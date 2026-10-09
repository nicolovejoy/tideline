import { describe, expect, test } from 'vitest'
import { tideView } from './tideView.ts'
import type { Loaded } from '../data/load.ts'
import type { TideExtreme, TidePoint } from '../data/noaa.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
// Local 8 October 2026 at the spot, Pacific daylight time.
const START = Date.UTC(2026, 9, 8, 7)
const END = Date.UTC(2026, 9, 9, 7)
const NOW = START + 15 * HOUR + 36 * MINUTE // 3:36 PM

function ready<T>(data: T): Loaded<T> {
  return { data, fetchedAt: NOW, span: null, status: 'ready' }
}

function none<T>(status: Loaded<T>['status']): Loaded<T> {
  return { data: null, fetchedAt: null, span: null, status }
}

// A flat 3 ft curve every 6 minutes from the day before to the day after,
// with one 6.5 ft point a week on.
const curve: TidePoint[] = []
for (let t = START - HOUR; t <= END + HOUR; t += 6 * MINUTE) {
  curve.push({ t, ft: 3 })
}
curve.push({ t: START + 7 * 24 * HOUR, ft: 6.5 })

// Readings until 3:24 PM, running 1 ft above the curve.
const readings: TidePoint[] = []
for (let t = START; t <= START + 15 * HOUR + 24 * MINUTE; t += 6 * MINUTE) {
  readings.push({ t, ft: 4 })
}

const events: TideExtreme[] = [
  { t: START - 2 * HOUR, ft: 5, type: 'H' },
  { t: START, ft: 0.2, type: 'L' },
  { t: START + 6 * HOUR, ft: 5.4, type: 'H' },
  { t: END, ft: 0.8, type: 'L' },
]

function data(overrides = {}) {
  return {
    now: NOW,
    shown: 0,
    today: '2026-10-08',
    day: { start: START, end: END },
    predictions: ready(curve),
    hilo: ready(events),
    observed: ready(readings),
    ...overrides,
  }
}

describe('what is drawn', () => {
  test('the curve covers the day and reaches both edges of the plot', () => {
    const { predicted } = tideView(data(), null)
    expect(predicted[0].t).toBe(START)
    expect(predicted.at(-1)!.t).toBe(END)
    expect(predicted).toHaveLength(241)
  })

  test('a high or low at midnight belongs to the day it starts', () => {
    const view = tideView(data(), null)
    expect(view.events.map((event) => event.t)).toEqual([
      START,
      START + 6 * HOUR,
    ])
  })

  test("the vertical range covers all 14 days and today's readings", () => {
    // The curve is 3 ft today but reaches 6.5 ft next week.
    expect(tideView(data(), null).bounds).toEqual([3, 7])
    const high = [...readings, { t: NOW, ft: 8.2 }]
    expect(tideView(data({ observed: ready(high) }), null).bounds).toEqual([
      3, 9,
    ])
  })
})

describe('where the cursor is', () => {
  test('at rest it sits on the latest reading', () => {
    const view = tideView(data(), null)
    expect(view.cursor).toBe(START + 15 * HOUR + 24 * MINUTE)
    expect(view.readout).toEqual({ predictedFt: 3, observedFt: 4, aboveFt: 1 })
  })

  test('it stays where it was put', () => {
    const pick = { t: START + 9 * HOUR, day: '2026-10-08', shown: 0 }
    expect(tideView(data(), pick).cursor).toBe(START + 9 * HOUR)
  })

  test('it goes back to rest when the page is put away and brought back', () => {
    const pick = { t: START + 9 * HOUR, day: '2026-10-08', shown: 0 }
    const view = tideView(data({ shown: 1 }), pick)
    expect(view.cursor).toBe(START + 15 * HOUR + 24 * MINUTE)
  })

  test('it goes back to rest when the day changes', () => {
    const pick = { t: END, day: '2026-10-08', shown: 0 }
    const tomorrow = data({
      now: END + 5 * MINUTE,
      today: '2026-10-09',
      day: { start: END, end: END + 24 * HOUR },
      observed: ready([]),
    })
    // 12:05 AM with no readings yet: the clock, to the nearest step.
    expect(tideView(tomorrow, pick).cursor).toBe(END + 6 * MINUTE)
  })

  test('it cannot be put outside the day', () => {
    const pick = { t: END + 3 * HOUR, day: '2026-10-08', shown: 0 }
    expect(tideView(data(), pick).cursor).toBe(END)
  })
})

describe('when there is no curve to draw', () => {
  test('nothing saved and a request on its way: loading', () => {
    const view = tideView(data({ predictions: none('loading') }), null)
    expect(view.notice).toBe('Loading tides')
    expect(view.predicted).toEqual([])
  })

  test('nothing saved and the request failed: unavailable', () => {
    const view = tideView(data({ predictions: none('unavailable') }), null)
    expect(view.notice).toBe('Tide data unavailable')
  })

  test('saved data that does not reach today, and no way to refresh it: unavailable, not loading for ever', () => {
    const old: Loaded<TidePoint[]> = {
      data: [{ t: START - 20 * 24 * HOUR, ft: 3 }],
      fetchedAt: START - 20 * 24 * HOUR,
      span: null,
      status: 'stale',
    }
    expect(tideView(data({ predictions: old }), null).notice).toBe(
      'Tide data unavailable',
    )
  })

  test('with a curve there is no notice', () => {
    expect(tideView(data(), null).notice).toBeNull()
  })
})
