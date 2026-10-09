import { describe, expect, test } from 'vitest'
import { dayRows, tonightWords } from './dayList.ts'
import type { DayAstro } from '../data/astro.ts'
import type { Loaded } from '../data/load.ts'
import type { TideExtreme } from '../data/noaa.ts'
import type { Forecast, ForecastHour } from '../data/nws.ts'
import { frameFor } from '../data/useSpotData.ts'
import { CAMPUS_POINT } from '../spot.ts'
import { formatTime } from '../time.ts'

const ZONE = CAMPUS_POINT.timeZone
const HOUR = 3_600_000
// Local 8 October 2026 at the spot, Pacific daylight time.
const START = Date.UTC(2026, 9, 8, 7)
const NOW = START + 15 * HOUR

function ready<T>(data: T): Loaded<T> {
  return { data, fetchedAt: NOW, span: null, status: 'ready' }
}
function none<T>(): Loaded<T> {
  return { data: null, fetchedAt: null, span: null, status: 'loading' }
}

describe('tonightWords', () => {
  const day: DayAstro = {
    date: '2026-10-08',
    sunset: Date.UTC(2026, 9, 9, 1, 34), // 6:34 PM
    moonrise: Date.UTC(2026, 9, 8, 12, 0), // 5:00 AM
    illumination: 0.0349,
    phase: 'Waning Crescent',
    moonriseNearSunset: null,
  }

  const morning = Date.UTC(2026, 9, 8, 11, 0) // 4:00 AM, before the moonrise
  const evening = Date.UTC(2026, 9, 9, 1, 0) // 6:00 PM, long after it

  test('sunset, the moon and moonrise', () => {
    expect(tonightWords(day, morning, ZONE)).toEqual({
      sunset: '6:34 PM',
      moon: '3% lit, waning crescent',
      moonrise: 'Rises 5:00 AM',
      flag: null,
    })
  })

  test('a moonrise that has passed is in the past tense', () => {
    expect(tonightWords(day, evening, ZONE).moonrise).toBe('Rose 5:00 AM')
  })

  test('the very minute of moonrise still reads as coming', () => {
    expect(tonightWords(day, day.moonrise!, ZONE).moonrise).toBe(
      'Rises 5:00 AM',
    )
  })

  test('a moonrise near sunset is flagged with its time', () => {
    const flagged = { ...day, moonriseNearSunset: Date.UTC(2026, 9, 9, 0, 45) }
    expect(tonightWords(flagged, morning, ZONE).flag).toBe(
      'Moonrise near sunset: 5:45 PM',
    )
  })

  test('a day with no moonrise, or no sunset, says so', () => {
    const words = tonightWords(
      { ...day, sunset: null, moonrise: null },
      morning,
      ZONE,
    )
    expect(words.sunset).toBe('No sunset today')
    expect(words.moonrise).toBe('No moonrise today')
  })
})

