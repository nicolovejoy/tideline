// The wind's arrows: one per hour, at the hour's speed, pointing where the
// wind is going. Plain functions, so the thinning rule has tests and is
// ready for a panel that shows more than a day.

import { HOUR } from '../time.ts'
import type { Scale } from './scales.ts'

/** How long an arrow is drawn, in px. */
export const ARROW_LENGTH = 10
const HALF = ARROW_LENGTH / 2
/** An arrow pointing up, centred on the origin: a shaft and two barbs. */
export const ARROW_PATH = `M0,${HALF}V${-HALF}M${-3.5},${-HALF + 3.5}L0,${-HALF}L3.5,${-HALF + 3.5}`
/** The dot's radius, in px: a calm hour, or one with no direction. */
export const DOT_RADIUS = 2
/** The least distance between arrows, in px. Closer than this they are thinned. */
export const ARROW_GAP = 12

/** The steps the thinning can take, in hours. */
const STEPS = [1, 2, 3, 4, 6, 12, 24]

export interface Arrow {
  /** The instant it is drawn at: the middle of its hour. */
  t: number
  /** Its place on the panel's axis: the hour's wind speed. */
  v: number
  /** Degrees clockwise from up, or null for a dot: calm, or no direction. */
  angle: number | null
}

/** A speed that rounds to 0 mph. */
export function isCalm(mph: number): boolean {
  return Math.round(mph) === 0
}

/**
 * The way an arrow points, in degrees clockwise from up. NWS gives where
 * the wind comes from; the arrow is turned half a circle from it.
 */
export function arrowAngle(windDeg: number): number {
  return (windDeg + 180) % 360
}

/**
 * How many hours apart the arrows are drawn: the smallest step that keeps
 * them at least `gap` apart, from the steps that divide a day. An hour of
 * no width, before the panel is measured, takes the largest.
 */
export function arrowStep(hourWidth: number, gap = ARROW_GAP): number {
  const need = gap / hourWidth
  return STEPS.find((step) => step >= need) ?? STEPS[STEPS.length - 1]
}

/** How many pixels one hour takes on a time scale. */
export function hourWidth(x: Scale): number {
  return x(HOUR) - x(0)
}

/**
 * The arrows that keep their place: those whose hour, counted from the
 * start of the span drawn, is a multiple of the step. Counting from the
 * span and not from the first arrow keeps the same hours as the forecast's
 * first hour changes.
 */
export function thinArrows(
  arrows: Arrow[],
  spanStart: number,
  hourWidthPx: number,
  gap = ARROW_GAP,
): Arrow[] {
  const step = arrowStep(hourWidthPx, gap)
  if (step === 1) return arrows
  return arrows.filter(
    (arrow) => Math.floor((arrow.t - spanStart) / HOUR) % step === 0,
  )
}
