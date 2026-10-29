import { describe, expect, test } from 'vitest'
import {
  SPANS,
  cursorWords,
  spanBeside,
  headingWords,
  stackLabels,
  windowBands,
  windowFor,
  windowMarkers,
  zoomWindow,
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

describe('spanBeside', () => {
  test('the next choice to the right, and back to the first past the last', () => {
    expect(spanBeside('day', 1)).toBe('days3')
    expect(spanBeside('days3', 1)).toBe('week')
    expect(spanBeside('week', 1)).toBe('day')
  })
  test('the next choice to the left, and round to the last before the first', () => {
    expect(spanBeside('week', -1)).toBe('days3')
    expect(spanBeside('days3', -1)).toBe('day')
    expect(spanBeside('day', -1)).toBe('week')
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
    expect(stackLabels(window, ZONE)).toEqual([
      { t: window.start, text: '12a' },
      { t: window.start + 6 * HOUR, text: '6a' },
      { t: window.start + 12 * HOUR, text: '12p' },
      { t: window.start + 18 * HOUR, text: '6p' },
      { t: window.end, text: '12a' },
    ])
  })

  test('three days label each day with its weekday and its noon, and not the end', () => {
    const window = windowFor(spans, 0, 'days3')
    expect(stackLabels(window, ZONE)).toEqual([
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
    expect(stackLabels(window, ZONE)).toEqual(
      ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'].map((text, i) => ({
        t: spans[i].start,
        text,
      })),
    )
  })

  test('a week from the last day is one day, with the hour labels', () => {
    const window = windowFor(spans, 13, 'week')
    expect(stackLabels(window, ZONE)).toEqual([
      { t: spans[13].start, text: '12a' },
      { t: spans[13].start + 6 * HOUR, text: '6a' },
      { t: spans[13].start + 12 * HOUR, text: '12p' },
      { t: spans[13].start + 18 * HOUR, text: '6p' },
      { t: spans[13].end, text: '12a' },
    ])
  })

  test('on the day the clocks go back, noon is 13 hours after midnight', () => {
    // 1 November 2026 is 25 hours long at the spot.
    const late = frameFor(CAMPUS_POINT, '2026-10-31')
    const window = windowFor(late.spans, 0, 'days3')
    const labels = stackLabels(window, ZONE)
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

  test('a zoom under a day that crosses midnight puts the weekday before it', () => {
    const w = zoomWindow(spans, {
      start: spans[1].start + 20 * HOUR,
      end: spans[2].start + 4 * HOUR,
    })
    expect(w.end - w.start).toBe(8 * HOUR)
    expect(cursorWords(spans[2].start + HOUR, ZONE, w)).toBe('Sat 1:00 AM')
    expect(cursorWords(spans[1].start + 22 * HOUR, ZONE, w)).toBe(
      'Fri 10:00 PM',
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

  test('a zoom has its nights cut to it, and none that lies outside it', () => {
    const sunset = days[3].sunset!
    const w = zoomWindow(spans, {
      start: sunset - 2 * HOUR,
      end: spans[4].start + 3 * HOUR,
    })
    const bands = windowBands(days, w)
    expect(bands.length).toBeGreaterThan(0)
    for (const band of bands) {
      expect(band.start).toBeGreaterThanOrEqual(w.start)
      expect(band.end).toBeLessThanOrEqual(w.end)
      expect(band.end).toBeGreaterThan(band.start)
    }
    // The morning of the fourth day, before the zoom, is not shaded.
    expect(bands.some((band) => band.end <= spans[3].start + 12 * HOUR)).toBe(
      false,
    )
    // The night runs on to the zoom's end, past midnight.
    expect(bands[bands.length - 1].end).toBe(w.end)
  })
})

describe('windowMarkers inside a zoom', () => {
  test('a zoom of an afternoon keeps only the lines inside it', () => {
    const w = zoomWindow(spans, {
      start: spans[3].start + 12 * HOUR,
      end: spans[3].start + 16 * HOUR,
    })
    const markers = windowMarkers(days, w, NOW)
    for (const marker of markers) {
      expect(marker.t).toBeGreaterThanOrEqual(w.start)
      expect(marker.t).toBeLessThanOrEqual(w.end)
    }
    expect(markers.some((m) => m.name === 'sunset')).toBe(false)
  })

  test('a zoom of today that ends before the current time has no line for it', () => {
    const w = zoomWindow(spans, {
      start: spans[0].start + 6 * HOUR,
      end: spans[0].start + 10 * HOUR,
    })
    expect(w.first).toBe(0)
    expect(windowMarkers(days, w, NOW).some((m) => m.name === 'now')).toBe(
      false,
    )
  })
})

describe('a window of any length', () => {
  test('a zoom of 5 hours has a label every hour, both ends where on the hour', () => {
    const w = zoomWindow(spans, {
      start: spans[3].start + 13 * HOUR,
      end: spans[3].start + 18 * HOUR,
    })
    expect(stackLabels(w, ZONE).map((l) => l.text)).toEqual([
      '1p',
      '2p',
      '3p',
      '4p',
      '5p',
      '6p',
    ])
  })

  test('a zoom that starts off the hour begins at the next whole hour', () => {
    const w = zoomWindow(spans, {
      start: spans[3].start + 13 * HOUR + 20 * MINUTE,
      end: spans[3].start + 18 * HOUR + 20 * MINUTE,
    })
    const labels = stackLabels(w, ZONE)
    expect(labels.map((l) => l.text)).toEqual(['2p', '3p', '4p', '5p', '6p'])
    expect(labels.every((l) => l.t % HOUR === 0)).toBe(true)
  })

  test('a zoom of 10 hours has a label every 3 hours', () => {
    const w = zoomWindow(spans, {
      start: spans[3].start + 8 * HOUR,
      end: spans[3].start + 18 * HOUR,
    })
    expect(stackLabels(w, ZONE).map((l) => l.text)).toEqual([
      '9a',
      '12p',
      '3p',
      '6p',
    ])
  })

  test('a zoom across midnight names the midnight by its weekday and leaves the end unlabelled', () => {
    const w = zoomWindow(spans, {
      start: spans[3].start + 18 * HOUR,
      end: spans[4].start + 6 * HOUR,
    })
    expect([w.first, w.last]).toEqual([3, 4])
    expect(stackLabels(w, ZONE).map((l) => l.text)).toEqual([
      '6p',
      '9p',
      'Mon',
      '3a',
    ])
  })

  test('zoomWindow: a zoom ending at midnight ends on the day before', () => {
    const w = zoomWindow(spans, {
      start: spans[3].start + 12 * HOUR,
      end: spans[4].start,
    })
    expect([w.first, w.last]).toEqual([3, 3])
  })

  test('a zoom across midnight under a day keeps the marker names', () => {
    const w = zoomWindow(spans, {
      start: spans[3].start + 12 * HOUR,
      end: spans[4].start + 6 * HOUR,
    })
    expect(windowMarkers(days, w, NOW).some((m) => m.label !== undefined)).toBe(
      true,
    )
  })

  test('a zoom of two days drops the marker names', () => {
    const w = zoomWindow(spans, { start: spans[3].start, end: spans[5].start })
    expect(
      windowMarkers(days, w, NOW).every((m) => m.label === undefined),
    ).toBe(true)
  })

  test('the Day window of the 25-hour day has the usual labels and keeps its names', () => {
    const late = frameFor(CAMPUS_POINT, '2026-10-31')
    const w = windowFor(late.spans, 1, 'day')
    expect(w.end - w.start).toBe(25 * HOUR)
    expect(stackLabels(w, ZONE).map((l) => l.text)).toEqual([
      '12a',
      '6a',
      '12p',
      '6p',
      '12a',
    ])
    const sunset = windowMarkers(late.days, w, NOW).find(
      (m) => m.name === 'sunset',
    )
    expect(sunset?.label).toBe('Sunset')
  })
})
