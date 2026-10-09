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
  return {
    index,
    date: astro.date,
    span: data.spans[index],
    astro,
    isToday: index === 0,
  }
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
