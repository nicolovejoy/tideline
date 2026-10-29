// The window a stack of panels shows when it is pinched or dragged: where it
// starts, how long it is, and what keeps it inside the days there is data
// for. Plain functions; PanelStack applies them to pointer events.

import type { Span } from '../data/cache.ts'
import { DAY, HOUR } from '../time.ts'
import { SLOP } from './gesture.ts'

/** The shortest window, in milliseconds: below this the curves are a few points. */
export const MIN_WINDOW = 3 * HOUR

/** The longest window, in milliseconds: the widest span the buttons offer. */
export const MAX_WINDOW = 7 * DAY

/**
 * The window with its length brought into range for the bounds, `about`
 * kept at the same fraction of it, and then slid, length kept, to lie inside
 * the bounds. Where the bounds are shorter than the minimum, they win.
 */
export function held(window: Span, bounds: Span, about: number): Span {
  const length = window.end - window.start
  const fraction = length === 0 ? 0 : (about - window.start) / length
  const longest = Math.min(MAX_WINDOW, bounds.end - bounds.start)
  const next = Math.min(Math.max(length, MIN_WINDOW), longest)
  let start = about - fraction * next
  start = Math.min(start, bounds.end - next)
  start = Math.max(start, bounds.start)
  return { start, end: start + next }
}

/**
 * The window made shorter by `factor` (above 1 zooms in, below 1 out), with
 * the instant `about` still the same fraction of the way across it.
 */
export function zoomAbout(
  window: Span,
  about: number,
  factor: number,
  bounds: Span,
): Span {
  const length = (window.end - window.start) / factor
  const fraction = (about - window.start) / (window.end - window.start)
  const start = about - fraction * length
  return held({ start, end: start + length }, bounds, about)
}

/** The window moved by `dt` milliseconds, as far as the bounds allow. */
export function panBy(window: Span, dt: number, bounds: Span): Span {
  return held(
    { start: window.start + dt, end: window.end + dt },
    bounds,
    window.start + dt,
  )
}

/**
 * The window after two fingers have moved. `from` and `to` are the fingers'
 * x in pixels from the stack's left, when the pinch began and now, and
 * `begun` is the window then. The instants that were under the fingers are
 * put under them again. Fingers too close to tell apart, or that have
 * crossed, would make the scale wild or flip it, so then only the midpoint
 * counts and the window is panned.
 */
export function pinchWindow(
  begun: Span,
  width: number,
  from: [number, number],
  to: [number, number],
  bounds: Span,
): Span {
  const length = begun.end - begun.start
  const at = (x: number) => begun.start + (x / width) * length
  const apartFrom = from[1] - from[0]
  const apartTo = to[1] - to[0]
  const midFrom = (from[0] + from[1]) / 2
  const midTo = (to[0] + to[1]) / 2
  const pans =
    Math.abs(apartFrom) < SLOP ||
    Math.abs(apartTo) < SLOP ||
    Math.sign(apartFrom) !== Math.sign(apartTo)
  if (pans) return panBy(begun, -((midTo - midFrom) / width) * length, bounds)
  const next = ((at(from[1]) - at(from[0])) / apartTo) * width
  const start = at(from[0]) - (to[0] / width) * next
  const about = start + (midTo / width) * next
  return held({ start, end: start + next }, bounds, about)
}
