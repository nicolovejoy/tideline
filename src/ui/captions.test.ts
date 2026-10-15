import { describe, expect, test } from 'vitest'
import {
  monthCaption,
  noTidesWords,
  observedCaption,
  spotSubtitle,
  sunCaption,
  tideCaption,
  weatherCaption,
  weatherStationName,
} from './captions.ts'
import type { Loaded } from '../data/load.ts'
import type { ObservedDay } from '../data/observed.ts'
import type { NearStation, StationChoice } from '../data/weatherRule.ts'
import type { TideExtreme, TidePoint } from '../data/noaa.ts'
import type { Forecast } from '../data/nws.ts'
import { CAMPUS_POINT, spotById } from '../spot.ts'

const TODAY = '2026-10-08'
// The 8 October day at the spot, in Pacific time.
const DAY = { start: Date.UTC(2026, 9, 8, 7), end: Date.UTC(2026, 9, 9, 7) }
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

describe('tideCaption at a spot whose gauge is another station', () => {
  const GAVIOTA = spotById('gaviota')
  const THEIRS =
    'Tide: NOAA 9411399 Gaviota State Park, 0.2 mi south, predictions only.'
  const GAUGE = 'Gauge: NOAA 9411340 Santa Barbara, 31 mi east'

  function theirs(
    predictions: Loaded<TidePoint[]>,
    observed: Loaded<TidePoint[]>,
    readings: TidePoint[],
    rest: { hilo?: Loaded<TideExtreme[]>; isToday?: boolean } = {},
  ): string {
    return tideCaption(GAVIOTA, {
      predictions,
      hilo: HILO,
      observed,
      readings,
      today: TODAY,
      isToday: true,
      ...rest,
    })
  }

  test('names both stations, and the gauge gives the time of its last reading', () => {
    expect(theirs(loaded('ready'), loaded('ready'), [EARLIER, READING])).toBe(
      `${THEIRS} ${GAUGE}, observed through 2:06 PM, preliminary.`,
    )
  })

  test('with no reading yet, the gauge is named and then the reason', () => {
    expect(theirs(loaded('ready'), loaded('ready', []), [])).toBe(
      `${THEIRS} ${GAUGE}. No observed readings yet today.`,
    )
    expect(theirs(loaded('ready'), loaded('unavailable', null), [])).toBe(
      `${THEIRS} ${GAUGE}. Observed level unavailable.`,
    )
    expect(theirs(loaded('ready'), loaded('loading', null), [])).toBe(
      `${THEIRS} ${GAUGE}.`,
    )
  })

  test("a refresh that failed keeps the gauge's last reading and says so", () => {
    expect(theirs(loaded('ready'), loaded('stale'), [READING])).toBe(
      `${THEIRS} ${GAUGE}, observed through 2:06 PM, preliminary. Couldn't refresh the observed level.`,
    )
  })

  test('old predictions are reported before the gauge', () => {
    expect(theirs(loaded('stale'), loaded('ready'), [READING])).toBe(
      `${THEIRS} Couldn't refresh. Showing predictions from 2:05 PM. ${GAUGE}, observed through 2:06 PM, preliminary.`,
    )
  })

  test('on another day the gauge is not mentioned', () => {
    expect(
      theirs(loaded('ready'), loaded('ready'), [], { isToday: false }),
    ).toBe(THEIRS)
  })
})

