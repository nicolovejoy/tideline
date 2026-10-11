import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  fetchPlace,
  forgetPlaces,
  normalizeQuery,
  parsePlaces,
  searchUrl,
  viewbox,
} from './geocode.ts'
import santaBarbaraRaw from './__fixtures__/nominatim-santa-barbara.json?raw'
import leadbetterRaw from './__fixtures__/nominatim-leadbetter-beach.json?raw'
import summerlandRaw from './__fixtures__/nominatim-summerland-beach-santa-barbara-view.json?raw'
import summerlandOhioRaw from './__fixtures__/nominatim-summerland-beach-ohio-view.json?raw'

// The add screen's map as it opens from Campus Point on a phone, about 30
// miles wide and 25 tall, and a map over Buckeye Lake, Ohio.
const SANTA_BARBARA_VIEW = {
  south: 34.2213,
  north: 34.5871,
  west: -120.1183,
  east: -119.5697,
}
const OHIO_VIEW = { south: 39.65, north: 40.15, west: -82.8, east: -82.25 }

describe('viewbox', () => {
  test('west, north, east, south, to two places', () => {
    const laptop = {
      south: 34.1532,
      north: 34.6541,
      west: -120.4183,
      east: -119.2697,
    }
    expect(viewbox(laptop)).toBe('-120.42,34.65,-119.27,34.15')
  })
  test('a view under half a degree is widened about its centre', () => {
    // Zoomed in on Leadbetter Beach, about two miles across.
    const close = { south: 34.39, north: 34.43, west: -119.72, east: -119.68 }
    expect(viewbox(close)).toBe('-119.95,34.66,-119.45,34.16')
  })
  test('only the short side is widened', () => {
    const tall = { south: 34, north: 35, west: -119.72, east: -119.68 }
    expect(viewbox(tall)).toBe('-119.95,35,-119.45,34')
    expect(viewbox(SANTA_BARBARA_VIEW)).toBe('-120.12,34.65,-119.57,34.15')
  })
  test('a view past the edge of the world is cut to it', () => {
    const wide = { south: -95, north: 95, west: -200, east: 190 }
    expect(viewbox(wide)).toBe('-180,90,180,-90')
  })
  test('a view that is no box is null', () => {
    expect(viewbox({ ...SANTA_BARBARA_VIEW, west: NaN })).toBeNull()
    // Panned a whole turn of the world past the date line.
    expect(viewbox({ south: 34, north: 35, west: -480, east: -470 })).toBeNull()
  })
})

describe('searchUrl', () => {
  test('asks Nominatim for one US place, with the query encoded', () => {
    expect(searchUrl('Santa Barbara')).toBe(
      'https://nominatim.openstreetmap.org/search?q=Santa+Barbara&format=jsonv2&countrycodes=us&limit=1',
    )
    expect(searchUrl('Doña Ana & co')).toContain('q=Do%C3%B1a+Ana+%26+co')
  })
  test('with a view, prefers places in it without leaving out the rest', () => {
    expect(searchUrl('Summerland Beach', SANTA_BARBARA_VIEW)).toBe(
      'https://nominatim.openstreetmap.org/search?q=Summerland+Beach&format=jsonv2&countrycodes=us&limit=1&viewbox=-120.12%2C34.65%2C-119.57%2C34.15&bounded=0',
    )
  })
  test('a view that is no box is left out', () => {
    expect(searchUrl('Seattle', { ...SANTA_BARBARA_VIEW, north: NaN })).toBe(
      searchUrl('Seattle'),
    )
  })
})

describe('parsePlaces', () => {
  test('the city comes first for Santa Barbara, as numbers', () => {
    const places = parsePlaces(JSON.parse(santaBarbaraRaw))
    expect(places).toHaveLength(3)
    expect(places[0]).toEqual({
      lat: 34.4221319,
      lon: -119.702667,
      name: 'Santa Barbara',
      displayName:
        'Santa Barbara, Santa Barbara County, California, United States',
      bounds: {
        south: 34.336029,
        north: 34.463922,
        west: -119.859791,
        east: -119.6399059,
      },
    })
  })
  test('non-object entries are dropped', () => {
    expect(parsePlaces([null, 'x', 5])).toEqual([])
  })
  test('an entry with a blank coordinate is dropped', () => {
    const [first] = JSON.parse(santaBarbaraRaw)
    expect(parsePlaces([{ ...first, lat: '' }])).toEqual([])
    expect(parsePlaces([{ ...first, lon: '  ' }])).toEqual([])
  })
  test('a beach', () => {
    const [beach] = parsePlaces(JSON.parse(leadbetterRaw))
    expect(beach.name).toBe('Leadbetter Beach')
    expect(beach.lat).toBeCloseTo(34.4009, 3)
    expect(beach.bounds.south).toBeLessThan(beach.bounds.north)
    expect(beach.bounds.west).toBeLessThan(beach.bounds.east)
  })
  test('nothing found is an empty list', () => {
    expect(parsePlaces([])).toEqual([])
  })
  test('an entry missing a field is dropped, the rest kept', () => {
    const [good] = JSON.parse(leadbetterRaw)
    const { boundingbox: _box, ...noBox } = good
    expect(parsePlaces([noBox, good])).toHaveLength(1)
    expect(parsePlaces([{ ...good, lat: 'north' }])).toEqual([])
    expect(parsePlaces([{ ...good, boundingbox: ['1', '2'] }])).toEqual([])
  })
  test('a response that is not a list throws', () => {
    expect(() => parsePlaces({ error: 'x' })).toThrow('Nominatim')
    expect(() => parsePlaces(null)).toThrow('Nominatim')
  })
})

