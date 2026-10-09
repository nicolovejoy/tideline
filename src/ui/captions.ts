// The small print under the panels: where the data comes from, how recent it
// is, and what went wrong if something did. Plain functions.

import type { Loaded } from '../data/load.ts'
import type { TidePoint } from '../data/noaa.ts'
import type { Spot } from '../spot.ts'
import { formatDay, formatTime, localDate } from '../time.ts'

/** A time, with its day in front when that day is not today. */
function when(t: number, today: string, timeZone: string): string {
  const day = localDate(t, timeZone)
  const time = formatTime(t, timeZone)
  return day === today ? time : `${formatDay(day)}, ${time}`
}

/**
 * The tide caption. `observedToday` is the readings that fall in the day on
 * screen, in order, and `today` is that day's date at the spot.
 */
export function tideCaption(
  spot: Spot,
  predictions: Loaded<TidePoint[]>,
  observed: Loaded<TidePoint[]>,
  observedToday: TidePoint[],
  today: string,
): string {
  const zone = spot.timeZone
  const { id, name, distanceMi, direction } = spot.tideStation
  const parts = [`Tide: NOAA ${id} ${name}, ${distanceMi} mi ${direction}.`]

  if (predictions.status === 'stale' && predictions.fetchedAt !== null) {
    const saved = when(predictions.fetchedAt, today, zone)
    parts.push(`Couldn't refresh. Showing predictions from ${saved}.`)
  }

  const last = observedToday[observedToday.length - 1]
  if (last) {
    const through = formatTime(last.t, zone)
    parts.push(`Observed through ${through}, preliminary.`)
  }
  if (observed.status === 'stale') {
    parts.push("Couldn't refresh the observed level.")
  } else if (observed.status === 'unavailable') {
    parts.push('Observed level unavailable.')
  } else if (!last && observed.status === 'ready') {
    parts.push('No observed readings yet today.')
  }

  return parts.join(' ')
}
