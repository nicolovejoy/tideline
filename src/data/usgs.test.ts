import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  elevationUrl,
  fetchPointElevationFt,
  parsePointElevationFt,
} from './usgs.ts'
import elCapitanRaw from './__fixtures__/usgs-epqs-34.4586--120.0236.json?raw'

describe('elevationUrl', () => {
  test('asks for one point in feet, longitude as x', () => {
    expect(elevationUrl(34.4586, -120.0236)).toBe(
      'https://epqs.nationalmap.gov/v1/json?x=-120.0236&y=34.4586&wkid=4326&units=Feet&includeDate=false',
    )
  })
})

describe('parsePointElevationFt', () => {
  test('El Capitan State Beach is 21 ft, from a real response', () => {
    expect(parsePointElevationFt(JSON.parse(elCapitanRaw))).toBe(21)
  })
  test('rounds to whole feet, below sea level too', () => {
    expect(parsePointElevationFt({ value: 3807.77 })).toBe(3808)
    expect(parsePointElevationFt({ value: -281.6 })).toBe(-282)
    expect(parsePointElevationFt({ value: 0 })).toBe(0)
  })
  test('throws where there is no height', () => {
    expect(() => parsePointElevationFt({})).toThrow('USGS')
    expect(() => parsePointElevationFt(null)).toThrow('USGS')
    expect(() => parsePointElevationFt({ value: '21' })).toThrow('USGS')
  })
  // What the service gives for a point it has no data for.
  test('throws on the no-data value', () => {
    expect(() => parsePointElevationFt({ value: -1000000 })).toThrow('USGS')
  })
})

describe('fetchPointElevationFt', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('fetches the point and reads its height', async () => {
    const fetched = vi.fn(async () => new Response(elCapitanRaw))
    vi.stubGlobal('fetch', fetched)
    expect(await fetchPointElevationFt(34.4586, -120.0236)).toBe(21)
    // With a time limit: the service is slow now and then.
    expect(fetched).toHaveBeenCalledWith(
      elevationUrl(34.4586, -120.0236),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })
  test('a failure is an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Call failed.', { status: 500 })),
    )
    await expect(fetchPointElevationFt(15, -96)).rejects.toThrow('USGS')
  })
  // Seen on 2026-10-10 for a point off Oaxaca: plain text, not JSON.
  test('an answer that is not JSON is an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Call failed.  [Failed cloud operation]')),
    )
    await expect(fetchPointElevationFt(15, -96)).rejects.toThrow()
  })
})
