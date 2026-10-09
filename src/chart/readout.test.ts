import { describe, expect, test } from 'vitest'
import {
  STEP,
  cursorText,
  feet,
  hourAt,
  partsText,
  restingCursor,
  signedFeet,
  skyParts,
  snap,
  tempParts,
  tideReadout,
  tideWords,
  windParts,
} from './readout.ts'
import type { ForecastHour } from '../data/nws.ts'

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

describe('the weather under the cursor', () => {
  const HOUR = 3_600_000

  function hour(t: number, change: Partial<ForecastHour> = {}): ForecastHour {
    return {
      t,
      tempF: 73.6,
      windMph: 9.4,
      gustMph: 11.5,
      windDeg: 268,
      cloudPct: 3,
      rainPct: 0,
      ...change,
    }
  }
  const NOTHING = hour(NOON, {
    tempF: null,
    windMph: null,
    gustMph: null,
    windDeg: null,
    cloudPct: null,
    rainPct: null,
  })

  describe('hourAt', () => {
    const hours = [hour(NOON), hour(NOON + HOUR), hour(NOON + 3 * HOUR)]

    test('is the hour that contains the instant, from its first moment to its last', () => {
      expect(hourAt(hours, NOON)).toBe(hours[0])
      expect(hourAt(hours, NOON + 59 * MINUTE)).toBe(hours[0])
      expect(hourAt(hours, NOON + HOUR)).toBe(hours[1])
    })

    test('is nothing where the forecast has no such hour', () => {
      expect(hourAt(hours, NOON - MINUTE)).toBeNull()
      expect(hourAt(hours, NOON + 2 * HOUR + 30 * MINUTE)).toBeNull()
      expect(hourAt([], NOON)).toBeNull()
    })
  })

  describe('windParts', () => {
    test('speed, gusts and a compass point, in whole numbers', () => {
      const parts = windParts(hour(NOON))
      expect(parts).toEqual([
        { key: 'wind', text: '9 mph' },
        { key: 'gust', text: 'gusts 12' },
        { key: null, text: 'from W' },
      ])
      expect(partsText(parts)).toBe('9 mph, gusts 12, from W')
    })

    test('leaves out what the forecast does not have', () => {
      expect(partsText(windParts(hour(NOON, { gustMph: null })))).toBe(
        '9 mph, from W',
      )
      expect(partsText(windParts(hour(NOON, { windDeg: null })))).toBe(
        '9 mph, gusts 12',
      )
    })

    test('gusts carry the unit when there is no speed to carry it', () => {
      expect(partsText(windParts(hour(NOON, { windMph: null })))).toBe(
        'gusts 12 mph, from W',
      )
    })

    test('calm is 0 mph, not nothing', () => {
      const calm = hour(NOON, { windMph: 0, gustMph: 0 })
      expect(partsText(windParts(calm))).toBe('0 mph, gusts 0, from W')
    })

    test('no hour, or an hour with no wind at all, is no parts', () => {
      expect(windParts(null)).toEqual([])
      expect(windParts(NOTHING)).toEqual([])
    })
  })

  describe('tempParts', () => {
    test('a whole number of degrees', () => {
      expect(tempParts(hour(NOON))).toEqual([{ key: 'temp', text: '74°F' }])
    })

    test('just below zero is 0, never -0', () => {
      expect(partsText(tempParts(hour(NOON, { tempF: -0.4 })))).toBe('0°F')
      expect(partsText(tempParts(hour(NOON, { tempF: -0.6 })))).toBe('-1°F')
    })

    test('zero degrees is a temperature, not a missing one', () => {
      expect(partsText(tempParts(hour(NOON, { tempF: 0 })))).toBe('0°F')
    })

    test('no hour, or no temperature, is no parts', () => {
      expect(tempParts(null)).toEqual([])
      expect(tempParts(NOTHING)).toEqual([])
    })
  })

  describe('skyParts', () => {
    test('cloud cover and the chance of rain', () => {
      const parts = skyParts(hour(NOON))
      expect(parts).toEqual([
        { key: 'cloud', text: '3% cloud' },
        { key: 'rain', text: '0% rain' },
      ])
      expect(partsText(parts)).toBe('3% cloud, 0% rain')
    })

    test('leaves out what the forecast does not have', () => {
      expect(partsText(skyParts(hour(NOON, { rainPct: null })))).toBe(
        '3% cloud',
      )
      expect(partsText(skyParts(hour(NOON, { cloudPct: null })))).toBe(
        '0% rain',
      )
    })

    test('no hour, or neither value, is no parts', () => {
      expect(skyParts(null)).toEqual([])
      expect(skyParts(NOTHING)).toEqual([])
    })
  })
})

describe('cursorText', () => {
  test('the time, then each panel, set apart by semicolons', () => {
    expect(
      cursorText('3:36 PM', ['Tide: 3.0 ft predicted', 'Wind: 9 mph, from W']),
    ).toBe('3:36 PM; Tide: 3.0 ft predicted; Wind: 9 mph, from W')
  })
})
