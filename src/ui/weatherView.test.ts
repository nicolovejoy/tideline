import { describe, expect, test } from 'vitest'
import { partsText } from '../chart/readout.ts'
import type { Selected } from './selection.ts'
import { forecastHours, weatherView } from './weatherView.ts'
import type { Loaded } from '../data/load.ts'
import type { Forecast, ForecastHour } from '../data/nws.ts'
import type { ObservedHour } from '../data/observed.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
// Local 8 October 2026 at the spot, Pacific daylight time.
const START = Date.UTC(2026, 9, 8, 7)
const END = START + DAY
const NOW = START + 15 * HOUR + 36 * MINUTE // 3:36 PM
const SUNSET = 18 * HOUR + 34 * MINUTE // 6:34 PM, as an offset into a day

function day(index: number, sunset: number | null = SUNSET): Selected {
  const start = START + index * DAY
  const date = `2026-10-${String(8 + index).padStart(2, '0')}`
  return {
    index,
    date,
    span: { start, end: start + DAY },
    astro: {
      date,
      sunset: sunset === null ? null : start + sunset,
      night: [],
      moonrise: null,
      illumination: 0.03,
      phase: 'Waning Crescent',
      moonriseNearSunset: null,
    },
    isToday: index === 0,
    anchor: sunset === null ? start + DAY / 2 : start + sunset,
  }
}

/** Hourly records from `first` for `count` hours. The temperature is the hour of the day plus 50. */
function hourly(
  first: number,
  count: number,
  change: (hour: ForecastHour) => void = () => {},
): ForecastHour[] {
  return Array.from({ length: count }, (_, i) => {
    const t = first + i * HOUR
    const hour: ForecastHour = {
      t,
      tempF: 50 + (((t - START) / HOUR) % 24),
      windMph: 9,
      gustMph: 12,
      windDeg: 270,
      cloudPct: 3,
      rainPct: 0,
    }
    change(hour)
    return hour
  })
}

function loaded(
  hours: ForecastHour[] | null,
  status: Loaded<Forecast>['status'] = 'ready',
): Loaded<Forecast> {
  const data = hours === null ? null : { updatedAt: NOW - HOUR, hours }
  return { data, fetchedAt: data ? NOW : null, span: null, status }
}

// From 5 AM today for 7 days and 17 hours, as NWS sends it: the last record
// is for 9 PM on 15 October.
const FIRST = START + 5 * HOUR
const week = loaded(hourly(FIRST, 185))