describe('weatherCaption', () => {
  const SOURCE =
    'Weather: NWS forecast for the 2.5 km cell at this spot, 3 ft above sea level'
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
      `${SOURCE}. Updated 7:26 AM.`,
    )
  })

  test('names the day when the update was not today', () => {
    const old = forecast('ready', DAYS_AGO)
    expect(weatherCaption(CAMPUS_POINT, old, TODAY)).toBe(
      `${SOURCE}. Updated Mon Oct 5, 1:33 AM.`,
    )
  })

  test('says when the forecast on screen is a saved one that could not be refreshed', () => {
    expect(weatherCaption(CAMPUS_POINT, forecast('stale'), TODAY)).toBe(
      `${SOURCE}. Updated 7:26 AM. Couldn't refresh. Showing the forecast from 2:05 PM.`,
    )
  })

  test('names the day when the saved forecast is not from today', () => {
    const old = forecast('stale', UPDATED, DAYS_AGO)
    expect(weatherCaption(CAMPUS_POINT, old, TODAY)).toBe(
      `${SOURCE}. Updated 7:26 AM. Couldn't refresh. Showing the forecast from Mon Oct 5, 1:33 AM.`,
    )
  })

  test('with no forecast at all it only names the source', () => {
    for (const status of ['loading', 'unavailable'] as const) {
      expect(weatherCaption(CAMPUS_POINT, forecast(status, null), TODAY)).toBe(
        `${SOURCE}.`,
      )
    }
  })

  test("gives the cell's average and the spot's own height where the two differ", () => {
    const laCumbre = spotById('la-cumbre-peak')
    expect(weatherCaption(laCumbre, forecast('ready'), TODAY)).toBe(
      'Weather: NWS forecast for the 2.5 km cell at this spot, which averages 3,258 ft above sea level; the spot itself is at 3,997 ft. Updated 7:26 AM.',
    )
    expect(weatherCaption(laCumbre, forecast('loading', null), TODAY)).toBe(
      'Weather: NWS forecast for the 2.5 km cell at this spot, which averages 3,258 ft above sea level; the spot itself is at 3,997 ft.',
    )
  })

  // Every added spot has a height of its own now, from USGS. It is said
  // only where it is far enough from the cell's to change the reading.
  test("a beach under hills gives both; a spot as high as its cell gives the cell's alone", () => {
    const elCapitan = {
      ...CAMPUS_POINT,
      elevationFt: 21,
      nws: { office: 'LOX', gridX: 95, gridY: 75, elevationFt: 640 },
    }
    expect(weatherCaption(elCapitan, forecast('loading', null), TODAY)).toBe(
      'Weather: NWS forecast for the 2.5 km cell at this spot, which averages 640 ft above sea level; the spot itself is at 21 ft.',
    )
    const flat = { ...CAMPUS_POINT, elevationFt: 12 }
    expect(weatherCaption(flat, forecast('loading', null), TODAY)).toBe(
      `${SOURCE}.`,
    )
    const nearly = { ...elCapitan, elevationFt: 541 }
    expect(weatherCaption(nearly, forecast('loading', null), TODAY)).toBe(
      'Weather: NWS forecast for the 2.5 km cell at this spot, 640 ft above sea level.',
    )
    const just = { ...elCapitan, elevationFt: 540 }
    expect(weatherCaption(just, forecast('loading', null), TODAY)).toBe(
      'Weather: NWS forecast for the 2.5 km cell at this spot, which averages 640 ft above sea level; the spot itself is at 540 ft.',
    )
  })

  test('a cell at sea level says 0 ft', () => {
    const gaviota = spotById('gaviota')
    expect(weatherCaption(gaviota, forecast('ready'), TODAY)).toBe(
      'Weather: NWS forecast for the 2.5 km cell at this spot, 0 ft above sea level. Updated 7:26 AM.',
    )
  })
})

describe('noTidesWords', () => {
  const laCumbre = spotById('la-cumbre-peak')
  const lake = {
    ...CAMPUS_POINT,
    tideStation: { ...CAMPUS_POINT.tideStation, distanceMi: 636 },
  }

  test('nothing where the spot has a tide', () => {
    expect(noTidesWords(CAMPUS_POINT)).toBeNull()
    expect(noTidesWords(spotById('gaviota'))).toBeNull()
  })

  test("the spot's own height, where it is high", () => {
    expect(noTidesWords(laCumbre)).toBe(
      'Tides are not shown here: the spot is 3,997 ft above sea level.',
    )
  })

  test("the cell's average, where the spot's own height is not known", () => {
    expect(noTidesWords({ ...laCumbre, elevationFt: null })).toBe(
      'Tides are not shown here: the forecast cell averages 3,258 ft above sea level.',
    )
  })

  test('the distance, where the station is far', () => {
    expect(noTidesWords(lake)).toBe(
      'Tides are not shown here: the nearest station, NOAA 9411340 Santa Barbara, is 636 mi away.',
    )
  })

  test('both: the distance comes first, as the plainer fact', () => {
    expect(noTidesWords({ ...lake, elevationFt: 3997 })).toBe(
      'Tides are not shown here: the nearest station, NOAA 9411340 Santa Barbara, is 636 mi away.',
    )
  })
})

