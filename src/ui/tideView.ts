// What the tide part of the screen shows, worked out from what is loaded and
// where the cursor was last put. A plain function, so the rules have tests
// and App.tsx only arranges the result.

import { restingCursor, tideReadout } from '../chart/readout.ts'
import type { TideReadout } from '../chart/readout.ts'
import { wholeBounds } from '../chart/scales.ts'
import type { TideExtreme, TidePoint } from '../data/noaa.ts'
import type { SpotData } from '../data/useSpotData.ts'

/** Where the cursor was put by hand, and when. */
export interface CursorPick {
  t: number
  /** The date at the spot when it was put there. */
  day: string
  /** How many times the page had come back into view by then. */
  shown: number
}

export interface TideView {
  /** The day's predicted curve, reaching both edges of the plot. */
  predicted: TidePoint[]
  /** The day's readings, in order. */
  observed: TidePoint[]
  /** The day's highs and lows. */
  events: TideExtreme[]
  cursor: number
  /** The plot's vertical range, in whole feet. */
  bounds: [number, number]
  readout: TideReadout
  /** What to say where the plot would be, when there is no curve to draw. */
  notice: string | null
}

type Inputs = Pick<
  SpotData,
  'now' | 'shown' | 'today' | 'day' | 'predictions' | 'hilo' | 'observed'
>

export function tideView(data: Inputs, pick: CursorPick | null): TideView {
  const { day } = data
  // Both ends are included, so the curve reaches the right edge of the plot
  // by using the first point of the next day.
  const ofDay = (points: TidePoint[] | null) =>
    (points ?? []).filter((point) => point.t >= day.start && point.t <= day.end)
  const predicted = ofDay(data.predictions.data)
  const observed = ofDay(data.observed.data)
  // A high or low at midnight belongs to the day it starts, not both.
  const events = (data.hilo.data ?? []).filter(
    (event) => event.t >= day.start && event.t < day.end,
  )

  // A pick lasts until the day changes or the page is put away and brought
  // back. After that the cursor goes back to rest, so reopening the app shows
  // the latest reading and not wherever the cursor was left.
  const held =
    pick !== null && pick.day === data.today && pick.shown === data.shown
  const cursor = held
    ? Math.min(Math.max(pick.t, day.start), day.end)
    : restingCursor(data.now, observed)

  // One vertical range for all 14 days, so one day can be compared with
  // another, widened if needed to fit today's readings.
  const bounds = wholeBounds(
    [...(data.predictions.data ?? []), ...observed].map((point) => point.ft),
  )

  let notice: string | null = null
  if (predicted.length === 0) {
    notice =
      data.predictions.status === 'loading'
        ? 'Loading tides'
        : 'Tide data unavailable'
  }

  return {
    predicted,
    observed,
    events,
    cursor,
    bounds,
    readout: tideReadout(predicted, observed, cursor),
    notice,
  }
}
