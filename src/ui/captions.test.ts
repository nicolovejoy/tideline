import { describe, expect, test } from 'vitest'
import { tideCaption, weatherCaption } from './captions.ts'
import type { Loaded } from '../data/load.ts'
import type { TideExtreme, TidePoint } from '../data/noaa.ts'
import type { Forecast } from '../data/nws.ts'
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

const HILO: Loaded<TideExtreme[]> = {
  data: [{ t: FETCHED, ft: 0.8, type: 'L' }],
  fetchedAt: FETCHED,
  span: null,
  status: 'ready',
}

function caption(
  predictions: Loaded<TidePoint[]>,
  observed: Loaded<TidePoint[]>,
  readings: TidePoint[],
  rest: { hilo?: Loaded<TideExtreme[]>; isToday?: boolean } = {},
): string {
  return tideCaption(CAMPUS_POINT, {
    predictions,
    hilo: HILO,
    observed,
    readings,
    today: TODAY,
    isToday: true,
    ...rest,
  })
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

  test('says so when there are no highs and lows to show', () => {
    const hilo: Loaded<TideExtreme[]> = {
      data: null,
      fetchedAt: null,
      span: null,
      status: 'unavailable',
    }
    expect(caption(loaded('ready'), loaded('ready'), [READING], { hilo })).toBe(
      `${STATION} High and low times unavailable. Observed through 2:06 PM, preliminary.`,
    )
  })

  test('says so when the highs and lows could not be refreshed', () => {
    const hilo: Loaded<TideExtreme[]> = { ...HILO, status: 'stale' }
    expect(caption(loaded('ready'), loaded('ready'), [READING], { hilo })).toBe(
      `${STATION} Couldn't refresh the high and low times. Showing those from 2:05 PM. Observed through 2:06 PM, preliminary.`,
    )
  })

  test('says nothing about readings on a day other than today', () => {
    const other = { isToday: false }
    expect(caption(loaded('ready'), loaded('ready'), [], other)).toBe(STATION)
    expect(caption(loaded('ready'), loaded('stale'), [], other)).toBe(STATION)
    expect(
      caption(loaded('ready'), loaded('unavailable', null), [], other),
    ).toBe(STATION)
  })

  test('still says the highs and lows are missing on a day other than today', () => {
    const hilo: Loaded<TideExtreme[]> = {
      data: null,
      fetchedAt: null,
      span: null,
      status: 'unavailable',
    }
    expect(
      caption(loaded('ready'), loaded('ready'), [], { hilo, isToday: false }),
    ).toBe(`${STATION} High and low times unavailable.`)
  })

  test('names the day when the saved highs and lows are not from today', () => {
    const hilo: Loaded<TideExtreme[]> = {
      ...HILO,
      fetchedAt: DAYS_AGO,
      status: 'stale',
    }
    expect(
      caption(loaded('ready'), loaded('ready'), [], { hilo, isToday: false }),
    ).toBe(
      `${STATION} Couldn't refresh the high and low times. Showing those from Mon Oct 5, 1:33 AM.`,
    )
  })

  test('still says the predictions are old ones on a day other than today', () => {
    expect(
      caption(loaded('stale'), loaded('ready'), [], { isToday: false }),
    ).toBe(`${STATION} Couldn't refresh. Showing predictions from 2:05 PM.`)
  })
})

describe('weatherCaption', () => {
  const SOURCE = 'Weather: NWS forecast for the 2.5 km cell at this spot'
  // Updated by NWS at 7:26 AM Pacific on 8 October 2026.
  const UPDATED = Date.UTC(2026, 9, 8, 14, 26)

  function forecast(
    status: Loaded<Forecast>['status'],
    updatedAt: number | null = UPDATED,
    fetchedAt: number = FETCHED,
  ): Loaded<Forecast> {
    const data = updatedAt === null ? null : { updatedAt, hours: [] }
    return { data, fetchedAt: data ? fetchedAt : null, span: null, status }
  }

  test('names the source and says when NWS last updated it', () => {
    expect(weatherCaption(CAMPUS_POINT, forecast('ready'), TODAY)).toBe(
      `${SOURCE}, updated 7:26 AM.`,
    )
  })

  test('names the day when the update was not today', () => {
    const old = forecast('ready', DAYS_AGO)
    expect(weatherCaption(CAMPUS_POINT, old, TODAY)).toBe(
      `${SOURCE}, updated Mon Oct 5, 1:33 AM.`,
    )
  })

  test('says when the forecast on screen is a saved one that could not be refreshed', () => {
    expect(weatherCaption(CAMPUS_POINT, forecast('stale'), TODAY)).toBe(
      `${SOURCE}, updated 7:26 AM. Couldn't refresh. Showing the forecast from 2:05 PM.`,
    )
  })

  test('names the day when the saved forecast is not from today', () => {
    const old = forecast('stale', UPDATED, DAYS_AGO)
    expect(weatherCaption(CAMPUS_POINT, old, TODAY)).toBe(
      `${SOURCE}, updated 7:26 AM. Couldn't refresh. Showing the forecast from Mon Oct 5, 1:33 AM.`,
    )
  })

  test('with no forecast at all it only names the source', () => {
    for (const status of ['loading', 'unavailable'] as const) {
      expect(weatherCaption(CAMPUS_POINT, forecast(status, null), TODAY)).toBe(
        `${SOURCE}.`,
      )
    }
  })
})
