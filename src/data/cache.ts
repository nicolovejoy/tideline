// Saved data in the browser, so a repeat open can draw before any request
// returns. Every access is wrapped: with storage disabled the app still
// works, just without a cache.

import { DAY, HOUR, MINUTE } from '../time.ts'

export type Source =
  | 'predictions'
  | 'hilo'
  | 'observed'
  | 'gauge-predictions'
  | 'forecast'
  | 'weather-station'
  | 'observed-weather'

export interface Span {
  start: number
  end: number
}

export interface CacheEntry<T> {
  /** When the data was fetched, UTC instant in epoch ms. */
  fetchedAt: number
  /** The window the data was requested for; null for sources without one. */
  span: Span | null
  data: T
}

/**
 * How far ahead of the clock a stamp may be and still be believed. The
 * caller's reading of the clock can be a minute or so behind the one that
 * stamped the entry, and a request can take 20 seconds to answer.
 */
const AHEAD = 5 * MINUTE

// Bump the version when the shape or coverage of a saved entry changes, so
// saved entries from an older build are not reused. v2: the predicted curve
// includes its end instant.
const PREFIX = 'tideline:v2:'

function storageKey(spotId: string, source: Source): string {
  return `${PREFIX}${spotId}:${source}`
}

function isSpan(value: unknown): value is Span {
  return (
    typeof value === 'object' &&
    value !== null &&
    'start' in value &&
    typeof value.start === 'number' &&
    'end' in value &&
    typeof value.end === 'number'
  )
}

/**
 * The saved entry for a source, or null if there is none worth using.
 *
 * `isData` says what the caller's data looks like. An entry that fails it, or
 * whose envelope is malformed, is treated as nothing saved, so it is fetched
 * again. That is what stops a leftover from an older version of the app, or a
 * damaged entry, from breaking every open.
 */
export function readCache<T>(
  spotId: string,
  source: Source,
  isData: (data: unknown) => data is T,
): CacheEntry<T> | null {
  try {
    const text = localStorage.getItem(storageKey(spotId, source))
    if (text === null) return null
    const entry: unknown = JSON.parse(text)
    if (
      typeof entry !== 'object' ||
      entry === null ||
      !('fetchedAt' in entry) ||
      typeof entry.fetchedAt !== 'number' ||
      !('span' in entry) ||
      !(entry.span === null || isSpan(entry.span)) ||
      !('data' in entry) ||
      !isData(entry.data)
    ) {
      return null
    }
    return { fetchedAt: entry.fetchedAt, span: entry.span, data: entry.data }
  } catch {
    // Storage is disabled, or the entry is not valid JSON.
    return null
  }
}

/**
 * Saves the entry. Storage is shared by every spot ever viewed and a site
 * gets about 5 MB, so when a write fails the other spots' entries go to
 * make room, and the write is tried once more. If it still fails, storage
 * is disabled or too full even so: carry on without a cache.
 */
export function writeCache<T>(
  spotId: string,
  source: Source,
  entry: CacheEntry<T>,
): void {
  const key = storageKey(spotId, source)
  const text = JSON.stringify(entry)
  try {
    localStorage.setItem(key, text)
  } catch {
    evictCache(spotId)
    try {
      localStorage.setItem(key, text)
    } catch {
      // Storage is full or disabled. Carry on without a cache.
    }
  }
}

/**
 * Drops every cache entry, or every one but a spot's own. Nothing else in
 * storage is touched: the saved spots and the user's choices are small and
 * are not cache.
 */
export function evictCache(keepSpotId?: string): void {
  try {
    const keep = keepSpotId === undefined ? null : `${PREFIX}${keepSpotId}:`
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key === null || !key.startsWith(PREFIX)) continue
      if (keep !== null && key.startsWith(keep)) continue
      doomed.push(key)
    }
    for (const key of doomed) localStorage.removeItem(key)
  } catch {
    // Storage is disabled. There was nothing to drop.
  }
}

const SOURCES: Source[] = [
  'predictions',
  'hilo',
  'observed',
  'gauge-predictions',
  'forecast',
  'weather-station',
  'observed-weather',
]

/** Drop everything saved for a spot, when the spot itself goes. */
export function forgetSpot(spotId: string): void {
  for (const source of SOURCES) {
    try {
      localStorage.removeItem(storageKey(spotId, source))
    } catch {
      // Storage is disabled. There was nothing to drop.
    }
  }
}

/**
 * Whether a source needs fetching again. `needed` is the window of time the
 * screen needs right now.
 */
export function isStale(
  source: Source,
  entry: CacheEntry<unknown> | null,
  now: number,
  needed: Span,
): boolean {
  if (!entry) return true
  const age = now - entry.fetchedAt
  // A stamp from the future means the device's clock was ahead when it saved
  // and has been put right since, so there is no telling how old the data is.
  const fromTheFuture = age < -AHEAD
  switch (source) {
    // Predictions for a date do not change, so they are good for as long as
    // they cover the window.
    case 'predictions':
    case 'hilo':
    case 'gauge-predictions':
      return (
        !entry.span ||
        entry.span.start > needed.start ||
        entry.span.end < needed.end
      )
    case 'forecast':
      return age > HOUR || fromTheFuture
    // Stations are not built every week. The spot's own facts never change.
    case 'weather-station':
      return age > 30 * DAY || fromTheFuture
    case 'observed':
      return age > 6 * MINUTE || fromTheFuture
    // The rows are for one day, and are worked out once, at the fetch: an hour
    // that has ended since is drawn from its latest report, not the one
    // nearest its top, so they are stale at each hour's turn too.
    case 'observed-weather':
      return (
        age > 6 * MINUTE ||
        fromTheFuture ||
        !entry.span ||
        entry.span.start !== needed.start ||
        Math.floor(entry.fetchedAt / HOUR) !== Math.floor(now / HOUR)
      )
  }
}
