// Sunset, moonrise and moon phase, computed on the device. Times are for a
// flat sea-level horizon, which is what most weather sites show.

import {
  Body,
  Illumination,
  MoonPhase,
  Observer,
  SearchMoonQuarter,
  SearchRiseSet,
} from 'astronomy-engine'
import type { Spot } from '../spot.ts'
import { addDays, localDayStart } from '../time.ts'

export type PhaseName =
  | 'New Moon'
  | 'Waxing Crescent'
  | 'First Quarter'
  | 'Waxing Gibbous'
  | 'Full Moon'
  | 'Waning Gibbous'
  | 'Last Quarter'
  | 'Waning Crescent'

export interface DayAstro {
  /** Local calendar date, 'YYYY-MM-DD'. */
  date: string
  /** To the nearest minute, like every time in this record. */
  sunset: number | null
  /** The moonrise inside this local day, if there is one. */
  moonrise: number | null
  /** Lit fraction of the moon, 0 to 1, at sunset. */
  illumination: number
  phase: PhaseName
  /** The moonrise within 2 hours either side of sunset, if there is one. */
  moonriseNearSunset: number | null
}

type Place = Pick<Spot, 'lat' | 'lon' | 'timeZone'>

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const RISE = 1
const SET = -1
const QUARTERS: PhaseName[] = [
  'New Moon',
  'First Quarter',
  'Full Moon',
  'Last Quarter',
]

/**
 * Rise and set times are reported to the nearest minute, as almanacs and the
 * US Naval Observatory do. Cutting the seconds off instead would show a time
 * one minute early on about half of all days.
 */
function toMinute(t: number | null): number | null {
  return t === null ? null : Math.round(t / MINUTE) * MINUTE
}

/** The first rise or set at or after `from`, within `spanMs`, or null. */
function riseOrSet(
  body: Body,
  observer: Observer,
  direction: number,
  from: number,
  spanMs: number,
): number | null {
  const found = SearchRiseSet(
    body,
    observer,
    direction,
    new Date(from),
    spanMs / DAY,
  )
  return found ? found.date.getTime() : null
}

function phaseName(dayStart: number, dayEnd: number, at: number): PhaseName {
  // A principal phase is named on the local day it happens.
  const next = SearchMoonQuarter(new Date(dayStart))
  if (next.time.date.getTime() < dayEnd) return QUARTERS[next.quarter]

  const angle = MoonPhase(new Date(at))
  if (angle < 90) return 'Waxing Crescent'
  if (angle < 180) return 'Waxing Gibbous'
  if (angle < 270) return 'Waning Gibbous'
  return 'Waning Crescent'
}

export function dayAstro(spot: Place, date: string): DayAstro {
  const observer = new Observer(spot.lat, spot.lon, 0)
  // The local day is 23 or 25 hours long when the clocks change.
  const start = localDayStart(date, spot.timeZone)
  const end = localDayStart(addDays(date, 1), spot.timeZone)

  const sunset = riseOrSet(Body.Sun, observer, SET, start, end - start)
  const moonrise = riseOrSet(Body.Moon, observer, RISE, start, end - start)
  let moonriseNearSunset: number | null = null
  if (sunset !== null) {
    // The day's own moonrise is reused when it qualifies, so one event is
    // never reported as two slightly different instants.
    moonriseNearSunset =
      moonrise !== null && Math.abs(moonrise - sunset) <= 2 * HOUR
        ? moonrise
        : riseOrSet(Body.Moon, observer, RISE, sunset - 2 * HOUR, 4 * HOUR)
  }

  // Where there is no sunset (far north in summer), describe the moon at
  // local midday instead.
  const at = sunset ?? start + (end - start) / 2

  return {
    date,
    sunset: toMinute(sunset),
    moonrise: toMinute(moonrise),
    illumination: Illumination(Body.Moon, new Date(at)).phase_fraction,
    phase: phaseName(start, end, at),
    moonriseNearSunset: toMinute(moonriseNearSunset),
  }
}

export function astroForDays(
  spot: Place,
  startDate: string,
  days: number,
): DayAstro[] {
  return Array.from({ length: days }, (_, i) =>
    dayAstro(spot, addDays(startDate, i)),
  )
}