describe('monthCaption', () => {
  test('names the station and nothing else when the highs and lows are current', () => {
    expect(monthCaption(CAMPUS_POINT, HILO, TODAY)).toBe(STATION)
  })

  test('names the station alone while the first request is on its way', () => {
    const hilo: Loaded<TideExtreme[]> = {
      data: null,
      fetchedAt: null,
      span: null,
      status: 'loading',
    }
    expect(monthCaption(CAMPUS_POINT, hilo, TODAY)).toBe(STATION)
  })

  test('says so when there are no highs and lows to show', () => {
    const hilo: Loaded<TideExtreme[]> = {
      data: null,
      fetchedAt: null,
      span: null,
      status: 'unavailable',
    }
    expect(monthCaption(CAMPUS_POINT, hilo, TODAY)).toBe(
      `${STATION} High and low times unavailable.`,
    )
  })

  test('says when the highs and lows on screen are old ones', () => {
    const hilo: Loaded<TideExtreme[]> = { ...HILO, status: 'stale' }
    expect(monthCaption(CAMPUS_POINT, hilo, TODAY)).toBe(
      `${STATION} Couldn't refresh the high and low times. Showing those from 2:05 PM.`,
    )
    const old: Loaded<TideExtreme[]> = {
      ...HILO,
      fetchedAt: DAYS_AGO,
      status: 'stale',
    }
    expect(monthCaption(CAMPUS_POINT, old, TODAY)).toBe(
      `${STATION} Couldn't refresh the high and low times. Showing those from Mon Oct 5, 1:33 AM.`,
    )
  })

  test('at a spot with a gauge elsewhere, the station sentence has no "predictions only"', () => {
    expect(monthCaption(spotById('gaviota'), HILO, TODAY)).toBe(
      'Tide: NOAA 9411399 Gaviota State Park, 0.2 mi south.',
    )
  })
})

describe('tideCaption at a spot whose station publishes highs and lows only', () => {
  const gaviota = spotById('gaviota')
  const VENTURA = {
    ...gaviota,
    id: 'ventura-test',
    tideStation: {
      id: '9411189',
      name: 'Ventura',
      distanceMi: 33,
      direction: 'east',
      type: 'subordinate' as const,
    },
  }
  const THEIRS =
    "Tide: NOAA 9411189 Ventura, 33 mi east, highs and lows only. Curve interpolated between them, not NOAA's."
  const GAUGE = 'Gauge: NOAA 9411340 Santa Barbara, 31 mi east'

  function ventura(
    predictions: Loaded<TidePoint[]>,
    observed: Loaded<TidePoint[]>,
    readings: TidePoint[],
    rest: { hilo?: Loaded<TideExtreme[]>; isToday?: boolean } = {},
  ): string {
    return tideCaption(VENTURA, {
      predictions,
      hilo: HILO,
      observed,
      readings,
      today: TODAY,
      isToday: true,
      ...rest,
    })
  }

  test('says the curve is interpolated, then names the gauge as at any spot without one', () => {
    expect(ventura(loaded('ready'), loaded('ready'), [EARLIER, READING])).toBe(
      `${THEIRS} ${GAUGE}, observed through 2:06 PM, preliminary.`,
    )
  })

  test('a failed refresh is reported once, by the highs and lows, not by the curve too', () => {
    const stale: Loaded<TideExtreme[]> = {
      data: [],
      fetchedAt: DAYS_AGO,
      span: null,
      status: 'stale',
    }
    // The derived curve carries the same stale status and stamp.
    const curve: Loaded<TidePoint[]> = {
      data: [],
      fetchedAt: DAYS_AGO,
      span: null,
      status: 'stale',
    }
    expect(ventura(curve, loaded('ready'), [READING], { hilo: stale })).toBe(
      `${THEIRS} Couldn't refresh the high and low times. Showing those from Mon Oct 5, 1:33 AM. ${GAUGE}, observed through 2:06 PM, preliminary.`,
    )
  })

  test('with nothing saved, the highs and lows are unavailable and so is the curve', () => {
    const none: Loaded<TideExtreme[]> = {
      data: null,
      fetchedAt: null,
      span: null,
      status: 'unavailable',
    }
    expect(
      ventura(loaded('unavailable', null), loaded('ready'), [READING], {
        hilo: none,
      }),
    ).toBe(
      `${THEIRS} High and low times unavailable. ${GAUGE}, observed through 2:06 PM, preliminary.`,
    )
  })
})

