// The values under the cursor, and how they are worded. Plain functions.

import type { TidePoint } from '../data/noaa.ts'
import { compassPoint } from '../data/nws.ts'
import type { ForecastHour } from '../data/nws.ts'
import { HOUR, MINUTE } from '../time.ts'

/** NOAA's tide points sit on 6-minute steps, and so does the cursor. */
export const STEP = 6 * MINUTE

/** The nearest 6-minute step to an instant. */
export function snap(t: number): number {
  return Math.round(t / STEP) * STEP
}

function nearest(
  points: TidePoint[],
  t: number,
  within: number,
): TidePoint | null {
  let best: TidePoint | null = null
  let bestDistance = Infinity
  for (const point of points) {
    const distance = Math.abs(point.t - t)
    if (distance <= within && distance < bestDistance) {
      best = point
      bestDistance = distance
    }
  }
  return best
}

/**
 * Where the cursor sits until someone moves it: on the latest observed
 * reading, if there is one from the past hour, and otherwise on the current
 * time. NOAA publishes readings some minutes late, so a cursor resting on the
 * current time would never have a reading under it.
 */
export function restingCursor(now: number, observed: TidePoint[]): number {
  const latest = observed[observed.length - 1]
  return latest && latest.t <= now && now - latest.t <= HOUR
    ? latest.t
    : snap(now)
}

export interface TideReadout {
  predictedFt: number | null
  /** The reading at the cursor's own 6-minute step, if there is one. */
  observedFt: number | null
  /**
   * Observed minus predicted, both rounded to the tenth they are shown at, so
   * that the three numbers on screen always agree with each other.
   */
  aboveFt: number | null
}

function tenth(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * The prediction and the reading at the cursor. A reading counts only if it
 * is at the cursor's own step: one from the step before would be compared
 * with a prediction for a different moment.
 */
export function tideReadout(
  predicted: TidePoint[],
  observed: TidePoint[],
  t: number,
): TideReadout {
  const prediction = nearest(predicted, t, STEP / 2)
  const reading = nearest(observed, t, STEP / 2)
  return {
    predictedFt: prediction ? prediction.ft : null,
    observedFt: reading ? reading.ft : null,
    aboveFt:
      prediction && reading
        ? tenth(tenth(reading.ft) - tenth(prediction.ft))
        : null,
  }
}

/** One decimal place. Rounding first is what stops -0.04 showing as '-0.0'. */
function oneDecimal(value: number): string {
  return tenth(value).toFixed(1)
}

/** A height for display, such as '0.8 ft' or '-0.3 ft'. */
export function feet(ft: number): string {
  return `${oneDecimal(ft)} ft`
}

/** A difference for display, always signed unless zero: '+1.1', '-0.4', '0.0'. */
export function signedFeet(ft: number): string {
  const text = oneDecimal(ft)
  return text.startsWith('-') || text === '0.0' ? text : `+${text}`
}

/**
 * The readout in words: the prediction, and the reading if there is one at
 * the cursor. Shared by what is drawn and what a screen reader is told. The
 * curve is NOAA's prediction, or one interpolated on the device from the
 * highs and lows where the station publishes no curve, and the word says
 * which.
 */
export function tideWords(
  readout: TideReadout,
  curve: 'predicted' | 'interpolated' = 'predicted',
): {
  predicted: string
  observed: string | null
} {
  const { predictedFt, observedFt, aboveFt } = readout
  const above = aboveFt === null ? '' : ` (${signedFeet(aboveFt)})`
  return {
    predicted:
      predictedFt === null
        ? 'No prediction here'
        : `${feet(predictedFt)} ${curve}`,
    observed:
      observedFt === null ? null : `${feet(observedFt)} observed${above}`,
  }
}

/**
 * A gauge elsewhere, set against its own prediction: 'Santa Barbara gauge
 * +1.2 ft vs its prediction'. For a spot whose tide station has no gauge.
 */
export function gaugeWords(name: string, aboveFt: number): string {
  return `${name} gauge ${signedFeet(aboveFt)} ft vs its prediction`
}

/** The forecast hour that contains an instant, if the forecast has it. */
export function hourAt(hours: ForecastHour[], t: number): ForecastHour | null {
  const start = Math.floor(t / HOUR) * HOUR
  return hours.find((hour) => hour.t === start) ?? null
}

/** A whole number for display. */
function whole(value: number): string {
  return String(Math.round(value))
}

/** One piece of a weather readout, and the series it describes, if any. */
export interface ReadoutPart {
  /** Names the series, for its colour key: 'wind', 'gust' and so on. */
  key: string | null
  text: string
}

/**
 * The wind in an hour, as '9 mph', 'gusts 12', 'from W'. Each part is there
 * only if the forecast has it.
 */
export function windParts(hour: ForecastHour | null): ReadoutPart[] {
  if (!hour) return []
  const parts: ReadoutPart[] = []
  if (hour.windMph !== null) {
    parts.push({ key: 'wind', text: `${whole(hour.windMph)} mph` })
  }
  if (hour.gustMph !== null) {
    // The unit is given once, by whichever number comes first.
    const unit = hour.windMph === null ? ' mph' : ''
    parts.push({ key: 'gust', text: `gusts ${whole(hour.gustMph)}${unit}` })
  }
  if (hour.windDeg !== null) {
    parts.push({ key: null, text: `from ${compassPoint(hour.windDeg)}` })
  }
  return parts
}

/** The temperature in an hour, as '74°F'. */
export function tempParts(hour: ForecastHour | null): ReadoutPart[] {
  if (!hour || hour.tempF === null) return []
  return [{ key: 'temp', text: `${whole(hour.tempF)}°F` }]
}

/** Cloud cover and the chance of rain in an hour: '3% cloud', '0% rain'. */
export function skyParts(hour: ForecastHour | null): ReadoutPart[] {
  if (!hour) return []
  const parts: ReadoutPart[] = []
  if (hour.cloudPct !== null) {
    parts.push({ key: 'cloud', text: `${whole(hour.cloudPct)}% cloud` })
  }
  if (hour.rainPct !== null) {
    parts.push({ key: 'rain', text: `${whole(hour.rainPct)}% rain` })
  }
  return parts
}

/** A readout as one run of words, such as '9 mph, gusts 12, from W'. */
export function partsText(parts: ReadoutPart[]): string {
  return parts.map((part) => part.text).join(', ')
}

/**
 * Everything under the cursor as one run of words, for a screen reader: the
 * time, then what each panel says. Panels are set apart by semicolons
 * because the words within one are already set apart by commas.
 */
export function cursorText(time: string, panels: string[]): string {
  return [time, ...panels].join('; ')
}