describe('what is drawn', () => {
  test('one staircase per value but the wind, over the hours of the day on screen', () => {
    const view = weatherView(week, day(0), NOW, NOW)
    expect(view.notice).toBeNull()
    expect(view.wind.series.map((series) => series.name)).toEqual(['gust'])
    expect(view.temp.series.map((series) => series.name)).toEqual(['temp'])
    expect(view.sky.series.map((series) => series.name)).toEqual([
      'cloud',
      'rain',
    ])
    // Today's forecast starts at 5 AM, so the lines start partway across.
    const temps = view.temp.series[0].points
    expect(temps).toHaveLength(19)
    expect(temps[0]).toEqual({ t: FIRST, v: 55 })
    expect(temps.at(-1)).toEqual({ t: END - HOUR, v: 73 })
    expect(view.wind.series[0].points[0]).toEqual({ t: FIRST, v: 12 })
  })

  test('another day has its own hours, midnight to midnight', () => {
    const temps = weatherView(week, day(2), NOW, NOW).temp.series[0].points
    expect(temps).toHaveLength(24)
    expect(temps[0].t).toBe(START + 2 * DAY)
    expect(temps.at(-1)!.t).toBe(START + 3 * DAY - HOUR)
  })

  test('an hour with no value for one thing is left out of that line only', () => {
    const gap = START + 10 * HOUR
    const patchy = loaded(
      hourly(FIRST, 185, (hour) => {
        if (hour.t === gap) hour.tempF = null
      }),
    )
    const view = weatherView(patchy, day(0), NOW, NOW)
    expect(view.temp.series[0].points.map((point) => point.t)).not.toContain(
      gap,
    )
    expect(view.temp.series[0].points).toHaveLength(18)
    expect(view.wind.arrows.map((arrow) => arrow.t)).toContain(gap + HOUR / 2)
  })

  test('the wind is an arrow per hour, at the middle of the hour, at its speed, pointing where it goes', () => {
    const view = weatherView(week, day(0), NOW, NOW)
    expect(view.wind.arrows).toHaveLength(19)
    // A wind from the west (270) points right (90).
    expect(view.wind.arrows[0]).toEqual({
      t: FIRST + HOUR / 2,
      v: 9,
      angle: 90,
    })
    expect(view.wind.arrows.at(-1)!.t).toBe(END - HOUR / 2)
    expect(view.temp.arrows).toEqual([])
    expect(view.sky.arrows).toEqual([])
  })

  test('a calm hour is a dot, and so is an hour with no direction', () => {
    const calmAtTen = START + 10 * HOUR
    const blindAtEleven = START + 11 * HOUR
    const patchy = loaded(
      hourly(FIRST, 185, (hour) => {
        if (hour.t === calmAtTen) hour.windMph = 0.3
        if (hour.t === blindAtEleven) hour.windDeg = null
      }),
    )
    const arrows = weatherView(patchy, day(0), NOW, NOW).wind.arrows
    expect(arrows.find((a) => a.t === calmAtTen + HOUR / 2)).toEqual({
      t: calmAtTen + HOUR / 2,
      v: 0.3,
      angle: null,
    })
    expect(arrows.find((a) => a.t === blindAtEleven + HOUR / 2)).toEqual({
      t: blindAtEleven + HOUR / 2,
      v: 9,
      angle: null,
    })
  })

  test('an hour with no speed has no arrow', () => {
    const noSpeed = START + 12 * HOUR
    const patchy = loaded(
      hourly(FIRST, 185, (hour) => {
        if (hour.t === noSpeed) hour.windMph = null
      }),
    )
    const view = weatherView(patchy, day(0), NOW, NOW)
    expect(view.wind.arrows).toHaveLength(18)
    expect(view.wind.arrows.map((a) => a.t)).not.toContain(noSpeed + HOUR / 2)
    // The gust line and the range do not change.
    expect(view.wind.series[0].points).toHaveLength(19)
    expect(view.wind.bounds).toEqual([0, 20])
  })

  test('a gust that does not stand out from the wind is left off the staircase and has no dot, but still counts in the range', () => {
    // 3 PM, the hour under the cursor: 34 over 30 reaches neither bar, and
    // is the day's highest gust. 4 PM: 30 over 20 does. 5 PM: 26 over 20
    // does, by 5 mph or more.
    const three = START + 15 * HOUR
    const quiet = loaded(
      hourly(FIRST, 185, (hour) => {
        if (hour.t === three) {
          hour.windMph = 30
          hour.gustMph = 34
        }
        if (hour.t === three + HOUR) {
          hour.windMph = 20
          hour.gustMph = 30
        }
        if (hour.t === three + 2 * HOUR) {
          hour.windMph = 20
          hour.gustMph = 26
        }
      }),
    )
    const view = weatherView(quiet, day(0), NOW, NOW)
    const gusts = view.wind.series[0].points
    expect(gusts).toHaveLength(18)
    expect(gusts.map((point) => point.t)).not.toContain(three)
    expect(gusts.find((point) => point.t === three + HOUR)).toEqual({
      t: three + HOUR,
      v: 30,
    })
    expect(gusts.find((point) => point.t === three + 2 * HOUR)).toEqual({
      t: three + 2 * HOUR,
      v: 26,
    })
    expect(view.wind.readout).toEqual([{ key: 'wind', text: '30 mph from W' }])
    expect(view.wind.dots).toEqual([{ name: 'wind', v: 30 }])
    // The arrow is drawn whatever the gust.
    expect(view.wind.arrows.find((a) => a.t === three + HOUR / 2)).toEqual({
      t: three + HOUR / 2,
      v: 30,
      angle: 90,
    })
    // The range still reaches the hidden gust's height, so it does not jump.
    expect(view.wind.bounds).toEqual([0, 40])
  })

  test('one vertical range for every day, on round numbers', () => {
    const afternoon = START + 3 * DAY + 15 * HOUR
    const stormy = loaded(
      hourly(FIRST, 185, (hour) => {
        // A hot and blustery afternoon three days on.
        if (hour.t === afternoon) {
          hour.gustMph = 23
          hour.tempF = 91
        }
      }),
    )
    // Today itself has gusts of 12 and temperatures from 55 to 73.
    const view = weatherView(stormy, day(0), NOW, NOW)
    expect(view.wind.bounds).toEqual([0, 30])
    expect(view.temp.bounds).toEqual([50, 100])
    expect(view.sky.bounds).toEqual([0, 100])
  })

  test('the wind range starts at zero even when it never drops that low', () => {
    const breezy = loaded(
      hourly(FIRST, 185, (hour) => {
        hour.windMph = 14
        hour.gustMph = 18
      }),
    )
    expect(weatherView(breezy, day(0), NOW, NOW).wind.bounds).toEqual([0, 20])
  })

  test('each panel is named, has a rule every so often with its unit, and draws staircases', () => {
    const view = weatherView(week, day(0), NOW, NOW)
    expect([view.wind.title, view.temp.title, view.sky.title]).toEqual([
      'Wind',
      'Temperature',
      'Sky',
    ])
    expect(view.sky.rules).toEqual([
      { v: 0, label: '0%' },
      { v: 50, label: '50%' },
      { v: 100, label: '100%' },
    ])
    expect(view.wind.rules).toEqual([
      { v: 0, label: '0 mph' },
      { v: 10, label: '10 mph' },
      { v: 20, label: '20 mph' },
    ])
    expect(view.temp.rules[0]).toEqual({ v: 50, label: '50°F' })
    const all = [...view.wind.series, ...view.temp.series, ...view.sky.series]
    expect(all.every((series) => series.step === HOUR)).toBe(true)
  })

  test('a panel that is not drawn still has its name and its rules, so the layout does not depend on data', () => {
    const view = weatherView(loaded(null, 'unavailable'), day(0), NOW, NOW)
    expect(view.temp.title).toBe('Temperature')
    expect(view.sky.rules).toHaveLength(3)
  })
})