describe('sunCaption', () => {
  const laCumbre = spotById('la-cumbre-peak')

  test("says the height where the spot's own height is counted", () => {
    expect(sunCaption(laCumbre)).toBe(
      'Sun and moon: times as seen from 3,997 ft, over a sea-level horizon. Hills in the way are not counted.',
    )
  })

  test('a height in whole feet', () => {
    expect(sunCaption({ ...laCumbre, elevationFt: 583.4 })).toBe(
      'Sun and moon: times as seen from 583 ft, over a sea-level horizon. Hills in the way are not counted.',
    )
  })

  test('nothing where the times are for a level horizon', () => {
    expect(sunCaption(CAMPUS_POINT)).toBeNull()
    expect(sunCaption(spotById('gaviota'))).toBeNull()
    expect(sunCaption({ ...laCumbre, elevationFt: null })).toBeNull()
    expect(sunCaption({ ...laCumbre, elevationFt: 99 })).toBeNull()
    expect(
      sunCaption({
        ...laCumbre,
        tideStation: { ...laCumbre.tideStation, distanceMi: 636 },
      }),
    ).toBeNull()
  })
})

describe('weatherStationName', () => {
  test('an all-caps name is put in title case; a mixed one is left alone', () => {
    expect(weatherStationName('LOS PRIETOS')).toBe('Los Prietos')
    expect(weatherStationName('MONTECITO #2')).toBe('Montecito #2')
    expect(
      weatherStationName('Santa Barbara, Santa Barbara Municipal Airport'),
    ).toBe('Santa Barbara, Santa Barbara Municipal Airport')
    expect(weatherStationName('KSBA')).toBe('KSBA')
  })
})

