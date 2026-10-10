// The month view: which months are offered, how to step between them, and
// one row per day with its sunset, moon and highs and lows. Plain functions.

import { dayAstro } from '../data/astro.ts'
import type { Loaded } from '../data/load.ts'
import type { TideExtreme } from '../data/noaa.ts'
import { MONTHS_AHEAD } from '../data/useSpotData.ts'
import type { Spot } from '../spot.ts'
import {
  addDays,
  addMonths,
  datesOfMonth,
  formatDay,
  formatMonth,
  localDayStart,
  monthOf,
} from '../time.ts'
import { flagWords, moonWords, sunsetWords, tideLines } from './dayList.ts'

/** This month and the next MONTHS_AHEAD, as 'YYYY-MM', in order. */
export function monthsOffered(today: string): string[] {
  const first = monthOf(today)
  return Array.from({ length: MONTHS_AHEAD + 1 }, (_, i) => addMonths(first, i))
}

export interface MonthNav {
  /** The month on screen, 'YYYY-MM'. */
  month: string
  /** 'October 2026' */
  title: string
  /** The offered months either side, or null at an end. */
  prev: string | null
  next: string | null
}

/**
 * Where a month stands among those offered. No month, or one that is not
 * offered, such as the month that ended on a phone left open into the
 * first of the next, means this month.
 */
export function monthNav(month: string | null, today: string): MonthNav {
  const offered = monthsOffered(today)
  const found = offered.indexOf(month ?? '')
  const index = found === -1 ? 0 : found
  return {
    month: offered[index],
    title: formatMonth(offered[index]),
    prev: index > 0 ? offered[index - 1] : null,
    next: index < offered.length - 1 ? offered[index + 1] : null,
  }
}

export interface MonthRow {
  date: string
  /** The weekday and date, such as 'Sat Oct 10'. */
  day: string
  isToday: boolean
  sunset: string
  /** With the phase: 'Moon 1% lit, new moon'. */
  moon: string
  /** The moonrise within 2 hours of sunset, when there is one. */
  flag: string | null
  /** The day's highs and lows in order, such as 'Low 2:35 AM 0.2 ft'. */
  tides: string[]
}

interface Inputs {
  /** Today's date at the spot. */
  today: string
  hilo: Loaded<TideExtreme[]>
}

/**
 * One row per day of the month, from today where the month is this one. The
 * month is read as monthNav reads it. With the tide hidden the rows list no
 * highs and lows; where the saved highs and lows stop short, the rows past
 * them have none either.
 */
export function monthRows(
  spot: Spot,
  month: string | null,
  data: Inputs,
  tidesShown: boolean,
): MonthRow[] {
  const zone = spot.timeZone
  const shown = monthNav(month, data.today).month
  const dates = datesOfMonth(shown).filter((date) => date >= data.today)
  const events = tidesShown ? (data.hilo.data ?? []) : []
  return dates.map((date) => {
    const day = dayAstro(spot, date)
    const span = {
      start: localDayStart(date, zone),
      end: localDayStart(addDays(date, 1), zone),
    }
    return {
      date,
      day: formatDay(date),
      isToday: date === data.today,
      sunset: sunsetWords(day, zone),
      moon: moonWords(day, true),
      flag: flagWords(day, zone),
      tides: tideLines(events, span, zone),
    }
  })
}
