import { describe, expect, test } from 'vitest'
import {
  areaPath,
  linePath,
  linearScale,
  wholeBounds,
  wholeSteps,
} from './scales.ts'

describe('linearScale', () => {
  test('maps the ends of the domain to the ends of the range', () => {
    const scale = linearScale([100, 200], [0, 360])
    expect(scale(100)).toBe(0)
    expect(scale(200)).toBe(360)
    expect(scale(150)).toBe(180)
  })

  test('works upside down, as a vertical axis needs', () => {
    const scale = linearScale([0, 6], [168, 12])
    expect(scale(0)).toBe(168)
    expect(scale(6)).toBe(12)
  })

  test('invert undoes the mapping', () => {
    const scale = linearScale([100, 200], [0, 360])
    expect(scale.invert(90)).toBe(125)
    expect(scale.invert(scale(173))).toBeCloseTo(173, 9)
  })

  test('invert works when the range does not start at zero', () => {
    const scale = linearScale([0, 6], [168, 14])
    expect(scale.invert(168)).toBe(0)
    expect(scale.invert(14)).toBe(6)
    expect(scale.invert(91)).toBeCloseTo(3, 9)
  })
})

describe('wholeBounds', () => {
  test('rounds outward to whole numbers', () => {
    expect(wholeBounds([0.189, 5.449, 3.1])).toEqual([0, 6])
  })

  test('goes below zero for a tide below the datum', () => {
    expect(wholeBounds([-0.3, 4.2])).toEqual([-1, 5])
  })

  test('is never zero tall', () => {
    expect(wholeBounds([2, 2])).toEqual([2, 3])
  })

  test('has a fallback when there are no values', () => {
    expect(wholeBounds([])).toEqual([0, 1])
  })
})

describe('wholeSteps', () => {
  test('lists the multiples of the step inside the bounds', () => {
    expect(wholeSteps(0, 6, 2)).toEqual([0, 2, 4, 6])
    expect(wholeSteps(-1, 7, 2)).toEqual([0, 2, 4, 6])
    expect(wholeSteps(-2, 1, 2)).toEqual([-2, 0])
  })
})

describe('paths', () => {
  const x = linearScale([0, 10], [0, 10])
  const y = linearScale([0, 10], [10, 0])
  const points = [
    { t: 0, v: 0 },
    { t: 5, v: 5 },
    { t: 10, v: 10 },
  ]

  test('a line goes through the points in order', () => {
    expect(linePath(points, x, y)).toBe('M0.0,10.0L5.0,5.0L10.0,0.0')
  })

  test('a line breaks where neighbours are too far apart', () => {
    const gapped = [...points, { t: 30, v: 0 }, { t: 35, v: 5 }]
    expect(linePath(gapped, x, y, 5)).toBe(
      'M0.0,10.0L5.0,5.0L10.0,0.0M30.0,10.0L35.0,5.0',
    )
  })

  test('an area is the line closed down to the floor', () => {
    expect(areaPath(points, x, y, 10)).toBe(
      'M0.0,10.0L5.0,5.0L10.0,0.0L10.0,10L0.0,10Z',
    )
  })

  test('no points means no path', () => {
    expect(linePath([], x, y)).toBe('')
    expect(areaPath([], x, y, 10)).toBe('')
  })
})
