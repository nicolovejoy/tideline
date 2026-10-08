import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  compassPoint,
  fetchForecast,
  nwsUrl,
  parseDurationHours,
  parseGridpoint,
} from './nws.ts'
import realRaw from './__fixtures__/nws-gridpoint-LOX-100-71.json?raw'

const HOUR = 3_600_000
const EIGHT = Date.UTC(2026, 9, 8, 8)

function sample() {
  return {
    properties: {
      updateTime: '2026-10-08T14:26:58+00:00',
      temperature: {
        uom: 'wmoUnit:degC',
        values: [
          { validTime: '2026-10-08T08:00:00+00:00/PT2H', value: 20 },
          { validTime: '2026-10-08T10:00:00+00:00/PT1H', value: 25 },
        ],
      },
      windSpeed: {
        uom: 'wmoUnit:km_h-1',
        values: [
          { validTime: '2026-10-08T08:00:00+00:00/PT3H', value: 16.0934 },
        ],
      },
      windGust: {
        uom: 'wmoUnit:km_h-1',
        values: [
          { validTime: '2026-10-08T08:00:00+00:00/PT1H', value: 32.1868 },
        ],
      },
      windDirection: {
        uom: 'wmoUnit:degree_(angle)',
        values: [{ validTime: '2026-10-08T08:00:00+00:00/PT3H', value: 260 }],
      },
      skyCover: {
        uom: 'wmoUnit:percent',
        values: [{ validTime: '2026-10-08T08:00:00+00:00/PT3H', value: 3 }],
      },
      probabilityOfPrecipitation: {
        uom: 'wmoUnit:percent',
        values: [{ validTime: '2026-10-08T08:00:00+00:00/PT3H', value: null }],
      },
    } as Record<string, unknown>,
  }
}

afterEach(() => vi.unstubAllGlobals())

test('nwsUrl points at the raw grid endpoint', () => {
  expect(nwsUrl('LOX', 100, 71)).toBe(
    'https://api.weather.gov/gridpoints/LOX/100,71',
  )
})

describe('parseDurationHours', () => {
  test('hours, days, and both', () => {
    expect(parseDurationHours('PT1H')).toBe(1)
    expect(parseDurationHours('PT12H')).toBe(12)
    expect(parseDurationHours('P1D')).toBe(24)
    expect(parseDurationHours('P2DT4H')).toBe(52)
  })

  test('anything else is an error, not a guess', () => {
    expect(() => parseDurationHours('PT30M')).toThrow(
      'NWS: unsupported duration PT30M',
    )
    expect(() => parseDurationHours('P')).toThrow('NWS: unsupported duration P')
  })
})

describe('parseGridpoint', () => {
  test('expands multi-hour intervals into one record per hour', () => {
    const { hours } = parseGridpoint(sample())
    expect(hours.map((h) => h.t)).toEqual([
      EIGHT,
      EIGHT + HOUR,
      EIGHT + 2 * HOUR,
    ])
  })

  test('converts to °F and mph and keeps percent and degrees', () => {
    const { hours, updatedAt } = parseGridpoint(sample())
    expect(updatedAt).toBe(Date.UTC(2026, 9, 8, 14, 26, 58))
    expect(hours[0].tempF).toBeCloseTo(68, 5)
    expect(hours[0].windMph).toBeCloseTo(10, 3)
    expect(hours[0].gustMph).toBeCloseTo(20, 3)
    expect(hours[0].windDeg).toBe(260)
    expect(hours[0].cloudPct).toBe(3)
    expect(hours[1].tempF).toBeCloseTo(68, 5)
    expect(hours[2].tempF).toBeCloseTo(77, 5)
  })

  test('an hour a layer does not cover is null for that field', () => {
    const { hours } = parseGridpoint(sample())
    // Gusts were given for the first hour only.
    expect(hours[1].gustMph).toBeNull()
    expect(hours[2].gustMph).toBeNull()
  })

  test('a null value in a layer is null, never NaN', () => {
    const { hours } = parseGridpoint(sample())
    expect(hours.map((h) => h.rainPct)).toEqual([null, null, null])
  })

  test('a layer missing altogether leaves its field null and the rest intact', () => {
    const body = sample()
    delete body.properties.skyCover
    const { hours } = parseGridpoint(body)
    expect(hours.map((h) => h.cloudPct)).toEqual([null, null, null])
    expect(hours[0].tempF).toBeCloseTo(68, 5)
  })

  test('a layer in an unexpected unit is an error, not a wrong number', () => {
    const body = sample()
    body.properties.temperature = {
      uom: 'wmoUnit:degF',
      values: [{ validTime: '2026-10-08T08:00:00+00:00/PT1H', value: 68 }],
    }
    expect(() => parseGridpoint(body)).toThrow(
      'NWS: temperature is in wmoUnit:degF, expected wmoUnit:degC',
    )
  })

  test('a body without properties or an update time is an error', () => {
    expect(() => parseGridpoint(null)).toThrow(
      'NWS: response has no properties',
    )
    expect(() => parseGridpoint({ properties: {} })).toThrow(
      'NWS: response has no updateTime',
    )
  })

  test('a real response parses into consecutive hours with plausible values', () => {
    const forecast = parseGridpoint(JSON.parse(realRaw))
    expect(Number.isFinite(forecast.updatedAt)).toBe(true)
    // The forecast runs about 7 days 17 hours.
    expect(forecast.hours.length).toBeGreaterThan(150)
    for (let i = 1; i < forecast.hours.length; i++) {
      expect(forecast.hours[i].t - forecast.hours[i - 1].t).toBe(HOUR)
    }
    const temps = forecast.hours
      .map((h) => h.tempF)
      .filter((v): v is number => v !== null)
    expect(temps.length).toBeGreaterThan(150)
    expect(Math.min(...temps)).toBeGreaterThan(20)
    expect(Math.max(...temps)).toBeLessThan(120)
    const gusts = forecast.hours
      .map((h) => h.gustMph)
      .filter((v): v is number => v !== null)
    expect(gusts.length).toBeGreaterThan(150)
    expect(Math.min(...gusts)).toBeGreaterThanOrEqual(0)
  })
})

