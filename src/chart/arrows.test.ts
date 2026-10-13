import { describe, expect, test } from 'vitest'
import {
  ARROW_GAP,
  ARROW_PATH,
  arrowAngle,
  arrowStep,
  DOT_RADIUS,
  hourWidth,
  isCalm,
  thinArrows,
} from './arrows.ts'
import type { Arrow } from './arrows.ts'
import { linearScale } from './scales.ts'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const START = Date.UTC(2026, 9, 8, 7) // local midnight, 8 October

describe('isCalm', () => {
  test('a speed that rounds to zero', () => {
    expect(isCalm(0)).toBe(true)
    expect(isCalm(0.4)).toBe(true)
    expect(isCalm(0.5)).toBe(false)
    expect(isCalm(3)).toBe(false)
  })
})

describe('arrowAngle', () => {
  // NWS gives where the wind comes from. The arrow points where it goes.
  test('a west wind points right, a north wind points down', () => {
    expect(arrowAngle(270)).toBe(90)
    expect(arrowAngle(0)).toBe(180)
    expect(arrowAngle(180)).toBe(0)
    expect(arrowAngle(45)).toBe(225)
  })

  test('always in 0 to 360', () => {
    expect(arrowAngle(359)).toBe(179)
    expect(arrowAngle(360)).toBe(180)
  })
})

describe('arrowStep', () => {
  test('every hour where an hour is at least the gap wide', () => {
    expect(arrowStep(12)).toBe(1)
    expect(arrowStep(14.7)).toBe(1)
    expect(arrowStep(40)).toBe(1)
  })

  test('the smallest of 1, 2, 3, 4, 6, 12, 24 that is at least the gap over the width', () => {
    expect(arrowStep(11)).toBe(2) // 1.09
    expect(arrowStep(6)).toBe(2) // 2
    expect(arrowStep(5)).toBe(3) // 2.4
    expect(arrowStep(3.5)).toBe(4) // 3.43
    expect(arrowStep(2.5)).toBe(6) // 4.8
    expect(arrowStep(1.5)).toBe(12) // 8
    expect(arrowStep(0.6)).toBe(24) // 20
  })

  test('the gap can be given', () => {
    expect(arrowStep(10, 25)).toBe(3)
  })

  test('an hour narrower than a 24th of the gap, or no width at all, is 24', () => {
    expect(arrowStep(0.1)).toBe(24)
    expect(arrowStep(0)).toBe(24)
  })

  test('the default gap is the one the panel uses', () => {
    expect(arrowStep(ARROW_GAP)).toBe(1)
    expect(arrowStep(ARROW_GAP - 0.01)).toBe(2)
  })
})

describe('hourWidth', () => {
  test('is how many pixels one hour takes on the scale', () => {
    const x = linearScale([START, START + DAY], [0, 353])
    expect(hourWidth(x)).toBeCloseTo(353 / 24, 6)
  })
})

describe('thinArrows', () => {
  const arrow = (index: number): Arrow => ({
    t: START + index * HOUR + HOUR / 2,
    v: 9,
    angle: 90,
  })
  const all = Array.from({ length: 24 }, (_, i) => arrow(i))

  test('keeps every arrow where the hours are wide enough', () => {
    expect(thinArrows(all, START, 14)).toEqual(all)
  })

  test('keeps the hours whose index from the start of the span is a multiple of the step', () => {
    const kept = thinArrows(all, START, 5) // step 3
    expect(kept.map((a) => (a.t - START - HOUR / 2) / HOUR)).toEqual([
      0, 3, 6, 9, 12, 15, 18, 21,
    ])
  })

  test('counts from the span, not from the first arrow, so the same hours keep theirs whichever hours exist', () => {
    // Today's forecast starts at 5 AM.
    const fromFive = all.slice(5)
    const kept = thinArrows(fromFive, START, 6) // step 2
    expect(kept.map((a) => (a.t - START - HOUR / 2) / HOUR)).toEqual([
      6, 8, 10, 12, 14, 16, 18, 20, 22,
    ])
  })

  test('keeps nothing of nothing, and does not mind an hour of no width', () => {
    expect(thinArrows([], START, 14)).toEqual([])
    expect(thinArrows(all, START, 0)).toEqual([arrow(0)])
  })

  test('a span of several days thins the same way', () => {
    const week = Array.from({ length: 7 * 24 }, (_, i) => arrow(i))
    const kept = thinArrows(week, START, 2) // step 6
    expect(kept).toHaveLength(28)
    expect(kept[1].t).toBe(START + 6 * HOUR + HOUR / 2)
  })
})

describe('the glyph', () => {
  test('the shaft is ARROW_LENGTH long through the origin, and the dot is 2 px', () => {
    expect(ARROW_PATH.startsWith('M0,5V-5')).toBe(true)
    expect(DOT_RADIUS).toBe(2)
  })
})
