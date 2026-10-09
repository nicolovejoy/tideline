import { describe, expect, test } from 'vitest'
import { tideCaption } from './captions.ts'
import type { Loaded } from '../data/load.ts'
import type { TidePoint } from '../data/noaa.ts'
import { CAMPUS_POINT } from '../spot.ts'

const TODAY = '2026-10-08'
const STATION = 'Tide: NOAA 9411340 Santa Barbara, 8.6 mi east.'
// 2:00 PM and 2:06 PM Pacific on 8 October 2026.
const EARLIER = { t: Date.UTC(2026, 9, 8, 21, 0), ft: 2.4 }
const READING = { t: Date.UTC(2026, 9, 8, 21, 6), ft: 2.3 }
// 2:05 PM that day, and 1:33 AM three days before.
const FETCHED = Date.UTC(2026, 9, 8, 21, 5)
const DAYS_AGO = Date.UTC(2026, 9, 5, 8, 33)

function loaded(
  status: Loaded<TidePoint[]>['status'],
  data: TidePoint[] | null = [EARLIER, READING],
  fetchedAt: number = FETCHED,
): Loaded<TidePoint[]> {
  return { data, fetchedAt: data ? fetchedAt : null, span: null, status }
}

function caption(
  predictions: Loaded<TidePoint[]>,
  observed: Loaded<TidePoint[]>,
  observedToday: TidePoint[],
): string {
  return tideCaption(CAMPUS_POINT, predictions, observed, observedToday, TODAY)
}

describe('tideCaption', () => {
  test('names the station and gives the time of the last reading', () => {
    expect(caption(loaded('ready'), loaded('ready'), [EARLIER, READING])).toBe(
      `${STATION} Observed through 2:06 PM, preliminary.`,
    )
  })

  test('says so when the readings could not be refreshed', () => {
    expect(caption(loaded('ready'), loaded('stale'), [READING])).toBe(
      `${STATION} Observed through 2:06 PM, preliminary. Couldn't refresh the observed level.`,
    )
  })

  test('says so when there are no readings to show at all', () => {
    expect(caption(loaded('ready'), loaded('unavailable', null), [])).toBe(
      `${STATION} Observed level unavailable.`,
    )
  })

  test('says so when the day has no readings yet', () => {
    expect(caption(loaded('ready'), loaded('ready', []), [])).toBe(
      `${STATION} No observed readings yet today.`,
    )
  })

  test('says nothing about readings while the first request is on its way', () => {
    expect(caption(loaded('ready'), loaded('loading', null), [])).toBe(STATION)
  })

  test('says when the predictions on screen are old ones', () => {
    expect(caption(loaded('stale'), loaded('ready'), [READING])).toBe(
      `${STATION} Couldn't refresh. Showing predictions from 2:05 PM. Observed through 2:06 PM, preliminary.`,
    )
  })

  test('names the day when the old predictions are not from today', () => {
    const old = loaded('stale', [READING], DAYS_AGO)
    expect(caption(old, loaded('unavailable', null), [])).toBe(
      `${STATION} Couldn't refresh. Showing predictions from Mon Oct 5, 1:33 AM. Observed level unavailable.`,
    )
  })
})
