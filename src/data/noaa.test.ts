import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  fetchHiLo,
  fetchPredictions,
  fetchWaterLevel,
  noaaUrl,
  parseHiLo,
  parsePredictions,
  parseWaterLevel,
} from './noaa.ts'
import hiloRaw from './__fixtures__/noaa-hilo-20261008-20261022.json?raw'
import curveRaw from './__fixtures__/noaa-predictions-20261008-20261009.json?raw'
import observedRaw from './__fixtures__/noaa-water-level-20261008-20261009.json?raw'

const hilo: unknown = JSON.parse(hiloRaw)
const curve: unknown = JSON.parse(curveRaw)
const observed: unknown = JSON.parse(observedRaw)

const MINUTE = 60_000
// Local midnight at the spot on 8 and 9 October 2026 (Pacific daylight time).
const OCT_8 = Date.UTC(2026, 9, 8, 7)
const OCT_9 = Date.UTC(2026, 9, 9, 7)

afterEach(() => vi.unstubAllGlobals())

describe('noaaUrl', () => {
  test('covers the UTC dates the window touches', () => {
    // A 14-day local window touches 15 UTC dates.
    expect(
      noaaUrl(
        '9411340',
        'predictions',
        OCT_8,
        Date.UTC(2026, 9, 22, 7),
        'hilo',
      ),
    ).toBe(
      'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter' +
        '?product=predictions&interval=hilo' +
        '&begin_date=20261008&end_date=20261022' +
        '&station=9411340&datum=MLLW&units=english&time_zone=gmt' +
        '&format=json&application=tideline',
    )
  })

  test('a window ending exactly at UTC midnight does not ask for the next date', () => {
    const url = noaaUrl(
      '9411340',
      'water_level',
      Date.UTC(2026, 9, 8),
      Date.UTC(2026, 9, 9),
    )
    expect(url).toContain('begin_date=20261008&end_date=20261008')
    expect(url).not.toContain('interval=')
  })
})

describe('parseHiLo', () => {
  test('reads NOAA highs and lows as UTC instants', () => {
    const events = parseHiLo(hilo)
    expect(events).toHaveLength(54)
    expect(events[0]).toEqual({
      t: Date.UTC(2026, 9, 8, 3, 9),
      ft: 5.449,
      type: 'H',
    })
    expect(events[1]).toEqual({
      t: Date.UTC(2026, 9, 8, 9, 35),
      ft: 0.189,
      type: 'L',
    })
    expect(events.at(-1)).toEqual({
      t: Date.UTC(2026, 9, 22, 21, 0),
      ft: 1.49,
      type: 'L',
    })
  })
})

describe('parsePredictions', () => {
  test('reads the curve at 6-minute spacing', () => {
    const points = parsePredictions(curve)
    expect(points).toHaveLength(480)
    expect(points[0]).toEqual({ t: Date.UTC(2026, 9, 8, 0, 0), ft: 3.149 })
    expect(points.at(-1)).toEqual({
      t: Date.UTC(2026, 9, 9, 23, 54),
      ft: 0.852,
    })
    for (let i = 1; i < points.length; i++) {
      expect(points[i].t - points[i - 1].t).toBe(6 * MINUTE)
    }
  })

  test('NOAA reporting a problem with HTTP 200 is an error, not an empty curve', () => {
    const body = {
      error: { message: ' No Predictions data was found. ' },
    }
    expect(() => parsePredictions(body)).toThrow(
      'NOAA: No Predictions data was found.',
    )
  })

  test('a body that is not an object is an error', () => {
    expect(() => parsePredictions(null)).toThrow(
      'NOAA: response is not an object',
    )
    expect(() => parsePredictions('oops')).toThrow(
      'NOAA: response is not an object',
    )
  })

  test('a body without the expected list is an error', () => {
    expect(() => parsePredictions({ data: [] })).toThrow(
      'NOAA: response has no predictions',
    )
  })
})

describe('parseWaterLevel', () => {
  test('reads observed readings', () => {
    const reading = parseWaterLevel(observed).find(
      (p) => p.t === Date.UTC(2026, 9, 8, 17, 6),
    )
    // 10:06 AM Pacific. Preliminary data can be revised slightly.
    expect(reading?.ft).toBeCloseTo(6.119, 1)
  })

  test('drops rows with an empty value, which is how a gauge outage appears', () => {
    const body = {
      data: [
        { t: '2026-10-08 00:00', v: '4.275' },
        { t: '2026-10-08 00:06', v: '' },
        { t: '2026-10-08 00:12', v: '4.301' },
      ],
    }
    expect(parseWaterLevel(body)).toEqual([
      { t: Date.UTC(2026, 9, 8, 0, 0), ft: 4.275 },
      { t: Date.UTC(2026, 9, 8, 0, 12), ft: 4.301 },
    ])
  })

  test('the morning of 8 October 2026 ran about 1.1 ft above the prediction', () => {
    const predicted = new Map(parsePredictions(curve).map((p) => [p.t, p.ft]))
    const from = Date.UTC(2026, 9, 8, 14, 0) // 7:00 AM Pacific
    const to = Date.UTC(2026, 9, 8, 17, 6) // 10:06 AM Pacific
    const deviations = parseWaterLevel(observed)
      .filter((p) => p.t >= from && p.t <= to)
      .map((p) => p.ft - predicted.get(p.t)!)
    const mean = deviations.reduce((sum, d) => sum + d, 0) / deviations.length
    expect(deviations.length).toBeGreaterThanOrEqual(30)
    expect(mean).toBeGreaterThan(0.9)
    expect(mean).toBeLessThan(1.4)
  })
})

describe('fetching', () => {
  test('fetchPredictions asks for the covering UTC dates and trims to the window', async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response(curveRaw))
    vi.stubGlobal('fetch', fetchMock)

    const points = await fetchPredictions('9411340', OCT_8, OCT_9)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = fetchMock.mock.calls[0][0]
    expect(url).toContain('product=predictions&interval=6')
    expect(url).toContain('begin_date=20261008&end_date=20261009')
    expect(points).toHaveLength(240)
    expect(points[0].t).toBe(OCT_8)
    expect(points.at(-1)!.t).toBe(OCT_9 - 6 * MINUTE)
  })

  test('fetchHiLo trims to the window', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string) => new Response(hiloRaw)),
    )
    const events = await fetchHiLo('9411340', OCT_8, OCT_9)
    // Local 8 October: low 2:35 AM, high 8:52 AM, low 2:58 PM, high 8:58 PM.
    expect(events.map((e) => e.type)).toEqual(['L', 'H', 'L', 'H'])
    expect(events[0]).toEqual({
      t: Date.UTC(2026, 9, 8, 9, 35),
      ft: 0.189,
      type: 'L',
    })
  })

  test('fetchWaterLevel trims to the window', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string) => new Response(observedRaw)),
    )
    const points = await fetchWaterLevel('9411340', OCT_8, OCT_9)
    expect(points.length).toBeGreaterThan(0)
    expect(points.every((p) => p.t >= OCT_8 && p.t < OCT_9)).toBe(true)
  })

  test('an HTTP failure is an error that names the status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string) => new Response('down', { status: 503 })),
    )
    await expect(fetchPredictions('9411340', OCT_8, OCT_9)).rejects.toThrow(
      'NOAA: HTTP 503',
    )
  })
})
