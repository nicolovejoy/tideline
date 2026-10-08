import { describe, expect, test } from 'vitest'
import { addDays, formatTime, localDate, localDayStart } from './time.ts'

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
