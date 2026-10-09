import { describe, expect, test } from 'vitest'
import { SLOP, isSideways, isTap } from './gesture.ts'

describe('isSideways', () => {
  test('a clear sideways movement is a drag', () => {
    expect(isSideways(20, 2)).toBe(true)
    expect(isSideways(-20, 2)).toBe(true)
  })

  test('a movement that is mostly up or down is not', () => {
    expect(isSideways(8, 30)).toBe(false)
    expect(isSideways(8, -30)).toBe(false)
  })

  test('nothing counts until the finger has travelled the slop distance', () => {
    expect(isSideways(SLOP - 1, 0)).toBe(false)
    expect(isSideways(SLOP, 0)).toBe(true)
  })

  test('an exact diagonal is treated as a scroll', () => {
    expect(isSideways(10, 10)).toBe(false)
  })
})

describe('isTap', () => {
  test('a finger that barely moved was a tap', () => {
    expect(isTap(0, 0)).toBe(true)
    expect(isTap(3, -3)).toBe(true)
  })

  test('a finger that moved the slop distance or more was not', () => {
    expect(isTap(SLOP, 0)).toBe(false)
    expect(isTap(5, 5)).toBe(false)
  })
})