describe('what is read out', () => {
  test('the forecast hour that contains the cursor', () => {
    const view = weatherView(week, day(0), NOW, NOW)
    expect(view.wind.readout).toEqual([
      { key: 'wind', text: '9 mph from W' },
      { key: 'gust', text: 'gusts 12' },
    ])
    // 3:36 PM is in the 3 PM hour.
    expect(view.temp.readout).toEqual([{ key: 'temp', text: '65°F' }])
    expect(view.sky.readout).toEqual([
      { key: 'cloud', text: '3% cloud' },
      { key: 'rain', text: '0% rain' },
    ])
  })

  test('a dot for each value that hour has', () => {
    const view = weatherView(week, day(0), NOW, NOW)
    expect(view.wind.dots).toEqual([
      { name: 'wind', v: 9 },
      { name: 'gust', v: 12 },
    ])
    expect(view.temp.dots).toEqual([{ name: 'temp', v: 65 }])
    expect(view.sky.dots).toEqual([
      { name: 'cloud', v: 3 },
      { name: 'rain', v: 0 },
    ])
  })

  test('says it all in one run of words, naming each panel, for a screen reader', () => {
    expect(weatherView(week, day(0), NOW, NOW).words).toBe(
      'Wind: 9 mph from W, gusts 12; Temperature: 65°F; Sky: 3% cloud, 0% rain',
    )
  })

  test('a panel with nothing to say is still named, so the words are not left hanging', () => {
    const patchy = loaded(
      hourly(FIRST, 185, (hour) => {
        hour.tempF = null
      }),
    )
    expect(weatherView(patchy, day(0), NOW, NOW).words).toBe(
      'Wind: 9 mph from W, gusts 12; Temperature: No forecast here; Sky: 3% cloud, 0% rain',
    )
  })

  test('where no panel has anything to say, the run of words says so once', () => {
    const view = weatherView(week, day(0), START + 3 * HOUR, NOW)
    expect(view.words).toBe('No forecast here')
  })

  test('at the right-hand edge it reads the last hour drawn, not the next day', () => {
    // The cursor can sit on the midnight that ends the day.
    const view = weatherView(week, day(0), END, NOW)
    // 11 PM is 73 degrees. The midnight after it is 50.
    expect(view.temp.readout).toEqual([{ key: 'temp', text: '73°F' }])
    expect(view.temp.dots).toEqual([{ name: 'temp', v: 73 }])
  })

  test('before the forecast starts it says so, and has no dots', () => {
    const view = weatherView(week, day(0), START + 3 * HOUR, NOW)
    const nothing = [{ key: null, text: 'No forecast here' }]
    expect(view.wind.readout).toEqual(nothing)
    expect(view.temp.readout).toEqual(nothing)
    expect(view.sky.readout).toEqual(nothing)
    expect(view.wind.dots).toEqual([])
  })

  test('an hour with only some values reads out those, and says so for a panel with none', () => {
    const patchy = loaded(
      hourly(FIRST, 185, (hour) => {
        hour.tempF = null
        hour.gustMph = null
      }),
    )
    const view = weatherView(patchy, day(0), NOW, NOW)
    expect(view.temp.readout).toEqual([{ key: null, text: 'No forecast here' }])
    expect(view.temp.dots).toEqual([])
    expect(view.wind.readout).toEqual([{ key: 'wind', text: '9 mph from W' }])
    expect(view.wind.dots).toEqual([{ name: 'wind', v: 9 }])
  })
})

