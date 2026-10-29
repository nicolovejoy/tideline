import { describe, expect, test } from 'vitest'
import type { Selected } from './selection.ts'
import { tideView } from './tideView.ts'
import { curveFromHiLo } from '../data/interpolate.ts'
import type { Loaded } from '../data/load.ts'
import type { TideExtreme, TidePoint } from '../data/noaa.ts'
import { CAMPUS_POINT, spotById } from '../spot.ts'

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

const OWN = CAMPUS_POINT
const GAVIOTA = spotById('gaviota')
// Inland and high up, so it has no tide.
const LA_CUMBRE = spotById('la-cumbre-peak')
// A spot whose station publishes highs and lows only. Its gauge is elsewhere,
// as Gaviota's is.
const VENTURA = {
  ...spotById('gaviota'),
  id: 'ventura-test',
  tideStation: {
    id: '9411189',
    name: 'Ventura',
    distanceMi: 1.4,
    direction: 'south',
    type: 'subordinate' as const,
  },
}

/** The view at Campus Point, which has its own gauge. */
function own(
  data: Parameters<typeof tideView>[0],
  selected: Selected,
  pick: Parameters<typeof tideView>[2],
) {
  return tideView(data, selected, pick, OWN)
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
    gaugePredictions: ready(curve),
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
    window: {
      start: START + index * DAY,
      end: END + index * DAY,
      first: index,
      last: index,
    },
    astro: {
      date,
      sunset,
      night: [],
      moonrise: null,
      illumination: 0.03,
      phase: 'Waning Crescent',
      moonriseNearSunset: null,
    },
    isToday: index === 0,
    showsToday: index === 0,
    anchor: sunset ?? START + index * DAY + DAY / 2,
  }
}

/** The same day with a window of `days` days from it. */
function wide(selected: Selected, days: number): Selected {
  return {
    ...selected,
    window: {
      start: selected.span.start,
      end: selected.span.start + days * DAY,
      first: selected.index,
      last: selected.index + days - 1,
    },
  }
}

const TODAY = day(0, START + 18 * HOUR + 34 * MINUTE)
// Sunset at 6:32 PM, which is between two 6-minute steps.
const TOMORROW = day(1, END + 18 * HOUR + 32 * MINUTE)

describe('what is drawn', () => {
  test('the curve covers the day and reaches past both edges of the plot by a point', () => {
    const { predicted } = own(data(), TODAY, null)
    expect(predicted[0].t).toBe(START - 6 * MINUTE)
    expect(predicted.at(-1)!.t).toBe(END + 6 * MINUTE)
    expect(predicted).toHaveLength(243)
  })

  test('a high or low at midnight belongs to the day it starts', () => {
    const view = own(data(), TODAY, null)
    expect(view.events.map((event) => event.t)).toEqual([
      START,
      START + 6 * HOUR,
    ])
  })

  test("the vertical range covers all 14 days and today's readings", () => {
    // The curve is 3 ft today but reaches 6.5 ft next week.
    expect(own(data(), TODAY, null).bounds).toEqual([3, 7])
    const high = [...readings, { t: NOW, ft: 8.2 }]
    const view = own(data({ observed: ready(high) }), TODAY, null)
    expect(view.bounds).toEqual([3, 9])
  })
})

describe('another day', () => {
  test('has its own curve and its own highs and lows', () => {
    const view = own(data(), TOMORROW, null)
    expect(view.predicted[0].t).toBe(END - 6 * MINUTE)
    expect(view.predicted.at(-1)!.t).toBe(END + DAY + 6 * MINUTE)
    expect(view.events.map((event) => event.t)).toEqual([END, END + 9 * HOUR])
  })

  test("has no readings: today's are not drawn on it or read out", () => {
    const view = own(data(), TOMORROW, null)
    expect(view.observed).toEqual([])
    expect(view.readout.observedFt).toBeNull()
  })

  test('keeps the vertical range that today has, readings included, so the scale does not jump', () => {
    const high = [...readings, { t: NOW, ft: 8.2 }]
    const view = own(data({ observed: ready(high) }), TOMORROW, null)
    expect(view.bounds).toEqual([3, 9])
  })
})

