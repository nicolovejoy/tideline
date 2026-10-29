import { describe, expect, test } from 'vitest'
import { YESTERDAY_UNTIL, recordOnce } from './recorder.ts'
import type { RecorderFetch, RecorderStore } from './recorder.ts'
import { KEEP_UNNEEDED } from './history.ts'
import type { IssuedDoc, ObservedDoc, PlaceDoc } from './history.ts'
import { toDoc } from './accountDoc.ts'
import { parseStations } from './nwsStations.ts'
import type { WeatherStation } from './nwsStations.ts'
import { parseGridpoint } from './nws.ts'
import { parseObservations } from './nwsObservations.ts'
import type { Report } from './nwsObservations.ts'
import { REPORT_WITHIN } from './observed.ts'
import { CAMPUS_POINT } from '../spot.ts'
import type { Spot } from '../spot.ts'
import { DAY, HOUR } from '../time.ts'
import stationsRaw from './__fixtures__/nws-stations-LOX-100-71.json?raw'
import gridRaw from './__fixtures__/nws-gridpoint-LOX-100-71.json?raw'
import ksbaRaw from './__fixtures__/nws-observations-KSBA.json?raw'

const stationList = parseStations(JSON.parse(stationsRaw))
const forecast = parseGridpoint(JSON.parse(gridRaw))
const reports = parseObservations(JSON.parse(ksbaRaw))
// The fixture's reports run 16:30 to 17:40 UTC on 2026-10-13, which is the
// morning of that day in Santa Barbara.
const NOW = Date.parse('2026-10-13T17:40:00Z')
const CAMPUS_ID = 'LOX-100-71-KSBA'

// A second place: a spot in another cell with its own station right on it.
const other: Spot = {
  ...CAMPUS_POINT,
  id: 'other',
  name: 'Other',
  nws: { office: 'LOX', gridX: 50, gridY: 50, elevationFt: 10 },
  elevationFt: 10,
}
const otherStation: WeatherStation = {
  id: 'KXXX',
  name: 'Other Field',
  lat: other.lat,
  lon: other.lon,
  elevationFt: 10,
}

interface Rig {
  store: RecorderStore
  net: RecorderFetch
  places: Map<string, PlaceDoc>
  issued: [string, IssuedDoc][]
  observed: [string, ObservedDoc][]
  fetched: string[]
  /** The `start` of each observations request. */
  starts: number[]
}

function rig(
  docs: unknown[] = [],
  options: {
    updatedAt?: number
    stored?: PlaceDoc[]
    failForecast?: string
    failStations?: string
    reports?: Report[]
  } = {},
): Rig {
  const places = new Map<string, PlaceDoc>()
  for (const doc of options.stored ?? []) {
    places.set(`${doc.office}-${doc.gridX}-${doc.gridY}-${doc.stationId}`, doc)
  }
  const r: Rig = {
    places,
    issued: [],
    observed: [],
    fetched: [],
    starts: [],
    store: {
      accountDocs: async () => docs,
      places: async () => [...places.values()],
      writePlace: async (id, doc) => void places.set(id, doc),
      writeIssued: async (id, doc) => void r.issued.push([id, doc]),
      writeObserved: async (id, doc) => void r.observed.push([id, doc]),
    },
    net: {
      stations: async (office, x, y) => {
        if (`${office}-${x}-${y}` === options.failStations) {
          throw new Error('stations down')
        }
        return x === 50 ? [otherStation] : stationList
      },
      forecast: async (office, x, y) => {
        r.fetched.push(`${office}-${x}-${y}`)
        if (`${office}-${x}-${y}` === options.failForecast) {
          throw new Error('forecast down')
        }
        return {
          ...forecast,
          updatedAt: options.updatedAt ?? forecast.updatedAt,
        }
      },
      observations: async (stationId, start) => {
        r.starts.push(start)
        return stationId === 'KSBA' ? (options.reports ?? reports) : []
      },
    },
  }
  return r
}

