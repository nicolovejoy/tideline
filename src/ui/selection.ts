// Which of the 14 days is on screen, and the vertical lines drawn across its
// panels. Plain functions.

import type { DayAstro } from '../data/astro.ts'
import type { Span } from '../data/cache.ts'
import type { SpotData } from '../data/useSpotData.ts'

export interface Selected {
  /** Its place in the 14 days. 0 is today. */
  index: number
  date: string
  span: Span
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
): Selected {
  const found = data.days.findIndex((day) => day.date === picked)
  const index = found === -1 ? 0 : found
  const astro = data.days[index]
  const span = data.spans[index]
  return {
    index,
    date: astro.date,
    span,
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
  selected: Selected,
  now: number,
): { name: string; t: number }[] {
  const { sunset, moonrise } = selected.astro
  const markers: { name: string; t: number }[] = []
  if (selected.isToday) markers.push({ name: 'now', t: now })
  if (sunset !== null) markers.push({ name: 'sunset', t: sunset })
  if (moonrise !== null) markers.push({ name: 'moonrise', t: moonrise })
  return markers
}