describe('parseGridpoint with gaps in the data', () => {
  test('a layer that arrives empty leaves its field null and the rest intact', () => {
    const body = sample()
    // NWS sends layers it has no data for in exactly this shape: no unit.
    body.properties.windGust = { values: [] }
    const { hours } = parseGridpoint(body)
    expect(hours.map((h) => h.gustMph)).toEqual([null, null, null])
    expect(hours[0].tempF).toBeCloseTo(68, 5)
  })

  test('a null in a layer that gets converted stays null, not a converted zero', () => {
    const body = sample()
    body.properties.temperature = {
      uom: 'wmoUnit:degC',
      values: [{ validTime: '2026-10-08T08:00:00+00:00/PT3H', value: null }],
    }
    body.properties.windSpeed = {
      uom: 'wmoUnit:km_h-1',
      values: [{ validTime: '2026-10-08T08:00:00+00:00/PT3H', value: null }],
    }
    const { hours } = parseGridpoint(body)
    expect(hours.map((h) => h.tempF)).toEqual([null, null, null])
    expect(hours.map((h) => h.windMph)).toEqual([null, null, null])
  })

  test('an entry with no value at all is null, never NaN', () => {
    const body = sample()
    body.properties.temperature = {
      uom: 'wmoUnit:degC',
      values: [{ validTime: '2026-10-08T08:00:00+00:00/PT3H' }],
    }
    const { hours } = parseGridpoint(body)
    expect(hours.map((h) => h.tempF)).toEqual([null, null, null])
  })
})

describe('fetchForecast', () => {
  test('requests the cell and parses the body', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify(sample())),
    )
    vi.stubGlobal('fetch', fetchMock)
    const forecast = await fetchForecast('LOX', 100, 71)
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.weather.gov/gridpoints/LOX/100,71',
    )
    expect(forecast.hours).toHaveLength(3)
  })

  test('an HTTP failure is an error that names the status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string) => new Response('down', { status: 503 })),
    )
    await expect(fetchForecast('LOX', 100, 71)).rejects.toThrow('NWS: HTTP 503')
  })
})

describe('compassPoint', () => {
  test('the cardinal and intermediate points', () => {
    expect(compassPoint(0)).toBe('N')
    expect(compassPoint(90)).toBe('E')
    expect(compassPoint(225)).toBe('SW')
    expect(compassPoint(260)).toBe('W')
  })

  test('boundaries and wrap-around', () => {
    expect(compassPoint(11.24)).toBe('N')
    expect(compassPoint(11.25)).toBe('NNE')
    expect(compassPoint(348.75)).toBe('N')
    expect(compassPoint(360)).toBe('N')
    expect(compassPoint(-90)).toBe('W')
  })
})
