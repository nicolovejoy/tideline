import { describe, expect, test } from 'vitest'
import type { Loaded } from './load.ts'
import type { Report } from './nwsObservations.ts'
import {
  REPORT_WITHIN,
  isObservedDay,
  observedDay,
  observedHours,
  skyPct,
  todaysObserved,
} from './observed.ts'
import type { ObservedDay } from './observed.ts'
import type { StationChoice } from './weatherRule.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
// 13 October 2026 at Campus Point: midnight Pacific is 07:00 UTC.
const START = Date.UTC(2026, 9, 13, 7)
const DAY = { start: START, end: START + 24 * HOUR }
const NINE = START + 9 * HOUR

function report(t: number, change: Partial<Report> = {}): Report {
  return {
    t,
    tempF: 60,
    dewF: 50,
    humidityPct: 70,
    windMph: 8,
    gustMph: null,
    windDeg: 270,
    sky: 'clear',
    ...change,
  }
}

describe('observedHours', () => {
  test("the row's dew point and humidity come from the same report as its temperature", () => {
    const reports = [
      report(NINE - 20 * MINUTE, { tempF: 50, dewF: 40, humidityPct: 60 }),
      report(NINE + 5 * MINUTE, { tempF: 55, dewF: 45, humidityPct: 65 }),
    ]
    const [row] = observedHours(reports, DAY, START + 11 * HOUR)
    expect(row.tempF).toBe(55)
    expect(row.dewF).toBe(45)
    expect(row.humidityPct).toBe(65)
  })

  test('an hour gone by takes the report nearest its top, from the half hour either side', () => {
    const reports = [
      report(NINE - 20 * MINUTE, { tempF: 50 }),
      report(NINE + 5 * MINUTE, { tempF: 55 }),
      report(NINE + 25 * MINUTE, { tempF: 58 }),
    ]
    const hours = observedHours(reports, DAY, NINE + 2 * HOUR)
    expect(hours.map((hour) => hour.t)).toEqual([NINE])
    expect(hours[0].tempF).toBe(55)
  })

  test('a report stands for the hour whose top it is nearest, not for the one it falls in', () => {
    const reports = [report(NINE + 31 * MINUTE)]
    const hours = observedHours(reports, DAY, NINE + 2 * HOUR)
    expect(hours.map((hour) => hour.t)).toEqual([NINE + HOUR])
    expect(REPORT_WITHIN).toBe(30 * MINUTE)
  })

  test('on a tie, the later report', () => {
    const reports = [
      report(NINE - 10 * MINUTE, { tempF: 50 }),
      report(NINE + 10 * MINUTE, { tempF: 55 }),
    ]
    expect(observedHours(reports, DAY, NINE + 2 * HOUR)[0].tempF).toBe(55)
  })

  test('the current hour takes the latest report, if it is no older than half an hour before the hour began', () => {
    const now = NINE + 40 * MINUTE
    const reports = [
      report(NINE - 25 * MINUTE, { tempF: 50 }),
      report(NINE + 35 * MINUTE, { tempF: 57 }),
    ]
    const hours = observedHours(reports, DAY, now)
    expect(hours.map((hour) => hour.t)).toEqual([NINE])
    expect(hours[0].tempF).toBe(57)
    // Only the older report: it stands for the current hour.
    expect(observedHours([reports[0]], DAY, now)[0].tempF).toBe(50)
    // A report older than that stands for the hour before, which has ended, and not for the current one.
    expect(
      observedHours([report(NINE - 31 * MINUTE)], DAY, now).map(
        (hour) => hour.t,
      ),
    ).toEqual([NINE - HOUR])
  })

  test('a report stamped on the current time is on the observed side; one after it is not', () => {
    const now = NINE + 30 * MINUTE
    expect(observedHours([report(now, { tempF: 61 })], DAY, now)[0].tempF).toBe(
      61,
    )
    expect(observedHours([report(now + MINUTE)], DAY, now)).toEqual([])
  })

  test("the hour's gust is the highest in any report within the hour, and an hour with reports and no gust has none", () => {
    const reports = [
      report(NINE + 5 * MINUTE, { gustMph: 15 }),
      report(NINE + 20 * MINUTE, { gustMph: 22 }),
      report(NINE + 40 * MINUTE, { gustMph: 18 }),
      report(NINE + HOUR + 5 * MINUTE),
    ]
    const hours = observedHours(reports, DAY, NINE + 3 * HOUR)
    expect(hours[0].gustMph).toBe(22)
    expect(hours[1].gustMph).toBeNull()
  })

  test('a report with nothing in it but a gust still makes a row, with the gust alone', () => {
    const reports = [
      report(NINE + 15 * MINUTE, {
        gustMph: 20,
        tempF: null,
        dewF: null,
        humidityPct: null,
        windMph: null,
        windDeg: null,
        sky: null,
      }),
    ]
    const hours = observedHours(reports, DAY, NINE + 2 * HOUR)
    expect(hours).toEqual([
      {
        t: NINE,
        tempF: null,
        dewF: null,
        humidityPct: null,
        windMph: null,
        gustMph: 20,
        windDeg: null,
        sky: null,
      },
    ])
  })

  test('the first hour of the day may take a report from the last half hour of the day before', () => {
    const reports = [report(START - 25 * MINUTE, { tempF: 48 })]
    expect(observedHours(reports, DAY, START + 2 * HOUR)[0]).toMatchObject({
      t: START,
      tempF: 48,
    })
  })

  test('the rows follow the day: 25 of them on the day the clocks go back', () => {
    // 1 November 2026: midnight PDT is 07:00 UTC, the next midnight PST is 08:00 UTC.
    const fallBack = {
      start: Date.UTC(2026, 10, 1, 7),
      end: Date.UTC(2026, 10, 2, 8),
    }
    const reports = Array.from({ length: 25 }, (_, i) =>
      report(fallBack.start + i * HOUR + 5 * MINUTE),
    )
    const hours = observedHours(reports, fallBack, fallBack.end + HOUR)
    expect(hours).toHaveLength(25)
    expect(hours[24].t).toBe(fallBack.start + 24 * HOUR)
  })

  test('an hour not yet begun has no row, whatever the reports say', () => {
    const reports = [report(NINE + HOUR + 5 * MINUTE)]
    expect(observedHours(reports, DAY, NINE + 30 * MINUTE)).toEqual([])
  })
})

