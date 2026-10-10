// A tide curve where NOAA publishes none. 2,242 of its 3,502 prediction
// stations are subordinate: they give highs and lows only, and a 6-minute
// request returns an error. Between each pair of extremes the curve is a
// cosine, level at both and halfway at the midpoint, one point every 6
// minutes as NOAA's own curves run. Framework-free.

import type { Span } from './cache.ts'
import type { Loaded } from './load.ts'
import type { TideExtreme, TidePoint } from './noaa.ts'
import { MINUTE } from '../time.ts'

/** NOAA's points fall on 6-minute boundaries from the hour, and so do these. */
const STEP = 6 * MINUTE

/** The height at t between two extremes: from.ft at from.t, to.ft at to.t. */
function between(from: TideExtreme, to: TideExtreme, t: number): number {
  const phase = (Math.PI * (t - from.t)) / (to.t - from.t)
  return (from.ft + to.ft) / 2 + ((from.ft - to.ft) / 2) * Math.cos(phase)
}

/**
 * The curve through the highs and lows over a span, both ends included. A
 * step before the first extreme or after the last is left out rather than
 * guessed, so a plot whose data stops short has a gap, not a slope.
 */
export function interpolateCurve(
  events: TideExtreme[],
  span: Span,
): TidePoint[] {
  const sorted = [...events].sort((a, b) => a.t - b.t)
  const points: TidePoint[] = []
  if (sorted.length < 2) return points
  let i = 0
  for (let t = Math.ceil(span.start / STEP) * STEP; t <= span.end; t += STEP) {
    // The last pair that starts at or before t.
    while (i < sorted.length - 2 && sorted[i + 1].t <= t) i++
    const from = sorted[i]
    const to = sorted[i + 1]
    if (t < from.t || t > to.t || to.t === from.t) continue
    points.push({ t, ft: between(from, to, t) })
  }
  return points
}

/**
 * The curve as a source, standing in for fetched predictions at a station
 * that publishes none. It is as fresh, or as stale, as the highs and lows
 * it is made from, and nothing while they are nothing.
 */
export function curveFromHiLo(
  hilo: Loaded<TideExtreme[]>,
  span: Span,
): Loaded<TidePoint[]> {
  if (hilo.data === null) {
    return { data: null, fetchedAt: null, span: null, status: hilo.status }
  }
  return {
    data: interpolateCurve(hilo.data, span),
    fetchedAt: hilo.fetchedAt,
    span,
    status: hilo.status,
  }
}
