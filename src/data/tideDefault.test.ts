import { describe, expect, test } from 'vitest'
import * as resolve from './resolve.ts'
import {
  TIDES_BELOW_FT,
  TIDES_WITHIN_MI,
  defaultTidesShown,
} from './tideDefault.ts'
import source from './tideDefault.ts?raw'

describe('tideDefault', () => {
  test('resolve.ts hands on the same rule and numbers', () => {
    expect(resolve.defaultTidesShown).toBe(defaultTidesShown)
    expect(resolve.TIDES_WITHIN_MI).toBe(TIDES_WITHIN_MI)
    expect(resolve.TIDES_BELOW_FT).toBe(TIDES_BELOW_FT)
  })
  // The spot screen's words import this. An import here would bring the
  // station code into the bundle every open loads.
  test('imports nothing', () => {
    expect(source).not.toMatch(/^\s*(import|export .* from)\b/m)
  })
})
