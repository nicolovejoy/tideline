import { describe, expect, test } from 'vitest'
import {
  STEP,
  feet,
  restingCursor,
  signedFeet,
  snap,
  tideReadout,
  tideWords,
} from './readout.ts'

const MINUTE = 60_000
const NOON = Date.UTC(2026, 9, 8, 19) // 12:00 PM Pacific

// A rising tide at 6-minute steps, and readings that stop at 12:12.
const predicted = [0, 1, 2, 3, 4].map((i) => ({
  t: NOON + i * STEP,
  ft: 0.86 + i * 0.1,
}))
const observed = [0, 1, 2].map((i) => ({
  t: NOON + i * STEP,
  ft: 2.04 + i * 0.1,
}))

describe('snap', () => {
  test('goes to the nearest 6-minute step', () => {
    expect(snap(NOON + 2 * MINUTE)).toBe(NOON)
    expect(snap(NOON + 4 * MINUTE)).toBe(NOON + STEP)
    expect(snap(NOON)).toBe(NOON)
  })
})

describe('restingCursor', () => {
  test('sits on the latest reading when it is from the past hour', () => {
    expect(restingCursor(NOON + 25 * MINUTE, observed)).toBe(NOON + 2 * STEP)
  })

  test('sits on the clock when the latest reading is over an hour old', () => {
    expect(restingCursor(NOON + 2 * STEP + 61 * MINUTE, observed)).toBe(
      snap(NOON + 2 * STEP + 61 * MINUTE),
    )
  })

  test('sits on the clock when there are no readings', () => {
    expect(restingCursor(NOON + 2 * MINUTE, [])).toBe(NOON)
  })

  test('ignores a reading stamped later than the clock', () => {
    expect(restingCursor(NOON, observed)).toBe(NOON)
  })
})

describe('tideReadout', () => {
  test('gives the prediction and the reading at the cursor', () => {
    const readout = tideReadout(predicted, observed, NOON)
    expect(readout.predictedFt).toBeCloseTo(0.86, 5)
    expect(readout.observedFt).toBeCloseTo(2.04, 5)
  })

  test('the difference agrees with the two numbers as they are shown', () => {
    // 2.04 - 0.86 is 1.18, which would show as +1.2 beside "2.0" and "0.9".
    expect(tideReadout(predicted, observed, NOON).aboveFt).toBe(1.1)
  })

  test('past the last reading there is a prediction but no reading', () => {
    const readout = tideReadout(predicted, observed, NOON + 4 * STEP)
    expect(readout.predictedFt).toBeCloseTo(1.26, 5)
    expect(readout.observedFt).toBeNull()
    expect(readout.aboveFt).toBeNull()
  })

  test('a reading from the step before the cursor does not count', () => {
    const readout = tideReadout(predicted, observed, NOON + 3 * STEP)
    expect(readout.predictedFt).toBeCloseTo(1.16, 5)
    expect(readout.observedFt).toBeNull()
    expect(readout.aboveFt).toBeNull()
  })

  test('wherever the cursor is, the difference equals the two numbers as shown', () => {
    const tenths = (ft: number) => Math.round(ft * 10)
    for (let i = 0; i <= 4; i++) {
      const readout = tideReadout(predicted, observed, NOON + i * STEP)
      if (readout.aboveFt === null) continue
      expect(tenths(readout.aboveFt)).toBe(
        tenths(readout.observedFt!) - tenths(readout.predictedFt!),
      )
    }
  })

  test('a prediction far from the cursor does not count either', () => {
    expect(tideReadout(predicted, observed, NOON + 20 * STEP)).toEqual({
      predictedFt: null,
      observedFt: null,
      aboveFt: null,
    })
  })

  test('with no predictions everything is null', () => {
    expect(tideReadout([], [], NOON)).toEqual({
      predictedFt: null,
      observedFt: null,
      aboveFt: null,
    })
  })
})

describe('wording', () => {
  test('feet has one decimal and its unit', () => {
    expect(feet(0.849)).toBe('0.8 ft')
    expect(feet(5.449)).toBe('5.4 ft')
    expect(feet(-0.3)).toBe('-0.3 ft')
  })

  test('feet never shows a negative zero', () => {
    expect(feet(-0.04)).toBe('0.0 ft')
  })

  test('a difference is signed unless it is zero', () => {
    expect(signedFeet(1.1)).toBe('+1.1')
    expect(signedFeet(-0.4)).toBe('-0.4')
    expect(signedFeet(0.04)).toBe('0.0')
    expect(signedFeet(-0.04)).toBe('0.0')
  })

  test('the readout in words, with and without a reading', () => {
    expect(
      tideWords({ predictedFt: 0.86, observedFt: 2.04, aboveFt: 1.1 }),
    ).toEqual({
      predicted: '0.9 ft predicted',
      observed: '2.0 ft observed (+1.1)',
    })
    expect(
      tideWords({ predictedFt: 0.86, observedFt: null, aboveFt: null }),
    ).toEqual({ predicted: '0.9 ft predicted', observed: null })
    expect(
      tideWords({ predictedFt: null, observedFt: null, aboveFt: null }),
    ).toEqual({ predicted: 'No prediction here', observed: null })
  })
})
