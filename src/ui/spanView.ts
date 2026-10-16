// The window of days the panels draw (one day, three or a week from the chosen
// day), the labels under the stack of panels and the words for the window.
// Plain functions.

import type { Band, Marker } from '../chart/Panel.tsx'
import type { DayAstro } from '../data/astro.ts'
import type { Span } from '../data/cache.ts'
import { formatDay, formatTime, formatWeekday, hourMarks } from '../time.ts'
import { dayBands, dayMarkers, unlabelled } from './selection.ts'

export type SpanChoice = 'day' | 'days3' | 'week'

export const SPANS: { id: SpanChoice; days: number; words: string }[] = [
  { id: 'day', days: 1, words: 'Day' },
  { id: 'days3', days: 3, words: '3 days' },
  { id: 'week', days: 7, words: 'Week' },
]

/** The instants the panels run between, and which of the 14 days they cover. */
export interface Window extends Span {
  /** Indices in the 14 days, both included. */
  first: number
  last: number
}

const HOUR_LABELS: Record<number, string> = {
  0: '12a',
  6: '6a',
  12: '12p',
  18: '6p',
}

/** The window from the chosen day, cut short where the 14 days end. */
export function windowFor(
  spans: Span[],
  index: number,
  choice: SpanChoice,
): Window {
  const days = SPANS.find((s) => s.id === choice)?.days ?? 1
  const last = Math.min(index + days, spans.length) - 1
  return { start: spans[index].start, end: spans[last].end, first: index, last }
}

export interface StackLabel {
  t: number
  text: string
}

/**
 * The labels under the stack. A window of one day has the hours 12a, 6a, 12p
 * and 6p, both midnights included, whatever span was chosen: three days or a
 * week from the last of the 14 days is one day. Wider windows label each
 * day's start with its weekday, and for three days its noon, and leave the
 * end unlabelled.
 */
export function stackLabels(
  window: Window,
  timeZone: string,
  choice: SpanChoice,
): StackLabel[] {
  if (window.last === window.first) {
    return hourMarks(window.start, window.end, timeZone, 6).map((mark) => ({
      t: mark.t,
      text: HOUR_LABELS[mark.hour],
    }))
  }
  const every = choice === 'days3' ? 12 : 24
  return hourMarks(window.start, window.end, timeZone, every)
    .filter((mark) => mark.t !== window.end)
    .map((mark) => ({
      t: mark.t,
      text: mark.hour === 0 ? formatWeekday(mark.t, timeZone) : '12p',
    }))
}

/** The days the window covers, such as 'Thu Oct 8 to Wed Oct 14'. */
export function headingWords(days: { date: string }[], window: Window): string {
  const first = formatDay(days[window.first].date)
  if (window.last === window.first) return first
  return `${first} to ${formatDay(days[window.last].date)}`
}

/** The cursor's time, with its weekday where the window covers several days. */
export function cursorWords(
  t: number,
  timeZone: string,
  window: Window,
): string {
  const time = formatTime(t, timeZone)
  return window.last === window.first
    ? time
    : `${formatWeekday(t, timeZone)} ${time}`
}

/**
 * The lines across the panels: each day's sunset and moonrise, and the current
 * time on today. Over several days they lose their names.
 */
export function windowMarkers(
  days: DayAstro[],
  window: Window,
  now: number,
): Marker[] {
  const several = window.last > window.first
  return days.slice(window.first, window.last + 1).flatMap((astro, i) => {
    const markers = dayMarkers({ astro, isToday: window.first + i === 0 }, now)
    return several ? unlabelled(markers) : markers
  })
}

/** The nights of every day in the window. */
export function windowBands(days: DayAstro[], window: Window): Band[] {
  return days
    .slice(window.first, window.last + 1)
    .flatMap((astro) => dayBands({ astro }))
}