describe('where the cursor is', () => {
  test('at rest today it sits on the latest reading', () => {
    const view = own(data(), TODAY, null)
    expect(view.cursor).toBe(START + 15 * HOUR + 24 * MINUTE)
    expect(view.readout).toEqual({ predictedFt: 3, observedFt: 4, aboveFt: 1 })
  })

  test('at rest on another day it sits at sunset, on the step that contains it', () => {
    const view = own(data(), TOMORROW, null)
    expect(view.cursor).toBe(END + 18 * HOUR + 30 * MINUTE)
  })

  test('a sunset just before the hour does not tip the cursor into the next hour', () => {
    // 4:59 PM. The nearest step is 5:00 PM, where the weather is another
    // hour's and no longer what the day's row in the list gives.
    const view = own(data(), day(1, END + 16 * HOUR + 59 * MINUTE), null)
    expect(view.cursor).toBe(END + 16 * HOUR + 54 * MINUTE)
  })

  test('where the sun does not set it rests in the middle of the day', () => {
    const view = own(data(), day(1, null), null)
    expect(view.cursor).toBe(END + 12 * HOUR)
  })

  test('it stays where it was put', () => {
    const pick = { t: START + 9 * HOUR, day: '2026-10-08', shown: 0 }
    expect(own(data(), TODAY, pick).cursor).toBe(START + 9 * HOUR)
  })

  test('it goes back to rest when the page is put away and brought back', () => {
    const pick = { t: START + 9 * HOUR, day: '2026-10-08', shown: 0 }
    const view = own(data({ shown: 1 }), TODAY, pick)
    expect(view.cursor).toBe(START + 15 * HOUR + 24 * MINUTE)
  })

  test('it goes back to rest when another day is put on screen', () => {
    const pick = { t: START + 9 * HOUR, day: '2026-10-08', shown: 0 }
    const view = own(data(), TOMORROW, pick)
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
    expect(own(tomorrow, today, pick).cursor).toBe(END + 6 * MINUTE)
  })

  test('it cannot be put outside the day', () => {
    const pick = { t: END + 3 * HOUR, day: '2026-10-08', shown: 0 }
    expect(own(data(), TODAY, pick).cursor).toBe(END)
  })
})

describe('when there is no curve to draw', () => {
  test('nothing saved and a request on its way: loading', () => {
    const view = own(data({ predictions: none('loading') }), TODAY, null)
    expect(view.notice).toBe('Loading tides')
    expect(view.predicted).toEqual([])
  })

  test('nothing saved and the request failed: unavailable', () => {
    const view = own(data({ predictions: none('unavailable') }), TODAY, null)
    expect(view.notice).toBe('Tide data unavailable')
  })

  test('saved data that does not reach today, and no way to refresh it: unavailable, not loading for ever', () => {
    const old: Loaded<TidePoint[]> = {
      data: [{ t: START - 20 * DAY, ft: 3 }],
      fetchedAt: START - 20 * DAY,
      span: null,
      status: 'stale',
    }
    expect(own(data({ predictions: old }), TODAY, null).notice).toBe(
      'Tide data unavailable',
    )
  })

  test('with a curve there is no notice', () => {
    expect(own(data(), TODAY, null).notice).toBeNull()
  })
})

