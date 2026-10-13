// A day's reports from a weather station turned into one row for each hour,
// as the forecast has, so the two can be drawn on one axis. Plain functions.

import type { Span } from './cache.ts'
import type { Loaded } from './load.ts'
import type { Report, Sky } from './nwsObservations.ts'
import type { StationChoice } from './weatherRule.ts'
import { HOUR, MINUTE } from '../time.ts'

export interface ObservedHour {
  /** Start of the hour, UTC instant in epoch ms. */
  t: number
  tempF: number | null
  windMph: number | null
  /** The highest gust reported in the hour, or null where none was. */
  gustMph: number | null
  windDeg: number | null
  sky: Sky | null
}

/** What is saved for a spot's day: the rows, not the reports. */
export interface ObservedDay {
  /** The station the rows came from. */
  stationId: string
  /** When the latest report of the day was taken, or null before the first. */
  through: number | null
  hours: ObservedHour[]
}

/** How far from the top of an hour a report may be and still stand for it. */
export const REPORT_WITHIN = 30 * MINUTE

function row(
  t: number,
  base: Report | null,
  gustMph: number | null,
): ObservedHour {
  return {
    t,
    tempF: base?.tempF ?? null,
    windMph: base?.windMph ?? null,
    gustMph,
    windDeg: base?.windDeg ?? null,
    sky: base?.sky ?? null,
  }
}

/**
 * One row for each hour of the day that has begun, from the reports:
 *
 * - An hour that has ended takes the report nearest its top, from the half
 *   hour either side; on a tie, the later one.
 * - The current hour takes the latest report, if it is no older than half an
 *   hour before the hour began.
 * - The hour's gust is the highest in any report stamped within it. Stations
 *   give a gust only when there is one, so an hour with reports and no gust
 *   has none.
 *
 * An hour with neither has no row. A report stamped after `now` is not used.
 */
export function observedHours(
  reports: Report[],
  day: Span,
  now: number,
): ObservedHour[] {
  const usable = reports.filter((report) => report.t <= now)
  const hours: ObservedHour[] = []
  for (let t = day.start; t < day.end && t <= now; t += HOUR) {
    const ended = t + HOUR <= now
    let base: Report | null = null
    if (ended) {
      let nearest = Infinity
      for (const report of usable) {
        const distance = Math.abs(report.t - t)
        if (distance <= REPORT_WITHIN && distance <= nearest) {
          base = report
          nearest = distance
        }
      }
    } else {
      for (const report of usable) {
        if (report.t >= t - REPORT_WITHIN) base = report
      }
    }
    let gustMph: number | null = null
    for (const report of usable) {
      if (report.t >= t && report.t < t + HOUR && report.gustMph !== null) {
        gustMph =
          gustMph === null ? report.gustMph : Math.max(gustMph, report.gustMph)
      }
    }
    if (base !== null || gustMph !== null) hours.push(row(t, base, gustMph))
  }
  return hours
}

/** The rows for a spot's day from one station, with the time of the latest report. */
export function observedDay(
  stationId: string,
  reports: Report[],
  day: Span,
  now: number,
): ObservedDay {
  let through: number | null = null
  for (const report of reports) {
    if (
      report.t >= day.start &&
      report.t <= now &&
      (through === null || report.t > through)
    ) {
      through = report.t
    }
  }
  return { stationId, through, hours: observedHours(reports, day, now) }
}

/**
 * Where an observed sky sits on the percent axis: the middle of the range
 * its category stands for, in eighths of the sky. Few is 1 to 2, scattered
 * 3 to 4, broken 5 to 7, overcast 8.
 */
export function skyPct(sky: Sky): number {
  switch (sky) {
    case 'clear':
      return 0
    case 'few':
      return 19
    case 'scattered':
      return 44
    case 'broken':
      return 75
    case 'overcast':
      return 100
  }
}

const SKIES = new Set(['clear', 'few', 'scattered', 'broken', 'overcast'])

function isObservedHour(value: unknown): value is ObservedHour {
  if (typeof value !== 'object' || value === null) return false
  const hour = value as Record<string, unknown>
  const number = (field: string) =>
    hour[field] === null || typeof hour[field] === 'number'
  return (
    typeof hour.t === 'number' &&
    number('tempF') &&
    number('windMph') &&
    number('gustMph') &&
    number('windDeg') &&
    (hour.sky === null || (typeof hour.sky === 'string' && SKIES.has(hour.sky)))
  )
}

/** Whether saved data has the shape of an observed day. For the cache. */
export function isObservedDay(data: unknown): data is ObservedDay {
  if (typeof data !== 'object' || data === null) return false
  const day = data as Record<string, unknown>
  return (
    typeof day.stationId === 'string' &&
    'through' in day &&
    (day.through === null || typeof day.through === 'number') &&
    Array.isArray(day.hours) &&
    day.hours.every(isObservedHour)
  )
}

/**
 * The rows to draw today: those saved for the station that serves the spot.
 * None where no station serves, where none is known yet, or where the saved
 * rows are from a station chosen earlier.
 */
export function todaysObserved(
  station: Loaded<StationChoice>,
  observed: Loaded<ObservedDay>,
): ObservedHour[] {
  const serves = station.data?.serves ?? null
  const day = observed.data
  if (serves === null || day === null || day.stationId !== serves.id) return []
  return day.hours
}
