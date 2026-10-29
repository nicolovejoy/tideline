// Which of the 14 days is on screen, the window of days the panels draw from
// it, the vertical lines drawn across its panels and the spans shaded on
// them. Plain functions.

import type { Band, Marker } from '../chart/Panel.tsx'
import type { DayAstro } from '../data/astro.ts'
import type { Span } from '../data/cache.ts'
import type { SpotData } from '../data/useSpotData.ts'
import { windowFor, zoomWindow } from './spanView.ts'
import type { SpanChoice, DayWindow } from './spanView.ts'

export interface Selected {
  /** Its place in the 14 days. 0 is today. */
  index: number
  date: string
  span: Span
  /** The days the panels draw: the day itself, or three or seven from it. */
  window: DayWindow
  astro: DayAstro
  /** Whether the chosen day is today. The cursor rests by it. */
  isToday: boolean
  /**
   * Whether the window reaches into today, which a zoom panned back from
   * tomorrow does though the chosen day is not today. Today's observed side,
   * the gauge's readings and the station's rows, is drawn by this.
   */
  showsToday: boolean
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
  zoom: Span | null = null,
): Selected {
  const found = data.days.findIndex((day) => day.date === picked)
  const index = found === -1 ? 0 : found
  const astro = data.days[index]
  const span = data.spans[index]
  const window = zoom
    ? zoomWindow(data.spans, zoom)
    : windowFor(data.spans, index, choice)
  return {
    index,
    date: astro.date,
    span,
    window,
    astro,
    isToday: index === 0,
    // The same test as the line at the current time, in windowMarkers.
    showsToday: window.first === 0,
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
 * The hours, each starting at `t` and lasting `length`, that any part of a
 * window shows. A zoom can start or end mid-hour, and the hour it cuts into
 * is drawn as far as the plot goes, not left blank.
 */
export function overlapping<T extends { t: number }>(
  items: T[],
  window: Span,
  length: number,
): T[] {
  return items.filter(
    (item) => item.t + length > window.start && item.t < window.end,
  )
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
