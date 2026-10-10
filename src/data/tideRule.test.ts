import { describe, expect, test } from 'vitest'
import { TIDES_BELOW_FT, TIDES_WITHIN_MI, tidesApply } from './tideRule.ts'
import source from './tideRule.ts?raw'

describe('tidesApply', () => {
  test('the three hard-coded spots come out as they are shipped', () => {
    expect(tidesApply(8.6, 3)).toBe(true)
    expect(tidesApply(0.2, 0)).toBe(true)
    expect(tidesApply(6.3, 3997)).toBe(false)
  })
  test('within 25 mi and under 300 ft, both inclusive on the near side', () => {
    expect(TIDES_WITHIN_MI).toBe(25)
    expect(TIDES_BELOW_FT).toBe(300)
    expect(tidesApply(25, 299)).toBe(true)
    expect(tidesApply(25.1, 0)).toBe(false)
    expect(tidesApply(0, 300)).toBe(false)
    expect(tidesApply(636, 600)).toBe(false)
  })
  // The spot screen's words import this. An import here would bring the
  // station code into the bundle every open loads.
  test('imports nothing', () => {
    expect(source).not.toMatch(/^\s*(import|export .* from)\b/m)
  })
})
