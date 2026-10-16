import { describe, expect, test } from 'vitest'
import { FEEL_STANDS_OUT_F, shownFeel } from './feel.ts'
import type { ForecastHour } from '../data/nws.ts'

function hour(change: Partial<ForecastHour>): ForecastHour {
  return {
    t: 0,
    tempF: 70,
    windMph: 5,
    gustMph: null,
    windDeg: 180,
    cloudPct: 10,
    rainPct: 0,
    feelsF: 70,
    dewF: 50,
    humidityPct: 50,
    ...change,
  }
}

describe('shownFeel', () => {
  test('the threshold is two degrees', () => {
    expect(FEEL_STANDS_OUT_F).toBe(2)
  })

  test('the feels-like where it stands out from the temperature, else none', () => {
    expect(shownFeel(hour({ tempF: 70, feelsF: 78 }))).toBe(78)
    expect(shownFeel(hour({ tempF: 70, feelsF: 72 }))).toBe(72)
    expect(shownFeel(hour({ tempF: 70, feelsF: 68 }))).toBe(68)
    expect(shownFeel(hour({ tempF: 70, feelsF: 71.9 }))).toBeNull()
    expect(shownFeel(hour({ tempF: 70, feelsF: 70 }))).toBeNull()
  })

  test('nothing to set it against, or no feels-like, is none', () => {
    expect(shownFeel(hour({ tempF: null, feelsF: 78 }))).toBeNull()
    expect(shownFeel(hour({ feelsF: null }))).toBeNull()
  })
})
