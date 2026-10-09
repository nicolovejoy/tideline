// The arithmetic behind the panels: where an instant or a value falls on
// screen, and the SVG paths through a list of points. No SVG elements and
// no React here.

export interface Scale {
  (value: number): number
  /** The value at a screen position. */
  invert(position: number): number
}

export interface Point {
  /** UTC instant, epoch ms. */
  t: number
  v: number
}

/** A straight-line mapping from a range of values onto a range of pixels. */
export function linearScale(
  domain: [number, number],
  range: [number, number],
): Scale {
  const [d0, d1] = domain
  const [r0, r1] = range
  const slope = (r1 - r0) / (d1 - d0)
  const scale = (value: number) => r0 + (value - d0) * slope
  scale.invert = (position: number) => d0 + (position - r0) / slope
  return scale
}

/** Whole-number bounds that contain every value and are at least 1 apart. */
export function wholeBounds(values: number[]): [number, number] {
  let low = Infinity
  let high = -Infinity
  for (const value of values) {
    if (value < low) low = value
    if (value > high) high = value
  }
  if (low > high) return [0, 1]
  const floor = Math.floor(low)
  return [floor, Math.max(Math.ceil(high), floor + 1)]
}

/**
 * Bounds on multiples of `step` that contain every value and are at least one
 * step apart, such as 50 to 80 for temperatures between 52 and 78.
 */
export function steppedBounds(
  values: number[],
  step: number,
): [number, number] {
  let low = Infinity
  let high = -Infinity
  for (const value of values) {
    if (value < low) low = value
    if (value > high) high = value
  }
  if (low > high) return [0, step]
  // Adding 0 turns the -0 that a small negative `low` can produce into 0.
  const floor = Math.floor(low / step) * step + 0
  return [floor, Math.max(Math.ceil(high / step) * step, floor + step)]
}

/** The multiples of `step` from low to high, both included. */
export function wholeSteps(low: number, high: number, step: number): number[] {
  const steps: number[] = []
  // Adding 0 turns the -0 that a negative `low` can produce into 0.
  const first = Math.ceil(low / step) * step + 0
  for (let value = first; value <= high; value += step) steps.push(value)
  return steps
}

function at(point: Point, x: Scale, y: Scale): string {
  return `${x(point.t).toFixed(1)},${y(point.v).toFixed(1)}`
}

/**
 * An SVG path through the points in order. Where two neighbours are further
 * apart in time than `maxGap`, the line breaks instead of bridging the gap.
 */
export function linePath(
  points: Point[],
  x: Scale,
  y: Scale,
  maxGap = Infinity,
): string {
  let path = ''
  points.forEach((point, i) => {
    const joined = i > 0 && point.t - points[i - 1].t <= maxGap
    path += `${joined ? 'L' : 'M'}${at(point, x, y)}`
  })
  return path
}

/** The same line, closed down to `floor` so it can be filled. */
export function areaPath(
  points: Point[],
  x: Scale,
  y: Scale,
  floor: number,
): string {
  if (points.length === 0) return ''
  const first = x(points[0].t).toFixed(1)
  const last = x(points[points.length - 1].t).toFixed(1)
  return `${linePath(points, x, y)}L${last},${floor}L${first},${floor}Z`
}

/**
 * A staircase through values that each hold for `width`, as an hourly
 * forecast's do: level across each one, then straight up or down to the next.
 * Where the next value starts later than this one ends, the line breaks.
 */
export function stepPath(
  points: Point[],
  x: Scale,
  y: Scale,
  width: number,
): string {
  let path = ''
  points.forEach((point, i) => {
    const joined = i > 0 && point.t - points[i - 1].t <= width
    const level = y(point.v).toFixed(1)
    path += joined ? `V${level}` : `M${x(point.t).toFixed(1)},${level}`
    path += `H${x(point.t + width).toFixed(1)}`
  })
  return path
}