describe('dayRows', () => {
  const frame = frameFor(CAMPUS_POINT, '2026-10-08')
  const sunsetHour = (index: number) =>
    Math.floor(frame.days[index].sunset! / HOUR) * HOUR

  function hour(t: number, change: Partial<ForecastHour> = {}): ForecastHour {
    return {
      t,
      tempF: 67.6,
      windMph: 9.2,
      gustMph: 12.4,
      windDeg: 250,
      cloudPct: 30,
      rainPct: 2,
      ...change,
    }
  }

  const events: TideExtreme[] = [
    { t: START - HOUR, ft: 4.1, type: 'H' }, // 11 PM the night before
    { t: START, ft: 0.24, type: 'L' }, // midnight
    { t: START + 9 * HOUR, ft: 5.41, type: 'H' },
    { t: START + 24 * HOUR, ft: -0.32, type: 'L' }, // the next midnight
  ]
  // The forecast has the hour of sunset today and tomorrow, and nothing after.
  const forecast: Forecast = {
    updatedAt: NOW,
    hours: [
      hour(sunsetHour(0)),
      hour(sunsetHour(1), { tempF: null }),
      hour(sunsetHour(1) + HOUR),
    ],
  }
  const data = {
    ...frame,
    now: NOW,
    hilo: ready(events),
    forecast: ready(forecast),
  }
  const rows = dayRows(data, null, ZONE)

  test('one row for each of the 14 days, in order', () => {
    expect(rows).toHaveLength(14)
    expect(rows[0].date).toBe('2026-10-08')
    expect(rows[0].day).toBe('Thu Oct 8')
    expect(rows[13].date).toBe('2026-10-21')
    expect(rows[13].day).toBe('Wed Oct 21')
  })

  test('the day on screen is marked, and only that one', () => {
    expect(rows.map((row) => row.selected).indexOf(true)).toBe(0)
    const marks = dayRows(data, '2026-10-13', ZONE).map((row) => row.selected)
    expect(marks.filter(Boolean)).toHaveLength(1)
    expect(marks[5]).toBe(true)
  })

  test('a tapped day that is no longer among the 14 marks today instead', () => {
    const marks = dayRows(data, '2026-10-07', ZONE).map((row) => row.selected)
    expect(marks.indexOf(true)).toBe(0)
    expect(marks.filter(Boolean)).toHaveLength(1)
  })

  test('each row gives its own sunset and how much of the moon is lit', () => {
    expect(rows[0].sunset).toBe('Sunset 6:34 PM')
    expect(rows[0].moon).toBe('Moon 3% lit')
    expect(rows[1].sunset).toBe('Sunset 6:32 PM')
    expect(rows[0].flag).toBeNull()
  })

  test('a moonrise near sunset is flagged on its own row, with its time', () => {
    // 25 October 2026: sunset 6:13 PM, moonrise about 5:45 PM.
    const later = frameFor(CAMPUS_POINT, '2026-10-20')
    const row = dayRows({ ...data, ...later }, null, ZONE)[5]
    expect(row.date).toBe('2026-10-25')
    const moonrise = later.days[5].moonriseNearSunset
    expect(moonrise).not.toBeNull()
    expect(row.flag).toBe(`Moonrise ${formatTime(moonrise!, ZONE)}`)
    expect(row.flag).toMatch(/^Moonrise 5:4\d PM$/)
  })

  test("a row's highs and lows are that day's, in order, and one at midnight belongs to the day it starts", () => {
    expect(rows[0].tides).toEqual([
      'Low 12:00 AM 0.2 ft',
      'High 9:00 AM 5.4 ft',
    ])
    expect(rows[1].tides).toEqual(['Low 12:00 AM -0.3 ft'])
    expect(rows[2].tides).toEqual([])
  })

  test('inside the forecast, a row gives the forecast for the hour of sunset', () => {
    expect(rows[0].weather).toEqual([
      'At sunset',
      '68°F',
      '9 mph, gusts 12, from WSW',
      '30% cloud, 2% rain',
    ])
  })

  test('an hour with only some values gives those', () => {
    expect(rows[1].weather).toEqual([
      'At sunset',
      '9 mph, gusts 12, from WSW',
      '30% cloud, 2% rain',
    ])
  })

  test('past the end of the forecast, a row has no weather', () => {
    expect(rows[2].weather).toBeNull()
    expect(rows[13].weather).toBeNull()
  })

  test('a saved forecast whose every hour has passed gives no weather, as the panels give none', () => {
    // The forecast's last record is the hour after tomorrow's sunset. Two
    // hours on from that, all of it is over.
    const over = sunsetHour(1) + 2 * HOUR
    const stale = dayRows({ ...data, now: over }, null, ZONE)
    expect(stale[0].weather).toBeNull()
    expect(stale[1].weather).toBeNull()
  })

  test("a forecast with any hour still to come keeps every row's weather", () => {
    // It is tomorrow's sunset hour. Today's sunset is long past, but the
    // forecast still has an hour to come, so today's row keeps its weather.
    const evening = dayRows({ ...data, now: sunsetHour(1) }, null, ZONE)
    expect(evening[0].weather).not.toBeNull()
  })

  test('with nothing loaded yet the rows still give the sun and the moon', () => {
    const bare = dayRows(
      { ...frame, now: NOW, hilo: none(), forecast: none() },
      null,
      ZONE,
    )
    expect(bare).toHaveLength(14)
    expect(bare[0].sunset).toBe('Sunset 6:34 PM')
    expect(bare[0].tides).toEqual([])
    expect(bare[0].weather).toBeNull()
  })
})
