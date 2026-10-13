// The small print under the panels: where the data comes from, how recent it
// is, and what went wrong if something did. Plain functions.

import type { Span } from '../data/cache.ts'
import { seenFromFt } from '../data/horizon.ts'
import type { Loaded } from '../data/load.ts'
import type { TideExtreme, TidePoint } from '../data/noaa.ts'
import type { Forecast } from '../data/nws.ts'
import type { ObservedDay } from '../data/observed.ts'
import { TIDES_WITHIN_MI } from '../data/tideRule.ts'
import { STATION_WITHIN_MI } from '../data/weatherRule.ts'
import type { NearStation, StationChoice } from '../data/weatherRule.ts'
import { hasOwnCurve, hasOwnGauge, hasTides } from '../spot.ts'
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

/** A spot's own height is said when it is this far from its cell's average. */
const HEIGHTS_APART_FT = 100

/** A height in whole feet with a thousands comma: '3,258 ft'. */
function feetHigh(ft: number): string {
  return `${Math.round(ft).toLocaleString('en-US')} ft`
}

/**
 * Why a spot has no tide, or null where it has one. Said in place of the
 * tide on the spot's screen, and on the add screen before it is saved.
 * Where the station is far and the spot is high, the distance: a far
 * station is the plainer fact.
 */
export function noTidesWords(
  spot: Pick<Spot, 'elevationFt' | 'nws' | 'tideStation'>,
): string | null {
  if (hasTides(spot)) return null
  const { id, name, distanceMi } = spot.tideStation
  const why =
    distanceMi > TIDES_WITHIN_MI
      ? `the nearest station, NOAA ${id} ${name}, is ${distanceMi} mi away`
      : spot.elevationFt !== null
        ? `the spot is ${feetHigh(spot.elevationFt)} above sea level`
        : `the forecast cell averages ${feetHigh(spot.nws.elevationFt)} above sea level`
  return `Tides are not shown here: ${why}.`
}