describe('when the panels are not drawn', () => {
  const blank = (view: ReturnType<typeof weatherView>) =>
    [view.wind, view.temp, view.sky].every(
      (panel) =>
        panel.dots.length === 0 &&
        panel.arrows.length === 0 &&
        panel.series.every((series) => series.points.length === 0),
    )

  test('nothing saved and a request on its way: loading', () => {
    const view = weatherView(loaded(null, 'loading'), day(0), NOW, NOW)
    expect(view.notice).toBe('Loading forecast')
    expect(blank(view)).toBe(true)
  })

  test('nothing saved and the request failed: unavailable', () => {
    const view = weatherView(loaded(null, 'unavailable'), day(0), NOW, NOW)
    expect(view.notice).toBe('Forecast unavailable')
  })

  test('a day past the end of the forecast says so', () => {
    const view = weatherView(week, day(8), NOW, NOW)
    expect(view.notice).toBe('No forecast this far out.')
    expect(view.words).toBe('No forecast this far out.')
    expect(blank(view)).toBe(true)
  })

  test('the last day counts as inside the forecast when it reaches the hour of sunset', () => {
    // The forecast ends with the 9 PM hour on 15 October. Sunset is 6:34 PM.
    expect(weatherView(week, day(7), NOW, NOW).notice).toBeNull()
  })

  test('a missing record at the hour of sunset, with the forecast running on past it, is a gap and not the end', () => {
    const sunsetHour = START + 2 * DAY + 18 * HOUR
    const holed = loaded(
      hourly(FIRST, 185).filter((hour) => hour.t !== sunsetHour),
    )
    const view = weatherView(holed, day(2), NOW, NOW)
    expect(view.notice).toBeNull()
    expect(view.temp.series[0].points).toHaveLength(23)
  })

  test('the last day counts as inside when the last record is the very hour of sunset', () => {
    // 182 hours from 5 AM: the last record is for 6 PM on 15 October, the
    // hour that the 6:34 PM sunset falls in.
    const exact = loaded(hourly(FIRST, 182))
    expect(weatherView(exact, day(7), NOW, NOW).notice).toBeNull()
  })

  test('the last day counts as past the end when the forecast stops before the hour of sunset', () => {
    // 181 hours from 5 AM: the last record is for 5 PM on 15 October.
    const shorter = loaded(hourly(FIRST, 181))
    const view = weatherView(shorter, day(7), NOW, NOW)
    expect(view.notice).toBe('No forecast this far out.')
    expect(blank(view)).toBe(true)
  })

  test('today keeps its panels after sunset, when a new forecast starts later than sunset did', () => {
    // 9 PM, and NWS has just issued a forecast whose first hour is 8 PM.
    const evening = START + 21 * HOUR
    const late = loaded(hourly(START + 20 * HOUR, 185))
    const view = weatherView(late, day(0), evening, evening)
    expect(view.notice).toBeNull()
    expect(view.temp.series[0].points).toHaveLength(4)
  })

  test('today keeps its panels while a saved forecast has any of today left, even short of sunset', () => {
    // It is 3:36 PM, and the saved forecast stops with the 3 PM hour.
    const nearlyOut = loaded(hourly(START, 16), 'stale')
    const view = weatherView(nearlyOut, day(0), NOW, NOW)
    expect(view.notice).toBeNull()
    expect(view.temp.series[0].points).toHaveLength(16)
    expect(view.temp.readout).toEqual([{ key: 'temp', text: '65°F' }])
  })

  test('once its last hour is over, it has wholly passed', () => {
    const nearlyOut = loaded(hourly(START, 16), 'stale')
    const four = START + 16 * HOUR
    expect(weatherView(nearlyOut, day(0), four, four).notice).toBe(
      'Forecast unavailable',
    )
  })

  test('a saved forecast that has wholly passed, with no way to refresh it: unavailable', () => {
    // Saved ten days ago. Its last hour was two days ago.
    const old = loaded(hourly(FIRST - 10 * DAY, 185), 'stale')
    const view = weatherView(old, day(0), NOW, NOW)
    expect(view.notice).toBe('Forecast unavailable')
    expect(blank(view)).toBe(true)
  })

  test('a saved forecast that has wholly passed, with a request on its way: loading', () => {
    const old = loaded(hourly(FIRST - 10 * DAY, 185), 'loading')
    expect(weatherView(old, day(0), NOW, NOW).notice).toBe('Loading forecast')
  })

  test('where the sun does not set, the middle of the day decides', () => {
    // The week's forecast ends with the 9 PM hour on 15 October, past that
    // day's midday. One that ends with its 8 AM hour stops short of it.
    const morning = loaded(hourly(FIRST, 172))
    expect(weatherView(week, day(7, null), NOW, NOW).notice).toBeNull()
    expect(weatherView(morning, day(7, null), NOW, NOW).notice).toBe(
      'No forecast this far out.',
    )
    expect(weatherView(morning, day(6, null), NOW, NOW).notice).toBeNull()
  })
})

