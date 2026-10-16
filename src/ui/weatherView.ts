// What the three weather panels show, worked out from the forecast, today's
// observed rows where a station serves, which day is on screen and where the
// cursor is. A plain function, so the rules have tests and App.tsx only
// arranges the result.

import { arrowAngle, isCalm, shownGust } from '../chart/arrows.ts'
import type { Arrow } from '../chart/arrows.ts'
import type { Dot, Rule, Series } from '../chart/Panel.tsx'
import {
  cloudPart,
  hourAt,
  partsText,
  rainPart,
  skyCategoryPart,
  tempParts,
  windParts,
  withSourceWords,
} from '../chart/readout.ts'
import type { ReadoutPart, SourceWord } from '../chart/readout.ts'
import { steppedBounds, wholeSteps } from '../chart/scales.ts'
import type { Loaded } from '../data/load.ts'
import type { Forecast, ForecastHour } from '../data/nws.ts'
import type { Sky } from '../data/nwsObservations.ts'
import { skyPct } from '../data/observed.ts'
import type { ObservedHour } from '../data/observed.ts'
import { HOUR } from '../time.ts'
import { onDay } from './selection.ts'
import type { Selected } from './selection.ts'

const NOTHING_HERE: ReadoutPart[] = [{ key: null, text: 'No forecast here' }]

