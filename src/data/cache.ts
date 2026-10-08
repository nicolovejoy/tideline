// Saved data in the browser, so a repeat open can draw before any request
// returns. Every access is wrapped: with storage disabled the app still
// works, just without a cache.

export type Source = 'predictions' | 'hilo' | 'observed' | 'forecast'

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

const MINUTE = 60_000
const HOUR = 60 * MINUTE

// Bump the version when the shape of any saved data changes, so old entries
// are ignored instead of misread.
function storageKey(spotId: string, source: Source): string {
  return `tideline:v1:${spotId}:${source}`
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

export function writeCache<T>(
  spotId: string,
  source: Source,
  entry: CacheEntry<T>,
): void {
  try {
    localStorage.setItem(storageKey(spotId, source), JSON.stringify(entry))
  } catch {
    // Storage is full or disabled. Carry on without a cache.
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
  switch (source) {
    // Predictions for a date do not change, so they are good for as long as
    // they cover the window.
    case 'predictions':
    case 'hilo':
      return (
        !entry.span ||
        entry.span.start > needed.start ||
        entry.span.end < needed.end
      )
    case 'forecast':
      return now - entry.fetchedAt > HOUR
    case 'observed':
      return now - entry.fetchedAt > 6 * MINUTE
  }
}
