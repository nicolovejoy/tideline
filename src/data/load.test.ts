import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { writeCache } from './cache.ts'
import {
  RETRY_AFTER,
  TIMEOUT,
  createLoader,
  fromCache,
  needsFetch,
  refresh,
} from './load.ts'
import type { Loaded, SourceSpec } from './load.ts'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
const NOW = Date.UTC(2026, 9, 8, 17)
const WINDOW = { start: Date.UTC(2026, 9, 8, 7), end: Date.UTC(2026, 9, 22, 7) }
const NOTHING: Loaded<number[]> = {
  data: null,
  fetchedAt: null,
  span: null,
  status: 'loading',
}

const isNumbers = (data: unknown): data is number[] =>
  Array.isArray(data) && data.every((n) => typeof n === 'number')

function spec(
  overrides: Partial<SourceSpec<number[]>> = {},
): SourceSpec<number[]> {
  return {
    spotId: 'campus-point',
    source: 'forecast',
    isData: isNumbers,
    needed: WINDOW,
    fetch: async () => [1, 2, 3],
    isEmpty: (data) => data.length === 0,
    ...overrides,
  }
}

beforeEach(() => {
  const items = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('fromCache', () => {
  test('with nothing saved there is nothing to show yet', () => {
    expect(fromCache(spec(), NOW)).toEqual(NOTHING)
  })

  test('a fresh saved entry is ready to show', () => {
    const entry = { fetchedAt: NOW - 10 * MINUTE, span: WINDOW, data: [7] }
    writeCache('campus-point', 'forecast', entry)
    expect(fromCache(spec(), NOW)).toEqual({ ...entry, status: 'ready' })
  })

  test('a stale saved entry is shown while a request is on its way', () => {
    const entry = { fetchedAt: NOW - 90 * MINUTE, span: WINDOW, data: [7] }
    writeCache('campus-point', 'forecast', entry)
    expect(fromCache(spec(), NOW)).toEqual({ ...entry, status: 'loading' })
  })

  test('a saved entry in the wrong shape counts as nothing saved', () => {
    writeCache('campus-point', 'forecast', {
      fetchedAt: NOW,
      span: WINDOW,
      data: 'not numbers',
    })
    expect(fromCache(spec(), NOW)).toEqual(NOTHING)
  })
})

describe('needsFetch', () => {
  const shown = (fetchedAt: number): Loaded<number[]> => ({
    data: [7],
    fetchedAt,
    span: WINDOW,
    status: 'ready',
  })

  test('nothing on screen always needs fetching', () => {
    expect(needsFetch(spec(), NOTHING, NOW)).toBe(true)
  })

  test('a forecast needs fetching again after an hour', () => {
    expect(needsFetch(spec(), shown(NOW - 59 * MINUTE), NOW)).toBe(false)
    expect(needsFetch(spec(), shown(NOW - 61 * MINUTE), NOW)).toBe(true)
  })

  test('predictions need fetching again only when the window moves', () => {
    const predictions = spec({ source: 'predictions' })
    expect(needsFetch(predictions, shown(NOW - 5 * DAY), NOW)).toBe(false)
    const tomorrow = { start: WINDOW.start + DAY, end: WINDOW.end + DAY }
    expect(
      needsFetch(
        spec({ source: 'predictions', needed: tomorrow }),
        shown(NOW),
        NOW,
      ),
    ).toBe(true)
  })
})

describe('refresh', () => {
  const clock = () => NOW

  test('a good answer is shown, stamped, and saved', async () => {
    const next = await refresh(spec(), NOTHING, clock)
    expect(next).toEqual({
      data: [1, 2, 3],
      fetchedAt: NOW,
      span: WINDOW,
      status: 'ready',
    })
    expect(fromCache(spec(), NOW)).toEqual(next)
  })

  test('the request is told which window is needed', async () => {
    const fetch = vi.fn(async () => [1])
    await refresh(spec({ fetch }), NOTHING, clock)
    expect(fetch).toHaveBeenCalledWith(WINDOW)
  })

  test('a failure keeps what was on screen and marks it stale', async () => {
    const before: Loaded<number[]> = {
      data: [7],
      fetchedAt: NOW - 90 * MINUTE,
      span: WINDOW,
      status: 'loading',
    }
    const failing = spec({
      fetch: async () => {
        throw new Error('NWS: HTTP 503')
      },
    })
    expect(await refresh(failing, before, clock)).toEqual({
      ...before,
      status: 'stale',
    })
  })

  test('a failure with nothing on screen is unavailable', async () => {
    const failing = spec({
      fetch: async () => {
        throw new Error('NWS: HTTP 503')
      },
    })
    expect(await refresh(failing, NOTHING, clock)).toEqual({
      ...NOTHING,
      status: 'unavailable',
    })
  })

  test('an empty answer is a failure and is never saved', async () => {
    const empty = spec({ fetch: async () => [] })
    expect((await refresh(empty, NOTHING, clock)).status).toBe('unavailable')
    expect(fromCache(spec(), NOW)).toEqual(NOTHING)
  })

  test('an empty answer is fine for a source that allows it', async () => {
    const allowed = spec({ fetch: async () => [], isEmpty: () => false })
    expect(await refresh(allowed, NOTHING, clock)).toEqual({
      data: [],
      fetchedAt: NOW,
      span: WINDOW,
      status: 'ready',
    })
  })

  test('with no storage at all, loading still works, just without saving', async () => {
    vi.unstubAllGlobals()
    expect(fromCache(spec(), NOW)).toEqual(NOTHING)
    const next = await refresh(spec(), NOTHING, clock)
    expect(next.status).toBe('ready')
    expect(next.data).toEqual([1, 2, 3])
  })
})

describe('a request that never answers', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('is given up on, so the source is not stuck waiting for ever', async () => {
    const hanging = spec({ fetch: () => new Promise<number[]>(() => {}) })
    const result = refresh(hanging, NOTHING, () => NOW)
    await vi.advanceTimersByTimeAsync(TIMEOUT)
    expect((await result).status).toBe('unavailable')
  })

  test('an answer that comes in time is not affected', async () => {
    const slow = spec({
      fetch: () =>
        new Promise<number[]>((resolve) =>
          setTimeout(() => resolve([5]), TIMEOUT - 1000),
        ),
    })
    const result = refresh(slow, NOTHING, () => NOW)
    await vi.advanceTimersByTimeAsync(TIMEOUT - 1000)
    expect((await result).data).toEqual([5])
  })
})

describe('createLoader', () => {
  // A clock the test moves by hand, and a way to let pending work finish.
  let time = NOW
  const clock = () => time
  const settle = () => vi.advanceTimersByTimeAsync(0)

  beforeEach(() => {
    time = NOW
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  test('starts with whatever is saved', () => {
    const entry = { fetchedAt: NOW - 10 * MINUTE, span: WINDOW, data: [7] }
    writeCache('campus-point', 'forecast', entry)
    const loader = createLoader(spec(), NOW, clock)
    expect(loader.current()).toEqual({ ...entry, status: 'ready' })
  })

  test('fetches when what is on screen is stale, and tells its listeners', async () => {
    const fetch = vi.fn(async () => [1, 2, 3])
    const loader = createLoader(spec({ fetch }), NOW, clock)
    const heard = vi.fn()
    loader.subscribe(heard)

    loader.check(spec({ fetch }), NOW)
    await settle()

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(loader.current().status).toBe('ready')
    expect(loader.current().data).toEqual([1, 2, 3])
    expect(heard).toHaveBeenCalledTimes(1)
  })

  test('does not fetch while what is on screen is fresh', async () => {
    const fetch = vi.fn(async () => [1, 2, 3])
    const loader = createLoader(spec({ fetch }), NOW, clock)
    loader.check(spec({ fetch }), NOW)
    await settle()

    time = NOW + 30 * MINUTE
    loader.check(spec({ fetch }), time)
    await settle()
    expect(fetch).toHaveBeenCalledTimes(1)

    time = NOW + 61 * MINUTE
    loader.check(spec({ fetch }), time)
    await settle()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  test('makes one request however often it is checked while waiting', async () => {
    let answer: (data: number[]) => void = () => {}
    const fetch = vi.fn(
      () => new Promise<number[]>((resolve) => (answer = resolve)),
    )
    const loader = createLoader(spec({ fetch }), NOW, clock)
    for (let i = 0; i < 5; i++) loader.check(spec({ fetch }), NOW)
    expect(fetch).toHaveBeenCalledTimes(1)

    answer([9])
    await settle()
    expect(loader.current().data).toEqual([9])
  })

  test('after a failure it leaves the source alone before trying again', async () => {
    const fetch = vi.fn(async (): Promise<number[]> => {
      throw new Error('NOAA: HTTP 503')
    })
    const loader = createLoader(spec({ fetch }), NOW, clock)
    loader.check(spec({ fetch }), NOW)
    await settle()
    expect(loader.current().status).toBe('unavailable')

    // Checked again at once, as a re-render would: no second request.
    for (let i = 0; i < 5; i++) loader.check(spec({ fetch }), time)
    time = NOW + RETRY_AFTER - 1000
    loader.check(spec({ fetch }), time)
    await settle()
    expect(fetch).toHaveBeenCalledTimes(1)

    time = NOW + RETRY_AFTER
    loader.check(spec({ fetch }), time)
    await settle()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  test('a failure after a success keeps the data and tries again later', async () => {
    let fail = false
    const fetch = vi.fn(async () => {
      if (fail) throw new Error('NOAA: HTTP 503')
      return [1]
    })
    const loader = createLoader(spec({ fetch }), NOW, clock)
    loader.check(spec({ fetch }), NOW)
    await settle()

    fail = true
    time = NOW + 61 * MINUTE
    loader.check(spec({ fetch }), time)
    await settle()
    expect(loader.current()).toMatchObject({ data: [1], status: 'stale' })

    fail = false
    time += RETRY_AFTER
    loader.check(spec({ fetch }), time)
    await settle()
    expect(loader.current()).toMatchObject({ data: [1], status: 'ready' })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  test('a request that never answers does not block later checks', async () => {
    const fetch = vi.fn(() => new Promise<number[]>(() => {}))
    const loader = createLoader(spec({ fetch }), NOW, clock)
    loader.check(spec({ fetch }), NOW)

    time = NOW + TIMEOUT
    await vi.advanceTimersByTimeAsync(TIMEOUT)
    expect(loader.current().status).toBe('unavailable')

    time += RETRY_AFTER
    loader.check(spec({ fetch }), time)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  test('a request that was given up on is tried again at the next minute, not the one after', async () => {
    const fetch = vi.fn(() => new Promise<number[]>(() => {}))
    const loader = createLoader(spec({ fetch }), NOW, clock)
    loader.check(spec({ fetch }), NOW)

    // The request is given up on 20 seconds in. The screen checks on the
    // minute, which is 40 seconds after that.
    time = NOW + TIMEOUT
    await vi.advanceTimersByTimeAsync(TIMEOUT)
    expect(loader.current().status).toBe('unavailable')

    time = NOW + MINUTE
    loader.check(spec({ fetch }), time)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  test('when the window moves, the next check fetches the new window', async () => {
    const fetch = vi.fn(async () => [1])
    const today = spec({ source: 'predictions', fetch })
    const loader = createLoader(today, NOW, clock)
    loader.check(today, NOW)
    await settle()

    const moved = { start: WINDOW.start + DAY, end: WINDOW.end + DAY }
    time = NOW + DAY
    loader.check(spec({ source: 'predictions', fetch, needed: moved }), time)
    await settle()
    expect(fetch).toHaveBeenLastCalledWith(moved)
    expect(loader.current().span).toEqual(moved)
  })

  test('a listener that has stopped listening hears nothing more', async () => {
    const loader = createLoader(spec(), NOW, clock)
    const heard = vi.fn()
    const stop = loader.subscribe(heard)
    stop()
    loader.check(spec(), NOW)
    await settle()
    expect(heard).not.toHaveBeenCalled()
  })
})
