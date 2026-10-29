// What the tide part of the screen shows, worked out from what is loaded,
// which day is on screen, where the cursor was last put, and which spot it
// is. A plain function, so the rules have tests and the components only
// arrange the result.

import type { Dot, Rule, Series } from '../chart/Panel.tsx'
import {
  STEP,
  gaugeWords,
  restingCursor,
  tideReadout,
  tideWords,
} from '../chart/readout.ts'
import type { TideReadout } from '../chart/readout.ts'
import { steppedBounds, wholeSteps } from '../chart/scales.ts'
import type { TideExtreme, TidePoint } from '../data/noaa.ts'
import type { SpotData } from '../data/useSpotData.ts'
import { hasOwnCurve, hasOwnGauge, hasTides } from '../spot.ts'
import type { Spot } from '../spot.ts'
import { MINUTE } from '../time.ts'
import { noTidesWords } from './captions.ts'
import { onDay } from './selection.ts'
import type { Selected } from './selection.ts'

/** Readings come every 6 minutes. A longer gap is an outage. */
const OBSERVED_GAP = 13 * MINUTE
/** A rule and a label every this many feet. */
const RULE_EVERY = 2
const TITLE = 'Tide'

/** Where the cursor was put by hand, and when. */
export interface CursorPick {
  t: number
  /** The date of the day that was on screen when it was put there. */
  day: string
  /** How many times the page had come back into view by then. */
  shown: number
}

/** The readout's second line, under the prediction. */
export interface SecondLine {
  words: string
  /** The series it is the key to, for its colour bar. None for a gauge elsewhere. */
  key: 'observed' | null
}

export interface TideView {
  title: string
  /** The day's predicted curve, reaching both edges of the plot. */
  predicted: TidePoint[]
  /** The gauge's readings for today, drawn or not. For the caption. */
  readings: TidePoint[]
  /**
   * The readings that are drawn: today's in the window, with one either side,
   * at a spot with its own gauge.
   */
  observed: TidePoint[]
  /** The day's highs and lows. */
  events: TideExtreme[]
  cursor: number
  /** The plot's vertical range, in whole feet. */
  bounds: [number, number]
  readout: TideReadout
  /**
   * The readout in words: the prediction, and under it the reading with its
   * difference, or a gauge elsewhere set against its own prediction, or
   * nothing.
   */
  text: { predicted: string; second: SecondLine | null }
  /**
   * Everything the panel says at the cursor, as one run of words. Empty at
   * a spot with no tide, which has no panel.
   */
  words: string
  rules: Rule[]
  /** The curve, filled, with the readings over it where there are any. */
  series: Series[]
  /**
   * Where the cursor meets the curve, and the reading if there is one. None
   * when there is no curve to draw.
   */
  dots: Dot[]
  /** What to say where the plot would be, when there is no curve to draw. */
  notice: string | null
  /**
   * The one line that stands in for the panel, the table and the caption
   * at a spot with no tide, saying why. Null where there is one.
   */
  noTides: string | null
}

type Inputs = Pick<
  SpotData,
  | 'now'
  | 'shown'
  | 'day'
  | 'predictions'
  | 'hilo'
  | 'observed'
  | 'gaugePredictions'
>

/** The points on a day, both ends included. */
function within(
  points: TidePoint[] | null,
  day: { start: number; end: number },
) {
  return (points ?? []).filter((p) => p.t >= day.start && p.t <= day.end)
}

/**
 * The points in a window and one either side of it, so the line reaches both
 * edges of the plot even when a zoom starts or ends between two points. The
 * plot is clipped to the window, so the parts beyond it are not seen.
 */
function across(
  points: TidePoint[] | null,
  window: { start: number; end: number },
) {
  const all = points ?? []
  const first = all.findIndex((p) => p.t >= window.start)
  if (first === -1) return []
  const after = all.findIndex((p) => p.t > window.end)
  const last = after === -1 ? all.length - 1 : after
  return all.slice(Math.max(first - 1, 0), last + 1)
}

