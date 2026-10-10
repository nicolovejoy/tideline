// src/data/stations.test.ts
import { describe, expect, test } from 'vitest'
import { isStationRows, nearestStations } from './stations.ts'
import type { StationRow } from './stations.ts'
import baked from './stations.json'

// A short list around Santa Barbara, with NOAA's coordinates.
const SANTA_BARBARA: StationRow = [
  '9411340',
  'Santa Barbara',
  34.4046,
  -119.6925,
  'RW',
]
const GAVIOTA: StationRow = [
  '9411399',
  'Gaviota State Park, Pacific Ocean',
  34.4694,
  -120.2283,
  'R',
]
const VENTURA: StationRow = ['9411189', 'Ventura', 34.2667, -119.283, 'S']
const LAKE_GAUGE: StationRow = ['9087057', 'Milwaukee', 43.002, -87.8876, 'W']
const ROWS = [SANTA_BARBARA, GAVIOTA, VENTURA, LAKE_GAUGE]

describe('nearestStations', () => {
  test('Campus Point: Santa Barbara for both, 8.6 mi east', () => {
    const { tideStation, gauge } = nearestStations(
      { lat: 34.4046, lon: -119.844 },
      ROWS,
    )
    expect(tideStation).toEqual({
      id: '9411340',
      name: 'Santa Barbara',
      distanceMi: 8.6,
      direction: 'east',
      type: 'harmonic',
    })
    expect(gauge).toEqual(tideStation)
  })

  test('Gaviota: its own station, with the gauge 31 mi east at Santa Barbara', () => {
    const { tideStation, gauge } = nearestStations(
      { lat: 34.4716, lon: -120.2284 },
      ROWS,
    )
    expect(tideStation.id).toBe('9411399')
    expect(tideStation.distanceMi).toBe(0.2)
    expect(tideStation.type).toBe('harmonic')
    expect(gauge).toEqual({
      id: '9411340',
      name: 'Santa Barbara',
      distanceMi: 31,
      direction: 'east',
      type: 'harmonic',
    })
  })

  test('a subordinate station is the tide station where it is nearest', () => {
    const { tideStation, gauge } = nearestStations(
      { lat: 34.27, lon: -119.29 },
      ROWS,
    )
    expect(tideStation.id).toBe('9411189')
    expect(tideStation.type).toBe('subordinate')
    expect(gauge.id).toBe('9411340')
  })

  test('a Great Lakes gauge is never chosen: the gauge needs its own curve', () => {
    const { tideStation, gauge } = nearestStations(
      { lat: 43.0389, lon: -87.9065 },
      ROWS,
    )
    expect(tideStation.id).not.toBe('9087057')
    expect(gauge.id).toBe('9411340')
  })

  test('with no station of a kind it throws rather than guess', () => {
    expect(() =>
      nearestStations({ lat: 34, lon: -119 }, [LAKE_GAUGE]),
    ).toThrow()
    expect(() => nearestStations({ lat: 34, lon: -119 }, [VENTURA])).toThrow()
  })
})

describe('the baked list', () => {
  test('has the shape the app expects', () => {
    expect(isStationRows(baked)).toBe(true)
    expect(baked.length).toBeGreaterThan(3000)
  })

  test('is what the hard-coded spots say', () => {
    const rows = baked as StationRow[]
    const campus = nearestStations({ lat: 34.4046, lon: -119.844 }, rows)
    expect(campus.tideStation.id).toBe('9411340')
    expect(campus.tideStation.distanceMi).toBe(8.6)
    expect(campus.tideStation.direction).toBe('east')
    expect(campus.gauge.id).toBe('9411340')
    const gaviota = nearestStations({ lat: 34.4716, lon: -120.2284 }, rows)
    expect(gaviota.tideStation.id).toBe('9411399')
    expect(gaviota.gauge.id).toBe('9411340')
    expect(gaviota.gauge.distanceMi).toBe(31)
    const laCumbre = nearestStations({ lat: 34.4939, lon: -119.7147 }, rows)
    expect(laCumbre.tideStation.distanceMi).toBe(6.3)
    expect(laCumbre.tideStation.direction).toBe('south')
  })

  test('on Lake Michigan the nearest prediction station is hundreds of miles off', () => {
    const rows = baked as StationRow[]
    const milwaukee = nearestStations({ lat: 43.0389, lon: -87.9065 }, rows)
    expect(milwaukee.tideStation.distanceMi).toBeGreaterThan(300)
    expect(milwaukee.gauge.type).toBe('harmonic')
  })
})

describe('isStationRows', () => {
  test('rejects a row with a kind it does not know, or a missing field', () => {
    expect(isStationRows([['1', 'x', 1, 2, 'Q']])).toBe(false)
    expect(isStationRows([['1', 'x', 1, 2]])).toBe(false)
    expect(isStationRows('nope')).toBe(false)
    expect(isStationRows([])).toBe(true)
  })
})
