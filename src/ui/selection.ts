// Which of the 14 days is on screen, the window of days the panels draw from
// it, the vertical lines drawn across its panels and the spans shaded on
// them. Plain functions.

import type { Band, Marker } from '../chart/Panel.tsx'
import type { DayAstro } from '../data/astro.ts'
import type { Span } from '../data/cache.ts'
import type { SpotData } from '../data/useSpotData.ts'
import { windowFor } from './spanView.ts'
import type { SpanChoice, DayWindow } from './spanView.ts'

export interface Selected {
  /** Its place in the 14 days. 0 is today. */
  index: number
  date: string
  span: Span
  /** The days the panels draw: the day itself, or three or seven from it. */
  window: DayWindow
  astro: DayAstro
  isToday: boolean
  /**
   * The instant the day is about: sunset, the moment the rest of the screen
   * is about, or the middle of the day where the sun does not set. The
   * cursor rests here on a day other than today, and the forecast counts as
   * reaching the day if it reaches this hour.
   */
  anchor: number
}

/**
 * The day on screen. `picked` is the date of the row last tapped, if any. A
 * date that is not one of the 14, such as yesterday's on a phone left open
 * past midnight, means today.
 */
export function selectedDay(
  data: Pick<SpotData, 'days' | 'spans'>,
  picked: string | null,
  choice: SpanChoice = 'day',
): Selected {
  const found = data.days.findIndex((day) => day.date === picked)
  const index = found === -1 ? 0 : found
  const astro = data.days[index]
  const span = data.spans[index]
  return {
    index,
    date: astro.date,
    span,
    window: windowFor(data.spans, index, choice),
    astro,
    isToday: index === 0,
    anchor: astro.sunset ?? (span.start + span.end) / 2,
  }
}

/**
 * The items that fall on a day, such as its highs and lows. One at midnight
 * belongs to the day it starts, not to both.
 */
export function onDay<T extends { t: number }>(items: T[], span: Span): T[] {
  return items.filter((item) => item.t >= span.start && item.t < span.end)
}

/**
 * The instants to draw a vertical line at: the day's sunset and moonrise,
 * and the current time when the day is today.
 */
export function dayMarkers(
  selected: Pick<Selected, 'astro' | 'isToday'>,
  now: number,
): Marker[] {
  const { sunset, moonrise } = selected.astro
  const markers: Marker[] = []
  if (selected.isToday) markers.push({ name: 'now', t: now })
  if (sunset !== null)
    markers.push({ name: 'sunset', t: sunset, label: 'Sunset' })
  if (moonrise !== null)
    markers.push({ name: 'moonrise', t: moonrise, label: 'Moonrise' })
  return markers
}

/** The spans to shade across every panel: the parts of the day the sun is down. */
export function dayBands(selected: Pick<Selected, 'astro'>): Band[] {
  return selected.astro.night.map((span) => ({ name: 'night', ...span }))
}

/** The same lines without their labels, for the panels that do not carry them. */
export function unlabelled(markers: Marker[]): Marker[] {
  return markers.map(({ name, t }) => ({ name, t }))
}
