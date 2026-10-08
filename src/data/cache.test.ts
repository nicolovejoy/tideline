import { afterEach, describe, expect, test, vi } from 'vitest'
import { isStale, readCache, writeCache } from './cache.ts'
import type { CacheEntry } from './cache.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const NOW = Date.UTC(2026, 9, 8, 17)
const WINDOW = { start: Date.UTC(2026, 9, 8, 7), end: Date.UTC(2026, 9, 22, 7) }
const KEY = 'tideline:v1:campus-point:forecast'

// The checks a caller hands to readCache to say what its data looks like.
const isNumbers = (data: unknown): data is number[] =>
  Array.isArray(data) && data.every((n) => typeof n === 'number')
const isText = (data: unknown): data is string => typeof data === 'string'
const anything = (_data: unknown): _data is unknown => true

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const items = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    clear: () => items.clear(),
    key: () => null,
    get length() {
      return items.size
    },
  }
}

function brokenStorage(): Storage {
  const fail = () => {
    throw new Error('storage is disabled')
  }
  return {
    getItem: fail,
    setItem: fail,
    removeItem: fail,
    clear: fail,
    key: fail,
    length: 0,
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('readCache and writeCache', () => {
  test('what is written can be read back', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    const entry: CacheEntry<number[]> = {
      fetchedAt: NOW,
      span: WINDOW,
      data: [1, 2, 3],
    }
    writeCache('campus-point', 'predictions', entry)
    expect(readCache('campus-point', 'predictions', isNumbers)).toEqual(entry)
  })

  test('sources and spots do not overwrite each other', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    writeCache('campus-point', 'forecast', {
      fetchedAt: NOW,
      span: null,
      data: 'a',
    })
    writeCache('campus-point', 'observed', {
      fetchedAt: NOW,
      span: null,
      data: 'b',
    })
    writeCache('elsewhere', 'forecast', {
      fetchedAt: NOW,
      span: null,
      data: 'c',
    })
    expect(readCache('campus-point', 'forecast', isText)?.data).toBe('a')
    expect(readCache('campus-point', 'observed', isText)?.data).toBe('b')
    expect(readCache('elsewhere', 'forecast', isText)?.data).toBe('c')
  })

  test('nothing saved reads as null', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    expect(readCache('campus-point', 'forecast', anything)).toBeNull()
  })

  test('a corrupt entry reads as null', () => {
    vi.stubGlobal('localStorage', fakeStorage({ [KEY]: '{not json' }))
    expect(readCache('campus-point', 'forecast', anything)).toBeNull()
  })

  test.each([
    '{"foo":1}',
    '{"fetchedAt":"yesterday","span":null,"data":1}',
    '5',
    'null',
    '"text"',
    // No span, or no data.
    '{"fetchedAt":1,"data":[]}',
    '{"fetchedAt":1,"span":null}',
    // A span that is not a pair of instants. Accepted as it stood, this one
    // made predictions look fresh for ever, so they were never fetched again.
    '{"fetchedAt":1,"span":"oops","data":[]}',
    '{"fetchedAt":1,"span":{},"data":[]}',
    '{"fetchedAt":1,"span":{"start":"a","end":2},"data":[]}',
  ])('an entry with the wrong shape reads as null: %s', (saved) => {
    vi.stubGlobal('localStorage', fakeStorage({ [KEY]: saved }))
    expect(readCache('campus-point', 'forecast', anything)).toBeNull()
  })

  test("data that fails the caller's check reads as null", () => {
    // What an entry saved by an older version of the app would look like.
    vi.stubGlobal(
      'localStorage',
      fakeStorage({
        [KEY]: '{"fetchedAt":1,"span":null,"data":[{"time":1,"feet":2}]}',
      }),
    )
    expect(readCache('campus-point', 'forecast', isNumbers)).toBeNull()
    // The same entry is fine for a caller that accepts it.
    expect(readCache('campus-point', 'forecast', anything)).not.toBeNull()
  })

  test('with storage disabled, reading gives null and writing does nothing', () => {
    vi.stubGlobal('localStorage', brokenStorage())
    expect(readCache('campus-point', 'forecast', anything)).toBeNull()
    expect(() =>
      writeCache('campus-point', 'forecast', {
        fetchedAt: NOW,
        span: null,
        data: 1,
      }),
    ).not.toThrow()
  })

  test('with no localStorage at all, reading gives null and writing does nothing', () => {
    // The test environment has no localStorage unless one is stubbed.
    expect(readCache('campus-point', 'forecast', anything)).toBeNull()
    expect(() =>
      writeCache('campus-point', 'forecast', {
        fetchedAt: NOW,
        span: null,
        data: 1,
      }),
    ).not.toThrow()
  })
})

describe('isStale', () => {
  const at = (fetchedAt: number): CacheEntry<unknown> => ({
    fetchedAt,
    span: null,
    data: null,
  })

  test('nothing saved is always stale', () => {
    expect(isStale('forecast', null, NOW, WINDOW)).toBe(true)
    expect(isStale('predictions', null, NOW, WINDOW)).toBe(true)
  })

  test('the forecast is stale after an hour', () => {
    expect(isStale('forecast', at(NOW - 59 * MINUTE), NOW, WINDOW)).toBe(false)
    expect(isStale('forecast', at(NOW - 61 * MINUTE), NOW, WINDOW)).toBe(true)
  })

  test('the observed level is stale after six minutes', () => {
    expect(isStale('observed', at(NOW - 5 * MINUTE), NOW, WINDOW)).toBe(false)
    expect(isStale('observed', at(NOW - 7 * MINUTE), NOW, WINDOW)).toBe(true)
  })

  test.each(['predictions', 'hilo'] as const)(
    '%s stay fresh while they cover the window, however old',
    (source) => {
      const entry = { fetchedAt: NOW - 5 * DAY, span: WINDOW, data: null }
      expect(isStale(source, entry, NOW, WINDOW)).toBe(false)
    },
  )

  test.each(['predictions', 'hilo'] as const)(
    '%s are stale once the window moves past what was fetched',
    (source) => {
      const entry = { fetchedAt: NOW, span: WINDOW, data: null }
      const tomorrow = { start: WINDOW.start + DAY, end: WINDOW.end + DAY }
      expect(isStale(source, entry, NOW, tomorrow)).toBe(true)
    },
  )

  test('predictions saved without a span are stale', () => {
    expect(isStale('predictions', at(NOW), NOW, WINDOW)).toBe(true)
  })
})
