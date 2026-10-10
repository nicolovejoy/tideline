import { describe, expect, test } from 'vitest'
import { monthNav, monthRows, monthsOffered } from './monthView.ts'
import type { Loaded } from '../data/load.ts'
import { parseHiLo } from '../data/noaa.ts'
import type { TideExtreme } from '../data/noaa.ts'
import { CAMPUS_POINT, spotById } from '../spot.ts'
import hiloRaw from '../data/__fixtures__/noaa-hilo-20261010-20270131.json?raw'

const TODAY = '2026-10-10'
const FETCHED = Date.UTC(2026, 9, 10, 17)
const EVENTS = parseHiLo(JSON.parse(hiloRaw))

function loaded(
  data: TideExtreme[] | null,
  status: Loaded<TideExtreme[]>['status'] = 'ready',
): Loaded<TideExtreme[]> {
  return { data, fetchedAt: data ? FETCHED : null, span: null, status }
}

const HILO = loaded(EVENTS)

describe('monthsOffered', () => {
  test('this month and the next three', () => {
    expect(monthsOffered(TODAY)).toEqual([
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
    ])
  })

  test('crosses the end of the year', () => {
    expect(monthsOffered('2026-11-15')).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ])
  })
})

describe('monthNav', () => {
  test('this month has no previous month', () => {
    expect(monthNav('2026-10', TODAY)).toEqual({
      month: '2026-10',
      title: 'October 2026',
      prev: null,
      next: '2026-11',
    })
  })

  test('a month in the middle has both neighbours', () => {
    expect(monthNav('2026-12', TODAY)).toEqual({
      month: '2026-12',
      title: 'December 2026',
      prev: '2026-11',
      next: '2027-01',
    })
  })

  test('the last month has no next month', () => {
    expect(monthNav('2027-01', TODAY)).toEqual({
      month: '2027-01',
      title: 'January 2027',
      prev: '2026-12',
      next: null,
    })
  })

  test('no month, or a month not offered, means this month', () => {
    expect(monthNav(null, TODAY).month).toBe('2026-10')
    // The month that ended, on a phone left open into the first of the next.
    expect(monthNav('2026-10', '2026-11-01').month).toBe('2026-11')
    expect(monthNav('2027-06', TODAY).month).toBe('2026-10')
  })
})

