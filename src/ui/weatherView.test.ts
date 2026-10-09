import { describe, expect, test } from 'vitest'
import type { Selected } from './selection.ts'
import { forecastHours, weatherView } from './weatherView.ts'
import type { Loaded } from '../data/load.ts'
import type { Forecast, ForecastHour } from '../data/nws.ts'

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
  test('one staircase per value, over the hours of the day on screen', () => {
    const view = weatherView(week, day(0), NOW, NOW)
    expect(view.notice).toBeNull()
    expect(view.wind.series.map((series) => series.name)).toEqual([
      'wind',
      'gust',
    ])
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
    expect(view.wind.series[1].points[0]).toEqual({ t: FIRST, v: 12 })
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
    expect(view.wind.series[0].points.map((point) => point.t)).toContain(gap)
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
      { key: 'wind', text: '9 mph' },
      { key: 'gust', text: 'gusts 12' },
      { key: null, text: 'from W' },
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
      'Wind: 9 mph, gusts 12, from W; Temperature: 65°F; Sky: 3% cloud, 0% rain',
    )
  })

  test('a panel with nothing to say is still named, so the words are not left hanging', () => {
    const patchy = loaded(
      hourly(FIRST, 185, (hour) => {
        hour.tempF = null
      }),
    )
    expect(weatherView(patchy, day(0), NOW, NOW).words).toBe(
      'Wind: 9 mph, gusts 12, from W; Temperature: No forecast here; Sky: 3% cloud, 0% rain',
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
    expect(view.wind.readout).toEqual([
      { key: 'wind', text: '9 mph' },
      { key: null, text: 'from W' },
    ])
    expect(view.wind.dots).toEqual([{ name: 'wind', v: 9 }])
  })
})

describe('when the panels are not drawn', () => {
  const blank = (view: ReturnType<typeof weatherView>) =>
    [view.wind, view.temp, view.sky].every(
      (panel) =>
        panel.dots.length === 0 &&
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
