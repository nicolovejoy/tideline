// The window of days the panels draw (one day, three or a week from the chosen
// day), the labels under the stack of panels and the words for the window.
// Plain functions.

import type { Band, Marker } from '../chart/Panel.tsx'
import type { DayAstro } from '../data/astro.ts'
import type { Span } from '../data/cache.ts'
import {
  DAY,
  HOUR,
  formatDay,
  formatTime,
  formatWeekday,
  hourMarks,
} from '../time.ts'
import { dayBands, dayMarkers, unlabelled } from './selection.ts'

export type SpanChoice = 'day' | 'days3' | 'week'

export const SPANS: { id: SpanChoice; days: number; words: string }[] = [
  { id: 'day', days: 1, words: 'Day' },
  { id: 'days3', days: 3, words: '3 days' },
  { id: 'week', days: 7, words: 'Week' },
]

/**
 * The choice beside one, to the right (1) or the left (-1), wrapping round
 * the ends as the arrow keys do in a group of radio buttons.
 */
export function spanBeside(choice: SpanChoice, direction: 1 | -1): SpanChoice {
  const at = SPANS.findIndex((s) => s.id === choice)
  const next = (at + direction + SPANS.length) % SPANS.length
  return SPANS[next].id
}

/** The instants the panels run between, and which of the 14 days they cover. */
export interface DayWindow extends Span {
  /** Indices in the 14 days, both included. */
  first: number
  last: number
}

/** The window from the chosen day, cut short where the 14 days end. */
export function windowFor(
  spans: Span[],
  index: number,
  choice: SpanChoice,
): DayWindow {
  const days = SPANS.find((s) => s.id === choice)?.days ?? 1
  const last = Math.min(index + days, spans.length) - 1
  return { start: spans[index].start, end: spans[last].end, first: index, last }
}

/**
 * The window a pinch or a drag has settled on, which can be any length and
 * start at any instant. It covers the days the zoom touches: the one holding
 * its start and the one holding its last instant, so a zoom that ends at
 * midnight does not claim the day after.
 */
export function zoomWindow(spans: Span[], zoom: Span): DayWindow {
  const dayAt = (t: number) => {
    const i = spans.findIndex((span) => t >= span.start && t < span.end)
    if (i !== -1) return i
    return t < spans[0].start ? 0 : spans.length - 1
  }
  return {
    start: zoom.start,
    end: zoom.end,
    first: dayAt(zoom.start),
    last: dayAt(zoom.end - 1),
  }
}

export interface StackLabel {
  t: number
  text: string
}

/** How far apart the labels are, in hours, for a window of this length. */
function labelStep(length: number): number {
  if (length <= 6 * HOUR) return 1
  if (length <= 12 * HOUR) return 3
  if (length <= 36 * HOUR) return 6
  if (length <= 4 * DAY) return 12
  return 24
}

/** An hour of the day as '12a', '3a', '12p' or '9p'. */
function hourText(hour: number): string {
  return `${hour % 12 || 12}${hour < 12 ? 'a' : 'p'}`
}

/**
 * The labels under the stack, spaced by how long the window is: every hour up
 * to 6 hours, every 3 up to 12, every 6 up to a day and a half, every 12 up to
 * 4 days and every 24 beyond. A midnight is named by its weekday where the
 * window covers more than one day, and the end is labelled only in a window
 * of one day, where it is the day's own closing hour. Marks are placed on
 * whole hours, so a window that starts between them begins at the next one.
 */
export function stackLabels(window: DayWindow, timeZone: string): StackLabel[] {
  const several = window.last > window.first
  const step = labelStep(window.end - window.start)
  const first = Math.ceil(window.start / HOUR) * HOUR
  return hourMarks(first, window.end, timeZone, step)
    .filter((mark) => !several || mark.t !== window.end)
    .map((mark) => ({
      t: mark.t,
      text:
        several && mark.hour === 0
          ? formatWeekday(mark.t, timeZone)
          : hourText(mark.hour),
    }))
}

/** The days the window covers, such as 'Thu Oct 8 to Wed Oct 14'. */
export function headingWords(
  days: { date: string }[],
  window: DayWindow,
): string {
  const first = formatDay(days[window.first].date)
  if (window.last === window.first) return first
  return `${first} to ${formatDay(days[window.last].date)}`
}

/** The cursor's time, with its weekday where the window covers several days. */
export function cursorWords(
  t: number,
  timeZone: string,
  window: DayWindow,
): string {
  const time = formatTime(t, timeZone)
  return window.last === window.first
    ? time
    : `${formatWeekday(t, timeZone)} ${time}`
}

/**
 * The lines across the panels: each day's sunset and moonrise, and the current
 * time on today. Over more than a day, spread across midnight, they lose
 * their names; a window under a day that crosses midnight keeps them.
 */
export function windowMarkers(
  days: DayAstro[],
  window: DayWindow,
  now: number,
): Marker[] {
  const several = window.last > window.first && window.end - window.start > DAY
  return days.slice(window.first, window.last + 1).flatMap((astro, i) => {
    const markers = dayMarkers({ astro, isToday: window.first + i === 0 }, now)
    return several ? unlabelled(markers) : markers
  })
}

/** The nights of every day in the window. */
export function windowBands(days: DayAstro[], window: DayWindow): Band[] {
  return days
    .slice(window.first, window.last + 1)
    .flatMap((astro) => dayBands({ astro }))
}