describe('monthRows', () => {
  test('this month runs from today to its last day, with today marked', () => {
    const rows = monthRows(
      CAMPUS_POINT,
      '2026-10',
      { today: TODAY, hilo: HILO },
      true,
    )
    expect(rows).toHaveLength(22)
    expect(rows[0].date).toBe('2026-10-10')
    expect(rows[0].day).toBe('Sat Oct 10')
    expect(rows[0].isToday).toBe(true)
    expect(rows[1].isToday).toBe(false)
    expect(rows[21].date).toBe('2026-10-31')
  })

  test("today's highs and lows, in the spot's zone, as NOAA gives them", () => {
    const rows = monthRows(
      CAMPUS_POINT,
      '2026-10',
      { today: TODAY, hilo: HILO },
      true,
    )
    expect(rows[0].tides).toEqual([
      'Low 3:32 AM 1.0 ft',
      'High 9:45 AM 5.9 ft',
      'Low 4:20 PM 0.1 ft',
      'High 10:27 PM 4.6 ft',
    ])
  })

  test('sunset, the moon with its phase, and the flag', () => {
    const rows = monthRows(
      CAMPUS_POINT,
      '2026-10',
      { today: TODAY, hilo: HILO },
      true,
    )
    // The new moon is on the 10th and the full moon on the 25th.
    expect(rows[0].moon).toMatch(/^Moon \d+% lit, new moon$/)
    expect(rows[15].date).toBe('2026-10-25')
    expect(rows[15].moon).toMatch(/^Moon \d+% lit, full moon$/)
    expect(rows[0].sunset).toMatch(/^Sunset 6:\d\d PM$/)
    expect(rows[12].date).toBe('2026-10-22')
    expect(rows[12].flag).toBe('Moonrise 4:17 PM')
    for (const row of rows) {
      expect(
        row.flag === null || /^Moonrise \d+:\d\d [AP]M$/.test(row.flag),
      ).toBe(true)
    }
  })

  test('a later month holds every one of its days', () => {
    const rows = monthRows(
      CAMPUS_POINT,
      '2027-01',
      { today: TODAY, hilo: HILO },
      true,
    )
    expect(rows).toHaveLength(31)
    expect(rows[0].date).toBe('2027-01-01')
    expect(rows[30].date).toBe('2027-01-31')
    expect(rows.every((row) => !row.isToday)).toBe(true)
    // A low that rounds to nothing is 0.0, never -0.0. (The fixture ends at
    // 23:59 UTC on the 31st, before that evening's events in Pacific time.)
    expect(rows[30].tides).toEqual([
      'High 4:52 AM 5.0 ft',
      'Low 12:52 PM 0.0 ft',
    ])
  })

  test('the day the clocks go back is 25 hours long and keeps all its highs and lows', () => {
    // No recorded event falls in the 25th hour (07:00 to 08:00 UTC), so add one.
    const late: TideExtreme = {
      t: Date.UTC(2026, 10, 2, 7, 30),
      ft: 1.5,
      type: 'H',
    }
    const events = [...EVENTS, late].sort((a, b) => a.t - b.t)
    const rows = monthRows(
      CAMPUS_POINT,
      '2026-11',
      { today: TODAY, hilo: loaded(events) },
      true,
    )
    expect(rows[0].date).toBe('2026-11-01')
    expect(rows[0].tides).toEqual([
      'High 4:19 AM 3.9 ft',
      'Low 8:22 AM 3.3 ft',
      'High 2:13 PM 5.1 ft',
      'Low 9:57 PM -0.1 ft',
      'High 11:30 PM 1.5 ft',
    ])
    expect(rows[1].tides).not.toContain('High 11:30 PM 1.5 ft')
    expect(rows[1].tides[0]).toBe('High 5:05 AM 4.3 ft')
  })

  test('rows past the saved highs and lows have no tide lines', () => {
    // What is saved from before: the 14 days from the 10th.
    const short = loaded(EVENTS.filter((e) => e.t < Date.UTC(2026, 9, 24, 7)))
    const rows = monthRows(
      CAMPUS_POINT,
      '2026-10',
      { today: TODAY, hilo: short },
      true,
    )
    expect(rows[13].tides.length).toBeGreaterThan(0)
    expect(rows[14].tides).toEqual([])
    const november = monthRows(
      CAMPUS_POINT,
      '2026-11',
      { today: TODAY, hilo: short },
      true,
    )
    expect(november.every((row) => row.tides.length === 0)).toBe(true)
  })

  test('no highs and lows at all is rows with no tide lines', () => {
    const rows = monthRows(
      CAMPUS_POINT,
      '2026-10',
      { today: TODAY, hilo: loaded(null, 'loading') },
      true,
    )
    expect(rows).toHaveLength(22)
    expect(rows.every((row) => row.tides.length === 0)).toBe(true)
  })

  test('with the tide hidden the rows list no highs and lows', () => {
    const laCumbre = spotById('la-cumbre-peak')
    const rows = monthRows(
      laCumbre,
      '2026-10',
      { today: TODAY, hilo: HILO },
      false,
    )
    expect(rows).toHaveLength(22)
    expect(rows.every((row) => row.tides.length === 0)).toBe(true)
    expect(rows[0].sunset).toMatch(/^Sunset /)
  })

  test('a month not offered is read as this month', () => {
    const rows = monthRows(
      CAMPUS_POINT,
      '2027-06',
      { today: TODAY, hilo: HILO },
      true,
    )
    expect(rows[0].date).toBe('2026-10-10')
    expect(
      monthRows(CAMPUS_POINT, null, { today: TODAY, hilo: HILO }, true)[0].date,
    ).toBe('2026-10-10')
  })
})
