import { describe, expect, test } from 'vitest'
import { NwsOutsideError } from './nws.ts'
import type { NwsCell } from './nws.ts'
import { resolveSpot } from './resolve.ts'
import type { ResolveIo } from './resolve.ts'
import type { StationRow } from './stations.ts'

const ROWS: StationRow[] = [
  ['9411340', 'Santa Barbara', 34.4046, -119.6925, 'RW'],
  ['9411399', 'Gaviota State Park, Pacific Ocean', 34.4694, -120.2283, 'R'],
  ['9411189', 'Ventura', 34.2667, -119.283, 'S'],
]
const LOX: NwsCell = {
  office: 'LOX',
  gridX: 100,
  gridY: 71,
  timeZone: 'America/Los_Angeles',
}

function io(overrides: Partial<ResolveIo> = {}): ResolveIo {
  return {
    fetchPoints: async () => LOX,
    fetchElevationFt: async () => 3,
    fetchPointElevationFt: async () => 12,
    stations: ROWS,
    ...overrides,
  }
}

describe('resolveSpot', () => {
  test('Campus Point: the cell, the zone, its height, Santa Barbara both ways', async () => {
    const result = await resolveSpot(34.4046, -119.844, io())
    expect(result).toEqual({
      ok: true,
      facts: {
        lat: 34.4046,
        lon: -119.844,
        timeZone: 'America/Los_Angeles',
        elevationFt: 12,
        nws: { office: 'LOX', gridX: 100, gridY: 71, elevationFt: 3 },
        tideStation: {
          id: '9411340',
          name: 'Santa Barbara',
          distanceMi: 8.6,
          direction: 'east',
          type: 'harmonic',
        },
        gauge: {
          id: '9411340',
          name: 'Santa Barbara',
          distanceMi: 8.6,
          direction: 'east',
          type: 'harmonic',
        },
      },
    })
  })

  test('coordinates are kept to four decimals', async () => {
    const result = await resolveSpot(34.40461234, -119.84399999, io())
    expect(result.ok && result.facts.lat).toBe(34.4046)
    expect(result.ok && result.facts.lon).toBe(-119.844)
  })

  test('a longitude from a world copy is wrapped before it is asked about', async () => {
    const asked: number[][] = []
    const result = await resolveSpot(
      21.3,
      202.1,
      io({
        fetchPoints: async (lat, lon) => {
          asked.push([lat, lon])
          return LOX
        },
      }),
    )
    expect(asked).toEqual([[21.3, -157.9]])
    expect(result.ok && result.facts.lon).toBe(-157.9)
  })

  test("the spot's own height is asked for at the wrapped, rounded point", async () => {
    const asked: number[][] = []
    const result = await resolveSpot(
      21.30004,
      202.1,
      io({
        fetchPointElevationFt: async (lat, lon) => {
          asked.push([lat, lon])
          return 40
        },
      }),
    )
    expect(asked).toEqual([[21.3, -157.9]])
    expect(result.ok && result.facts.elevationFt).toBe(40)
  })

  test('without its own height a spot still resolves, with none', async () => {
    const result = await resolveSpot(
      34.4046,
      -119.844,
      io({
        fetchPointElevationFt: async () => {
          throw new Error('USGS: HTTP 503')
        },
      }),
    )
    expect(result.ok && result.facts.elevationFt).toBeNull()
    expect(result.ok && result.facts.nws.elevationFt).toBe(3)
  })

  // Whether the spot has a tide is not decided here. It follows from
  // these two heights and the distance, in spot.ts.
  test("a peak: the cell's average and the spot's own height, both kept", async () => {
    const result = await resolveSpot(
      34.4939,
      -119.7147,
      io({
        fetchElevationFt: async () => 3258,
        fetchPointElevationFt: async () => 3808,
      }),
    )
    expect(result.ok && result.facts.nws.elevationFt).toBe(3258)
    expect(result.ok && result.facts.elevationFt).toBe(3808)
    expect(result.ok && 'tidesShown' in result.facts).toBe(false)
  })

  test('a point far from any tide still resolves, with the distance', async () => {
    const result = await resolveSpot(43.0389, -87.9065, io())
    expect(result.ok && result.facts.tideStation.distanceMi).toBeGreaterThan(
      1000,
    )
  })

  test('a 404 from /points is "outside"', async () => {
    const result = await resolveSpot(
      48.5,
      -3,
      io({
        fetchPoints: async () => {
          throw new NwsOutsideError('no')
        },
      }),
    )
    expect(result).toEqual({ ok: false, reason: 'outside' })
  })

  // NWS answers HTTP 500, not 404, for open water in the tropics. Nothing
  // there can be tried again, so it reads as land outside the US does.
  test('any failure for a point outside the US is "outside"', async () => {
    const error = async () => {
      throw new Error('HTTP 500')
    }
    expect(await resolveSpot(15, -96, io({ fetchPoints: error }))).toEqual({
      ok: false,
      reason: 'outside',
    })
    // A world copy east of the date line is the same water.
    expect(await resolveSpot(15, 264, io({ fetchPoints: error }))).toEqual({
      ok: false,
      reason: 'outside',
    })
  })

  test('any other failure inside the US, from either request, is "unreachable"', async () => {
    const down = async () => {
      throw new Error('HTTP 503')
    }
    expect(await resolveSpot(34.4, -119.8, io({ fetchPoints: down }))).toEqual({
      ok: false,
      reason: 'unreachable',
    })
    expect(
      await resolveSpot(34.4, -119.8, io({ fetchElevationFt: down })),
    ).toEqual({ ok: false, reason: 'unreachable' })
  })
})
