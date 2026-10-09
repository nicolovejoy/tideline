// Cache-first loading for one source: what to show before any request
// returns, when to fetch, and what to show afterwards. No React here.

import { isStale, readCache, writeCache } from './cache.ts'
import type { Source, Span } from './cache.ts'

/**
 * - loading: a request is on its way. `data` may hold saved data to draw
 *   in the meantime.
 * - ready: `data` is current.
 * - stale: the last request failed, and `data` is what was saved before it.
 * - unavailable: the last request failed and nothing is saved.
 */
export type Status = 'loading' | 'ready' | 'stale' | 'unavailable'

export interface Loaded<T> {
  data: T | null
  /** When `data` was fetched. Null when there is no data. */
  fetchedAt: number | null
  /** The window of time `data` was requested for. */
  span: Span | null
  status: Status
}

export interface SourceSpec<T> {
  spotId: string
  source: Source
  /** What this source's data looks like, for checking saved entries. */
  isData: (data: unknown) => data is T
  /** The window of time the screen needs from this source right now. */
  needed: Span
  fetch: (needed: Span) => Promise<T>
  /**
   * An answer that arrived but cannot be right, such as a tide curve with no
   * points. It is treated as a failed request and is never saved.
   */
  isEmpty: (data: T) => boolean
}

/** How long to wait for an answer before giving up on a request. */
export const TIMEOUT = 20_000
/** How long to leave a source alone after a check whose request failed. */
export const RETRY_AFTER = 55_000

const NOTHING = { data: null, fetchedAt: null, span: null } as const

/** What to show before any request returns: whatever is saved. */
export function fromCache<T>(spec: SourceSpec<T>, now: number): Loaded<T> {
  const entry = readCache(spec.spotId, spec.source, spec.isData)
  if (!entry) return { ...NOTHING, status: 'loading' }
  const stale = isStale(spec.source, entry, now, spec.needed)
  return { ...entry, status: stale ? 'loading' : 'ready' }
}

/** Whether what is on screen needs fetching again. */
export function needsFetch<T>(
  spec: SourceSpec<T>,
  loaded: Loaded<T>,
  now: number,
): boolean {
  if (loaded.fetchedAt === null) return true
  const entry = { fetchedAt: loaded.fetchedAt, span: loaded.span, data: null }
  return isStale(spec.source, entry, now, spec.needed)
}

/** The request's answer, or a rejection if none comes within TIMEOUT. */
function orGiveUp<T>(request: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no answer')), TIMEOUT)
    request.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/**
 * Fetch a source, save it, and say what to show. Never rejects, and always
 * settles: a failure, or no answer at all, keeps whatever was on screen.
 */
export async function refresh<T>(
  spec: SourceSpec<T>,
  previous: Loaded<T>,
  clock: () => number = Date.now,
): Promise<Loaded<T>> {
  try {
    const data = await orGiveUp(spec.fetch(spec.needed))
    if (spec.isEmpty(data)) throw new Error('empty answer')
    const entry = { fetchedAt: clock(), span: spec.needed, data }
    writeCache(spec.spotId, spec.source, entry)
    return { ...entry, status: 'ready' }
  } catch {
    if (previous.data === null) return { ...NOTHING, status: 'unavailable' }
    return { ...previous, status: 'stale' }
  }
}

export interface Loader<T> {
  /** What to show now. The same object until something changes. */
  current: () => Loaded<T>
  /**
   * Fetch if what is on screen needs it. Safe to call as often as you like:
   * it does nothing while a request is in flight, it fetches at most once
   * for one value of `now`, and after a failure it leaves the source alone
   * until RETRY_AFTER has passed since the check that made the failed request.
   */
  check: (spec: SourceSpec<T>, now: number) => void
  /** Calls `listener` whenever `current()` changes. Returns how to stop. */
  subscribe: (listener: () => void) => () => void
}

/**
 * One source's loading, over time. It starts from whatever is saved and
 * fetches when `check` finds that what is on screen has gone stale.
 */
export function createLoader<T>(
  initial: SourceSpec<T>,
  now: number,
  clock: () => number = Date.now,
): Loader<T> {
  let loaded = fromCache(initial, now)
  let busy = false
  let failedAt: number | null = null
  let answeredAt: number | null = null
  const listeners = new Set<() => void>()

  return {
    current: () => loaded,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    check(spec, now) {
      if (busy || !needsFetch(spec, loaded, now)) return
      if (failedAt !== null && now - failedAt < RETRY_AFTER) return
      // One answer is enough for one reading of the clock. The device's clock
      // can be changed while a request is out, and an answer stamped with the
      // new time can look stale against the old reading. Without this, every
      // draw until the next reading would fetch again.
      if (answeredAt === now) return
      busy = true
      void refresh(spec, loaded, clock).then((next) => {
        busy = false
        // Counted from the check that made the request, not from when the
        // request gave up. Checks come once a minute, so a request that took
        // 20 seconds to fail is still retried at the next one.
        failedAt = next.status === 'ready' ? null : now
        if (next.status === 'ready') answeredAt = now
        loaded = next
        for (const listener of listeners) listener()
      })
    },
  }
}
