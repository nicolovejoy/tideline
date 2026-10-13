import { describe, expect, test } from 'vitest'
import {
  STEP,
  cloudPart,
  cursorText,
  feet,
  gaugeWords,
  hourAt,
  partsText,
  rainPart,
  restingCursor,
  signedFeet,
  skyCategoryPart,
  skyParts,
  skyWords,
  snap,
  tempParts,
  tideReadout,
  tideWords,
  windParts,
  withSourceWords,
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

  test('a curve made on the device is worded as interpolated', () => {
    expect(
      tideWords(
        { predictedFt: 0.86, observedFt: 2.04, aboveFt: 1.1 },
        'interpolated',
      ),
    ).toEqual({
      predicted: '0.9 ft interpolated',
      observed: '2.0 ft observed (+1.1)',
    })
    // Off the curve the words do not change: nothing was interpolated there.
    expect(
      tideWords(
        { predictedFt: null, observedFt: null, aboveFt: null },
        'interpolated',
      ),
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
      gustMph: 12.4,
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
    test('the speed and where it comes from as one part, then the gusts', () => {
      const parts = windParts(hour(NOON))
      expect(parts).toEqual([
        { key: 'wind', text: '9 mph from W' },
        { key: 'gust', text: 'gusts 12' },
      ])
      expect(partsText(parts)).toBe('9 mph from W, gusts 12')
    })

    test('leaves out what the forecast does not have', () => {
      expect(partsText(windParts(hour(NOON, { gustMph: null })))).toBe(
        '9 mph from W',
      )
      expect(partsText(windParts(hour(NOON, { windDeg: null })))).toBe(
        '9 mph, gusts 12',
      )
    })

    test('with no speed, the gusts carry the unit and the direction stands alone', () => {
      expect(windParts(hour(NOON, { windMph: null }))).toEqual([
        { key: 'gust', text: 'gusts 12 mph' },
        { key: null, text: 'from W' },
      ])
    })

    test('a gust that does not stand out from the wind is left out', () => {
      // 24 is 1.2 times 20 and 4 mph above it: neither bar is reached.
      expect(
        partsText(windParts(hour(NOON, { windMph: 20, gustMph: 24 }))),
      ).toBe('20 mph from W')
      // Exactly 1.25 times is not more than it.
      expect(
        partsText(windParts(hour(NOON, { windMph: 8, gustMph: 10 }))),
      ).toBe('8 mph from W')
      expect(
        partsText(windParts(hour(NOON, { windMph: 8, gustMph: 10.1 }))),
      ).toBe('8 mph from W, gusts 10')
    })

    test('calm is the word, with no direction, and a gust 5 mph or more carries the unit', () => {
      expect(windParts(hour(NOON, { windMph: 0.4, gustMph: 6 }))).toEqual([
        { key: 'wind', text: 'Calm' },
        { key: 'gust', text: 'gusts 6 mph' },
      ])
      // A breath of 3 mph over a calm hour is no gust worth the words.
      expect(
        partsText(windParts(hour(NOON, { windMph: 0.4, gustMph: 3 }))),
      ).toBe('Calm')
      expect(partsText(windParts(hour(NOON, { windMph: 0, gustMph: 0 })))).toBe(
        'Calm',
      )
      expect(
        partsText(windParts(hour(NOON, { windMph: 0, gustMph: null }))),
      ).toBe('Calm')
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

  describe('the source words', () => {
    test('each part can say which side it is from, and the word is said once after a run', () => {
      const parts = withSourceWords(windParts(hour(NOON), 'observed'))
      expect(parts).toEqual([
        { key: 'wind', text: '9 mph from W', source: 'observed' },
        { key: 'gust', text: 'gusts 12', source: 'observed' },
        { key: null, text: 'observed', source: 'observed', label: true },
      ])
      expect(partsText(parts)).toBe('9 mph from W, gusts 12, observed')
    })

    test('two runs from different sides are set apart by a semicolon', () => {
      const parts = withSourceWords([
        skyCategoryPart('scattered', 'observed'),
        rainPart(0, 'forecast'),
      ])
      expect(partsText(parts)).toBe(
        'Scattered cloud, observed; 0% rain, forecast',
      )
    })

    test('with no sources nothing is added, as on any other day', () => {
      const parts = windParts(hour(NOON))
      expect(withSourceWords(parts)).toEqual(parts)
      expect(partsText(parts)).toBe('9 mph from W, gusts 12')
    })

    test('no parts is no parts', () => {
      expect(withSourceWords([])).toEqual([])
    })
  })

  describe('skyWords', () => {
    test('the category in words', () => {
      expect(skyWords('clear')).toBe('Clear')
      expect(skyWords('few')).toBe('Few clouds')
      expect(skyWords('scattered')).toBe('Scattered cloud')
      expect(skyWords('broken')).toBe('Broken cloud')
      expect(skyWords('overcast')).toBe('Overcast')
    })
  })

  test('tempParts and skyParts carry the source too', () => {
    expect(tempParts(hour(NOON), 'observed')).toEqual([
      { key: 'temp', text: '74°F', source: 'observed' },
    ])
    expect(skyParts(hour(NOON), 'forecast')).toEqual([
      { key: 'cloud', text: '3% cloud', source: 'forecast' },
      { key: 'rain', text: '0% rain', source: 'forecast' },
    ])
    expect(cloudPart(40, 'forecast')).toEqual({
      key: 'cloud',
      text: '40% cloud',
      source: 'forecast',
    })
  })
})

describe('cursorText', () => {
  test('the time, then each panel, set apart by semicolons', () => {
    expect(
      cursorText('3:36 PM', ['Tide: 3.0 ft predicted', 'Wind: 9 mph, from W']),
    ).toBe('3:36 PM; Tide: 3.0 ft predicted; Wind: 9 mph, from W')
  })
  // A spot with no tide has no tide panel, and nothing is said in its place.
  test('a panel with nothing to say is left out', () => {
    expect(cursorText('3:36 PM', ['', 'Wind: 9 mph, from W'])).toBe(
      '3:36 PM; Wind: 9 mph, from W',
    )
  })
})

describe('gaugeWords', () => {
  test('names the gauge and signs its deviation from its own prediction', () => {
    expect(gaugeWords('Santa Barbara', 1.18)).toBe(
      'Santa Barbara gauge +1.2 ft vs its prediction',
    )
    expect(gaugeWords('Santa Barbara', -0.3)).toBe(
      'Santa Barbara gauge -0.3 ft vs its prediction',
    )
  })

  test('a deviation that rounds to nothing is 0.0, never -0.0', () => {
    expect(gaugeWords('Santa Barbara', 0)).toBe(
      'Santa Barbara gauge 0.0 ft vs its prediction',
    )
    expect(gaugeWords('Santa Barbara', -0.04)).toBe(
      'Santa Barbara gauge 0.0 ft vs its prediction',
    )
  })
})