describe('normalizeQuery', () => {
  test('trims, collapses spaces and folds case', () => {
    expect(normalizeQuery('  Santa   Barbara ')).toBe('santa barbara')
    expect(normalizeQuery('\tLeadbetter\nBeach')).toBe('leadbetter beach')
  })
})

describe('fetchPlace', () => {
  beforeEach(() => forgetPlaces())
  afterEach(() => vi.unstubAllGlobals())

  test('the first place, fetched with the trimmed query', async () => {
    const fetchMock = vi.fn(async () => new Response(santaBarbaraRaw))
    vi.stubGlobal('fetch', fetchMock)
    const place = await fetchPlace('  Santa Barbara ')
    expect(place?.name).toBe('Santa Barbara')
    expect(fetchMock).toHaveBeenCalledWith(searchUrl('Santa Barbara'))
  })
  test('nothing found is null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('[]')),
    )
    expect(await fetchPlace('xqzv nowhere zz')).toBeNull()
  })
  test('a blank query asks nothing and is null', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchPlace('   ')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  test('a failed response throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 503 })),
    )
    await expect(fetchPlace('Santa Barbara')).rejects.toThrow('HTTP 503')
  })
  test('the same query, however spaced or cased, is asked once', async () => {
    const fetchMock = vi.fn(async () => new Response(santaBarbaraRaw))
    vi.stubGlobal('fetch', fetchMock)
    await fetchPlace('Santa Barbara')
    await fetchPlace('santa  barbara')
    await fetchPlace(' SANTA BARBARA ')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  test('with a view, asks with it', async () => {
    const fetchMock = vi.fn(async () => new Response(summerlandRaw))
    vi.stubGlobal('fetch', fetchMock)
    const place = await fetchPlace('Summerland Beach', SANTA_BARBARA_VIEW)
    expect(place?.displayName).toContain('Santa Barbara County, California')
    expect(fetchMock).toHaveBeenCalledWith(
      searchUrl('Summerland Beach', SANTA_BARBARA_VIEW),
    )
  })
  test('the same name from two views is asked twice, each with its own answer', async () => {
    const answers = new Map([
      [searchUrl('Summerland Beach', SANTA_BARBARA_VIEW), summerlandRaw],
      [searchUrl('Summerland Beach', OHIO_VIEW), summerlandOhioRaw],
    ])
    const fetchMock = vi.fn(
      async (url: string) => new Response(answers.get(url)),
    )
    vi.stubGlobal('fetch', fetchMock)
    const here = await fetchPlace('Summerland Beach', SANTA_BARBARA_VIEW)
    const there = await fetchPlace('Summerland Beach', OHIO_VIEW)
    expect(here?.displayName).toContain('California')
    expect(there?.displayName).toContain('Ohio')
    // Each view's answer is remembered as its own.
    expect(await fetchPlace('Summerland Beach', SANTA_BARBARA_VIEW)).toEqual(
      here,
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  test('the same name from a view nudged a few yards is asked once', async () => {
    const fetchMock = vi.fn(async () => new Response(summerlandRaw))
    vi.stubGlobal('fetch', fetchMock)
    const nudged = {
      south: SANTA_BARBARA_VIEW.south + 0.0004,
      north: SANTA_BARBARA_VIEW.north + 0.0004,
      west: SANTA_BARBARA_VIEW.west - 0.0004,
      east: SANTA_BARBARA_VIEW.east - 0.0004,
    }
    await fetchPlace('Summerland Beach', SANTA_BARBARA_VIEW)
    await fetchPlace('Summerland Beach', nudged)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  test('nothing found is remembered too', async () => {
    const fetchMock = vi.fn(async () => new Response('[]'))
    vi.stubGlobal('fetch', fetchMock)
    await fetchPlace('nowhere')
    await fetchPlace('nowhere')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  test('a failure is not remembered, so the next try asks again', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response(santaBarbaraRaw))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchPlace('Santa Barbara')).rejects.toThrow()
    expect((await fetchPlace('Santa Barbara'))?.name).toBe('Santa Barbara')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