describe('what the panel is given', () => {
  test('a rule every 2 ft across the range, each with its label', () => {
    const view = own(data(), TODAY, null)
    expect(view.bounds).toEqual([3, 7])
    expect(view.rules).toEqual([
      { v: 4, label: '4 ft' },
      { v: 6, label: '6 ft' },
    ])
  })

  test('just below the datum the first rule is zero, never minus zero', () => {
    const near = ready([...curve, { t: START + 8 * DAY, ft: -0.3 }])
    const first = own(data({ predictions: near }), TODAY, null)
    expect(first.bounds).toEqual([-1, 7])
    expect(Object.is(first.rules[0].v, 0)).toBe(true)
    expect(first.rules.map((rule) => rule.label)).toEqual([
      '0 ft',
      '2 ft',
      '4 ft',
      '6 ft',
    ])

    const low = ready([...curve, { t: START + 8 * DAY, ft: -1.5 }])
    const view = own(data({ predictions: low }), TODAY, null)
    expect(view.bounds).toEqual([-2, 7])
    expect(view.rules.map((rule) => rule.label)).toEqual([
      '-2 ft',
      '0 ft',
      '2 ft',
      '4 ft',
      '6 ft',
    ])
  })

  test('the curve is filled, and the readings break at a gap longer than two steps', () => {
    const view = own(data(), TODAY, null)
    expect(view.series.map((series) => series.name)).toEqual([
      'predicted',
      'observed',
    ])
    expect(view.series[0].filled).toBe(true)
    expect(view.series[0].points).toHaveLength(view.predicted.length)
    expect(view.series[0].points[0]).toEqual({ t: START - 6 * MINUTE, v: 3 })
    expect(view.series[1].maxGap).toBe(13 * MINUTE)
    expect(view.series[1].points).toHaveLength(readings.length)
  })

  test('a dot for the prediction and one for the reading under the cursor', () => {
    expect(own(data(), TODAY, null).dots).toEqual([
      { name: 'predicted', v: 3 },
      { name: 'observed', v: 4 },
    ])
  })

  test('on another day there is no reading, so no dot for one', () => {
    expect(own(data(), TOMORROW, null).dots).toEqual([
      { name: 'predicted', v: 3 },
    ])
  })

  test('the panel is named, and its words for a screen reader start with its name', () => {
    const view = own(data(), TODAY, null)
    expect(view.title).toBe('Tide')
    expect(view.text).toEqual({
      predicted: '3.0 ft predicted',
      second: { words: '4.0 ft observed (+1.0)', key: 'observed' },
    })
    expect(view.words).toBe('Tide: 3.0 ft predicted, 4.0 ft observed (+1.0)')
    expect(own(data(), TOMORROW, null).words).toBe('Tide: 3.0 ft predicted')
  })

  test('with no curve, the words are the notice', () => {
    const view = own(data({ predictions: none('unavailable') }), TODAY, null)
    expect(view.words).toBe('Tide data unavailable')
    expect(view.rules).toEqual([])
    expect(view.dots).toEqual([])
  })
})

describe('a spot whose gauge is another station', () => {
  // The gauge's own curve runs 0.5 ft below the spot's, so its readings,
  // which are 4 ft, stand 1.5 ft above it.
  const gaugeCurve = curve.map((point) => ({ ...point, ft: point.ft - 0.5 }))
  const gauge = () => data({ gaugePredictions: ready(gaugeCurve) })

  test("draws the spot's own curve and no readings on it", () => {
    const view = tideView(gauge(), TODAY, null, GAVIOTA)
    expect(view.predicted[0]).toEqual({ t: START - 6 * MINUTE, ft: 3 })
    expect(view.observed).toEqual([])
    expect(view.series.map((series) => series.name)).toEqual(['predicted'])
    expect(view.dots).toEqual([{ name: 'predicted', v: 3 }])
  })

  test("reads the gauge's deviation from its own prediction at the cursor, without a colour key", () => {
    const view = tideView(gauge(), TODAY, null, GAVIOTA)
    expect(view.text).toEqual({
      predicted: '3.0 ft predicted',
      second: {
        words: 'Santa Barbara gauge +1.5 ft vs its prediction',
        key: null,
      },
    })
    expect(view.words).toBe(
      'Tide: 3.0 ft predicted, Santa Barbara gauge +1.5 ft vs its prediction',
    )
  })

  test("at rest the cursor sits on the gauge's latest reading", () => {
    const view = tideView(gauge(), TODAY, null, GAVIOTA)
    expect(view.cursor).toBe(START + 15 * HOUR + 24 * MINUTE)
  })

  test('past the last reading the second line is blank', () => {
    const pick = { t: START + 16 * HOUR, day: '2026-10-08', shown: 0 }
    expect(tideView(gauge(), TODAY, pick, GAVIOTA).text.second).toBeNull()
  })

  test("without the gauge's own prediction there is no deviation", () => {
    const view = tideView(
      data({ gaugePredictions: none('loading') }),
      TODAY,
      null,
      GAVIOTA,
    )
    expect(view.text.second).toBeNull()
    expect(view.words).toBe('Tide: 3.0 ft predicted')
  })

  test('on another day the gauge says nothing', () => {
    const view = tideView(gauge(), TOMORROW, null, GAVIOTA)
    expect(view.text.second).toBeNull()
    expect(view.observed).toEqual([])
    expect(view.words).toBe('Tide: 3.0 ft predicted')
  })

  test("the gauge's readings are kept for the caption, though not drawn", () => {
    const view = tideView(gauge(), TODAY, null, GAVIOTA)
    expect(view.readings).toHaveLength(readings.length)
    expect(view.observed).toEqual([])
  })

  test("the vertical range does not count the gauge's readings, which are not drawn", () => {
    const high = [...readings, { t: NOW, ft: 8.2 }]
    const view = tideView(
      data({ observed: ready(high), gaugePredictions: ready(gaugeCurve) }),
      TODAY,
      null,
      GAVIOTA,
    )
    expect(view.bounds).toEqual([3, 7])
  })

  test('a spot with a tide has no line in its place', () => {
    expect(tideView(gauge(), TODAY, null, GAVIOTA).noTides).toBeNull()
    expect(tideView(data(), TODAY, null, OWN).noTides).toBeNull()
  })
})

