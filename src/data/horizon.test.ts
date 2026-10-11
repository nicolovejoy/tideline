import { describe, expect, test } from 'vitest'
import { SEEN_FROM_FT, seenFromFt } from './horizon.ts'
import { CAMPUS_POINT, spotById } from '../spot.ts'

const PEAK = spotById('la-cumbre-peak')

describe('seenFromFt', () => {
  test('a high spot near the sea: its own height', () => {
    // 3,997 ft, 6.3 mi from the Santa Barbara tide station.
    expect(seenFromFt(PEAK)).toBe(3997)
  })

  test('a spot with no height of its own: a level horizon', () => {
    expect(seenFromFt(CAMPUS_POINT)).toBe(0)
    // Its forecast cell averages 3,258 ft. That is not the spot's height.
    expect(seenFromFt({ ...PEAK, elevationFt: null })).toBe(0)
  })

  test('under 100 ft: a level horizon', () => {
    expect(SEEN_FROM_FT).toBe(100)
    expect(seenFromFt({ ...PEAK, elevationFt: 21 })).toBe(0)
    expect(seenFromFt({ ...PEAK, elevationFt: 99.9 })).toBe(0)
    expect(seenFromFt({ ...PEAK, elevationFt: 100 })).toBe(100)
  })

  test('at or below sea level: a level horizon', () => {
    expect(seenFromFt({ ...PEAK, elevationFt: 0 })).toBe(0)
    expect(seenFromFt({ ...PEAK, elevationFt: -282 })).toBe(0)
  })

  test('far from the sea: a level horizon, however high', () => {
    const at = (distanceMi: number) => ({
      elevationFt: 5280,
      tideStation: { ...PEAK.tideStation, distanceMi },
    })
    expect(seenFromFt(at(25))).toBe(5280)
    expect(seenFromFt(at(25.1))).toBe(0)
    expect(seenFromFt(at(900))).toBe(0)
  })
})
