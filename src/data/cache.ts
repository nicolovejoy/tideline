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

export function readCache<T>(
  spotId: string,
  source: Source,
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
      !('data' in entry)
    ) {
      return null
    }
    return entry as CacheEntry<T>
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
