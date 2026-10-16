import { describe, expect, test } from 'vitest'
import {
  dayBands,
  dayMarkers,
  onDay,
  selectedDay,
  unlabelled,
} from './selection.ts'
import { frameFor } from '../data/useSpotData.ts'
import { CAMPUS_POINT } from '../spot.ts'
import { HOUR, MINUTE, localDayStart } from '../time.ts'

const frame = frameFor(CAMPUS_POINT, '2026-10-08')
const NOW = Date.UTC(2026, 9, 8, 22, 36) // 3:36 PM

describe('selectedDay', () => {
  test('without a choice the window is the day', () => {
    const selected = selectedDay(frame, '2026-10-11')
    expect(selected.window).toEqual({ ...frame.spans[3], first: 3, last: 3 })
  })

  test('a week from the chosen day is its window; the day itself is unchanged', () => {
    const selected = selectedDay(frame, '2026-10-11', 'week')
    expect(selected.window).toEqual({
      start: frame.spans[3].start,
      end: frame.spans[9].end,
      first: 3,
      last: 9,
    })
    expect(selected.span).toEqual(frame.spans[3])
    expect(selected.anchor).toBe(frame.days[3].sunset)
  })

  test('with no row tapped, the day on screen is today', () => {
    const selected = selectedDay(frame, null)
    expect(selected.index).toBe(0)
    expect(selected.date).toBe('2026-10-08')
    expect(selected.isToday).toBe(true)
    expect(selected.span).toEqual(frame.day)
    expect(selected.astro).toBe(frame.days[0])
  })

  test('a tapped row puts its own day on screen, with its own span and sun and moon', () => {
    const selected = selectedDay(frame, '2026-10-11')
    expect(selected.index).toBe(3)
    expect(selected.isToday).toBe(false)
    expect(selected.span).toEqual({
      start: Date.UTC(2026, 9, 11, 7),
      end: Date.UTC(2026, 9, 12, 7),
    })
    expect(selected.astro.date).toBe('2026-10-11')
  })

  test('a day that has dropped out of the 14, as yesterday does at midnight, means today', () => {
    const next = frameFor(CAMPUS_POINT, '2026-10-09')
    const selected = selectedDay(next, '2026-10-08')
    expect(selected.date).toBe('2026-10-09')
    expect(selected.isToday).toBe(true)
  })

  test('a day still among the 14 stays on screen when the date changes', () => {
    const next = frameFor(CAMPUS_POINT, '2026-10-09')
    const selected = selectedDay(next, '2026-10-11')
    expect(selected.date).toBe('2026-10-11')
    expect(selected.index).toBe(2)
  })

  test('the day is about its sunset', () => {
    const selected = selectedDay(frame, '2026-10-11')
    expect(selected.anchor).toBe(selected.astro.sunset)
  })

  test('where the sun does not set, the day is about its middle', () => {
    const polar = {
      days: [{ ...frame.days[0], sunset: null }],
      spans: [frame.spans[0]],
    }
    const { start, end } = frame.spans[0]
    expect(selectedDay(polar, null).anchor).toBe((start + end) / 2)
  })
})

describe('dayMarkers', () => {
  test('today has the current time, sunset and moonrise', () => {
    const today = selectedDay(frame, null)
    expect(dayMarkers(today, NOW)).toEqual([
      { name: 'now', t: NOW },
      { name: 'sunset', t: today.astro.sunset, label: 'Sunset' },
      { name: 'moonrise', t: today.astro.moonrise, label: 'Moonrise' },
    ])
  })

  test('the sunset and moonrise lines carry their names; the current time does not', () => {
    const labels = dayMarkers(selectedDay(frame, null), NOW).map(
      (marker) => marker.label,
    )
    expect(labels).toEqual([undefined, 'Sunset', 'Moonrise'])
  })

  test('another day has no line for the current time', () => {
    const names = dayMarkers(selectedDay(frame, '2026-10-11'), NOW).map(
      (marker) => marker.name,
    )
    expect(names).toEqual(['sunset', 'moonrise'])
  })

  test('a day with no moonrise has no moonrise line', () => {
    // 2 November 2026 has no moonrise at this spot.
    const november = frameFor(CAMPUS_POINT, '2026-10-31')
    const names = dayMarkers(selectedDay(november, '2026-11-02'), NOW).map(
      (marker) => marker.name,
    )
    expect(names).toEqual(['sunset'])
  })
})

describe('unlabelled', () => {
  test('keeps the lines and drops their names', () => {
    const today = selectedDay(frame, null)
    const bare = unlabelled(dayMarkers(today, NOW))
    expect(bare).toEqual([
      { name: 'now', t: NOW },
      { name: 'sunset', t: today.astro.sunset },
      { name: 'moonrise', t: today.astro.moonrise },
    ])
    expect(bare.every((marker) => !('label' in marker))).toBe(true)
  })
})

describe('onDay', () => {
  test('a high or low at midnight belongs to the day it starts, not to both', () => {
    const { start, end } = frame.spans[0]
    const events = [
      { t: start - 2 * HOUR, ft: 5 },
      { t: start, ft: 0.2 },
      { t: start + 6 * HOUR, ft: 5.4 },
      { t: end, ft: 0.8 },
    ]
    expect(onDay(events, frame.spans[0]).map((event) => event.t)).toEqual([
      start,
      start + 6 * HOUR,
    ])
  })

  test('nothing on the day is an empty list', () => {
    expect(onDay([], frame.spans[0])).toEqual([])
  })
})

describe('dayBands', () => {
  test('a night band before sunrise and one after sunset', () => {
    const today = selectedDay(frame, null)
    const bands = dayBands(today)
    expect(bands).toEqual([
      { name: 'night', start: frame.day.start, end: today.astro.night[0].end },
      { name: 'night', start: today.astro.sunset, end: frame.day.end },
    ])
    expect(bands[0].end).toBe(
      localDayStart('2026-10-08', CAMPUS_POINT.timeZone) +
        6 * HOUR +
        59 * MINUTE,
    )
  })

  test('a day with no night has no band', () => {
    const polar = {
      days: [{ ...frame.days[0], night: [] }],
      spans: [frame.spans[0]],
    }
    expect(dayBands(selectedDay(polar, null))).toEqual([])
  })
})