describe('forecastHours', () => {
  test('the hours of the forecast, while any of it is still to come', () => {
    expect(forecastHours(week, NOW)).toHaveLength(185)
  })

  test('none once its last hour is over, to the minute', () => {
    // The last record is for the 184th hour from 5 AM. It is over an hour on.
    const over = FIRST + 185 * HOUR
    expect(forecastHours(week, over)).toEqual([])
    expect(forecastHours(week, over - MINUTE)).toHaveLength(185)
  })

  test('none with nothing saved', () => {
    expect(forecastHours(loaded(null, 'loading'), NOW)).toEqual([])
  })
})

/** Observed rows from midnight to the hour containing `until`, one an hour. */
function observed(
  until: number,
  change: (hour: ObservedHour) => void = () => {},
): ObservedHour[] {
  const rows: ObservedHour[] = []
  for (let t = START; t <= until; t += HOUR) {
    const row: ObservedHour = {
      t,
      tempF: 60 + (((t - START) / HOUR) % 24),
      windMph: 5,
      gustMph: null,
      windDeg: 180,
      sky: 'scattered',
    }
    change(row)
    rows.push(row)
  }
  return rows
}

describe('today with a station', () => {
  // NOW is 3:36 PM: fifteen hours have ended, and 3 PM is the current hour.
  const rows = observed(NOW)

  test('each value has an observed staircase up to now and the forecast after, with the current hour cut at the line', () => {
    const view = weatherView(week, day(0), NOW, NOW, rows)
    expect(view.temp.series.map((series) => series.name)).toEqual([
      'temp-observed',
      'temp',
    ])
    const [obs, fc] = view.temp.series
    expect(obs.points).toHaveLength(16)
    expect(obs.points[0]).toEqual({ t: START, v: 60 })
    expect(obs.points[15].t).toBe(START + 15 * HOUR)
    expect(obs.cut).toEqual({ at: NOW, keep: 'before' })
    // The forecast runs from 5 AM, but its hours up to 2 PM are covered by
    // rows. The current hour, 3 PM, is in both: observed to the line, forecast after.
    expect(fc.points[0].t).toBe(START + 15 * HOUR)
    expect(fc.points).toHaveLength(9)
    expect(fc.cut).toEqual({ at: NOW, keep: 'after' })
  })

  test('an hour gone by with no row shows the forecast for it, whole, and the forecast of the current hour is whole where there is no row for it', () => {
    const patchy = rows.filter(
      (row) => row.t !== START + 10 * HOUR && row.t !== START + 15 * HOUR,
    )
    const [obs, fc] = weatherView(week, day(0), NOW, NOW, patchy).temp.series
    expect(obs.points.map((point) => point.t)).not.toContain(START + 10 * HOUR)
    expect(fc.points.map((point) => point.t)).toContain(START + 10 * HOUR)
    expect(fc.cut).toBeUndefined()
  })

  test('a value a row lacks is filled from the forecast for that hour, worded and drawn as forecast', () => {
    const blind = observed(NOW, (row) => {
      if (row.t === START + 12 * HOUR) row.tempF = null
    })
    const [obs, fc] = weatherView(week, day(0), NOW, NOW, blind).temp.series
    expect(obs.points.map((point) => point.t)).not.toContain(START + 12 * HOUR)
    expect(fc.points.find((point) => point.t === START + 12 * HOUR)).toEqual({
      t: START + 12 * HOUR,
      v: 62,
    })
  })

  test("an observed sky is drawn at the middle of its category's range, and the rain stays forecast all day", () => {
    const view = weatherView(week, day(0), NOW, NOW, rows)
    expect(view.sky.series.map((series) => series.name)).toEqual([
      'cloud-observed',
      'cloud',
      'rain',
    ])
    expect(view.sky.series[0].points[0]).toEqual({ t: START, v: 44 })
    // Rain from 5 AM, as the forecast has it, uncut.
    expect(view.sky.series[2].points[0].t).toBe(FIRST)
    expect(view.sky.series[2].points).toHaveLength(19)
    expect(view.sky.series[2].cut).toBeUndefined()
  })

  test('a row with no sky leaves the forecast cloud for that hour', () => {
    const noSky = observed(NOW, (row) => {
      row.sky = null
    })
    const view = weatherView(week, day(0), NOW, NOW, noSky)
    expect(view.sky.series[0].points).toEqual([])
    expect(view.sky.series[1].points).toHaveLength(19)
    expect(view.sky.series[1].cut).toBeUndefined()
  })

  test('observed gusts go by the gust rule, and an hour with a row and no gust has no gust from the forecast either', () => {
    const gusty = observed(NOW, (row) => {
      if (row.t === START + 8 * HOUR) row.gustMph = 12 // 12 over 5 stands out.
      if (row.t === START + 9 * HOUR) row.gustMph = 6 // 6 over 5 does not.
    })
    const view = weatherView(week, day(0), NOW, NOW, gusty)
    expect(view.wind.series.map((series) => series.name)).toEqual([
      'gust-observed',
      'gust',
    ])
    expect(view.wind.series[0].points).toEqual([{ t: START + 8 * HOUR, v: 12 }])
    // The forecast's gust of 12 is not drawn for any hour gone by that has a
    // row, and in the current hour only right of the line.
    expect(view.wind.series[1].points[0].t).toBe(START + 15 * HOUR)
    expect(view.wind.series[1].cut).toEqual({ at: NOW, keep: 'after' })
  })

  test('observed hours have solid arrows, at their own speed, and the current hour is observed where it has a row', () => {
    const view = weatherView(week, day(0), NOW, NOW, rows)
    const arrows = view.wind.arrows
    const at = (t: number) => arrows.find((arrow) => arrow.t === t + HOUR / 2)
    // A south wind (180) points up (0).
    expect(at(START)).toEqual({
      t: START + HOUR / 2,
      v: 5,
      angle: 0,
      observed: true,
    })
    expect(at(START + 15 * HOUR)?.observed).toBe(true)
    expect(at(START + 16 * HOUR)).toEqual({
      t: START + 16 * HOUR + HOUR / 2,
      v: 9,
      angle: 90,
    })
    // One arrow per hour: midnight to 11 PM.
    expect(arrows).toHaveLength(24)
  })

  test('the ranges take the observed values in', () => {
    const hot = observed(NOW, (row) => {
      row.tempF = 95
      row.windMph = 31
    })
    const view = weatherView(week, day(0), NOW, NOW, hot)
    expect(view.temp.bounds).toEqual([50, 100])
    expect(view.wind.bounds).toEqual([0, 40])
    expect(weatherView(week, day(1), NOW, NOW, hot).temp.bounds).toEqual([
      50, 100,
    ])
  })

  test("in the first half of the current hour its arrow is the forecast's, right of the line", () => {
    const now = START + 15 * HOUR + 10 * 60_000
    const view = weatherView(week, day(0), now, now, observed(now))
    const arrows = view.wind.arrows
    expect(
      arrows.find((arrow) => arrow.t === START + 15 * HOUR + HOUR / 2),
    ).toEqual({ t: START + 15 * HOUR + HOUR / 2, v: 9, angle: 90 })
    expect(
      arrows.find((arrow) => arrow.t === START + 14 * HOUR + HOUR / 2)
        ?.observed,
    ).toBe(true)
  })

  test('with the current time exactly on the hour, the new hour is the forecast whole, and the observed side stops at the line', () => {
    const now = START + 15 * HOUR
    const view = weatherView(week, day(0), now, now, observed(now))
    expect(view.temp.series[0].cut).toEqual({ at: now, keep: 'before' })
    expect(view.temp.series[1].points[0].t).toBe(START + 15 * HOUR)
    expect(view.temp.series[1].cut).toEqual({ at: now, keep: 'after' })
    const arrow = view.wind.arrows.find(
      (a) => a.t === START + 15 * HOUR + HOUR / 2,
    )
    expect(arrow?.observed).toBeUndefined()
  })

  test('a row without the wind speed reads the forecast wind and its own gust, if any', () => {
    const cursor = START + 14 * HOUR + 30 * 60_000
    const gust = (gustMph: number | null) =>
      observed(NOW, (row) => {
        if (row.t === START + 14 * HOUR) {
          row.windMph = null
          row.windDeg = null
          row.gustMph = gustMph
        }
      })
    expect(
      partsText(weatherView(week, day(0), cursor, NOW, gust(15)).wind.readout),
    ).toBe('9 mph from W, forecast; gusts 15 mph, observed')
    expect(
      partsText(
        weatherView(week, day(0), cursor, NOW, gust(null)).wind.readout,
      ),
    ).toBe('9 mph from W, forecast')
  })

  test('on another day the rows are ignored', () => {
    const view = weatherView(week, day(1), NOW, NOW, rows)
    expect(view.temp.series.map((series) => series.name)).toEqual(['temp'])
    expect(view.temp.series[0].cut).toBeUndefined()
    expect(
      view.wind.arrows.every((arrow) => arrow.observed === undefined),
    ).toBe(true)
  })

  test('with rows and no forecast at all, today is drawn from the rows alone', () => {
    const view = weatherView(
      loaded(null, 'unavailable'),
      day(0),
      NOW,
      NOW,
      rows,
    )
    expect(view.notice).toBeNull()
    expect(view.temp.series[0].points).toHaveLength(16)
    expect(view.temp.series[1].points).toEqual([])
  })
})
