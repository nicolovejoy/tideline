// Sunset, moonrise and moon phase, computed on the device. Times are for a
// level horizon, which is what most weather sites show, except where the
// spot's own height is counted (`horizon.ts`).

import {
  Body,
  Equator,
  Horizon,
  Illumination,
  MoonPhase,
  Observer,
  SearchMoonQuarter,
  SearchRiseSet,
} from 'astronomy-engine'
import type { Spot } from '../spot.ts'
import type { Span } from './cache.ts'
import { DAY, HOUR, MINUTE, addDays, localDayStart } from '../time.ts'
import { seenFromFt } from './horizon.ts'

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
  /**
   * The parts of this local day when the sun is below the horizon, in
   * order: usually midnight to sunrise and sunset to midnight. The whole
   * day in polar night, none of it under the midnight sun.
   */
  night: Span[]
  /** The moonrise inside this local day, if there is one. */
  moonrise: number | null
  /** Lit fraction of the moon, 0 to 1, at sunset. */
  illumination: number
  phase: PhaseName
  /** The moonrise within 2 hours either side of sunset, if there is one. */
  moonriseNearSunset: number | null
}

type Place = Pick<
  Spot,
  'lat' | 'lon' | 'timeZone' | 'elevationFt' | 'tideStation'
>

const FT_TO_M = 0.3048
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
    // The horizon is the sea, so the observer stands as far above the
    // ground it looks out over as above sea level. Zero is a level horizon.
    observer.height,
  )
  return found ? found.date.getTime() : null
}

/** Every rise and set of a body between `from` and `to`, in order. */
function riseAndSetTimes(
  body: Body,
  observer: Observer,
  from: number,
  to: number,
): { t: number; direction: number }[] {
  const events: { t: number; direction: number }[] = []
  for (const direction of [RISE, SET]) {
    let at = from
    while (at < to) {
      const t = riseOrSet(body, observer, direction, at, to - at)
      if (t === null) break
      events.push({ t, direction })
      at = t + MINUTE
    }
  }
  return events.sort((a, b) => a.t - b.t)
}

/** Whether the sun is below the horizon at an instant, over a level horizon. */
function sunIsDown(observer: Observer, t: number): boolean {
  const eq = Equator(Body.Sun, new Date(t), observer, true, true)
  return Horizon(new Date(t), observer, eq.ra, eq.dec, 'normal').altitude < 0
}

/**
 * The spans of a day when the sun is down. The sun's rises and sets are
 * walked in order: it is down from the start until the first rise, or from
 * the start if the first event is a rise. A day without either is wholly
 * night or wholly day, by the sun at its middle.
 */
function nightSpans(observer: Observer, start: number, end: number): Span[] {
  const events = riseAndSetTimes(Body.Sun, observer, start, end)
  if (events.length === 0) {
    return sunIsDown(observer, start + (end - start) / 2)
      ? [{ start, end }]
      : []
  }
  const spans: Span[] = []
  let down = events[0].direction === RISE
  let since = start
  for (const event of events) {
    if (event.direction === RISE && down) {
      spans.push({ start: since, end: toMinute(event.t)! })
      down = false
    } else if (event.direction === SET && !down) {
      since = toMinute(event.t)!
      down = true
    }
  }
  if (down) spans.push({ start: since, end })
  return spans
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
  // The height the times are worked out from, or 0. The library lowers the
  // horizon by the dip for that height, and bends the light as it is bent
  // for a ray that grazes the sea.
  const observer = new Observer(spot.lat, spot.lon, seenFromFt(spot) * FT_TO_M)
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

  const night = nightSpans(observer, start, end)

  // Where there is no sunset (far north in summer), describe the moon at
  // local midday instead.
  const at = sunset ?? start + (end - start) / 2

  return {
    date,
    sunset: toMinute(sunset),
    night,
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
