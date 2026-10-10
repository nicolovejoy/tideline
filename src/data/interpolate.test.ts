import { describe, expect, test } from 'vitest'
import { curveFromHiLo, interpolateCurve } from './interpolate.ts'
import type { Loaded } from './load.ts'
import { parseHiLo, parsePredictions } from './noaa.ts'
import type { TideExtreme } from './noaa.ts'
import realRaw from './__fixtures__/noaa-predictions-9411340-20261010-20261023.json?raw'
import hiloRaw from './__fixtures__/noaa-hilo-9411340-20261009-20261024.json?raw'
import venturaRaw from './__fixtures__/noaa-hilo-9411189-20261009-20261024.json?raw'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const STEP = 6 * MINUTE
// 10 October 2026, 00:00 UTC.
const T0 = Date.UTC(2026, 9, 10)

// A low at midnight and a high six hours on, 1 ft to 5 ft.
const PAIR: TideExtreme[] = [
  { t: T0, ft: 1, type: 'L' },
  { t: T0 + 6 * HOUR, ft: 5, type: 'H' },
]

describe('interpolateCurve', () => {
  test('is the extremes at their instants and halfway at the midpoint', () => {
    const curve = interpolateCurve(PAIR, { start: T0, end: T0 + 6 * HOUR })
    expect(curve[0]).toEqual({ t: T0, ft: 1 })
    expect(curve.at(-1)).toEqual({ t: T0 + 6 * HOUR, ft: 5 })
    const mid = curve.find((p) => p.t === T0 + 3 * HOUR)!
    expect(mid.ft).toBeCloseTo(3, 10)
    // Level at both ends: the first step barely moves.
    expect(curve[1].ft - curve[0].ft).toBeLessThan(0.01)
  })

  test("one point every 6 minutes on the hour's boundaries, both ends included", () => {
    const curve = interpolateCurve(PAIR, { start: T0, end: T0 + 6 * HOUR })
    expect(curve).toHaveLength(61)
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].t - curve[i - 1].t).toBe(STEP)
    }
    // A span that starts between steps begins at the next step.
    const offset = interpolateCurve(PAIR, {
      start: T0 + 4 * MINUTE,
      end: T0 + HOUR,
    })
    expect(offset[0].t).toBe(T0 + STEP)
    expect(offset.at(-1)!.t).toBe(T0 + HOUR)
  })

  test('leaves out steps before the first event and after the last', () => {
    const curve = interpolateCurve(PAIR, {
      start: T0 - HOUR,
      end: T0 + 7 * HOUR,
    })
    expect(curve[0].t).toBe(T0)
    expect(curve.at(-1)!.t).toBe(T0 + 6 * HOUR)
    expect(curve.every((p) => Number.isFinite(p.ft))).toBe(true)
  })

  test('fewer than two events give no points', () => {
    expect(interpolateCurve([], { start: T0, end: T0 + HOUR })).toEqual([])
    expect(interpolateCurve([PAIR[0]], { start: T0, end: T0 + HOUR })).toEqual(
      [],
    )
  })

  test('events out of order are sorted first', () => {
    const backwards = [PAIR[1], PAIR[0]]
    expect(
      interpolateCurve(backwards, { start: T0, end: T0 + 6 * HOUR }),
    ).toEqual(interpolateCurve(PAIR, { start: T0, end: T0 + 6 * HOUR }))
  })

  test('two events at one instant make no point, and no NaN', () => {
    const twins: TideExtreme[] = [
      { t: T0, ft: 1, type: 'L' },
      { t: T0, ft: 1.1, type: 'H' },
      { t: T0 + 6 * HOUR, ft: 5, type: 'H' },
    ]
    const curve = interpolateCurve(twins, { start: T0, end: T0 + 6 * HOUR })
    expect(curve.every((p) => Number.isFinite(p.ft))).toBe(true)
    expect(curve.at(-1)).toEqual({ t: T0 + 6 * HOUR, ft: 5 })
  })

  test("follows a mixed semidiurnal day: Ventura's four extremes in order", () => {
    const events = parseHiLo(JSON.parse(venturaRaw))
    const day = { start: T0, end: T0 + 24 * HOUR }
    const curve = interpolateCurve(events, day)
    expect(curve).toHaveLength(241)
    // Each extreme is the curve's peak or trough: no point between two
    // neighbouring extremes lies outside their heights.
    const onDay = events.filter((e) => e.t >= day.start && e.t <= day.end)
    expect(onDay).toHaveLength(4)
    for (const point of curve) {
      const after = events.findIndex((e) => e.t > point.t)
      const [lo, hi] = [events[after - 1].ft, events[after].ft].sort(
        (a, b) => a - b,
      )
      expect(point.ft).toBeGreaterThanOrEqual(lo - 1e-9)
      expect(point.ft).toBeLessThanOrEqual(hi + 1e-9)
    }
  })

  test("is within the stated error of Santa Barbara's real curve over 14 days", () => {
    const real = parsePredictions(JSON.parse(realRaw))
    const events = parseHiLo(JSON.parse(hiloRaw))
    expect(real).toHaveLength(3360)
    const curve = interpolateCurve(events, {
      start: real[0].t,
      end: real[real.length - 1].t,
    })
    expect(curve).toHaveLength(real.length)
    const errors = curve
      .map((p, i) => {
        expect(p.t).toBe(real[i].t)
        return Math.abs(p.ft - real[i].ft)
      })
      .sort((a, b) => a - b)
    const rms = Math.sqrt(
      errors.reduce((sum, e) => sum + e * e, 0) / errors.length,
    )
    // Measured on 2026-10-10: rms 0.19 ft, 95th percentile 0.33 ft, worst
    // 1.15 ft (a 16-hour run on 17 October where NOAA's list skips a
    // near-stand). The spec states these; the ceilings sit just above.
    expect(rms).toBeLessThan(0.2)
    expect(errors[Math.floor(errors.length * 0.95)]).toBeLessThan(0.35)
    expect(errors[errors.length - 1]).toBeLessThan(1.2)
  })
})

describe('curveFromHiLo', () => {
  const span = { start: T0, end: T0 + 6 * HOUR }

  test('carries the highs and lows status and stamp, with the curve as data', () => {
    const hilo: Loaded<TideExtreme[]> = {
      data: PAIR,
      fetchedAt: T0 + HOUR,
      span: { start: T0 - 24 * HOUR, end: T0 + 90 * 24 * HOUR },
      status: 'stale',
    }
    const curve = curveFromHiLo(hilo, span)
    expect(curve.status).toBe('stale')
    expect(curve.fetchedAt).toBe(T0 + HOUR)
    expect(curve.span).toEqual(span)
    expect(curve.data).toEqual(interpolateCurve(PAIR, span))
  })

  test('is nothing while the highs and lows are nothing', () => {
    const hilo: Loaded<TideExtreme[]> = {
      data: null,
      fetchedAt: null,
      span: null,
      status: 'loading',
    }
    expect(curveFromHiLo(hilo, span)).toEqual({
      data: null,
      fetchedAt: null,
      span: null,
      status: 'loading',
    })
  })
})
