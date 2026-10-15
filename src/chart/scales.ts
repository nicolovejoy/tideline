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

/** Where a staircase is cut, and which side of the cut is drawn. */
export interface Cut {
  at: number
  /**
   * 'before': the step containing `at` ends there, and steps from `at` on are
   * not drawn. 'after': the step containing `at` starts there; steps before
   * it are drawn whole, since they may be what fills a gap on that side.
   */
  keep: 'before' | 'after'
}

/**
 * A staircase through values that each hold for `width`, as an hourly
 * forecast's do: level across each one, then straight up or down to the next.
 * Where the next value starts later than this one ends, the line breaks, and
 * so it does on either side of a cut.
 */
export function stepPath(
  points: Point[],
  x: Scale,
  y: Scale,
  width: number,
  cut?: Cut,
): string {
  let path = ''
  // Where the last step drawn ended in time, or null before the first.
  let drawnTo: number | null = null
  for (const point of points) {
    let from = point.t
    let to = point.t + width
    if (cut) {
      if (cut.keep === 'before') {
        if (from >= cut.at) continue
        if (to > cut.at) to = cut.at
      } else if (from < cut.at && cut.at < to) {
        from = cut.at
      }
    }
    const level = y(point.v).toFixed(1)
    const joined = drawnTo !== null && from === point.t && from <= drawnTo
    path += joined ? `V${level}` : `M${x(from).toFixed(1)},${level}`
    path += `H${x(to).toFixed(1)}`
    drawnTo = to
  }
  return path
}

/** About how wide a marker's label is drawn, from its length: 7 px a character at 0.8rem semibold. */
export function labelWidth(label: string): number {
  return label.length * 7
}

export interface LabelPlace {
  /** Where the text starts or ends, and which end `x` is. */
  x: number
  anchor: 'start' | 'end'
}

/**
 * Where each of a panel's labels stands, so that none print over another.
 * A label stands to the right of its line, or to the left where the line is
 * in the last fifth of the width. Where two labels would overlap, the
 * earlier goes to the left of its line and the later to the right. A left
 * and a right label on lines in time order cannot overlap, so one split
 * always resolves it. `lines` are in time
 * order; `gap` is the space between a line and its label.
 */
export function placeLabels(
  lines: { x: number; width: number }[],
  plotWidth: number,
  gap = 6,
): LabelPlace[] {
  const sides = lines.map((line) =>
    line.x > plotWidth * 0.8 ? 'left' : 'right',
  )
  const box = (i: number): [number, number] => {
    const { x, width } = lines[i]
    return sides[i] === 'right'
      ? [x + gap, x + gap + width]
      : [x - gap - width, x - gap]
  }
  const overlap = (a: number, b: number) => {
    const [a0, a1] = box(a)
    const [b0, b1] = box(b)
    return a0 <= b1 && b0 <= a1
  }
  // A line with no label (width 0) takes a slot but is not in anyone's way.
  let previous = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].width === 0) continue
    if (previous >= 0 && overlap(previous, i)) {
      sides[previous] = 'left'
      sides[i] = 'right'
    }
    previous = i
  }
  return lines.map((line, i) => {
    return sides[i] === 'right'
      ? { x: line.x + gap, anchor: 'start' }
      : { x: line.x - gap, anchor: 'end' }
  })
}