/** What is wrong with the highs and lows, if anything. */
function hiloWords(
  hilo: Loaded<TideExtreme[]>,
  today: string,
  timeZone: string,
): string[] {
  // Without this the table of highs and lows is simply missing, or stops
  // short of the last days, with nothing to say why.
  if (hilo.status === 'unavailable') return ['High and low times unavailable.']
  if (hilo.status === 'stale' && hilo.fetchedAt !== null) {
    const saved = when(hilo.fetchedAt, today, timeZone)
    return [
      `Couldn't refresh the high and low times. Showing those from ${saved}.`,
    ]
  }
  return []
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
  const ownCurve = hasOwnCurve(spot)
  const station = stationWords(spot.tideStation)
  // Highs and lows only says more than predictions only, so a station with
  // no curve does not get both tags.
  const parts = [
    !ownCurve
      ? `Tide: ${station}, highs and lows only. Curve interpolated between them, not NOAA's.`
      : ownGauge
        ? `Tide: ${station}.`
        : `Tide: ${station}, predictions only.`,
  ]

  // A curve made from the highs and lows is as stale as they are, and the
  // highs-and-lows sentence below says so once.
  if (
    ownCurve &&
    predictions.status === 'stale' &&
    predictions.fetchedAt !== null
  ) {
    const saved = when(predictions.fetchedAt, today, zone)
    parts.push(`Couldn't refresh. Showing predictions from ${saved}.`)
  }

  parts.push(...hiloWords(hilo, today, zone))

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

/**
 * The month view's caption: the station, and what is wrong with the highs
 * and lows if anything. Nothing about the curve or the gauge, since neither
 * is on that screen.
 */
export function monthCaption(
  spot: Spot,
  hilo: Loaded<TideExtreme[]>,
  today: string,
): string {
  return [
    `Tide: ${stationWords(spot.tideStation)}.`,
    ...hiloWords(hilo, today, spot.timeZone),
  ].join(' ')
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
  // average is well below it; where it is a beach under hills, well above.
  // Saying so stops the forecast looking wrong. Where the two are close
  // the spot's own height adds nothing.
  const own = spot.elevationFt
  const apart =
    own !== null && Math.abs(own - spot.nws.elevationFt) >= HEIGHTS_APART_FT
  const height = apart
    ? `which averages ${cell} above sea level; the spot itself is at ${feetHigh(own)}`
    : `${cell} above sea level`
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

/**
 * A station's name as NWS gives it, with an all-caps one put in title case:
 * 'LOS PRIETOS' is 'Los Prietos'. An id-like name of one word is left alone.
 */
export function weatherStationName(name: string): string {
  if (name !== name.toUpperCase() || !name.includes(' ')) return name
  return name
    .toLowerCase()
    .replace(/(^|[\s(])(\S)/g, (match) => match.toUpperCase())
}

/** 'NWS KSBA Santa Barbara, Santa Barbara Municipal Airport' */
function weatherStationWords(station: NearStation): string {
  return `NWS ${station.id} ${weatherStationName(station.name)}`
}

/**
 * Under the weather's caption on today: the station whose reports are
 * drawn, with its distance, its height and the latest report; or why today
 * is forecast only. Null on any other day, and while the station is still
 * being looked up with nothing saved.
 */
export function observedCaption(
  spot: Spot,
  station: Loaded<StationChoice>,
  observed: Loaded<ObservedDay>,
  today: Span,
  isToday: boolean,
): string | null {
  if (!isToday) return null
  const zone = spot.timeZone
  const choice = station.data
  if (choice === null) {
    return station.status === 'unavailable'
      ? "Today is forecast only: couldn't look up the weather stations near this spot."
      : null
  }
  const { serves, nearest } = choice
  if (serves === null) {
    if (nearest === null) {
      return 'Today is forecast only: NWS lists no weather station for this forecast cell.'
    }
    const name = `${nearest.id} ${weatherStationName(nearest.name)}`
    const why =
      nearest.distanceMi > STATION_WITHIN_MI
        ? `is ${nearest.distanceMi} mi away`
        : `is at ${feetHigh(nearest.elevationFt)} and this spot at ${feetHigh(spot.elevationFt ?? spot.nws.elevationFt)}`
    return `Today is forecast only: the nearest weather station, ${name}, ${why}.`
  }

  const named = `Observed: ${weatherStationWords(serves)}, ${serves.distanceMi} mi ${serves.direction}, at ${feetHigh(serves.elevationFt)}`
  // Rows from a station chosen earlier, or for another day, are not these.
  const day =
    observed.data !== null &&
    observed.data.stationId === serves.id &&
    observed.span !== null &&
    observed.span.start === today.start
      ? observed.data
      : null
  if (day === null) {
    const state =
      observed.status === 'unavailable' || observed.status === 'stale'
        ? 'Reports unavailable.'
        : 'Loading reports.'
    return `${named}. ${state}`
  }
  if (day.through === null) return `${named}. No reports yet today.`

  const parts = [`${named}, through ${formatTime(day.through, zone)}.`]
  const anySky = day.hours.some((hour) => hour.sky !== null)
  parts.push(
    anySky
      ? 'Sky is the cloud layer that covers most.'
      : 'It reports no sky, so sky is forecast.',
  )
  parts.push('Rain chance is forecast.')
  if (observed.status === 'stale') parts.push("Couldn't refresh the reports.")
  return parts.join(' ')
}

/**
 * What sunset and moonrise are worked out from, where that is the spot's
 * own height. Null where it is a level horizon, as it is at most spots and
 * on most weather sites. Said under the weather's caption and under the
 * month view's.
 */
export function sunCaption(
  spot: Pick<Spot, 'elevationFt' | 'tideStation'>,
): string | null {
  const from = seenFromFt(spot)
  if (from === 0) return null
  return `Sun and moon: times as seen from ${feetHigh(from)}, over a sea-level horizon. Hills in the way are not counted.`
}
