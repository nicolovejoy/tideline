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
import { hasOwnGauge } from '../spot.ts'
import type { Spot } from '../spot.ts'
import { MINUTE } from '../time.ts'
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
  /** The readings that are drawn: today's, at a spot with its own gauge. */
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
  /** Everything the panel says at the cursor, as one run of words. */
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
   * when the tide is hidden. Null when it is shown.
   */
  hidden: string | null
  /** Whether to offer "Hide tides": at a spot that hides them by default. */
  canHide: boolean
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

/** Which spot, and whether its tide is on screen. */
export interface TideChoice {
  spot: Spot
  shown: boolean
}

/** The points on a day, both ends included. */
function within(
  points: TidePoint[] | null,
  day: { start: number; end: number },
) {
  return (points ?? []).filter((p) => p.t >= day.start && p.t <= day.end)
}

/** The one line shown in place of the tide when it is hidden. */
function hiddenLine(spot: Spot): string {
  const { id, name, distanceMi, direction } = spot.tideStation
  return `Tides hidden. Nearest station: NOAA ${id} ${name}, ${distanceMi} mi ${direction}.`
}

export function tideView(
  data: Inputs,
  selected: Selected,
  pick: CursorPick | null,
  tides: TideChoice,
): TideView {
  const { spot } = tides
  const { span } = selected
  const ownGauge = hasOwnGauge(spot)
  // Both ends are included, so the curve reaches the right edge of the plot
  // by using the first point of the next day.
  const predicted = tides.shown ? within(data.predictions.data, span) : []
  // The gauge's readings for today, wherever the gauge is.
  const readings = within(data.observed.data, data.day)
  // Drawn only where they are this station's own, and only when the tide is.
  const observed = selected.isToday && ownGauge && tides.shown ? readings : []
  const events = tides.shown ? onDay(data.hilo.data ?? [], span) : []

  // Where the cursor sits until someone moves it. Today that is the latest
  // reading, or the clock. Any other day it is the day's anchor. It is the
  // step that contains the anchor, never the one after: a sunset at 4:59 PM
  // must not tip the cursor into the 5 PM hour, or the weather under it
  // would not be the hour that the day's row in the list gives.
  const rest = selected.isToday
    ? restingCursor(data.now, readings)
    : Math.floor(selected.anchor / STEP) * STEP
  // A pick belongs to the day it was made on, and lasts until the page is put
  // away and brought back. After that the cursor goes back to rest, so
  // reopening the app shows the latest reading and not wherever the cursor
  // was left. Choosing a day from the list clears the pick, in SpotScreen.
  const held =
    pick !== null && pick.day === selected.date && pick.shown === data.shown
  const cursor = held ? Math.min(Math.max(pick.t, span.start), span.end) : rest

  // One vertical range for all 14 days, so one day can be compared with
  // another, widened if needed to fit today's readings. Those count on every
  // day, so the scale does not jump when another day is chosen. A gauge
  // elsewhere is not drawn, so its readings do not count.
  const drawn = ownGauge ? readings : []
  const bounds = steppedBounds(
    [...(data.predictions.data ?? []), ...drawn].map((point) => point.ft),
    1,
  )

  const hidden = tides.shown ? null : hiddenLine(spot)
  let notice: string | null = null
  if (hidden === null && predicted.length === 0) {
    notice =
      data.predictions.status === 'loading'
        ? 'Loading tides'
        : 'Tide data unavailable'
  }

  const readout = tideReadout(predicted, observed, cursor)
  const text = tideWords(readout)
  // The second line: this station's reading, or a gauge elsewhere set
  // against its own prediction for the same step.
  let second: SecondLine | null = null
  if (text.observed !== null) {
    second = { words: text.observed, key: 'observed' }
  } else if (!ownGauge && selected.isToday && hidden === null) {
    const theirs = within(data.gaugePredictions.data, data.day)
    const { aboveFt } = tideReadout(theirs, readings, cursor)
    if (aboveFt !== null) {
      second = { words: gaugeWords(spot.gauge.name, aboveFt), key: null }
    }
  }

  const dots: Dot[] = []
  if (notice === null && hidden === null) {
    if (readout.predictedFt !== null) {
      dots.push({ name: 'predicted', v: readout.predictedFt })
    }
    if (readout.observedFt !== null) {
      dots.push({ name: 'observed', v: readout.observedFt })
    }
  }
  // For a screen reader. The panel is named, so the words are never left
  // hanging among the weather panels'. Without a curve there is no panel,
  // and the notice is said instead; hidden, the hidden line is said.
  const said = [text.predicted, second?.words ?? null].filter(
    (part) => part !== null,
  )
  const words = hidden ?? notice ?? `${TITLE}: ${said.join(', ')}`

  const series: Series[] = []
  if (hidden === null) {
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
      notice === null && hidden === null
        ? wholeSteps(bounds[0], bounds[1], RULE_EVERY).map((v) => ({
            v,
            label: `${v} ft`,
          }))
        : [],
    series,
    dots,
    notice,
    hidden,
    canHide: tides.shown && !spot.tidesShown,
  }
}
