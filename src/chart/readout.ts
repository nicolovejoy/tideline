// The values under the cursor, and how they are worded. Plain functions.

import type { TidePoint } from '../data/noaa.ts'

/** NOAA's tide points sit on 6-minute steps, and so does the cursor. */
export const STEP = 6 * 60_000

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

const HOUR = 3_600_000

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
 * the cursor. Shared by what is drawn and what a screen reader is told.
 */
export function tideWords(readout: TideReadout): {
  predicted: string
  observed: string | null
} {
  const { predictedFt, observedFt, aboveFt } = readout
  const above = aboveFt === null ? '' : ` (${signedFeet(aboveFt)})`
  return {
    predicted:
      predictedFt === null
        ? 'No prediction here'
        : `${feet(predictedFt)} predicted`,
    observed:
      observedFt === null ? null : `${feet(observedFt)} observed${above}`,
  }
}