export function tideView(
  data: Inputs,
  selected: Selected,
  pick: CursorPick | null,
  spot: Spot,
): TideView {
  // Whether there is a tide here at all. Not a choice: see hasTides.
  const tidal = hasTides(spot)
  const { span } = selected
  const ownGauge = hasOwnGauge(spot)
  // The curve across the whole window, with a point beyond each edge.
  const predicted = tidal ? across(data.predictions.data, selected.window) : []
  // The gauge's readings for today, wherever the gauge is.
  const readings = within(data.observed.data, data.day)
  // Drawn only where they are this station's own, only where the tide is, and
  // only where the window reaches into today, whichever day was chosen.
  const observed =
    selected.showsToday && ownGauge && tidal
      ? across(readings, selected.window)
      : []
  const events = tidal ? onDay(data.hilo.data ?? [], span) : []

  // Where the cursor sits until someone moves it. Today that is the latest
  // reading, or the clock. With no tide nothing on screen justifies resting
  // on a reading, and none is loaded, so the cursor rests on the clock. Any
  // other day it is the day's anchor. It is the step that contains the
  // anchor, never the one after: a sunset at 4:59 PM must not tip the cursor
  // into the 5 PM hour, or the weather under it would not be the hour that
  // the day's row in the list gives.
  // Held to the window as a pick is: a zoom can leave the reading, the clock
  // or the sunset off the plot.
  const { start, end } = selected.window
  const rest = Math.min(
    Math.max(
      selected.isToday
        ? restingCursor(data.now, tidal ? readings : [])
        : Math.floor(selected.anchor / STEP) * STEP,
      start,
    ),
    end,
  )
  // A pick belongs to the day it was made on, and lasts until the page is put
  // away and brought back. After that the cursor goes back to rest, so
  // reopening the app shows the latest reading and not wherever the cursor
  // was left. Choosing a day from the list clears the pick, in SpotScreen.
  const held =
    pick !== null && pick.day === selected.date && pick.shown === data.shown
  // A pick holds anywhere in the window, not only on the chosen day.
  const cursor = held ? Math.min(Math.max(pick.t, start), end) : rest

  // One vertical range for all 14 days, so one day can be compared with
  // another, widened if needed to fit today's readings. Those count on every
  // day, so the scale does not jump when another day is chosen. A gauge
  // elsewhere is not drawn, so its readings do not count.
  const drawn = ownGauge ? readings : []
  const bounds = steppedBounds(
    [...(data.predictions.data ?? []), ...drawn].map((point) => point.ft),
    1,
  )

  const noTides = noTidesWords(spot)
  let notice: string | null = null
  if (tidal && predicted.length === 0) {
    notice =
      data.predictions.status === 'loading'
        ? 'Loading tides'
        : 'Tide data unavailable'
  }

  const readout = tideReadout(predicted, observed, cursor)
  const text = tideWords(
    readout,
    hasOwnCurve(spot) ? 'predicted' : 'interpolated',
  )
  // The second line: this station's reading, or a gauge elsewhere set
  // against its own prediction for the same step.
  let second: SecondLine | null = null
  if (text.observed !== null) {
    second = { words: text.observed, key: 'observed' }
  } else if (!ownGauge && selected.showsToday && tidal) {
    const theirs = within(data.gaugePredictions.data, data.day)
    const { aboveFt } = tideReadout(theirs, readings, cursor)
    if (aboveFt !== null) {
      second = { words: gaugeWords(spot.gauge.name, aboveFt), key: null }
    }
  }

  const dots: Dot[] = []
  if (notice === null && tidal) {
    if (readout.predictedFt !== null) {
      dots.push({ name: 'predicted', v: readout.predictedFt })
    }
    if (readout.observedFt !== null) {
      dots.push({ name: 'observed', v: readout.observedFt })
    }
  }
  // For a screen reader. The panel is named, so the words are never left
  // hanging among the weather panels'. Without a curve there is no panel,
  // and the notice is said instead. With no tide nothing is said: the line
  // saying why is among the captions, not at every move of the cursor.
  const said = [text.predicted, second?.words ?? null].filter(
    (part) => part !== null,
  )
  const words = !tidal ? '' : (notice ?? `${TITLE}: ${said.join(', ')}`)

  const series: Series[] = []
  if (tidal) {
    series.push({
      name: 'predicted',
      filled: true,
      points: predicted.map((p) => ({ t: p.t, v: p.ft })),
    })
    if (ownGauge) {
      series.push({
        name: 'observed',
        maxGap: OBSERVED_GAP,
        points: observed.map((p) => ({ t: p.t, v: p.ft })),
      })
    }
  }

  return {
    title: TITLE,
    predicted,
    readings,
    observed,
    events,
    cursor,
    bounds,
    readout,
    text: { predicted: text.predicted, second },
    words,
    rules:
      notice === null && tidal
        ? wholeSteps(bounds[0], bounds[1], RULE_EVERY).map((v) => ({
            v,
            label: `${v} ft`,
          }))
        : [],
    series,
    dots,
    notice,
    noTides,
  }
}
