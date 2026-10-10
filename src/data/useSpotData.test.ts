import { afterEach, describe, expect, test, vi } from 'vitest'
import { forecastSpec, frameFor, tideSpecs } from './useSpotData.ts'
import { CAMPUS_POINT, hasOwnCurve, spotById } from '../spot.ts'

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

  test('each of the 14 days has its own span, end to end with no gaps', () => {
    const frame = frameFor(CAMPUS_POINT, '2026-10-08')
    expect(frame.spans).toHaveLength(14)
    expect(frame.spans[0]).toEqual(frame.day)
    expect(frame.spans[3]).toEqual({
      start: Date.UTC(2026, 9, 11, 7),
      end: Date.UTC(2026, 9, 12, 7),
    })
    for (let i = 1; i < 14; i++) {
      expect(frame.spans[i].start).toBe(frame.spans[i - 1].end)
    }
    expect(frame.spans[13].end).toBe(frame.window.end)
  })

  test('the span of the day the clocks go back is 25 hours, wherever it falls in the 14', () => {
    // 1 November 2026 is the eighth day from 25 October.
    const frame = frameFor(CAMPUS_POINT, '2026-10-25')
    const hours = frame.spans.map((span) => (span.end - span.start) / HOUR)
    expect(hours[7]).toBe(25)
    expect(hours.filter((length) => length === 24)).toHaveLength(13)
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

  test('the highs and lows run to the end of the third month after this one', () => {
    // From 8 October 2026: October, November, December, January. February
    // starts at 08:00 UTC, in standard time.
    const frame = frameFor(CAMPUS_POINT, '2026-10-08')
    expect(frame.ahead).toEqual({
      start: Date.UTC(2026, 9, 8, 7),
      end: Date.UTC(2027, 1, 1, 8),
    })
  })

  test('the span ahead crosses the end of the year', () => {
    const frame = frameFor(CAMPUS_POINT, '2026-11-15')
    expect(frame.ahead.start).toBe(Date.UTC(2026, 10, 15, 8))
    expect(frame.ahead.end).toBe(Date.UTC(2027, 2, 1, 8))
  })

  test('the highs and lows span starts the day before today and ends with the months ahead', () => {
    const frame = frameFor(CAMPUS_POINT, '2026-10-08')
    expect(frame.hiloSpan).toEqual({
      start: Date.UTC(2026, 9, 7, 7),
      end: frame.ahead.end,
    })
    expect(frame.ahead.start).toBe(frame.day.start)
  })

  test("the day before is the spot's local day, 25 hours long when the clocks went back in it", () => {
    // 1 November 2026 is the 25-hour day; 2 November is the day after.
    const frame = frameFor(CAMPUS_POINT, '2026-11-02')
    expect((frame.day.start - frame.hiloSpan.start) / HOUR).toBe(25)
  })
})

describe('tideSpecs', () => {
  const frame = frameFor(CAMPUS_POINT, '2026-10-08')
  const specs = tideSpecs(CAMPUS_POINT, frame)

  afterEach(() => vi.unstubAllGlobals())

  test('predictions are needed for the 14 days, and highs and lows from the day before to the months ahead', () => {
    expect(specs.predictions.needed).toEqual(frame.window)
    expect(specs.hilo.needed).toEqual(frame.hiloSpan)
  })

  test('the highs and lows are one request, from the day before to the last day of the last month', async () => {
    const fetchMock = vi.fn(
      async (_url: string) => new Response('{"predictions":[]}'),
    )
    vi.stubGlobal('fetch', fetchMock)
    await specs.hilo.fetch(frame.hiloSpan)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // The end date is the UTC date holding the span's last instant: local
    // midnight on 1 February is 08:00 UTC that day.
    expect(fetchMock.mock.calls[0][0]).toContain(
      'begin_date=20261007&end_date=20270201',
    )
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

  test("the gauge's own prediction is for today, at the gauge, and is saved as its own source", () => {
    expect(specs.gaugePredictions.needed).toEqual(frame.day)
    expect(specs.gaugePredictions.source).toBe('gauge-predictions')
    expect(specs.gaugePredictions.spotId).toBe('campus-point')
    expect(specs.gaugePredictions.isEmpty([])).toBe(true)
  })

  test('where the gauge is another station, readings and its prediction come from there', async () => {
    const gaviota = spotById('gaviota')
    const theirs = tideSpecs(gaviota, frameFor(gaviota, '2026-10-09'))
    const fetchMock = vi.fn(
      async (_url: string) => new Response('{"predictions":[],"data":[]}'),
    )
    vi.stubGlobal('fetch', fetchMock)

    await theirs.predictions.fetch(frame.day)
    await theirs.hilo.fetch(frame.day)
    await theirs.observed.fetch(frame.day)
    await theirs.gaugePredictions.fetch(frame.day)

    const urls = fetchMock.mock.calls.map((call) => call[0])
    expect(urls[0]).toContain('station=9411399')
    expect(urls[1]).toContain('station=9411399')
    expect(urls[2]).toContain('product=water_level&')
    expect(urls[2]).toContain('station=9411340')
    expect(urls[3]).toContain('product=predictions&interval=6&')
    expect(urls[3]).toContain('station=9411340')
  })
})

describe('a spot at a subordinate station', () => {
  const gaviota = spotById('gaviota')
  const ventura = {
    ...gaviota,
    id: 'ventura-test',
    tideStation: {
      id: '9411189',
      name: 'Ventura',
      distanceMi: 33,
      direction: 'east',
      type: 'subordinate' as const,
    },
  }

  test('its tide specs still name its own station for the highs and lows', () => {
    const specs = tideSpecs(ventura, frameFor(ventura, '2026-10-10'))
    expect(specs.hilo.spotId).toBe('ventura-test')
    expect(specs.predictions.spotId).toBe('ventura-test')
    expect(hasOwnCurve(ventura)).toBe(false)
  })
})

describe('forecastSpec', () => {
  const frame = frameFor(CAMPUS_POINT, '2026-10-08')
  const spec = forecastSpec(CAMPUS_POINT, frame)

  afterEach(() => vi.unstubAllGlobals())

  test("asks NWS for the spot's own forecast cell", async () => {
    const body = JSON.stringify({
      properties: { updateTime: '2026-10-08T14:26:58+00:00' },
    })
    const fetchMock = vi.fn(async (_url: string) => new Response(body))
    vi.stubGlobal('fetch', fetchMock)

    const forecast = await spec.fetch(frame.window)

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.weather.gov/gridpoints/LOX/100,71',
    )
    expect(forecast.updatedAt).toBe(Date.UTC(2026, 9, 8, 14, 26, 58))
  })

  test('is saved and checked as the forecast', () => {
    expect(spec.source).toBe('forecast')
    expect(spec.spotId).toBe('campus-point')
    expect(spec.isData({ updatedAt: 1, hours: [] })).toBe(true)
    expect(spec.isData([{ t: 1, ft: 3 }])).toBe(false)
  })

  test('a forecast with no hours in it is a failure, so it is never saved', () => {
    expect(spec.isEmpty({ updatedAt: 1, hours: [] })).toBe(true)
    const hour = {
      t: 1,
      tempF: 68,
      windMph: 10,
      gustMph: 12,
      windDeg: 260,
      cloudPct: 3,
      rainPct: 0,
    }
    expect(spec.isEmpty({ updatedAt: 1, hours: [hour] })).toBe(false)
  })
})
