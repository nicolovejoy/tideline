import { afterEach, describe, expect, test, vi } from 'vitest'
import { fetchStations, parseStations, stationsUrl } from './nwsStations.ts'
import realRaw from './__fixtures__/nws-stations-LOX-100-71.json?raw'

afterEach(() => vi.unstubAllGlobals())

test('stationsUrl asks the cell for all of its stations on one page', () => {
  expect(stationsUrl('LOX', 100, 71)).toBe(
    'https://api.weather.gov/gridpoints/LOX/100,71/stations?limit=500',
  )
})

describe('parseStations', () => {
  const stations = parseStations(JSON.parse(realRaw))

  test("gives each station's id, name, point and height in whole feet, in NWS's order", () => {
    expect(stations.map((station) => station.id)).toEqual([
      'KSBA',
      'LPOC1',
      'MOIC1',
      'KIZA',
      'WBPC1',
      'KLAX',
    ])
    expect(stations[0]).toEqual({
      id: 'KSBA',
      name: 'Santa Barbara, Santa Barbara Municipal Airport',
      lat: 34.42611,
      lon: -119.84361,
      elevationFt: 10,
    })
    // 299.3136 m.
    expect(stations[1].elevationFt).toBe(982)
    expect(stations[1].name).toBe('LOS PRIETOS')
  })

  test('leaves out a station it cannot place, and the rest stand', () => {
    const json = JSON.parse(realRaw) as {
      features: { geometry: unknown; properties: Record<string, unknown> }[]
    }
    json.features[1].geometry = null
    delete json.features[2].properties.elevation
    expect(parseStations(json).map((station) => station.id)).toEqual([
      'KSBA',
      'KIZA',
      'WBPC1',
      'KLAX',
    ])
  })

  test('a height in anything but metres is an error', () => {
    const json = JSON.parse(realRaw) as {
      features: { properties: { elevation: { unitCode: string } } }[]
    }
    json.features[0].properties.elevation.unitCode = 'wmoUnit:ft'
    expect(() => parseStations(json)).toThrow(/elevation/)
  })

  test('an answer with no features is an error', () => {
    expect(() => parseStations({})).toThrow(/features/)
    expect(() => parseStations(null)).toThrow(/features/)
  })
})

describe('fetchStations', () => {
  test('asks for the cell and parses the answer', async () => {
    const fetch = vi.fn(async () => new Response(realRaw, { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    const stations = await fetchStations('LOX', 100, 71)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.weather.gov/gridpoints/LOX/100,71/stations?limit=500',
      { headers: { Accept: 'application/geo+json' } },
    )
    expect(stations).toHaveLength(6)
  })

  test('a failed request is an error', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 500 }))
    await expect(fetchStations('LOX', 100, 71)).rejects.toThrow('HTTP 500')
  })
})
