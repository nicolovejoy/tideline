// What the three weather panels show, worked out from the forecast, which day
// is on screen and where the cursor is. A plain function, so the rules have
// tests and App.tsx only arranges the result.

import {
  hourAt,
  partsText,
  skyParts,
  tempParts,
  windParts,
} from '../chart/readout.ts'
import type { ReadoutPart } from '../chart/readout.ts'
import { steppedBounds } from '../chart/scales.ts'
import type { Point } from '../chart/scales.ts'
import type { Loaded } from '../data/load.ts'
import type { Forecast, ForecastHour } from '../data/nws.ts'
import type { Selected } from './selection.ts'

const HOUR = 3_600_000
const NOTHING_HERE: ReadoutPart[] = [{ key: null, text: 'No forecast here' }]

export interface WeatherPanelView {
  /** The values under the cursor, in words, each with its series' key. */
  readout: ReadoutPart[]
  /** The plot's vertical range. */
  bounds: [number, number]
  /** One staircase per value, each point holding for an hour. */
  series: { name: string; points: Point[] }[]
  /** Where the cursor meets each value the hour under it has. */
  dots: { name: string; v: number }[]
}

export interface WeatherView {
  /** What to say where the three panels would be, when they are not drawn. */
  notice: string | null
  /** Everything the panels say at the cursor, as one run of words. */
  words: string
  wind: WeatherPanelView
  temp: WeatherPanelView
  sky: WeatherPanelView
}

type Field = Exclude<keyof ForecastHour, 't'>

function panel(
  readout: ReadoutPart[],
  bounds: [number, number],
  hours: ForecastHour[],
  at: ForecastHour | null,
  fields: [name: string, field: Field][],
): WeatherPanelView {
  const dots: { name: string; v: number }[] = []
  for (const [name, field] of fields) {
    const v = at ? at[field] : null
    if (v !== null) dots.push({ name, v })
  }
  return {
    readout: readout.length > 0 ? readout : NOTHING_HERE,
    bounds,
    series: fields.map(([name, field]) => ({
      name,
      // An hour with no value for this field leaves a break in its line.
      points: hours.flatMap((hour) => {
        const v = hour[field]
        return v === null ? [] : [{ t: hour.t, v }]
      }),
    })),
    dots,
  }
}

function values(hours: ForecastHour[], fields: Field[]): number[] {
  return hours.flatMap((hour) =>
    fields.flatMap((field) => {
      const v = hour[field]
      return v === null ? [] : [v]
    }),
  )
}

export function weatherView(
  forecast: Loaded<Forecast>,
  selected: Selected,
  cursor: number,
  now: number,
): WeatherView {
  const { span } = selected
  const all = forecast.data?.hours ?? []
  const last = all.length > 0 ? all[all.length - 1].t : null

  let notice: string | null = null
  let hours: ForecastHour[] = []
  if (last === null || last + HOUR <= now) {
    // Nothing saved, or a saved forecast so old that all of it is in the
    // past and nothing has replaced it.
    notice =
      forecast.status === 'loading'
        ? 'Loading forecast'
        : 'Forecast unavailable'
  } else {
    // A day is inside the forecast if the forecast reaches the hour of its
    // sunset, the moment the rest of the screen is about. Today is inside it
    // for as long as the forecast has any of today left, whatever the hour.
    const anchor = selected.astro.sunset ?? (span.start + span.end) / 2
    const reaches = Math.floor(anchor / HOUR) * HOUR <= last
    hours = all.filter((hour) => hour.t >= span.start && hour.t < span.end)
    if (hours.length === 0 || !(reaches || selected.isToday)) {
      notice = 'No forecast this far out.'
      hours = []
    }
  }

  // At the right-hand edge the cursor is on the next day's midnight. It reads
  // the last hour drawn, not the first hour of a day that is not on screen.
  const at =
    notice === null ? hourAt(hours, Math.min(cursor, span.end - 1)) : null

  // One vertical range for every day, so one day can be compared with another.
  const windBounds = steppedBounds(
    [0, ...values(all, ['windMph', 'gustMph'])],
    10,
  )
  const tempBounds = steppedBounds(values(all, ['tempF']), 10)

  const wind = panel(windParts(at), windBounds, hours, at, [
    ['wind', 'windMph'],
    ['gust', 'gustMph'],
  ])
  const temp = panel(tempParts(at), tempBounds, hours, at, [['temp', 'tempF']])
  const sky = panel(skyParts(at), [0, 100], hours, at, [
    ['cloud', 'cloudPct'],
    ['rain', 'rainPct'],
  ])
  // For a screen reader. Panels with nothing to say at the cursor say so
  // once between them, not once each.
  const said = [wind, temp, sky].map((one) => partsText(one.readout))
  const words = notice ?? [...new Set(said)].join(', ')

  return { notice, words, wind, temp, sky }
}
