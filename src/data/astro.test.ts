import { Body, Equator, Horizon, Observer } from 'astronomy-engine'
import { describe, expect, test } from 'vitest'
import { astroForDays, dayAstro } from './astro.ts'
import { USNO_CAMPUS_POINT } from './__fixtures__/usno-campus-point.ts'
import { CAMPUS_POINT, spotById } from '../spot.ts'
import { addDays, formatTime, localDayStart } from '../time.ts'

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
    '$date: sunrise, sunset and moonrise agree within 90 seconds',
    (row) => {
      const day = dayAstro(CAMPUS_POINT, row.date)

      const sunset = usnoInstant(row.date, row.sunset, row.utcOffset)
      expect(day.sunset).not.toBeNull()
      expect(Math.abs(day.sunset! - sunset)).toBeLessThanOrEqual(TOLERANCE)
      const sunrise = usnoInstant(row.date, row.sunrise, row.utcOffset)
      expect(day.night).toHaveLength(2)
      expect(Math.abs(day.night[0].end - sunrise)).toBeLessThanOrEqual(
        TOLERANCE,
      )
      expect(Math.abs(day.night[1].start - sunset)).toBeLessThanOrEqual(
        TOLERANCE,
      )

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

describe('night', () => {
  const zone = CAMPUS_POINT.timeZone

  test('midnight to sunrise, and sunset to midnight', () => {
    const day = dayAstro(CAMPUS_POINT, '2026-10-08')
    const start = localDayStart('2026-10-08', zone)
    const end = localDayStart('2026-10-09', zone)
    expect(day.night).toEqual([
      { start, end: day.night[0].end },
      { start: day.sunset!, end },
    ])
    expect(formatTime(day.night[0].end, zone)).toBe('6:59 AM')
    expect(formatTime(day.night[1].start, zone)).toBe('6:34 PM')
  })

  test('the 25-hour day of 1 November is shaded to its own end', () => {
    const day = dayAstro(CAMPUS_POINT, '2026-11-01')
    const end = localDayStart('2026-11-02', zone)
    expect(end - localDayStart('2026-11-01', zone)).toBe(25 * HOUR)
    expect(day.night[1].end).toBe(end)
    // Standard time from 2 AM: the clock reads an hour earlier than the day before.
    expect(formatTime(day.night[0].end, zone)).toBe('6:20 AM')
    expect(formatTime(day.night[1].start, zone)).toBe('5:06 PM')
  })

  test('to the minute, like every time in the record', () => {
    const day = dayAstro(CAMPUS_POINT, '2026-10-08')
    for (const span of day.night) {
      expect(span.start % MINUTE).toBe(0)
      expect(span.end % MINUTE).toBe(0)
    }
  })

  test("from the spot's own height, the night is shorter", () => {
    const peak = spotById('la-cumbre-peak')
    const high = dayAstro(peak, '2026-10-10')
    const flat = dayAstro({ ...peak, elevationFt: null }, '2026-10-10')
    // Sunrise earlier and sunset later, by 5 to 8 minutes each.
    expect(flat.night[0].end - high.night[0].end).toBeGreaterThanOrEqual(
      5 * MINUTE,
    )
    expect(high.night[1].start - flat.night[1].start).toBeGreaterThanOrEqual(
      5 * MINUTE,
    )
  })

  // Utqiaġvik, Alaska, at 71.3° N: polar night in December, midnight sun in
  // June, and in late July and early August a sun that sets just after one
  // midnight and again just before the next.
  const utqiagvik = {
    ...CAMPUS_POINT,
    lat: 71.29,
    lon: -156.79,
    timeZone: 'America/Anchorage',
  }

  test('polar night: the whole day', () => {
    const day = dayAstro(utqiagvik, '2026-12-21')
    expect(day.sunset).toBeNull()
    expect(day.night).toEqual([
      {
        start: localDayStart('2026-12-21', utqiagvik.timeZone),
        end: localDayStart('2026-12-22', utqiagvik.timeZone),
      },
    ])
  })

  test('midnight sun: none of the day', () => {
    const day = dayAstro(utqiagvik, '2026-06-21')
    expect(day.sunset).toBeNull()
    expect(day.night).toEqual([])
  })

  /** The sun's altitude, unrefracted, over a level horizon. */
  function sunAltitude(t: number): number {
    const observer = new Observer(utqiagvik.lat, utqiagvik.lon, 0)
    const eq = Equator(Body.Sun, new Date(t), observer, true, true)
    return Horizon(new Date(t), observer, eq.ra, eq.dec, 'normal').altitude
  }

  test('where the sun sets twice in a day, both nights are shaded: dark at the middle of each span, light between them', () => {
    // The midnight sun ends in the first days of August, with a sunset
    // near 2:30 AM (solar midnight here) that comes earlier each day. Within
    // these three weeks is a day whose first sunset is just after midnight
    // and whose second is just before the next.
    const dates = Array.from({ length: 21 }, (_, i) => addDays('2026-07-28', i))
    let twoSunsets = 0
    for (const date of dates) {
      const start = localDayStart(date, utqiagvik.timeZone)
      const end = localDayStart(addDays(date, 1), utqiagvik.timeZone)
      const { night } = dayAstro(utqiagvik, date)
      // In order, inside the day, each with some length.
      let last = start
      for (const span of night) {
        expect(span.start).toBeGreaterThanOrEqual(last)
        expect(span.end).toBeGreaterThan(span.start)
        expect(span.end).toBeLessThanOrEqual(end)
        last = span.end
      }
      // Dark in the middle of each span, light in the middle of each gap.
      // The sun grazes the horizon here, so only the middles are checked,
      // and only where the span or the gap is over 20 minutes long.
      const edges = [start, ...night.flatMap((s) => [s.start, s.end]), end]
      for (let i = 0; i + 1 < edges.length; i++) {
        const [a, b] = [edges[i], edges[i + 1]]
        if (b - a < 20 * MINUTE) continue
        const dark = i % 2 === 1
        const altitude = sunAltitude((a + b) / 2)
        if (dark) expect(altitude).toBeLessThan(0)
        else expect(altitude).toBeGreaterThan(-1)
      }
      if (night.length === 2 && night[0].start > start) twoSunsets++
    }
    expect(twoSunsets).toBeGreaterThan(0)
  })
})
