// The small print under the panels: where the data comes from, how recent it
// is, and what went wrong if something did. Plain functions.

import type { Loaded } from '../data/load.ts'
import type { TideExtreme, TidePoint } from '../data/noaa.ts'
import type { Forecast } from '../data/nws.ts'
import { hasOwnGauge } from '../spot.ts'
import type { Spot, Station } from '../spot.ts'
import { formatDay, formatTime, localDate } from '../time.ts'

/** A time, with its day in front when that day is not today. */
function when(t: number, today: string, timeZone: string): string {
  const day = localDate(t, timeZone)
  const time = formatTime(t, timeZone)
  return day === today ? time : `${formatDay(day)}, ${time}`
}

/** 'NOAA 9411340 Santa Barbara, 8.6 mi east' */
function stationWords(station: Station): string {
  const { id, name, distanceMi, direction } = station
  return `NOAA ${id} ${name}, ${distanceMi} mi ${direction}`
}

/** A height in whole feet with a thousands comma: '3,258 ft'. */
function feetHigh(ft: number): string {
  return `${Math.round(ft).toLocaleString('en-US')} ft`
}

export interface TideSources {
  predictions: Loaded<TidePoint[]>
  hilo: Loaded<TideExtreme[]>
  observed: Loaded<TidePoint[]>
  /** The readings that are drawn, or read out, in order. Only today has any. */
  readings: TidePoint[]
  /** Today's date at the spot. */
  today: string
  /** Whether the day on screen is today. Readings belong to today only. */
  isToday: boolean
}

export function tideCaption(spot: Spot, tide: TideSources): string {
  const zone = spot.timeZone
  const { predictions, hilo, observed, readings, today } = tide
  const ownGauge = hasOwnGauge(spot)
  const parts = [
    ownGauge
      ? `Tide: ${stationWords(spot.tideStation)}.`
      : `Tide: ${stationWords(spot.tideStation)}, predictions only.`,
  ]

  if (predictions.status === 'stale' && predictions.fetchedAt !== null) {
    const saved = when(predictions.fetchedAt, today, zone)
    parts.push(`Couldn't refresh. Showing predictions from ${saved}.`)
  }

  // Without this the table of highs and lows is simply missing, or stops
  // short of the last days, with nothing to say why.
  if (hilo.status === 'unavailable') {
    parts.push('High and low times unavailable.')
  } else if (hilo.status === 'stale' && hilo.fetchedAt !== null) {
    const saved = when(hilo.fetchedAt, today, zone)
    parts.push(
      `Couldn't refresh the high and low times. Showing those from ${saved}.`,
    )
  }

  if (!tide.isToday) return parts.join(' ')

  const last = readings[readings.length - 1]
  // A gauge elsewhere is named, with its distance, before its reading.
  const gauge = ownGauge ? null : `Gauge: ${stationWords(spot.gauge)}`
  if (last) {
    const through = formatTime(last.t, zone)
    parts.push(
      gauge
        ? `${gauge}, observed through ${through}, preliminary.`
        : `Observed through ${through}, preliminary.`,
    )
  } else if (gauge) {
    parts.push(`${gauge}.`)
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

/** The weather caption. `today` is today's date at the spot. */
export function weatherCaption(
  spot: Spot,
  forecast: Loaded<Forecast>,
  today: string,
): string {
  const zone = spot.timeZone
  const cell = feetHigh(spot.nws.elevationFt)
  // The cell is an average over 2.5 km. Where the spot is a peak, that
  // average is well below it, and saying so stops the forecast looking
  // wrong.
  const height =
    spot.elevationFt === null
      ? `${cell} above sea level`
      : `which averages ${cell} above sea level; the spot itself is at ${feetHigh(spot.elevationFt)}`
  const source = `Weather: NWS forecast for the 2.5 km cell at this spot, ${height}.`
  if (forecast.data === null) return source

  const updated = when(forecast.data.updatedAt, today, zone)
  const parts = [source, `Updated ${updated}.`]
  if (forecast.status === 'stale' && forecast.fetchedAt !== null) {
    const saved = when(forecast.fetchedAt, today, zone)
    parts.push(`Couldn't refresh. Showing the forecast from ${saved}.`)
  }
  return parts.join(' ')
}
