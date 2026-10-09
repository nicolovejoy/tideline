import { afterEach, describe, expect, test, vi } from 'vitest'
import { frameFor, tideSpecs } from './useSpotData.ts'
import { CAMPUS_POINT } from '../spot.ts'

const HOUR = 3_600_000

describe('frameFor', () => {
  test('today, the 14-day window, and one sun-and-moon entry per day', () => {
    const frame = frameFor(CAMPUS_POINT, '2026-10-08')
    expect(frame.day).toEqual({
      start: Date.UTC(2026, 9, 8, 7),
      end: Date.UTC(2026, 9, 9, 7),
    })
    expect(frame.window).toEqual({
      start: Date.UTC(2026, 9, 8, 7),
      end: Date.UTC(2026, 9, 22, 7),
    })
    expect(frame.days).toHaveLength(14)
    expect(frame.days[0].date).toBe('2026-10-08')
    expect(frame.days[13].date).toBe('2026-10-21')
  })

  test('the day after is a different frame, which is what moves a phone left open past midnight on to the new day', () => {
    const before = frameFor(CAMPUS_POINT, '2026-10-08')
    const after = frameFor(CAMPUS_POINT, '2026-10-09')
    expect(after.day.start).toBe(before.day.end)
    expect(after.window.end).toBeGreaterThan(before.window.end)
    expect(after.days[0].date).toBe('2026-10-09')
  })

  test('on the day the clocks go back, today is 25 hours long', () => {
    const frame = frameFor(CAMPUS_POINT, '2026-11-01')
    expect((frame.day.end - frame.day.start) / HOUR).toBe(25)
  })

  test('a window that spans the clock change still ends on a local midnight', () => {
    // 14 days from 25 October ends on 8 November, which is in standard time.
    const frame = frameFor(CAMPUS_POINT, '2026-10-25')
    expect(frame.window.end).toBe(Date.UTC(2026, 10, 8, 8))
  })
})

describe('tideSpecs', () => {
  const frame = frameFor(CAMPUS_POINT, '2026-10-08')
  const specs = tideSpecs(CAMPUS_POINT, frame)

  afterEach(() => vi.unstubAllGlobals())

  test('predictions and highs and lows are needed for all 14 days', () => {
    expect(specs.predictions.needed).toEqual(frame.window)
    expect(specs.hilo.needed).toEqual(frame.window)
  })

  test('readings are needed for today only', () => {
    expect(specs.observed.needed).toEqual(frame.day)
  })

  test('an empty curve or table is a failure, but a day with no readings yet is not', () => {
    expect(specs.predictions.isEmpty([])).toBe(true)
    expect(specs.hilo.isEmpty([])).toBe(true)
    expect(specs.observed.isEmpty([])).toBe(false)
  })

  test("each source asks NOAA for its own product at the spot's station", async () => {
    const fetchMock = vi.fn(
      async (_url: string) => new Response('{"predictions":[],"data":[]}'),
    )
    vi.stubGlobal('fetch', fetchMock)

    await specs.predictions.fetch(frame.day)
    await specs.hilo.fetch(frame.day)
    await specs.observed.fetch(frame.day)

    const urls = fetchMock.mock.calls.map((call) => call[0])
    expect(urls[0]).toContain('product=predictions&interval=6&')
    expect(urls[1]).toContain('product=predictions&interval=hilo&')
    expect(urls[2]).toContain('product=water_level&')
    for (const url of urls) {
      expect(url).toContain('station=9411340')
      expect(url).toContain('begin_date=20261008&end_date=20261009')
    }
  })
})
