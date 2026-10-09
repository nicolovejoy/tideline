import { describe, expect, test } from 'vitest'
import type { Selected } from './selection.ts'
import { tideView } from './tideView.ts'
import type { Loaded } from '../data/load.ts'
import type { TideExtreme, TidePoint } from '../data/noaa.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
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

// A flat 3 ft curve every 6 minutes from the day before to two days after,
// with one 6.5 ft point a week on.
const curve: TidePoint[] = []
for (let t = START - HOUR; t <= END + DAY + HOUR; t += 6 * MINUTE) {
  curve.push({ t, ft: 3 })
}
curve.push({ t: START + 7 * DAY, ft: 6.5 })

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
  { t: END + 9 * HOUR, ft: 5.7, type: 'H' },
]

function data(overrides = {}) {
  return {
    now: NOW,
    shown: 0,
    day: { start: START, end: END },
    predictions: ready(curve),
    hilo: ready(events),
    observed: ready(readings),
    ...overrides,
  }
}

function day(index: number, sunset: number | null): Selected {
  const date = `2026-10-${String(8 + index).padStart(2, '0')}`
  return {
    index,
    date,
    span: { start: START + index * DAY, end: END + index * DAY },
    astro: {
      date,
      sunset,
      moonrise: null,
      illumination: 0.03,
      phase: 'Waning Crescent',
      moonriseNearSunset: null,
    },
    isToday: index === 0,
  }
}

const TODAY = day(0, START + 18 * HOUR + 34 * MINUTE)
// Sunset at 6:32 PM, which is between two 6-minute steps.
const TOMORROW = day(1, END + 18 * HOUR + 32 * MINUTE)

describe('what is drawn', () => {
  test('the curve covers the day and reaches both edges of the plot', () => {
    const { predicted } = tideView(data(), TODAY, null)
    expect(predicted[0].t).toBe(START)
    expect(predicted.at(-1)!.t).toBe(END)
    expect(predicted).toHaveLength(241)
  })

  test('a high or low at midnight belongs to the day it starts', () => {
    const view = tideView(data(), TODAY, null)
    expect(view.events.map((event) => event.t)).toEqual([
      START,
      START + 6 * HOUR,
    ])
  })

  test("the vertical range covers all 14 days and today's readings", () => {
    // The curve is 3 ft today but reaches 6.5 ft next week.
    expect(tideView(data(), TODAY, null).bounds).toEqual([3, 7])
    const high = [...readings, { t: NOW, ft: 8.2 }]
    const view = tideView(data({ observed: ready(high) }), TODAY, null)
    expect(view.bounds).toEqual([3, 9])
  })
})

describe('another day', () => {
  test('has its own curve and its own highs and lows', () => {
    const view = tideView(data(), TOMORROW, null)
    expect(view.predicted[0].t).toBe(END)
    expect(view.predicted.at(-1)!.t).toBe(END + DAY)
    expect(view.events.map((event) => event.t)).toEqual([END, END + 9 * HOUR])
  })

  test("has no readings: today's are not drawn on it or read out", () => {
    const view = tideView(data(), TOMORROW, null)
    expect(view.observed).toEqual([])
    expect(view.readout.observedFt).toBeNull()
  })

  test('keeps the vertical range that today has, readings included, so the scale does not jump', () => {
    const high = [...readings, { t: NOW, ft: 8.2 }]
    const view = tideView(data({ observed: ready(high) }), TOMORROW, null)
    expect(view.bounds).toEqual([3, 9])
  })
})

describe('where the cursor is', () => {
  test('at rest today it sits on the latest reading', () => {
    const view = tideView(data(), TODAY, null)
    expect(view.cursor).toBe(START + 15 * HOUR + 24 * MINUTE)
    expect(view.readout).toEqual({ predictedFt: 3, observedFt: 4, aboveFt: 1 })
  })

  test('at rest on another day it sits at sunset, on the step that contains it', () => {
    const view = tideView(data(), TOMORROW, null)
    expect(view.cursor).toBe(END + 18 * HOUR + 30 * MINUTE)
  })

  test('a sunset just before the hour does not tip the cursor into the next hour', () => {
    // 4:59 PM. The nearest step is 5:00 PM, where the weather is another
    // hour's and no longer what the day's row in the list gives.
    const view = tideView(data(), day(1, END + 16 * HOUR + 59 * MINUTE), null)
    expect(view.cursor).toBe(END + 16 * HOUR + 54 * MINUTE)
  })

  test('where the sun does not set it rests in the middle of the day', () => {
    const view = tideView(data(), day(1, null), null)
    expect(view.cursor).toBe(END + 12 * HOUR)
  })

  test('it stays where it was put', () => {
    const pick = { t: START + 9 * HOUR, day: '2026-10-08', shown: 0 }
    expect(tideView(data(), TODAY, pick).cursor).toBe(START + 9 * HOUR)
  })

  test('it goes back to rest when the page is put away and brought back', () => {
    const pick = { t: START + 9 * HOUR, day: '2026-10-08', shown: 0 }
    const view = tideView(data({ shown: 1 }), TODAY, pick)
    expect(view.cursor).toBe(START + 15 * HOUR + 24 * MINUTE)
  })

  test('it goes back to rest when another day is put on screen', () => {
    const pick = { t: START + 9 * HOUR, day: '2026-10-08', shown: 0 }
    const view = tideView(data(), TOMORROW, pick)
    expect(view.cursor).toBe(END + 18 * HOUR + 30 * MINUTE)
  })

  test('it goes back to rest when the day changes', () => {
    const pick = { t: END, day: '2026-10-08', shown: 0 }
    const tomorrow = data({
      now: END + 5 * MINUTE,
      day: { start: END, end: END + DAY },
      observed: ready([]),
    })
    const today = { ...day(1, null), isToday: true }
    // 12:05 AM with no readings yet: the clock, to the nearest step.
    expect(tideView(tomorrow, today, pick).cursor).toBe(END + 6 * MINUTE)
  })

  test('it cannot be put outside the day', () => {
    const pick = { t: END + 3 * HOUR, day: '2026-10-08', shown: 0 }
    expect(tideView(data(), TODAY, pick).cursor).toBe(END)
  })
})

describe('when there is no curve to draw', () => {
  test('nothing saved and a request on its way: loading', () => {
    const view = tideView(data({ predictions: none('loading') }), TODAY, null)
    expect(view.notice).toBe('Loading tides')
    expect(view.predicted).toEqual([])
  })

  test('nothing saved and the request failed: unavailable', () => {
    const view = tideView(
      data({ predictions: none('unavailable') }),
      TODAY,
      null,
    )
    expect(view.notice).toBe('Tide data unavailable')
  })

  test('saved data that does not reach today, and no way to refresh it: unavailable, not loading for ever', () => {
    const old: Loaded<TidePoint[]> = {
      data: [{ t: START - 20 * DAY, ft: 3 }],
      fetchedAt: START - 20 * DAY,
      span: null,
      status: 'stale',
    }
    expect(tideView(data({ predictions: old }), TODAY, null).notice).toBe(
      'Tide data unavailable',
    )
  })

  test('with a curve there is no notice', () => {
    expect(tideView(data(), TODAY, null).notice).toBeNull()
  })
})
