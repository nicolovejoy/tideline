// The words for the sun and the moon, and for each row of the 14-day list.
// Plain functions: the components only lay these out.

import {
  feet,
  hourAt,
  partsText,
  skyParts,
  tempParts,
  windParts,
} from '../chart/readout.ts'
import type { DayAstro } from '../data/astro.ts'
import type { SpotData } from '../data/useSpotData.ts'
import { formatDay, formatTime } from '../time.ts'
import { selectedDay } from './selection.ts'

/** How much of the moon is lit, such as '3% lit'. */
function lit(day: DayAstro): string {
  return `${Math.round(day.illumination * 100)}% lit`
}

export interface TonightWords {
  sunset: string
  /** How much of the moon is lit, and its phase. */
  moon: string
  moonrise: string
  /** The moonrise within 2 hours of sunset, when there is one. */
  flag: string | null
}

/**
 * What the strip at the top says about today. `now` decides the tense of
 * the moon line: by evening the day's moonrise is usually hours past.
 */
export function tonightWords(
  day: DayAstro,
  now: number,
  timeZone: string,
): TonightWords {
  const time = (t: number) => formatTime(t, timeZone)
  return {
    sunset: day.sunset === null ? 'None today' : time(day.sunset),
    moon: `${lit(day)}, ${day.phase.toLowerCase()}`,
    moonrise:
      day.moonrise === null
        ? 'No moonrise today'
        : `${day.moonrise < now ? 'Rose' : 'Rises'} ${time(day.moonrise)}`,
    flag:
      day.moonriseNearSunset === null
        ? null
        : `Moonrise near sunset: ${time(day.moonriseNearSunset)}`,
  }
}

export interface DayRow {
  date: string
  /** The weekday and date, such as 'Thu Oct 8'. */
  day: string
  selected: boolean
  sunset: string
  moon: string
  /** The moonrise within 2 hours of sunset, when there is one. */
  flag: string | null
  /** The day's highs and lows in order, such as 'Low 2:35 AM 0.2 ft'. */
  tides: string[]
  /**
   * The forecast for the hour of sunset: 'At sunset', then what each weather
   * panel would read. Null where the forecast does not reach that hour.
   */
  weather: string[] | null
}

type Inputs = Pick<SpotData, 'days' | 'spans' | 'hilo' | 'forecast'>

/**
 * One row for each of the 14 days. `picked` is the date of the row last
 * tapped, if any, and decides which row is marked.
 */
export function dayRows(
  data: Inputs,
  picked: string | null,
  timeZone: string,
): DayRow[] {
  const selected = selectedDay(data, picked).index
  const time = (t: number) => formatTime(t, timeZone)
  const events = data.hilo.data ?? []
  const hours = data.forecast.data?.hours ?? []

  return data.days.map((day, i) => {
    const { start, end } = data.spans[i]
    const hour = day.sunset === null ? null : hourAt(hours, day.sunset)
    // Only what the forecast has for that hour. Sunset on the last day it
    // reaches can have wind and cloud but no temperature.
    const weather = [tempParts(hour), windParts(hour), skyParts(hour)]
      .map(partsText)
      .filter((words) => words !== '')
    return {
      date: day.date,
      day: formatDay(day.date),
      selected: i === selected,
      sunset: day.sunset === null ? 'No sunset' : `Sunset ${time(day.sunset)}`,
      moon: `Moon ${lit(day)}`,
      flag:
        day.moonriseNearSunset === null
          ? null
          : `Moonrise ${time(day.moonriseNearSunset)}`,
      tides: events
        // A high or low at midnight belongs to the day it starts.
        .filter((event) => event.t >= start && event.t < end)
        .map((event) => {
          const kind = event.type === 'H' ? 'High' : 'Low'
          return `${kind} ${time(event.t)} ${feet(event.ft)}`
        }),
      weather: weather.length > 0 ? ['At sunset', ...weather] : null,
    }
  })
}
