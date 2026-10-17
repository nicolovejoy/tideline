import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  evictCache,
  forgetSpot,
  isStale,
  readCache,
  sweepOldVersions,
  writeCache,
} from './cache.ts'
import type { CacheEntry } from './cache.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const NOW = Date.UTC(2026, 9, 8, 17)
const WINDOW = { start: Date.UTC(2026, 9, 8, 7), end: Date.UTC(2026, 9, 22, 7) }
const KEY = 'tideline:v3:campus-point:forecast'

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
    key: (index: number) => [...items.keys()][index] ?? null,
    get length() {
      return items.size
    },
  }
}

/** A storage that holds `room` entries and throws on one more, as a full one does. */
function fullStorage(room: number, initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial))
  const storage: Storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (!items.has(key) && items.size >= room) {
        throw new DOMException('full', 'QuotaExceededError')
      }
      items.set(key, value)
    },
    removeItem: (key: string) => void items.delete(key),
    clear: () => items.clear(),
    key: (index: number) => [...items.keys()][index] ?? null,
    get length() {
      return items.size
    },
  }
  return { storage, items }
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

describe('a full storage', () => {
  const entry = { fetchedAt: NOW, span: null, data: 'x' }
  const elsewhere = {
    'tideline:v3:elsewhere:forecast': '{"fetchedAt":1,"span":null,"data":"e"}',
    'tideline:v3:elsewhere:hilo': '{"fetchedAt":1,"span":null,"data":"e"}',
  }
  const own = {
    'tideline:v3:campus-point:hilo': '{"fetchedAt":1,"span":null,"data":"o"}',
  }
  const choice = { 'tideline:spot': 'campus-point' }

  test("a write that fails for want of room evicts other spots' entries and goes in", () => {
    const { storage, items } = fullStorage(4, {
      ...elsewhere,
      ...own,
      ...choice,
    })
    vi.stubGlobal('localStorage', storage)
    writeCache('campus-point', 'forecast', entry)
    expect(readCache('campus-point', 'forecast', isText)?.data).toBe('x')
    // The spot's own entries and what is not cache stay.
    expect(readCache('campus-point', 'hilo', isText)?.data).toBe('o')
    expect(items.get('tideline:spot')).toBe('campus-point')
    expect(readCache('elsewhere', 'forecast', isText)).toBeNull()
  })

  test('a write that still fails after evicting does nothing', () => {
    const { storage } = fullStorage(1, choice)
    vi.stubGlobal('localStorage', storage)
    expect(() => writeCache('campus-point', 'forecast', entry)).not.toThrow()
    expect(readCache('campus-point', 'forecast', isText)).toBeNull()
  })

  test('evictCache drops every cache entry but the kept spot, and nothing else', () => {
    const { storage, items } = fullStorage(10, {
      ...elsewhere,
      ...own,
      ...choice,
    })
    vi.stubGlobal('localStorage', storage)
    evictCache('campus-point')
    expect([...items.keys()].sort()).toEqual([
      'tideline:spot',
      'tideline:v3:campus-point:hilo',
    ])
    evictCache()
    expect([...items.keys()]).toEqual(['tideline:spot'])
  })

  test('evictCache with storage disabled does not throw', () => {
    vi.stubGlobal('localStorage', brokenStorage())
    expect(() => evictCache()).not.toThrow()
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

  test("the gauge's own prediction is stale by coverage, like the spot's", () => {
    const covering = { fetchedAt: NOW - 30 * DAY, span: WINDOW, data: null }
    expect(isStale('gauge-predictions', covering, NOW, WINDOW)).toBe(false)
    const short = {
      fetchedAt: NOW,
      span: { start: WINDOW.start, end: WINDOW.end - HOUR },
      data: null,
    }
    expect(isStale('gauge-predictions', short, NOW, WINDOW)).toBe(true)
  })

  test('the forecast is stale after an hour', () => {
    expect(isStale('forecast', at(NOW - 59 * MINUTE), NOW, WINDOW)).toBe(false)
    expect(isStale('forecast', at(NOW - 61 * MINUTE), NOW, WINDOW)).toBe(true)
  })

  test('the observed level is stale after six minutes', () => {
    expect(isStale('observed', at(NOW - 5 * MINUTE), NOW, WINDOW)).toBe(false)
    expect(isStale('observed', at(NOW - 7 * MINUTE), NOW, WINDOW)).toBe(true)
  })

  test('the weather station chosen is good for 30 days', () => {
    const fresh = at(NOW - 29 * DAY)
    expect(isStale('weather-station', fresh, NOW, WINDOW)).toBe(false)
    const old = at(NOW - 31 * DAY)
    expect(isStale('weather-station', old, NOW, WINDOW)).toBe(true)
  })

  test('the hours observed go stale after 6 minutes, as the observed tide does', () => {
    const fresh = { ...at(NOW + 5 * MINUTE), span: WINDOW }
    const later = NOW + 10 * MINUTE
    expect(isStale('observed-weather', fresh, later, WINDOW)).toBe(false)
    const old = { ...at(NOW + 1 * MINUTE), span: WINDOW }
    expect(isStale('observed-weather', old, later, WINDOW)).toBe(true)
  })

  test('observed hours saved for another day are stale however young', () => {
    const yesterday = {
      fetchedAt: NOW + 1 * MINUTE,
      span: { start: WINDOW.start - DAY, end: WINDOW.end - DAY },
      data: null,
    }
    expect(isStale('observed-weather', yesterday, NOW, WINDOW)).toBe(true)
    const today = { ...yesterday, span: WINDOW }
    expect(isStale('observed-weather', today, NOW, WINDOW)).toBe(false)
    const noSpan = { ...yesterday, span: null }
    expect(isStale('observed-weather', noSpan, NOW, WINDOW)).toBe(true)
  })

  test('observed hours fetched in the previous hour are stale however young', () => {
    const now = NOW + 1 * MINUTE
    const entry = {
      fetchedAt: NOW - 2 * MINUTE,
      span: WINDOW,
      data: null,
    }
    // NOW is on the hour, so 2 minutes before is in the hour before.
    expect(isStale('observed-weather', entry, now, WINDOW)).toBe(true)
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

  test.each(['forecast', 'observed'] as const)(
    'a saved %s stamped well into the future is stale: the clock that stamped it was wrong',
    (source) => {
      expect(isStale(source, at(NOW + 6 * MINUTE), NOW, WINDOW)).toBe(true)
      expect(isStale(source, at(NOW + 3 * DAY), NOW, WINDOW)).toBe(true)
    },
  )

  test.each(['forecast', 'observed'] as const)(
    'a saved %s stamped a little ahead is fresh: the caller reads the clock up to a minute late',
    (source) => {
      expect(isStale(source, at(NOW + 90_000), NOW, WINDOW)).toBe(false)
      expect(isStale(source, at(NOW + 4 * MINUTE), NOW, WINDOW)).toBe(false)
    },
  )

  test.each(['predictions', 'hilo'] as const)(
    '%s do not go by their stamp at all, so one from the future changes nothing',
    (source) => {
      const entry = { fetchedAt: NOW + 3 * DAY, span: WINDOW, data: null }
      expect(isStale(source, entry, NOW, WINDOW)).toBe(false)
    },
  )
})

describe('forgetSpot', () => {
  afterEach(() => vi.unstubAllGlobals())
  test('removes the seven entries for that spot and no other', () => {
    const storage = fakeStorage({
      'tideline:v3:spot-abc:predictions': '1',
      'tideline:v3:spot-abc:hilo': '1',
      'tideline:v3:spot-abc:observed': '1',
      'tideline:v3:spot-abc:gauge-predictions': '1',
      'tideline:v3:spot-abc:forecast': '1',
      'tideline:v3:spot-abc:weather-station': '1',
      'tideline:v3:spot-abc:observed-weather': '1',
      'tideline:v3:campus-point:forecast': '1',
    })
    vi.stubGlobal('localStorage', storage)
    forgetSpot('spot-abc')
    expect(storage.length).toBe(1)
    expect(storage.getItem('tideline:v3:campus-point:forecast')).toBe('1')
  })
  test('does not throw with storage disabled', () => {
    vi.stubGlobal('localStorage', {
      removeItem: () => {
        throw new Error('disabled')
      },
    })
    expect(() => forgetSpot('spot-abc')).not.toThrow()
  })
})

describe('older versions', () => {
  test('evictCache drops an older version even for the spot kept', () => {
    const { items } = (() => {
      const f = fullStorage(99, {
        'tideline:v2:campus-point:forecast': '1',
        'tideline:v3:campus-point:forecast': '1',
        'tideline:v3:elsewhere:forecast': '1',
        'tideline:spots:v1': '1',
      })
      vi.stubGlobal('localStorage', f.storage)
      return f
    })()
    evictCache('campus-point')
    expect([...items.keys()].sort()).toEqual([
      'tideline:spots:v1',
      'tideline:v3:campus-point:forecast',
    ])
  })

  test('sweepOldVersions removes older versions and nothing else', () => {
    const f = fullStorage(99, {
      'tideline:v2:campus-point:forecast': '1',
      'tideline:v1:x:hilo': '1',
      'tideline:v3:campus-point:forecast': '1',
      'tideline:spots:v1': '1',
      'tideline:span': '1',
    })
    vi.stubGlobal('localStorage', f.storage)
    sweepOldVersions()
    expect([...f.items.keys()].sort()).toEqual([
      'tideline:span',
      'tideline:spots:v1',
      'tideline:v3:campus-point:forecast',
    ])
  })
})
