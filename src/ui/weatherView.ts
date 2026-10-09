// What the three weather panels show, worked out from the forecast, which day
// is on screen and where the cursor is. A plain function, so the rules have
// tests and App.tsx only arranges the result.

import type { Dot, Rule, Series } from '../chart/Panel.tsx'
import {
  hourAt,
  partsText,
  skyParts,
  tempParts,
  windParts,
} from '../chart/readout.ts'
import type { ReadoutPart } from '../chart/readout.ts'
import { steppedBounds, wholeSteps } from '../chart/scales.ts'
import type { Loaded } from '../data/load.ts'
import type { Forecast, ForecastHour } from '../data/nws.ts'
import { HOUR } from '../time.ts'
import type { Selected } from './selection.ts'

const NOTHING_HERE: ReadoutPart[] = [{ key: null, text: 'No forecast here' }]

export interface WeatherPanelView {
  title: string
  /** The values under the cursor, in words, each with its series' key. */
  readout: ReadoutPart[]
  /** The plot's vertical range. */
  bounds: [number, number]
  rules: Rule[]
  /** One staircase per value, each point holding for an hour. */
  series: Series[]
  /** Where the cursor meets each value the hour under it has. */
  dots: Dot[]
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

/**
 * The saved forecast's hours, or none when every one of them has passed: a
 * forecast that old counts as no forecast, in the panels and the list alike.
 */
export function forecastHours(
  forecast: Loaded<Forecast>,
  now: number,
): ForecastHour[] {
  const all = forecast.data?.hours ?? []
  const last = all.length > 0 ? all[all.length - 1].t : null
  return last === null || last + HOUR <= now ? [] : all
}

type Field = Exclude<keyof ForecastHour, 't'>

interface PanelSpec {
  title: string
  /** The series, in the order drawn: each one's name and the field it draws. */
  fields: [name: string, field: Field][]
  /** How far apart the rules are, and the unit written on each label. */
  every: number
  unit: string
}

const WIND: PanelSpec = {
  title: 'Wind',
  fields: [
    ['wind', 'windMph'],
    ['gust', 'gustMph'],
  ],
  every: 10,
  unit: ' mph',
}
const TEMP: PanelSpec = {
  title: 'Temperature',
  fields: [['temp', 'tempF']],
  every: 10,
  unit: '°F',
}
const SKY: PanelSpec = {
  title: 'Sky',
  fields: [
    ['cloud', 'cloudPct'],
    ['rain', 'rainPct'],
  ],
  every: 50,
  unit: '%',
}

function panel(
  spec: PanelSpec,
  readout: ReadoutPart[],
  bounds: [number, number],
  hours: ForecastHour[],
  at: ForecastHour | null,
): WeatherPanelView {
  const dots: Dot[] = []
  for (const [name, field] of spec.fields) {
    const v = at ? at[field] : null
    if (v !== null) dots.push({ name, v })
  }
  return {
    title: spec.title,
    readout: readout.length > 0 ? readout : NOTHING_HERE,
    bounds,
    rules: wholeSteps(bounds[0], bounds[1], spec.every).map((v) => ({
      v,
      label: `${v}${spec.unit}`,
    })),
    series: spec.fields.map(([name, field]) => ({
      name,
      step: HOUR,
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
  const all = forecastHours(forecast, now)

  let notice: string | null = null
  let hours: ForecastHour[] = []
  if (all.length === 0) {
    // Nothing saved, or a saved forecast so old that all of it is in the
    // past and nothing has replaced it.
    notice =
      forecast.status === 'loading'
        ? 'Loading forecast'
        : 'Forecast unavailable'
  } else {
    // A day is inside the forecast if the forecast reaches the hour of its
    // anchor. Today is inside it for as long as the forecast has any of
    // today left, whatever the hour.
    const last = all[all.length - 1].t
    const reaches = Math.floor(selected.anchor / HOUR) * HOUR <= last
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

  const wind = panel(WIND, windParts(at), windBounds, hours, at)
  const temp = panel(TEMP, tempParts(at), tempBounds, hours, at)
  const sky = panel(SKY, skyParts(at), [0, 100], hours, at)
  // For a screen reader. Each panel is named, so "No forecast here" never
  // reads as if it were the temperature. Where none of them has anything to
  // say, that is said once, not three times.
  const panels = [wind, temp, sky]
  const nothing = panels.every((one) => one.readout === NOTHING_HERE)
  const words =
    notice ??
    (nothing
      ? partsText(NOTHING_HERE)
      : panels
          .map((one) => `${one.title}: ${partsText(one.readout)}`)
          .join('; '))

  return { notice, words, wind, temp, sky }
}