describe('observedDay', () => {
  test('names the station and the latest report of the day, and holds the hours', () => {
    const reports = [report(START - 10 * MINUTE), report(NINE + 5 * MINUTE)]
    const day = observedDay('KSBA', reports, DAY, NINE + 2 * HOUR)
    expect(day.stationId).toBe('KSBA')
    expect(day.through).toBe(NINE + 5 * MINUTE)
    expect(day.hours.map((hour) => hour.t)).toEqual([START, NINE])
  })

  test('with no report yet today, through is null', () => {
    const day = observedDay(
      'KSBA',
      [report(START - 10 * MINUTE)],
      DAY,
      START + 10 * MINUTE,
    )
    expect(day.through).toBeNull()
  })
})

describe('skyPct', () => {
  test('is the middle of the range each category stands for, in eighths', () => {
    expect(skyPct('clear')).toBe(0)
    expect(skyPct('few')).toBe(19)
    expect(skyPct('scattered')).toBe(44)
    expect(skyPct('broken')).toBe(75)
    expect(skyPct('overcast')).toBe(100)
  })
})

describe('isObservedDay', () => {
  test('rows saved before the dew point and humidity fail, so the day is fetched afresh', () => {
    const old = {
      stationId: 'KSBA',
      through: null,
      hours: [
        { t: 1, tempF: 60, windMph: 5, gustMph: null, windDeg: 180, sky: null },
      ],
    }
    expect(isObservedDay(old)).toBe(false)
  })

  test('is the shape saved on the device', () => {
    const day = observedDay(
      'KSBA',
      [report(NINE + 5 * MINUTE)],
      DAY,
      NINE + 2 * HOUR,
    )
    expect(isObservedDay(JSON.parse(JSON.stringify(day)))).toBe(true)
    expect(isObservedDay({ stationId: 'KSBA', through: null, hours: [] })).toBe(
      true,
    )
    expect(isObservedDay({ stationId: 'KSBA', hours: [] })).toBe(false)
    expect(
      isObservedDay({ stationId: 'KSBA', through: null, hours: [{ t: 1 }] }),
    ).toBe(false)
    expect(isObservedDay(null)).toBe(false)
  })
})

describe('todaysObserved', () => {
  const ksba = {
    id: 'KSBA',
    name: 'Santa Barbara',
    lat: 34.4,
    lon: -119.8,
    elevationFt: 10,
    distanceMi: 1.5,
    direction: 'north',
  }
  function loaded<T>(
    data: T | null,
    status: Loaded<T>['status'] = 'ready',
  ): Loaded<T> {
    return { data, fetchedAt: data ? NINE : null, span: DAY, status }
  }
  const day: ObservedDay = {
    stationId: 'KSBA',
    through: NINE,
    hours: [
      {
        t: NINE,
        tempF: 60,
        dewF: null,
        humidityPct: null,
        windMph: 8,
        gustMph: null,
        windDeg: 270,
        sky: 'clear',
      },
    ],
  }
  const serves: StationChoice = { serves: ksba, nearest: ksba }

  test('the rows of the day where the station serving is the one they came from', () => {
    expect(todaysObserved(loaded(serves), loaded(day), DAY)).toEqual(day.hours)
  })

  test('none where no station serves, where none is known yet, or where the rows are from another station', () => {
    expect(
      todaysObserved(loaded({ serves: null, nearest: ksba }), loaded(day), DAY),
    ).toEqual([])
    expect(
      todaysObserved(loaded<StationChoice>(null, 'loading'), loaded(day), DAY),
    ).toEqual([])
    expect(
      todaysObserved(
        loaded(serves),
        loaded({ ...day, stationId: 'KIZA' }),
        DAY,
      ),
    ).toEqual([])
    expect(
      todaysObserved(loaded(serves), loaded<ObservedDay>(null, 'loading'), DAY),
    ).toEqual([])
  })

  test("none where the rows were fetched for another day's span", () => {
    const yesterday = { start: DAY.start - 24 * HOUR, end: DAY.start }
    const old: Loaded<ObservedDay> = { ...loaded(day), span: yesterday }
    expect(todaysObserved(loaded(serves), old, DAY)).toEqual([])
    expect(todaysObserved(loaded(serves), { ...old, span: null }, DAY)).toEqual(
      [],
    )
  })
})
