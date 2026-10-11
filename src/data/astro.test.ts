import { describe, expect, test } from 'vitest'
import { astroForDays, dayAstro } from './astro.ts'
import { USNO_CAMPUS_POINT } from './__fixtures__/usno-campus-point.ts'
import { CAMPUS_POINT, spotById } from '../spot.ts'
import { formatTime } from '../time.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
// The Observatory rounds to the minute, so a perfect answer can be 30 s away.
const TOLERANCE = 90_000

/** A Naval Observatory local clock time as a UTC instant. */
function usnoInstant(date: string, clock: string, utcOffset: number): number {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = clock.split(':').map(Number)
  return Date.UTC(year, month - 1, day, hour - utcOffset, minute)
}

describe('against the US Naval Observatory', () => {
  test.each(USNO_CAMPUS_POINT)(
    '$date: sunset and moonrise agree within 90 seconds',
    (row) => {
      const day = dayAstro(CAMPUS_POINT, row.date)

      const sunset = usnoInstant(row.date, row.sunset, row.utcOffset)
      expect(day.sunset).not.toBeNull()
      expect(Math.abs(day.sunset! - sunset)).toBeLessThanOrEqual(TOLERANCE)

      if (row.moonrise === null) {
        expect(day.moonrise).toBeNull()
      } else {
        const moonrise = usnoInstant(row.date, row.moonrise, row.utcOffset)
        expect(day.moonrise).not.toBeNull()
        expect(Math.abs(day.moonrise! - moonrise)).toBeLessThanOrEqual(
          TOLERANCE,
        )
      }
    },
  )
})

describe('days that are not 24 hours, and days without a moonrise', () => {
  test('1 November 2026: the 11:40 PM moonrise is found in the 25-hour day', () => {
    const day = dayAstro(CAMPUS_POINT, '2026-11-01')
    // A search of only 24 hours from local midnight would stop at 11 PM.
    expect(day.moonrise).not.toBeNull()
  })

  test('2 November 2026 has no moonrise', () => {
    const day = dayAstro(CAMPUS_POINT, '2026-11-02')
    expect(day.moonrise).toBeNull()
    expect(day.sunset).not.toBeNull()
    expect(day.moonriseNearSunset).toBeNull()
  })
})

describe('moonrise near sunset', () => {
  test.each([
    '2026-10-23',
    '2026-10-24',
    '2026-10-25',
    '2026-10-26',
    '2026-10-27',
    '2026-10-28',
  ])('%s: flagged', (date) => {
    const day = dayAstro(CAMPUS_POINT, date)
    expect(day.moonriseNearSunset).not.toBeNull()
    expect(Math.abs(day.moonriseNearSunset! - day.sunset!)).toBeLessThanOrEqual(
      2 * HOUR,
    )
  })

  // 22 October is within about a minute of the 2-hour limit, so it is left out.
  test.each(['2026-10-20', '2026-10-21', '2026-10-29', '2026-10-30'])(
    '%s: not flagged',
    (date) => {
      expect(dayAstro(CAMPUS_POINT, date).moonriseNearSunset).toBeNull()
    },
  )

  test('the flagged moonrise can come after sunset', () => {
    // 26 October: sunset 6:12 PM, moonrise 6:23 PM.
    const day = dayAstro(CAMPUS_POINT, '2026-10-26')
    const minutesAfter = (day.moonriseNearSunset! - day.sunset!) / MINUTE
    expect(minutesAfter).toBeGreaterThan(10)
    expect(minutesAfter).toBeLessThan(13)
  })

  test("the flagged moonrise is the day's own moonrise", () => {
    const day = dayAstro(CAMPUS_POINT, '2026-10-25')
    expect(Math.abs(day.moonriseNearSunset! - day.moonrise!)).toBeLessThan(1000)
  })
})

describe('to the minute', () => {
  const zone = CAMPUS_POINT.timeZone

  // The Observatory rounds to the nearest minute. Showing 6:33 PM for a
  // sunset at 6:33:43 would disagree with it on about half of all days.
  test.each(USNO_CAMPUS_POINT)(
    '$date: shows the same minute as the Observatory',
    (row) => {
      const day = dayAstro(CAMPUS_POINT, row.date)
      expect(formatTime(day.sunset!, zone)).toBe(
        formatTime(usnoInstant(row.date, row.sunset, row.utcOffset), zone),
      )
      if (row.moonrise !== null) {
        expect(formatTime(day.moonrise!, zone)).toBe(
          formatTime(usnoInstant(row.date, row.moonrise, row.utcOffset), zone),
        )
      }
    },
  )

  test.each(['2026-10-25', '2026-10-28'])(
    "%s: the flagged moonrise and the day's moonrise are one instant",
    (date) => {
      // Two separate searches for one event could print as different minutes.
      const day = dayAstro(CAMPUS_POINT, date)
      expect(day.moonriseNearSunset).toBe(day.moonrise)
    },
  )
})

