import { describe, expect, test } from 'vitest'
import { NwsOutsideError } from './nws.ts'
import type { NwsCell } from './nws.ts'
import { defaultTidesShown, resolveSpot } from './resolve.ts'
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
    stations: ROWS,
    ...overrides,
  }
}

describe('defaultTidesShown', () => {
  test('the three hard-coded spots come out as they are shipped', () => {
    expect(defaultTidesShown(8.6, 3)).toBe(true)
    expect(defaultTidesShown(0.2, 0)).toBe(true)
    expect(defaultTidesShown(6.3, 3258)).toBe(false)
  })
  test('within 25 mi and under 300 ft, both inclusive on the near side', () => {
    expect(defaultTidesShown(25, 299)).toBe(true)
    expect(defaultTidesShown(25.1, 0)).toBe(false)
    expect(defaultTidesShown(0, 300)).toBe(false)
    expect(defaultTidesShown(636, 600)).toBe(false)
  })
})

describe('resolveSpot', () => {
  test('Campus Point: the cell, the zone, Santa Barbara both ways, tides on', async () => {
    const result = await resolveSpot(34.4046, -119.844, io())
    expect(result).toEqual({
      ok: true,
      facts: {
        lat: 34.4046,
        lon: -119.844,
        timeZone: 'America/Los_Angeles',
        elevationFt: null,
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
        tidesShown: true,
      },
    })
  })

  test('coordinates are kept to four decimals', async () => {
    const result = await resolveSpot(34.40461234, -119.84399999, io())
    expect(result.ok && result.facts.lat).toBe(34.4046)
    expect(result.ok && result.facts.lon).toBe(-119.844)
  })

  test('a high cell turns tides off', async () => {
    const result = await resolveSpot(
      34.4939,
      -119.7147,
      io({ fetchElevationFt: async () => 3258 }),
    )
    expect(result.ok && result.facts.tidesShown).toBe(false)
    expect(result.ok && result.facts.nws.elevationFt).toBe(3258)
  })

  test('a far station turns tides off', async () => {
    const result = await resolveSpot(43.0389, -87.9065, io())
    expect(result.ok && result.facts.tidesShown).toBe(false)
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

  test('any other failure, from either request, is "unreachable"', async () => {
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
