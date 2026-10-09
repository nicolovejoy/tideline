import { describe, expect, test } from 'vitest'
import {
  addDays,
  formatDay,
  formatTime,
  hourMarks,
  localDate,
  localDayStart,
  localHour,
} from './time.ts'

const LA = 'America/Los_Angeles'
const HOUR = 3_600_000

describe('localDate', () => {
  test('the date changes at local midnight, not UTC midnight', () => {
    expect(localDate(Date.UTC(2026, 9, 9, 6, 59), LA)).toBe('2026-10-08')
    expect(localDate(Date.UTC(2026, 9, 9, 7, 0), LA)).toBe('2026-10-09')
  })

  test('an evening instant belongs to the local day, not the UTC day', () => {
    // 6:33 PM Pacific on 8 October is already 9 October in UTC.
    expect(localDate(Date.UTC(2026, 9, 9, 1, 33), LA)).toBe('2026-10-08')
  })
})

describe('localDayStart', () => {
  test('an ordinary day starts at local midnight', () => {
    expect(localDayStart('2026-10-08', LA)).toBe(Date.UTC(2026, 9, 8, 7))
  })

  test('the day the clocks go back is 25 hours long', () => {
    const start = localDayStart('2026-11-01', LA)
    const next = localDayStart('2026-11-02', LA)
    expect(start).toBe(Date.UTC(2026, 10, 1, 7))
    expect(next).toBe(Date.UTC(2026, 10, 2, 8))
    expect((next - start) / HOUR).toBe(25)
  })

  test('the day the clocks go forward is 23 hours long', () => {
    const start = localDayStart('2027-03-14', LA)
    const next = localDayStart('2027-03-15', LA)
    expect(start).toBe(Date.UTC(2027, 2, 14, 8))
    expect(next).toBe(Date.UTC(2027, 2, 15, 7))
    expect((next - start) / HOUR).toBe(23)
  })

  test('round-trips with localDate, including clock-change days', () => {
    for (const date of [
      '2026-10-08',
      '2026-11-01',
      '2026-11-02',
      '2027-03-14',
    ]) {
      expect(localDate(localDayStart(date, LA), LA)).toBe(date)
    }
  })

  test('uses the zone it is given, not a fixed one', () => {
    expect(localDayStart('2026-10-08', 'America/New_York')).toBe(
      Date.UTC(2026, 9, 8, 4),
    )
  })
})

describe('addDays', () => {
  test('crosses month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  test('adding zero returns the same date', () => {
    expect(addDays('2026-10-08', 0)).toBe('2026-10-08')
  })
})

describe('formatTime', () => {
  test('a 12-hour clock in the given zone', () => {
    expect(formatTime(Date.UTC(2026, 9, 9, 1, 33), LA)).toBe('6:33 PM')
    expect(formatTime(Date.UTC(2026, 9, 9, 1, 33), 'America/New_York')).toBe(
      '9:33 PM',
    )
  })

  test('midnight and noon', () => {
    expect(formatTime(Date.UTC(2026, 9, 8, 7, 0), LA)).toBe('12:00 AM')
    expect(formatTime(Date.UTC(2026, 9, 8, 19, 0), LA)).toBe('12:00 PM')
  })
})

describe('localHour', () => {
  test('the hour of the day in the given zone', () => {
    expect(localHour(Date.UTC(2026, 9, 9, 1, 33), LA)).toBe(18)
    expect(localHour(Date.UTC(2026, 9, 8, 7, 0), LA)).toBe(0)
    expect(localHour(Date.UTC(2026, 9, 9, 1, 33), 'America/New_York')).toBe(21)
  })
})

describe('hourMarks', () => {
  test('every six local hours on an ordinary day, both ends included', () => {
    const start = localDayStart('2026-10-08', LA)
    const end = localDayStart('2026-10-09', LA)
    expect(hourMarks(start, end, LA, 6)).toEqual([
      { t: start, hour: 0 },
      { t: start + 6 * HOUR, hour: 6 },
      { t: start + 12 * HOUR, hour: 12 },
      { t: start + 18 * HOUR, hour: 18 },
      { t: end, hour: 0 },
    ])
  })

  test('on the 25-hour day the marks follow the clock, not a fixed spacing', () => {
    const start = localDayStart('2026-11-01', LA)
    const end = localDayStart('2026-11-02', LA)
    const hoursIn = hourMarks(start, end, LA, 6).map(
      (m) => (m.t - start) / HOUR,
    )
    // 6 AM comes seven hours after midnight, because 1 AM happens twice.
    expect(hoursIn).toEqual([0, 7, 13, 19, 25])
  })

  test('on the 23-hour day 6 AM comes five hours after midnight', () => {
    const start = localDayStart('2027-03-14', LA)
    const end = localDayStart('2027-03-15', LA)
    const hoursIn = hourMarks(start, end, LA, 6).map(
      (m) => (m.t - start) / HOUR,
    )
    expect(hoursIn).toEqual([0, 5, 11, 17, 23])
  })
})

describe('formatDay', () => {
  test('weekday, month and day of the month', () => {
    expect(formatDay('2026-10-08')).toBe('Thu Oct 8')
    expect(formatDay('2026-11-01')).toBe('Sun Nov 1')
    expect(formatDay('2027-01-01')).toBe('Fri Jan 1')
  })
})