describe('a spot with no tide', () => {
  test('gives one line saying why, nothing to draw, and nothing for the cursor to say', () => {
    const view = tideView(data(), TODAY, null, LA_CUMBRE)
    expect(view.noTides).toBe(
      'Tides are not shown here: the spot is 3,997 ft above sea level.',
    )
    expect(view.words).toBe('')
    expect(view.notice).toBeNull()
    expect(view.predicted).toEqual([])
    expect(view.observed).toEqual([])
    expect(view.events).toEqual([])
    expect(view.series).toEqual([])
    expect(view.rules).toEqual([])
    expect(view.dots).toEqual([])
    expect(view.text.second).toBeNull()
  })

  test('the cursor rests on the clock today, and at sunset on other days', () => {
    const view = tideView(data(), TODAY, null, LA_CUMBRE)
    expect(view.cursor).toBe(NOW)
    expect(tideView(data(), TOMORROW, null, LA_CUMBRE).cursor).toBe(
      END + 18 * HOUR + 30 * MINUTE,
    )
  })

  // There is no switch. What a saved spot once said about its tide is not
  // read: see hasTides in spot.ts.
  test('nothing about the view offers to show it', () => {
    const view = tideView(data(), TODAY, null, LA_CUMBRE)
    expect('canHide' in view).toBe(false)
    expect('hidden' in view).toBe(false)
  })
})

describe('at a spot whose station publishes highs and lows only', () => {
  test('the readout and the spoken words say interpolated, and the curve is drawn as any other', () => {
    const view = tideView(data(), TODAY, null, VENTURA)
    expect(view.text.predicted).toBe('3.0 ft interpolated')
    expect(view.words).toContain('3.0 ft interpolated')
    expect(view.words).not.toContain('predicted')
    expect(view.predicted).toHaveLength(243)
    expect(view.series[0].name).toBe('predicted')
    expect(view.dots).toEqual([{ name: 'predicted', v: 3 }])
    expect(view.notice).toBeNull()
  })

  test('saved highs and lows draw the curve at once, while the refresh is still loading', () => {
    const hilo: Loaded<TideExtreme[]> = {
      data: events,
      fetchedAt: NOW,
      span: null,
      status: 'loading',
    }
    const predictions = curveFromHiLo(hilo, { start: START, end: END + DAY })
    const view = tideView(data({ predictions }), TODAY, null, VENTURA)
    expect(view.notice).toBeNull()
    // The interpolated curve starts at the day's start, so it has no point
    // before it, and one after the day's end.
    expect(view.predicted).toHaveLength(242)
    expect(view.predicted[0].t).toBe(START)
    expect(view.predicted.at(-1)?.t).toBe(END + 6 * MINUTE)
    expect(view.text.predicted.endsWith('interpolated')).toBe(true)
  })

  test('a harmonic station still says predicted', () => {
    const view = tideView(data(), TODAY, null, GAVIOTA)
    expect(view.text.predicted).toBe('3.0 ft predicted')
  })
})

