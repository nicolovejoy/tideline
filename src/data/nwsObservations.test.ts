import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  fetchObservations,
  observationsUrl,
  parseObservations,
  skyOf,
} from './nwsObservations.ts'
import ksbaRaw from './__fixtures__/nws-observations-KSBA.json?raw'
import lpoc1Raw from './__fixtures__/nws-observations-LPOC1.json?raw'

afterEach(() => vi.unstubAllGlobals())

test('observationsUrl asks for the reports from an instant, newest first, up to a page', () => {
  // 11:30 PM Pacific on 12 October 2026.
  expect(observationsUrl('KSBA', Date.UTC(2026, 9, 13, 6, 30))).toBe(
    'https://api.weather.gov/stations/KSBA/observations?start=2026-10-13T06:30:00Z&limit=500',
  )
})

describe('skyOf', () => {
  test('is the layer that covers most', () => {
    expect(
      skyOf([{ amount: 'FEW' }, { amount: 'BKN' }, { amount: 'SCT' }]),
    ).toBe('broken')
    expect(skyOf([{ amount: 'CLR' }])).toBe('clear')
    expect(skyOf([{ amount: 'SKC' }])).toBe('clear')
    expect(skyOf([{ amount: 'OVC' }])).toBe('overcast')
  })

  test('a sky hidden by fog, reported as a vertical visibility, is overcast', () => {
    expect(skyOf([{ amount: 'VV' }])).toBe('overcast')
  })

  test('no layers, or none it knows, is no sky', () => {
    expect(skyOf([])).toBeNull()
    expect(skyOf(undefined)).toBeNull()
    expect(skyOf([{ amount: 'XYZ' }])).toBeNull()
  })
})

describe('parseObservations', () => {
  test('the dew point in °F and the humidity in percent', () => {
    // 6 °C and 37.6% in the last KSBA report (the fixture is newest first).
    expect(ksba[15].dewF).toBeCloseTo(42.8, 5)
    expect(ksba[15].humidityPct).toBeCloseTo(37.638, 3)
  })

  test('a dew point flagged bad is left out and the temperature stands', () => {
    const json = JSON.parse(ksbaRaw)
    json.features[15].properties.dewpoint.qualityControl = 'X'
    const [first] = parseObservations(json)
    expect(first.dewF).toBeNull()
    expect(first.tempF).toBeCloseTo(66.2, 5)
  })

  const ksba = parseObservations(JSON.parse(ksbaRaw))
  const lpoc1 = parseObservations(JSON.parse(lpoc1Raw))

  test('is the reports oldest first, in °F and mph', () => {
    expect(ksba).toHaveLength(16)
    expect(ksba[0].t).toBe(Date.UTC(2026, 9, 13, 16, 30))
    expect(ksba[15].t).toBe(Date.UTC(2026, 9, 13, 17, 40))
    // 19 °C, 7.416 km/h from 120°, clear, no gust.
    expect(ksba[0].tempF).toBeCloseTo(66.2, 5)
    expect(ksba[0].windMph).toBeCloseTo(4.608, 3)
    expect(ksba[0].windDeg).toBe(120)
    expect(ksba[0].gustMph).toBeNull()
    expect(ksba[0].sky).toBe('clear')
  })

  test('a calm report has a speed of 0 and a direction of 0', () => {
    const calm = ksba.find(
      (report) => report.t === Date.UTC(2026, 9, 13, 16, 45),
    )
    expect(calm).toMatchObject({ windMph: 0, windDeg: 0 })
  })

  test('a value that is null is null, whatever its flag, and a report with no layers has no sky', () => {
    const blank = lpoc1.find(
      (report) => report.t === Date.UTC(2026, 9, 13, 14, 35),
    )
    expect(blank).toMatchObject({ tempF: null, gustMph: null, sky: null })
    expect(blank!.windMph).toBeCloseTo(1.991, 3)
  })

  test('a gust that passed screening is kept', () => {
    expect(lpoc1[5].t).toBe(Date.UTC(2026, 9, 13, 16, 35))
    expect(lpoc1[5].gustMph).toBeCloseTo(8.008, 3)
  })

  test('a value flagged rejected, bad or questioned is left out, and the rest of the report stands', () => {
    const json = JSON.parse(ksbaRaw) as {
      features: { properties: Record<string, { qualityControl: string }> }[]
    }
    json.features[0].properties.temperature.qualityControl = 'X'
    json.features[1].properties.windSpeed.qualityControl = 'B'
    json.features[2].properties.windDirection.qualityControl = 'Q'
    const reports = parseObservations(json)
    // Newest first in the answer, so feature 0 is the last report.
    expect(reports[15].tempF).toBeNull()
    expect(reports[15].windMph).not.toBeNull()
    expect(reports[14].windMph).toBeNull()
    expect(reports[14].windDeg).toBe(210)
    expect(reports[13].windDeg).toBeNull()
  })

  test('a speed in anything but km/h, or a temperature in anything but °C, is an error', () => {
    const json = JSON.parse(ksbaRaw) as {
      features: { properties: Record<string, { unitCode: string }> }[]
    }
    json.features[0].properties.windSpeed.unitCode = 'wmoUnit:m_s-1'
    expect(() => parseObservations(json)).toThrow(/windSpeed/)
  })

  test('a report with no timestamp is left out', () => {
    const json = JSON.parse(ksbaRaw) as {
      features: { properties: Record<string, unknown> }[]
    }
    delete json.features[3].properties.timestamp
    expect(parseObservations(json)).toHaveLength(15)
  })

  test('an answer with no features is an error', () => {
    expect(() => parseObservations({})).toThrow(/features/)
  })
})

describe('fetchObservations', () => {
  test('asks for the station from the instant and parses the answer', async () => {
    const fetch = vi.fn(async () => new Response(ksbaRaw, { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    const reports = await fetchObservations(
      'KSBA',
      Date.UTC(2026, 9, 13, 6, 30),
    )
    expect(fetch).toHaveBeenCalledWith(
      'https://api.weather.gov/stations/KSBA/observations?start=2026-10-13T06:30:00Z&limit=500',
      { headers: { Accept: 'application/geo+json' } },
    )
    expect(reports).toHaveLength(16)
  })

  test('a failed request is an error', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 503 }))
    await expect(fetchObservations('KSBA', 0)).rejects.toThrow('HTTP 503')
  })
})