export interface WeatherPanelView {
  title: string
  /** The values under the cursor, in words, each with its series' key. */
  readout: ReadoutPart[]
  /** The plot's vertical range. */
  bounds: [number, number]
  rules: Rule[]
  /**
   * One staircase per value, each point holding for an hour. On today with
   * a station, an observed staircase first, cut at the current time, then
   * the forecast's, which fills the hours the station did not report.
   */
  series: Series[]
  /** The wind panel's arrows, one per hour that has a speed. None elsewhere. */
  arrows: Arrow[]
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

/**
 * An observed row in the forecast's shape, so the same rules word and draw
 * it: its sky at the middle of its category's range, and no chance of rain.
 */
function asForecastHour(row: ObservedHour): ForecastHour {
  return {
    t: row.t,
    tempF: row.tempF,
    windMph: row.windMph,
    gustMph: row.gustMph,
    windDeg: row.windDeg,
    cloudPct: row.sky === null ? null : skyPct(row.sky),
    rainPct: null,
    feelsF: null,
    dewF: row.dewF,
    humidityPct: row.humidityPct,
  }
}

/** One hour of today: the forecast for it, and what the station reported. */
interface TodayHour {
  t: number
  forecast: ForecastHour | null
  /** The row in the forecast's shape, or null where there is no row. */
  observed: ForecastHour | null
  /** The row's sky as a category, for the words. Null where there is no row or no sky. */
  sky: Sky | null
}

interface PanelSpec {
  title: string
  /** The staircases, in the order drawn: each one's name and the field it draws. */
  fields: [name: string, field: Field][]
  /** The values the cursor's dots sit on: the staircases, and for the wind its speed. */
  dots: [name: string, field: Field][]
  /** How far apart the rules are, and the unit written on each label. */
  every: number
  unit: string
}

const WIND: PanelSpec = {
  title: 'Wind',
  // The wind's speed is drawn as arrows, not a line; see `windArrows`.
  fields: [['gust', 'gustMph']],
  dots: [
    ['wind', 'windMph'],
    ['gust', 'gustMph'],
  ],
  every: 10,
  unit: ' mph',
}
const TEMP: PanelSpec = {
  title: 'Temperature',
  fields: [['temp', 'tempF']],
  dots: [['temp', 'tempF']],
  every: 10,
  unit: '°F',
}
const SKY: PanelSpec = {
  title: 'Sky',
  fields: [
    ['cloud', 'cloudPct'],
    ['rain', 'rainPct'],
  ],
  dots: [
    ['cloud', 'cloudPct'],
    ['rain', 'rainPct'],
  ],
  every: 50,
  unit: '%',
}

/** The fields a station reports. The chance of rain is forecast all day. */
const OBSERVED_FIELDS = new Set<Field>([
  'tempF',
  'windMph',
  'gustMph',
  'windDeg',
  'cloudPct',
])

/**
 * The hours with only the gusts worth showing: an hour whose gust does not
 * stand out from its wind has none. The staircase, the dot and the words
 * then agree. The vertical range is worked out from the hours as given, so
 * the panel does not jump as the rule hides a gust.
 */
function withShownGusts<T extends ForecastHour | null>(hour: T): T {
  return hour === null ? hour : { ...hour, gustMph: shownGust(hour) }
}

function arrowFor(hour: ForecastHour, observed: boolean): Arrow | null {
  if (hour.windMph === null) return null
  const angle =
    hour.windDeg === null || isCalm(hour.windMph)
      ? null
      : arrowAngle(hour.windDeg)
  const arrow: Arrow = { t: hour.t + HOUR / 2, v: hour.windMph, angle }
  return observed ? { ...arrow, observed: true } : arrow
}

/**
 * One arrow per hour that has a wind speed, drawn at the middle of its hour
 * at that speed, pointing where the wind is going. A calm hour, or one with
 * no direction, is a dot. An hour the station reported takes its arrow from
 * the report, drawn solid, only while its middle is left of the line at the
 * current time: right of the line everything is the forecast's.
 */
function windArrows(hours: TodayHour[], now: number | null): Arrow[] {
  return hours.flatMap((hour) => {
    const observed =
      now !== null &&
      hour.t + HOUR / 2 < now &&
      hour.observed !== null &&
      hour.observed.windMph !== null
    const from = observed ? hour.observed : hour.forecast
    const arrow = from === null ? null : arrowFor(from, observed)
    return arrow === null ? [] : [arrow]
  })
}

/**
 * Whether the station's row stands for a field in this hour. For most
 * values that is a row that has the value: a value the row lacks is filled
 * from the forecast. A gust is the exception: a station gives a gust only
 * when there is one, so a row stands for the gust whether it has one or not,
 * and the forecast's gust is never drawn over a row.
 */
function rowStands(hour: TodayHour, field: Field): boolean {
  if (hour.observed === null || !OBSERVED_FIELDS.has(field)) return false
  return field === 'gustMph' || hour.observed[field] !== null
}

/**
 * The staircases for one field: the observed one, cut at `now`, and the
 * forecast's for the hours the station did not report. Where the station's
 * row stands for the current hour, the forecast's step for it starts at
 * `now`. With no current time (another day) there is only the forecast's,
 * whole. A field stations do not report has only the forecast's too.
 */
function staircases(
  name: string,
  field: Field,
  hours: TodayHour[],
  now: number | null,
): Series[] {
  const observed: Series = {
    name: `${name}-observed`,
    step: HOUR,
    points: [],
  }
  const forecast: Series = { name, step: HOUR, points: [] }
  if (now === null || !OBSERVED_FIELDS.has(field)) {
    for (const hour of hours) {
      const v = hour.forecast === null ? null : hour.forecast[field]
      // An hour with no value for this field leaves a break in its line.
      if (v !== null) forecast.points.push({ t: hour.t, v })
    }
    return [forecast]
  }
  let cutAfter = false
  for (const hour of hours) {
    const current = hour.t <= now && now < hour.t + HOUR
    const reported = rowStands(hour, field)
    if (reported) {
      const v = hour.observed![field]
      if (v !== null) observed.points.push({ t: hour.t, v })
      // An hour gone by that the station reported needs no forecast. The
      // current hour needs it right of the line.
      if (!current) continue
      cutAfter = true
    }
    const v = hour.forecast === null ? null : hour.forecast[field]
    if (v !== null) forecast.points.push({ t: hour.t, v })
  }
  return [
    { ...observed, cut: { at: now, keep: 'before' } },
    cutAfter ? { ...forecast, cut: { at: now, keep: 'after' } } : forecast,
  ]
}

function panel(
  spec: PanelSpec,
  readout: ReadoutPart[],
  bounds: [number, number],
  hours: TodayHour[],
  now: number | null,
  dots: Dot[],
  arrows: Arrow[] = [],
): WeatherPanelView {
  return {
    title: spec.title,
    readout: readout.length > 0 ? readout : NOTHING_HERE,
    bounds,
    rules: wholeSteps(bounds[0], bounds[1], spec.every).map((v) => ({
      v,
      label: `${v}${spec.unit}`,
    })),
    series: spec.fields.flatMap(([name, field]) =>
      staircases(name, field, hours, now),
    ),
    arrows,
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

/** The hours of the day on screen, forecast and observed side by side. */
function todayHours(
  forecast: ForecastHour[],
  observed: ObservedHour[],
): TodayHour[] {
  const byHour = new Map<number, TodayHour>()
  for (const hour of forecast) {
    byHour.set(hour.t, { t: hour.t, forecast: hour, observed: null, sky: null })
  }
  for (const row of observed) {
    const hour = byHour.get(row.t) ?? {
      t: row.t,
      forecast: null,
      observed: null,
      sky: null,
    }
    hour.observed = withShownGusts(asForecastHour(row))
    hour.sky = row.sky
    byHour.set(row.t, hour)
  }
  return [...byHour.values()].sort((a, b) => a.t - b.t)
}

/**
 * The dots at the cursor: on the observed value where the row stands for
 * it, else on the forecast's. A row that stands for a gust and has none
 * gives no dot, as it gives no step.
 */
function dotsFor(spec: PanelSpec, at: TodayHour | null): Dot[] {
  const dots: Dot[] = []
  if (at === null) return dots
  for (const [name, field] of spec.dots) {
    if (rowStands(at, field)) {
      const v = at.observed![field]
      if (v !== null) dots.push({ name: `${name}-observed`, v })
    } else if (at.forecast !== null && at.forecast[field] !== null) {
      dots.push({ name, v: at.forecast[field] })
    }
  }
  return dots
}

export function weatherView(
  forecast: Loaded<Forecast>,
  selected: Selected,
  cursor: number,
  now: number,
  observed: ObservedHour[] = [],
): WeatherView {
  const { span } = selected
  const all = forecastHours(forecast, now)
  // Rows belong to today only, and only where there are any.
  const rows = selected.isToday ? onDay(observed, span) : []
  const today = rows.length > 0 ? now : null

  let notice: string | null = null
  let hours: TodayHour[] = []
  if (all.length === 0 && rows.length === 0) {
    // Nothing saved, or a saved forecast so old that all of it is in the
    // past and nothing has replaced it.
    notice =
      forecast.status === 'loading'
        ? 'Loading forecast'
        : 'Forecast unavailable'
  } else {
    // A day is inside the forecast if the forecast reaches the hour of its
    // anchor. Today is inside it for as long as the forecast has any of
    // today left, whatever the hour, and always where the station reported.
    const last = all.length > 0 ? all[all.length - 1].t : -Infinity
    const reaches = Math.floor(selected.anchor / HOUR) * HOUR <= last
    // The hours across the whole window; the rows stay today's.
    hours = todayHours(onDay(all, selected.window).map(withShownGusts), rows)
    if (hours.length === 0 || !(reaches || selected.isToday)) {
      notice = 'No forecast this far out.'
      hours = []
    }
  }

  // At the right-hand edge the cursor is on the midnight after the window. It
  // reads the last hour drawn, not the first hour of a day that is not on screen.
  const cursorT = Math.min(cursor, selected.window.end - 1)
  const at = notice === null ? hourAt(hours, cursorT) : null
  // Left of the line at the current time the cursor reads the observed side.
  const left = today !== null && cursorT < now

  // One vertical range for every day, so one day can be compared with another.
  const observedHours = observed.map(asForecastHour)
  const windBounds = steppedBounds(
    [0, ...values([...all, ...observedHours], ['windMph', 'gustMph'])],
    10,
  )
  const tempBounds = steppedBounds(
    values([...all, ...observedHours], ['tempF']),
    10,
  )

  // The hour as the cursor reads it: with its row left of the line, and
  // the forecast alone right of it. On another day there is no row.
  const atSide = left ? at : forecastOnly(at)
  const read = readoutFor(atSide, today !== null)

  const wind = panel(
    WIND,
    read.wind,
    windBounds,
    hours,
    today,
    dotsFor(WIND, atSide),
    windArrows(hours, today),
  )
  const temp = panel(
    TEMP,
    read.temp,
    tempBounds,
    hours,
    today,
    dotsFor(TEMP, atSide),
  )
  const sky = panel(SKY, read.sky, [0, 100], hours, today, dotsFor(SKY, atSide))
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

/** The hour with its row set aside: right of the line the forecast is read. */
function forecastOnly(at: TodayHour | null): TodayHour | null {
  return at === null ? null : { ...at, observed: null, sky: null }
}

/**
 * The words for each panel at the cursor. On today with a station each
 * value says which side it is from: the row's value where the row stands
 * for it, the forecast's where not. The wind's words come from the row
 * whole, so a row without a gust has no gust in the words either.
 */
function readoutFor(
  at: TodayHour | null,
  labelled: boolean,
): { wind: ReadoutPart[]; temp: ReadoutPart[]; sky: ReadoutPart[] } {
  if (at === null) return { wind: [], temp: [], sky: [] }
  const forecast: SourceWord | undefined = labelled ? 'forecast' : undefined
  const wind = rowStands(at, 'windMph')
    ? windParts(at.observed, 'observed')
    : at.observed === null
      ? windParts(at.forecast, forecast)
      : [
          // The row lacks the wind: the forecast's wind, and the row's gust or none.
          ...windParts(
            at.forecast && { ...at.forecast, gustMph: null },
            forecast,
          ),
          ...windParts(
            { ...at.observed, windMph: null, windDeg: null },
            'observed',
          ),
        ]
  const temp = rowStands(at, 'tempF')
    ? tempParts(at.observed, 'observed')
    : tempParts(at.forecast, forecast)
  const sky: ReadoutPart[] = []
  if (rowStands(at, 'cloudPct') && at.sky !== null) {
    sky.push(skyCategoryPart(at.sky, 'observed'))
  } else if (at.forecast !== null && at.forecast.cloudPct !== null) {
    sky.push(cloudPart(at.forecast.cloudPct, forecast))
  }
  if (at.forecast !== null && at.forecast.rainPct !== null) {
    sky.push(rainPart(at.forecast.rainPct, forecast))
  }
  return {
    wind: withSourceWords(wind),
    temp: withSourceWords(temp),
    sky: withSourceWords(sky),
  }
}