describe('recordOnce', () => {
  test("records Campus Point's place from the starting spots alone", async () => {
    const r = rig()
    const result = await recordOnce(r.store, r.net, NOW)
    expect(result.recorded).toEqual([CAMPUS_ID])
    expect(result.failed).toEqual([])
    expect(result.failedCells).toBe(0)
    expect(r.issued).toHaveLength(1)
    expect(r.observed.map(([, d]) => d.date)).toEqual(['2026-10-13'])
    const doc = r.places.get(CAMPUS_ID)
    expect(doc?.firstWrite).toBe(NOW)
    expect(doc?.lastNeeded).toBe(NOW)
    expect(doc?.lastIssued).toBe(forecast.updatedAt)
  })

  test('the same issuance is not written twice', async () => {
    const r = rig()
    await recordOnce(r.store, r.net, NOW)
    await recordOnce(r.store, r.net, NOW + HOUR)
    expect(r.issued).toHaveLength(1)
    expect(r.places.get(CAMPUS_ID)?.firstWrite).toBe(NOW)
    expect(r.places.get(CAMPUS_ID)?.lastWrite).toBe(NOW + HOUR)
  })

  test('a place in two accounts is recorded once', async () => {
    const doc = toDoc([other])
    const r = rig([doc, doc])
    const result = await recordOnce(r.store, r.net, NOW)
    expect(result.recorded.sort()).toEqual([CAMPUS_ID, 'LOX-50-50-KXXX'].sort())
    expect(r.issued.filter(([id]) => id === 'LOX-50-50-KXXX')).toHaveLength(1)
  })

  test('a forecast failure for one place leaves the others recorded', async () => {
    const r = rig([toDoc([other])], { failForecast: 'LOX-50-50' })
    const result = await recordOnce(r.store, r.net, NOW)
    expect(result.recorded).toEqual([CAMPUS_ID])
    expect(result.failed.map((f) => f.id)).toEqual(['LOX-50-50-KXXX'])
    expect(r.places.has('LOX-50-50-KXXX')).toBe(false)
  })

  test('a cell whose station list fails is reported and skipped', async () => {
    const r = rig([toDoc([other])], { failStations: 'LOX-50-50' })
    const result = await recordOnce(r.store, r.net, NOW)
    expect(result.recorded).toEqual([CAMPUS_ID])
    expect(result.failed).toEqual([])
    expect(result.failedCells).toBe(1)
  })

  test('the hour in progress is not written', async () => {
    const r = rig()
    // 10:30 in Santa Barbara; the fixture's reports end at 10:40 local.
    await recordOnce(r.store, r.net, Date.parse('2026-10-13T17:30:00Z'))
    const [, today] = r.observed[0]
    expect(today.hours.length).toBeGreaterThan(0)
    const lastStart = Math.max(...today.hours.map((h) => h.t))
    expect(lastStart + HOUR).toBeLessThanOrEqual(
      Date.parse('2026-10-13T17:30:00Z'),
    )
    expect(today.hours.map((h) => h.t)).not.toContain(
      Date.parse('2026-10-13T17:00:00Z'),
    )
  })

  test('a place not needed for 31 days is not fetched; at 29 days it is', async () => {
    const old = (days: number): PlaceDoc => ({
      office: 'LOX',
      gridX: 1,
      gridY: 2,
      stationId: 'KOLD',
      stationName: 'Old',
      timeZone: 'America/Los_Angeles',
      firstWrite: 0,
      lastWrite: NOW - days * DAY,
      lastIssued: null,
      lastNeeded: NOW - days * DAY,
    })
    expect(KEEP_UNNEEDED).toBe(30 * DAY)
    const stale = rig([], { stored: [old(31)] })
    await recordOnce(stale.store, stale.net, NOW)
    expect(stale.fetched).not.toContain('LOX-1-2')
    expect(stale.places.has('LOX-1-2-KOLD')).toBe(true)

    const fresh = rig([], { stored: [old(29)] })
    const result = await recordOnce(fresh.store, fresh.net, NOW)
    expect(fresh.fetched).toContain('LOX-1-2')
    expect(result.recorded).toContain('LOX-1-2-KOLD')
    expect(fresh.places.get('LOX-1-2-KOLD')?.lastNeeded).toBe(NOW - 29 * DAY)
  })

  test('an account document that is not a list is ignored', async () => {
    const r = rig([null, 'x', { spots: 5 }, {}])
    const result = await recordOnce(r.store, r.net, NOW)
    expect(result.recorded).toEqual([CAMPUS_ID])
    expect(result.failed).toEqual([])
  })

  test('an older forecast than the last issue is not written and keeps lastIssued', async () => {
    const first = rig()
    await recordOnce(first.store, first.net, NOW)
    const stored = first.places.get(CAMPUS_ID)!
    const r = rig([], {
      stored: [stored],
      updatedAt: forecast.updatedAt - HOUR,
    })
    await recordOnce(r.store, r.net, NOW + HOUR)
    expect(r.issued).toEqual([])
    expect(r.places.get(CAMPUS_ID)?.lastIssued).toBe(forecast.updatedAt)
  })

  describe('observed days', () => {
    // Santa Barbara is UTC-7 in October: 13 October starts at 07:00 UTC.
    const day13 = Date.parse('2026-10-13T07:00:00Z')
    const day14 = Date.parse('2026-10-14T07:00:00Z')
    const hourly: Report[] = []
    for (let t = day13; t <= day14 + 3 * HOUR; t += HOUR) {
      hourly.push({ ...reports[0], t })
    }

    test('late in the day only today is fetched and written', async () => {
      const r = rig([], { reports: hourly })
      // 11 PM on 13 October.
      await recordOnce(r.store, r.net, Date.parse('2026-10-14T06:00:00Z'))
      expect(r.starts).toEqual([day13 - REPORT_WITHIN])
      expect(r.observed.map(([, d]) => d.date)).toEqual(['2026-10-13'])
    })

    test('early in the day yesterday is fetched and written too', async () => {
      expect(YESTERDAY_UNTIL).toBe(6 * HOUR)
      const r = rig([], { reports: hourly })
      // 2 AM on 14 October.
      await recordOnce(r.store, r.net, Date.parse('2026-10-14T09:00:00Z'))
      expect(r.starts).toEqual([day13 - REPORT_WITHIN])
      const days = r.observed.map(([, d]) => d)
      expect(days.map((d) => d.date)).toEqual(['2026-10-13', '2026-10-14'])
      expect(days[0].hours).toHaveLength(24)
      expect(days[1].hours.map((h) => h.t)).toEqual([day14, day14 + HOUR])
    })
  })
})