describe('observedCaption', () => {
  const KSBA: NearStation = {
    id: 'KSBA',
    name: 'Santa Barbara, Santa Barbara Municipal Airport',
    lat: 34.42611,
    lon: -119.84361,
    elevationFt: 10,
    distanceMi: 1.5,
    direction: 'north',
  }
  const KIZA: NearStation = {
    ...KSBA,
    id: 'KIZA',
    name: 'Santa Ynez, Santa Ynez Airport',
    elevationFt: 673,
    distanceMi: 12.8,
    direction: 'northwest',
  }
  const LPOC1: NearStation = {
    ...KSBA,
    id: 'LPOC1',
    name: 'LOS PRIETOS',
    elevationFt: 982,
    distanceMi: 5.6,
    direction: 'northwest',
  }
  const NAMED =
    'Observed: NWS KSBA Santa Barbara, Santa Barbara Municipal Airport, 1.5 mi north, at 10 ft'

  function station(
    data: StationChoice | null,
    status: Loaded<StationChoice>['status'] = 'ready',
  ): Loaded<StationChoice> {
    return { data, fetchedAt: data ? FETCHED : null, span: null, status }
  }
  function day(
    data: ObservedDay | null,
    status: Loaded<ObservedDay>['status'] = 'ready',
    span: Loaded<ObservedDay>['span'] = DAY,
  ): Loaded<ObservedDay> {
    return { data, fetchedAt: data ? FETCHED : null, span, status }
  }
  const serves = station({ serves: KSBA, nearest: KSBA })
  const hour = {
    t: Date.UTC(2026, 9, 8, 21),
    tempF: 64,
    windMph: 9,
    gustMph: null,
    windDeg: 270,
    sky: 'clear' as const,
  }
  const reported: ObservedDay = {
    stationId: 'KSBA',
    through: READING.t,
    hours: [hour],
  }

  test('names the station, its distance, its height and the latest report', () => {
    expect(
      observedCaption(CAMPUS_POINT, serves, day(reported), DAY, true),
    ).toBe(
      `${NAMED}, through 2:06 PM. Sky is the cloud layer that covers most. Rain chance is forecast.`,
    )
  })

  test('a station that reports no sky says so', () => {
    const noSky = { ...reported, hours: [{ ...hour, sky: null }] }
    expect(observedCaption(CAMPUS_POINT, serves, day(noSky), DAY, true)).toBe(
      `${NAMED}, through 2:06 PM. It reports no sky, so sky is forecast. Rain chance is forecast.`,
    )
  })

  test('before the first report of the day', () => {
    const none = { stationId: 'KSBA', through: null, hours: [] }
    expect(observedCaption(CAMPUS_POINT, serves, day(none), DAY, true)).toBe(
      `${NAMED}. No reports yet today.`,
    )
  })

  test('what went wrong with the reports, if anything', () => {
    expect(
      observedCaption(CAMPUS_POINT, serves, day(reported, 'stale'), DAY, true),
    ).toBe(
      `${NAMED}, through 2:06 PM. Sky is the cloud layer that covers most. Rain chance is forecast. Couldn't refresh the reports.`,
    )
    expect(
      observedCaption(
        CAMPUS_POINT,
        serves,
        day(null, 'unavailable'),
        DAY,
        true,
      ),
    ).toBe(`${NAMED}. Reports unavailable.`)
    expect(
      observedCaption(CAMPUS_POINT, serves, day(null, 'loading'), DAY, true),
    ).toBe(`${NAMED}. Loading reports.`)
  })

  test('rows saved from another station are not counted', () => {
    const theirs = { ...reported, stationId: 'KIZA' }
    expect(observedCaption(CAMPUS_POINT, serves, day(theirs), DAY, true)).toBe(
      `${NAMED}. Loading reports.`,
    )
  })

  test('rows saved from another station, with nothing coming, are unavailable', () => {
    const theirs = { ...reported, stationId: 'KIZA' }
    expect(
      observedCaption(CAMPUS_POINT, serves, day(theirs, 'stale'), DAY, true),
    ).toBe(`${NAMED}. Reports unavailable.`)
  })

  test("rows saved for yesterday's day are not counted", () => {
    const yesterday = {
      start: DAY.start - 24 * 3600000,
      end: DAY.end - 24 * 3600000,
    }
    expect(
      observedCaption(
        CAMPUS_POINT,
        serves,
        day(reported, 'ready', yesterday),
        DAY,
        true,
      ),
    ).toBe(`${NAMED}. Loading reports.`)
    expect(
      observedCaption(
        CAMPUS_POINT,
        serves,
        day(reported, 'stale', yesterday),
        DAY,
        true,
      ),
    ).toBe(`${NAMED}. Reports unavailable.`)
  })

  test('a nearest station 10.3 mi away is too far, though its height is near', () => {
    const test1 = {
      ...KSBA,
      id: 'TEST1',
      name: 'Test',
      elevationFt: 15,
      distanceMi: 10.3,
    }
    const spot = { ...CAMPUS_POINT, elevationFt: 20 }
    expect(
      observedCaption(
        spot,
        station({ serves: null, nearest: test1 }),
        day(null, 'loading'),
        DAY,
        true,
      ),
    ).toBe(
      'Today is forecast only: the nearest weather station, TEST1 Test, is 10.3 mi away.',
    )
  })

  test('a spot with no station near says why: too far, or too high or low', () => {
    const far = station({ serves: null, nearest: KIZA })
    expect(
      observedCaption(
        spotById('gaviota'),
        far,
        day(null, 'loading'),
        DAY,
        true,
      ),
    ).toBe(
      'Today is forecast only: the nearest weather station, KIZA Santa Ynez, Santa Ynez Airport, is 12.8 mi away.',
    )
    const low = station({ serves: null, nearest: LPOC1 })
    expect(
      observedCaption(
        spotById('la-cumbre-peak'),
        low,
        day(null, 'loading'),
        DAY,
        true,
      ),
    ).toBe(
      'Today is forecast only: the nearest weather station, LPOC1 Los Prietos, is at 982 ft and this spot at 3,997 ft.',
    )
  })

  test('a cell with no stations at all, and a lookup that failed', () => {
    expect(
      observedCaption(
        CAMPUS_POINT,
        station({ serves: null, nearest: null }),
        day(null, 'loading'),
        DAY,
        true,
      ),
    ).toBe(
      'Today is forecast only: NWS lists no weather station for this forecast cell.',
    )
    expect(
      observedCaption(
        CAMPUS_POINT,
        station(null, 'unavailable'),
        day(null, 'loading'),
        DAY,
        true,
      ),
    ).toBe(
      "Today is forecast only: couldn't look up the weather stations near this spot.",
    )
  })

  test('nothing while the station is still being looked up, and nothing on any other day', () => {
    expect(
      observedCaption(
        CAMPUS_POINT,
        station(null, 'loading'),
        day(null, 'loading'),
        DAY,
        true,
      ),
    ).toBeNull()
    expect(
      observedCaption(CAMPUS_POINT, serves, day(reported), DAY, false),
    ).toBeNull()
  })
})

describe('spotSubtitle', () => {
  test('names the tide at a spot that has one', () => {
    expect(spotSubtitle(CAMPUS_POINT)).toBe(
      'Sunset, tide and moon at Campus Point',
    )
  })

  test('leaves the tide out where the spot has none', () => {
    expect(spotSubtitle(spotById('la-cumbre-peak'))).toBe(
      'Sunset and moon at La Cumbre Peak',
    )
  })
})