describe('moon phase', () => {
  test.each([
    ['2026-10-08', 'Waning Crescent'],
    ['2026-10-10', 'New Moon'],
    ['2026-10-12', 'Waxing Crescent'],
    ['2026-10-18', 'First Quarter'],
    ['2026-10-21', 'Waxing Gibbous'],
    // Full moon is at 9:12 PM Pacific on the 25th, which is the 26th in UTC.
    ['2026-10-25', 'Full Moon'],
    ['2026-10-28', 'Waning Gibbous'],
    ['2026-11-01', 'Last Quarter'],
    ['2026-11-02', 'Waning Crescent'],
  ])('%s is %s', (date, phase) => {
    expect(dayAstro(CAMPUS_POINT, date).phase).toBe(phase)
  })

  test('illumination is a fraction between 0 and 1, evaluated at sunset', () => {
    expect(dayAstro(CAMPUS_POINT, '2026-10-10').illumination).toBeLessThan(0.01)
    expect(dayAstro(CAMPUS_POINT, '2026-10-25').illumination).toBeGreaterThan(
      0.99,
    )
    const oct8 = dayAstro(CAMPUS_POINT, '2026-10-08').illumination
    expect(oct8).toBeGreaterThan(0.02)
    expect(oct8).toBeLessThan(0.04)
  })
})

describe('astroForDays', () => {
  test('one entry per consecutive local date', () => {
    const days = astroForDays(CAMPUS_POINT, '2026-10-30', 4)
    expect(days.map((d) => d.date)).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ])
  })
})

describe("from the spot's own height", () => {
  const peak = spotById('la-cumbre-peak')
  const zone = peak.timeZone
  // The same point with no height of its own: a level horizon.
  const level = { ...peak, elevationFt: null }

  test('10 October 2026 from 3,997 ft: sunset 6:37 PM, moonrise 6:59 AM', () => {
    // The Naval Observatory gives 18:31 and 07:05 for this point whatever
    // height it is asked for: its times are for a level horizon.
    const flat = dayAstro(level, '2026-10-10')
    expect(formatTime(flat.sunset!, zone)).toBe('6:31 PM')
    expect(formatTime(flat.moonrise!, zone)).toBe('7:05 AM')

    // Both sunsets fall within two seconds of a half minute: 6:30:30 on a
    // level horizon and 6:36:31 from the peak. If an upgrade of the library
    // turns a pin here into the minute before, that is the rounding and not
    // a regression. The bands in the next test are what the height does.
    const high = dayAstro(peak, '2026-10-10')
    expect(formatTime(high.sunset!, zone)).toBe('6:37 PM')
    expect(formatTime(high.moonrise!, zone)).toBe('6:59 AM')
  })

  // From 1,218 m the horizon is about 1.2° below level. The sun and the
  // moon cross that in 6 to 7 minutes at this latitude, a little more at
  // the solstices, when they meet the horizon at more of a slant.
  test.each(['2026-10-10', '2026-12-21', '2027-03-20', '2027-06-21'])(
    '%s: sunset is 5 to 8 minutes later, moonrise 5 to 8 minutes earlier',
    (date) => {
      const flat = dayAstro(level, date)
      const high = dayAstro(peak, date)
      const later = (high.sunset! - flat.sunset!) / MINUTE
      const earlier = (flat.moonrise! - high.moonrise!) / MINUTE
      expect(later).toBeGreaterThanOrEqual(5)
      expect(later).toBeLessThanOrEqual(8)
      expect(earlier).toBeGreaterThanOrEqual(5)
      expect(earlier).toBeLessThanOrEqual(8)
    },
  )

  test('the higher the spot, the later the sunset', () => {
    const sunsetFrom = (elevationFt: number) =>
      dayAstro({ ...peak, elevationFt }, '2026-10-10').sunset!
    expect(sunsetFrom(1000)).toBeGreaterThan(sunsetFrom(100))
    expect(sunsetFrom(3997)).toBeGreaterThan(sunsetFrom(1000))
    expect(sunsetFrom(9000)).toBeGreaterThan(sunsetFrom(3997))
  })

  test('a height under 100 ft, or far from the sea, changes nothing', () => {
    const date = '2026-10-10'
    expect(dayAstro({ ...peak, elevationFt: 99 }, date)).toEqual(
      dayAstro(level, date),
    )
    const inland = {
      ...peak,
      tideStation: { ...peak.tideStation, distanceMi: 26 },
    }
    expect(dayAstro(inland, date)).toEqual(dayAstro(level, date))
  })

  test('the moonrise flag is worked out from the same times', () => {
    // 25 October 2026 from the peak: moonrise 5:38 PM, sunset 6:18 PM.
    const day = dayAstro(peak, '2026-10-25')
    expect(formatTime(day.sunset!, zone)).toBe('6:18 PM')
    expect(formatTime(day.moonrise!, zone)).toBe('5:38 PM')
    expect(day.moonriseNearSunset).toBe(day.moonrise)
  })

  test('2 November 2026 still has no moonrise', () => {
    // The moon rises at 11:33 PM on the 1st and 12:40 AM on the 3rd.
    const day = dayAstro(peak, '2026-11-02')
    expect(day.moonrise).toBeNull()
    expect(day.moonriseNearSunset).toBeNull()
    expect(formatTime(day.sunset!, zone)).toBe('5:10 PM')
  })
})
