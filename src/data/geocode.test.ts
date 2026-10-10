import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  fetchPlace,
  forgetPlaces,
  normalizeQuery,
  parsePlaces,
  searchUrl,
} from './geocode.ts'
import santaBarbaraRaw from './__fixtures__/nominatim-santa-barbara.json?raw'
import leadbetterRaw from './__fixtures__/nominatim-leadbetter-beach.json?raw'

describe('searchUrl', () => {
  test('asks Nominatim for one US place, with the query encoded', () => {
    expect(searchUrl('Santa Barbara')).toBe(
      'https://nominatim.openstreetmap.org/search?q=Santa+Barbara&format=jsonv2&countrycodes=us&limit=1',
    )
    expect(searchUrl('Doña Ana & co')).toContain('q=Do%C3%B1a+Ana+%26+co')
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
