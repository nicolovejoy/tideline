import { describe, expect, test } from 'vitest'
import {
  bearingDeg,
  directionWord,
  distanceMi,
  roundMiles,
  wrapLon,
} from './geo.ts'

// The hard-coded spots and their stations, as src/spot.ts states them.
const CAMPUS_POINT = { lat: 34.4046, lon: -119.844 }
const GAVIOTA = { lat: 34.4716, lon: -120.2284 }
const LA_CUMBRE = { lat: 34.4939, lon: -119.7147 }
// NOAA's coordinates for the stations, to four decimals.
const SANTA_BARBARA = { lat: 34.4046, lon: -119.6925 }
const GAVIOTA_STATION = { lat: 34.4694, lon: -120.2283 }

describe('distanceMi', () => {
  test('Campus Point to Santa Barbara is 8.6 mi', () => {
    expect(distanceMi(CAMPUS_POINT, SANTA_BARBARA)).toBeCloseTo(8.6, 1)
  })
  test('Gaviota to its station is 0.2 mi, and to Santa Barbara 30.9', () => {
    expect(distanceMi(GAVIOTA, GAVIOTA_STATION)).toBeCloseTo(0.2, 1)
    expect(distanceMi(GAVIOTA, SANTA_BARBARA)).toBeCloseTo(30.9, 1)
  })
  test('La Cumbre Peak to Santa Barbara is 6.3 mi', () => {
    expect(distanceMi(LA_CUMBRE, SANTA_BARBARA)).toBeCloseTo(6.3, 1)
  })
  test('a point to itself is 0', () => {
    expect(distanceMi(CAMPUS_POINT, CAMPUS_POINT)).toBe(0)
  })
})

describe('bearingDeg', () => {
  test('due east is 90 and due south is 180', () => {
    expect(bearingDeg({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(90)
    expect(bearingDeg({ lat: 1, lon: 0 }, { lat: 0, lon: 0 })).toBeCloseTo(180)
  })
  test('Campus Point to Santa Barbara is about 90', () => {
    expect(bearingDeg(CAMPUS_POINT, SANTA_BARBARA)).toBeCloseTo(90, 0)
  })
  test('La Cumbre Peak to Santa Barbara is about 168', () => {
    expect(bearingDeg(LA_CUMBRE, SANTA_BARBARA)).toBeCloseTo(168, 0)
  })
})

describe('directionWord', () => {
  test('the eight words at their centres', () => {
    expect([0, 45, 90, 135, 180, 225, 270, 315].map(directionWord)).toEqual([
      'north',
      'northeast',
      'east',
      'southeast',
      'south',
      'southwest',
      'west',
      'northwest',
    ])
  })
  test('each word covers 45 degrees, and 360 is north', () => {
    expect(directionWord(22)).toBe('north')
    expect(directionWord(23)).toBe('northeast')
    expect(directionWord(168)).toBe('south')
    expect(directionWord(360)).toBe('north')
    expect(directionWord(-90)).toBe('west')
  })
})

describe('roundMiles', () => {
  test('one decimal under 10 mi, whole miles from 10', () => {
    expect(roundMiles(8.63)).toBe(8.6)
    expect(roundMiles(0.21)).toBe(0.2)
    expect(roundMiles(9.96)).toBe(10)
    expect(roundMiles(30.9)).toBe(31)
    expect(roundMiles(636.04)).toBe(636)
  })
})

describe('wrapLon', () => {
  // Leaflet reports the longitude of the world copy that was tapped.
  test('a copy to the west or east comes back to -180 to 180', () => {
    expect(wrapLon(-215.3)).toBeCloseTo(144.7, 9)
    expect(wrapLon(202.1)).toBeCloseTo(-157.9, 9)
    expect(wrapLon(240.3)).toBeCloseTo(-119.7, 9)
  })
  test('two copies away as well', () => {
    expect(wrapLon(-575.3)).toBeCloseTo(144.7, 9)
    expect(wrapLon(562.1)).toBeCloseTo(-157.9, 9)
  })
  test('a longitude already in range is left as it is', () => {
    expect(wrapLon(-119.844)).toBe(-119.844)
    expect(wrapLon(0)).toBe(0)
  })
  test('180 comes back as -180, the same meridian', () => {
    expect(wrapLon(180)).toBe(-180)
    expect(wrapLon(-180)).toBe(-180)
  })
})
