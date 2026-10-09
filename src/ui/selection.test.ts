import { describe, expect, test } from 'vitest'
import { dayMarkers, onDay, selectedDay } from './selection.ts'
import { frameFor } from '../data/useSpotData.ts'
import { CAMPUS_POINT } from '../spot.ts'
import { HOUR } from '../time.ts'

const frame = frameFor(CAMPUS_POINT, '2026-10-08')
const NOW = Date.UTC(2026, 9, 8, 22, 36) // 3:36 PM

describe('selectedDay', () => {
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
      { name: 'sunset', t: today.astro.sunset },
      { name: 'moonrise', t: today.astro.moonrise },
    ])
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
