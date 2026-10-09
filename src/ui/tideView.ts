// What the tide part of the screen shows, worked out from what is loaded,
// which day is on screen and where the cursor was last put. A plain function,
// so the rules have tests and App.tsx only arranges the result.

import type { Dot, Rule, Series } from '../chart/Panel.tsx'
import {
  STEP,
  restingCursor,
  tideReadout,
  tideWords,
} from '../chart/readout.ts'
import type { TideReadout } from '../chart/readout.ts'
import { steppedBounds, wholeSteps } from '../chart/scales.ts'
import type { TideExtreme, TidePoint } from '../data/noaa.ts'
import type { SpotData } from '../data/useSpotData.ts'
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

export interface TideView {
  title: string
  /** The day's predicted curve, reaching both edges of the plot. */
  predicted: TidePoint[]
  /** The day's readings, in order. Only today has any. */
  observed: TidePoint[]
  /** The day's highs and lows. */
  events: TideExtreme[]
  cursor: number
  /** The plot's vertical range, in whole feet. */
  bounds: [number, number]
  readout: TideReadout
  /** The readout in words: the prediction, and the reading if there is one. */
  text: { predicted: string; observed: string | null }
  /** Everything the panel says at the cursor, as one run of words. */
  words: string
  rules: Rule[]
  /** The curve, filled, with the readings over it. */
  series: Series[]
  /**
   * Where the cursor meets the curve, and the reading if there is one. None
   * when there is no curve to draw.
   */
  dots: Dot[]
  /** What to say where the plot would be, when there is no curve to draw. */
  notice: string | null
}

type Inputs = Pick<
  SpotData,
  'now' | 'shown' | 'day' | 'predictions' | 'hilo' | 'observed'
>

export function tideView(
  data: Inputs,
  selected: Selected,
  pick: CursorPick | null,
): TideView {
  const { span } = selected
  // Both ends are included, so the curve reaches the right edge of the plot
  // by using the first point of the next day.
  const within = (points: TidePoint[] | null, day: typeof span) =>
    (points ?? []).filter((point) => point.t >= day.start && point.t <= day.end)
  const predicted = within(data.predictions.data, span)
  const readings = within(data.observed.data, data.day)
  const observed = selected.isToday ? readings : []
  const events = onDay(data.hilo.data ?? [], span)

  // Where the cursor sits until someone moves it. Today that is the latest
  // reading, or the clock. Any other day it is the day's anchor. It is the
  // step that contains the anchor, never the one after: a sunset at 4:59 PM
  // must not tip the cursor into the 5 PM hour, or the weather under it
  // would not be the hour that the day's row in the list gives.
  const rest = selected.isToday
    ? restingCursor(data.now, observed)
    : Math.floor(selected.anchor / STEP) * STEP
  // A pick belongs to the day it was made on, and lasts until the page is put
  // away and brought back. After that the cursor goes back to rest, so
  // reopening the app shows the latest reading and not wherever the cursor
  // was left. Choosing a day from the list clears the pick, in App.tsx.
  const held =
    pick !== null && pick.day === selected.date && pick.shown === data.shown
  const cursor = held ? Math.min(Math.max(pick.t, span.start), span.end) : rest

  // One vertical range for all 14 days, so one day can be compared with
  // another, widened if needed to fit today's readings. Those count on every
  // day, so the scale does not jump when another day is chosen.
  const bounds = steppedBounds(
    [...(data.predictions.data ?? []), ...readings].map((point) => point.ft),
    1,
  )

  let notice: string | null = null
  if (predicted.length === 0) {
    notice =
      data.predictions.status === 'loading'
        ? 'Loading tides'
        : 'Tide data unavailable'
  }

  const readout = tideReadout(predicted, observed, cursor)
  const text = tideWords(readout)
  const dots: Dot[] = []
  if (notice === null) {
    if (readout.predictedFt !== null) {
      dots.push({ name: 'predicted', v: readout.predictedFt })
    }
    if (readout.observedFt !== null) {
      dots.push({ name: 'observed', v: readout.observedFt })
    }
  }
  // For a screen reader. The panel is named, so the words are never left
  // hanging among the weather panels'. Without a curve there is no panel,
  // and the notice is said instead.
  const said = [text.predicted, text.observed].filter((part) => part !== null)
  const words = notice ?? `${TITLE}: ${said.join(', ')}`

  return {
    title: TITLE,
    predicted,
    observed,
    events,
    cursor,
    bounds,
    readout,
    text,
    words,
    rules:
      notice === null
        ? wholeSteps(bounds[0], bounds[1], RULE_EVERY).map((v) => ({
            v,
            label: `${v} ft`,
          }))
        : [],
    series: [
      {
        name: 'predicted',
        filled: true,
        points: predicted.map((p) => ({ t: p.t, v: p.ft })),
      },
      {
        name: 'observed',
        maxGap: OBSERVED_GAP,
        points: observed.map((p) => ({ t: p.t, v: p.ft })),
      },
    ],
    dots,
    notice,
  }
}
