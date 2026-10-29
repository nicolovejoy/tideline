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
 * the instant `about` still the same fraction of the way across it. An
 * `about` outside the window, such as a cursor left behind by a pan, is
 * taken at the nearer edge: zooming about an instant off the plot would
 * carry the window away from what is on screen at each press.
 */
export function zoomAbout(
  window: Span,
  about: number,
  factor: number,
  bounds: Span,
): Span {
  const at = Math.min(Math.max(about, window.start), window.end)
  const length = (window.end - window.start) / factor
  const fraction = (at - window.start) / (window.end - window.start)
  const start = at - fraction * length
  return held({ start, end: start + length }, bounds, at)
}

/**
 * A zoom held again to new bounds, as when the 14 days move on at midnight
 * and its start may now be before the first of them. A zoom still inside
 * them is kept as it is. Null, no zoom, stays null.
 */
export function heldToBounds(zoom: Span | null, bounds: Span): Span | null {
  if (zoom === null) return null
  if (zoom.start >= bounds.start && zoom.end <= bounds.end) return zoom
  return held(zoom, bounds, (zoom.start + zoom.end) / 2)
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

/** What a wheel event says, as far as the window is concerned. */
export interface Wheel {
  deltaX: number
  deltaY: number
  /** Set by Chrome, Edge and Firefox when the wheel is a trackpad pinch. */
  ctrlKey: boolean
  /** 0 for pixels, 1 for lines, 2 for pages. */
  deltaMode: number
}

/** How many pixels a line of wheel is counted as. */
const LINE = 16

/**
 * The window after a wheel event over a stack `width` pixels wide, with the
 * instant `about` under the pointer: a trackpad pinch zooms about it, and a
 * sideways swipe pans. A wheel turning up or down gives null, so the page
 * scrolls, as it does before the stack has a width.
 */
export function wheelWindow(
  window: Span,
  wheel: Wheel,
  width: number,
  about: number,
  bounds: Span,
): Span | null {
  if (width === 0) return null
  const unit = wheel.deltaMode === 0 ? 1 : LINE
  const dx = wheel.deltaX * unit
  const dy = wheel.deltaY * unit
  if (wheel.ctrlKey)
    return zoomAbout(window, about, Math.exp(-dy * 0.01), bounds)
  if (Math.abs(dx) <= Math.abs(dy)) return null
  return panBy(window, (dx / width) * (window.end - window.start), bounds)
}
