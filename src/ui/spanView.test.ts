import { describe, expect, test } from 'vitest'
import {
  SPANS,
  cursorWords,
  headingWords,
  stackLabels,
  windowBands,
  windowFor,
  windowMarkers,
} from './spanView.ts'
import { dayBands, dayMarkers, unlabelled } from './selection.ts'
import { frameFor } from '../data/useSpotData.ts'
import { CAMPUS_POINT } from '../spot.ts'
import { HOUR, MINUTE } from '../time.ts'

const ZONE = CAMPUS_POINT.timeZone
// Thursday 8 October 2026 at the spot.
const frame = frameFor(CAMPUS_POINT, '2026-10-08')
const { spans, days } = frame

describe('SPANS', () => {
  test('three choices, in the order of the buttons', () => {
    expect(SPANS.map((s) => [s.id, s.days, s.words])).toEqual([
      ['day', 1, 'Day'],
      ['days3', 3, '3 days'],
      ['week', 7, 'Week'],
    ])
  })
})

describe('windowFor', () => {
  test('a day is the day itself', () => {
    expect(windowFor(spans, 3, 'day')).toEqual({
      ...spans[3],
      first: 3,
      last: 3,
    })
  })

  test('a week from today runs to the end of the seventh day', () => {
    expect(windowFor(spans, 0, 'week')).toEqual({
      start: spans[0].start,
      end: spans[6].end,
      first: 0,
      last: 6,
    })
  })

  test('three days from the chosen day', () => {
    expect(windowFor(spans, 5, 'days3')).toEqual({
      start: spans[5].start,
      end: spans[7].end,
      first: 5,
      last: 7,
    })
  })

  test('a week from the thirteenth day is the two days that exist', () => {
    expect(windowFor(spans, 12, 'week')).toEqual({
      start: spans[12].start,
      end: spans[13].end,
      first: 12,
      last: 13,
    })
  })

  test('three days from the last day is that day', () => {
    expect(windowFor(spans, 13, 'days3')).toEqual({
      ...spans[13],
      first: 13,
      last: 13,
    })
  })
})

describe('stackLabels', () => {
  test('one day keeps the hour marks, both midnights included', () => {
    const window = windowFor(spans, 0, 'day')
    expect(stackLabels(window, ZONE, 'day')).toEqual([
      { t: window.start, text: '12a' },
      { t: window.start + 6 * HOUR, text: '6a' },
      { t: window.start + 12 * HOUR, text: '12p' },
      { t: window.start + 18 * HOUR, text: '6p' },
      { t: window.end, text: '12a' },
    ])
  })

  test('three days label each day with its weekday and its noon, and not the end', () => {
    const window = windowFor(spans, 0, 'days3')
    expect(stackLabels(window, ZONE, 'days3')).toEqual([
      { t: spans[0].start, text: 'Thu' },
      { t: spans[0].start + 12 * HOUR, text: '12p' },
      { t: spans[1].start, text: 'Fri' },
      { t: spans[1].start + 12 * HOUR, text: '12p' },
      { t: spans[2].start, text: 'Sat' },
      { t: spans[2].start + 12 * HOUR, text: '12p' },
    ])
  })

  test('a week labels each day with its weekday only', () => {
    const window = windowFor(spans, 0, 'week')
    expect(stackLabels(window, ZONE, 'week')).toEqual(
      ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'].map((text, i) => ({
        t: spans[i].start,
        text,
      })),
    )
  })

  test('on the day the clocks go back, noon is 13 hours after midnight', () => {
    // 1 November 2026 is 25 hours long at the spot.
    const late = frameFor(CAMPUS_POINT, '2026-10-31')
    const window = windowFor(late.spans, 0, 'days3')
    const labels = stackLabels(window, ZONE, 'days3')
    expect(labels[2]).toEqual({ t: late.spans[1].start, text: 'Sun' })
    expect(labels[3]).toEqual({
      t: late.spans[1].start + 13 * HOUR,
      text: '12p',
    })
    expect(labels[4]).toEqual({ t: late.spans[2].start, text: 'Mon' })
    expect(late.spans[2].start - late.spans[1].start).toBe(25 * HOUR)
  })
})

describe('headingWords', () => {
  test('one day is the day', () => {
    expect(headingWords(days, windowFor(spans, 0, 'day'))).toBe('Thu Oct 8')
  })

  test('a week names both ends', () => {
    expect(headingWords(days, windowFor(spans, 0, 'week'))).toBe(
      'Thu Oct 8 to Wed Oct 14',
    )
  })

  test('a clipped window names the last day that exists', () => {
    expect(headingWords(days, windowFor(spans, 12, 'week'))).toBe(
      'Tue Oct 20 to Wed Oct 21',
    )
  })
})

describe('cursorWords', () => {
  const t = spans[1].start + 15 * HOUR + 36 * MINUTE // Friday 3:36 PM

  test('one day is the time', () => {
    expect(cursorWords(t, ZONE, windowFor(spans, 1, 'day'))).toBe('3:36 PM')
  })

  test('a wider window puts the weekday before it', () => {
    expect(cursorWords(t, ZONE, windowFor(spans, 0, 'days3'))).toBe(
      'Fri 3:36 PM',
    )
  })
})

const NOW = Date.UTC(2026, 9, 8, 22, 36) // 3:36 PM today

describe('windowMarkers', () => {
  test("one day is the day's markers, names and all", () => {
    const window = windowFor(spans, 0, 'day')
    expect(windowMarkers(days, window, NOW)).toEqual(
      dayMarkers({ astro: days[0], isToday: true }, NOW),
    )
  })

  test("a week has each day's sunset and moonrise without names, and the current time once", () => {
    const window = windowFor(spans, 0, 'week')
    const markers = windowMarkers(days, window, NOW)
    expect(markers.filter((m) => m.name === 'now')).toEqual([
      { name: 'now', t: NOW },
    ])
    expect(markers.filter((m) => m.name === 'sunset').map((m) => m.t)).toEqual(
      days.slice(0, 7).map((d) => d.sunset),
    )
    expect(markers.every((m) => !('label' in m))).toBe(true)
    expect(markers).toEqual(
      days
        .slice(0, 7)
        .flatMap((astro, i) =>
          unlabelled(dayMarkers({ astro, isToday: i === 0 }, NOW)),
        ),
    )
  })

  test('a window that does not start today has no current time', () => {
    const window = windowFor(spans, 2, 'days3')
    expect(windowMarkers(days, window, NOW).some((m) => m.name === 'now')).toBe(
      false,
    )
  })
})

describe('windowBands', () => {
  test('the nights of every day in the window, in order', () => {
    const window = windowFor(spans, 1, 'days3')
    expect(windowBands(days, window)).toEqual(
      days.slice(1, 4).flatMap((astro) => dayBands({ astro })),
    )
  })
})