describe('the window', () => {
  test("three days draw the curve to the end of the third day, and the table stays the day's", () => {
    const view = own(data(), wide(TODAY, 3), null)
    expect(view.predicted[0].t).toBe(START - 6 * MINUTE)
    // The curve runs out on the second day; the next point, a week on, is
    // the one after the window, and the plot's clip hides the line to it.
    expect(view.predicted.at(-2)!.t).toBe(START + 2 * DAY + HOUR)
    expect(view.predicted.at(-1)!.t).toBe(START + 7 * DAY)
    expect(view.events.map((e) => e.t)).toEqual([START, START + 6 * HOUR])
  })

  test('a pick on the third day holds in a three-day window', () => {
    const pick = { t: START + 2 * DAY + 6 * HOUR, day: '2026-10-08', shown: 0 }
    expect(own(data(), wide(TODAY, 3), pick).cursor).toBe(pick.t)
  })

  test("the same pick is clamped to the day's end when the window is the day", () => {
    const pick = { t: START + 2 * DAY + 6 * HOUR, day: '2026-10-08', shown: 0 }
    expect(own(data(), TODAY, pick).cursor).toBe(END)
  })
})

/** A zoom from `start` to `end`, with the chosen day `selected`. */
function zoomed(
  selected: Selected,
  start: number,
  end: number,
  first: number,
  last: number,
): Selected {
  return {
    ...selected,
    window: { start, end, first, last },
    showsToday: first === 0,
  }
}

describe('a zoom', () => {
  test('that starts and ends between two points has a point beyond each edge', () => {
    const a = START + 10 * HOUR + 2 * MINUTE
    const b = START + 14 * HOUR + 3 * MINUTE
    const { predicted } = own(data(), zoomed(TODAY, a, b, 0, 0), null)
    expect(predicted[0].t).toBe(START + 10 * HOUR)
    expect(predicted.at(-1)!.t).toBe(START + 14 * HOUR + 6 * MINUTE)
  })

  test('draws only the readings in it, with one either side', () => {
    const a = START + 10 * HOUR + 3 * MINUTE
    const b = START + 13 * HOUR + 3 * MINUTE
    const view = own(data(), zoomed(TODAY, a, b, 0, 0), null)
    expect(view.observed[0].t).toBe(START + 10 * HOUR)
    expect(view.observed.at(-1)!.t).toBe(START + 13 * HOUR + 6 * MINUTE)
    // Every reading is still kept for the caption.
    expect(view.readings).toEqual(readings)
  })

  test('holds the resting cursor to it when the latest reading is off its right', () => {
    const a = START + 6 * HOUR
    const b = START + 10 * HOUR
    expect(own(data(), zoomed(TODAY, a, b, 0, 0), null).cursor).toBe(b)
  })

  test('holds the resting cursor to it when sunset is off its left', () => {
    const a = END + 20 * HOUR
    const b = END + DAY + 2 * HOUR
    expect(own(data(), zoomed(TOMORROW, a, b, 1, 2), null).cursor).toBe(a)
  })

  test("panned back from tomorrow into today draws today's readings", () => {
    // The cursor rests at the window's end, inside the readings.
    const a = START + 10 * HOUR
    const b = START + 15 * HOUR
    const view = own(data(), zoomed(TOMORROW, a, b, 0, 0), null)
    expect(view.observed.length).toBeGreaterThan(0)
    expect(view.readout.observedFt).not.toBeNull()
  })

  test('of today panned on to tomorrow draws no readings', () => {
    const a = END + 6 * HOUR
    const b = END + 12 * HOUR
    const view = own(data(), zoomed(TODAY, a, b, 1, 1), null)
    expect(view.observed).toEqual([])
  })

  test('panned back into today reads a gauge elsewhere, as today does', () => {
    const a = START + 10 * HOUR
    const b = START + 15 * HOUR
    const view = tideView(data(), zoomed(TOMORROW, a, b, 0, 0), null, GAVIOTA)
    expect(view.text.second).not.toBeNull()
  })
})
