import { describe, expect, it } from 'vitest'
import {
  KEEP_UNNEEDED,
  endedHours,
  placeId,
  placeOf,
  stillRecorded,
  trimIssued,
  uniquePlaces,
} from './history.ts'
import type { Place, PlaceDoc } from './history.ts'
import type { ObservedHour } from './observed.ts'
import type { WeatherStation } from './nwsStations.ts'
import { CAMPUS_POINT } from '../spot.ts'
import { DAY, HOUR } from '../time.ts'

const KSBA: WeatherStation = {
  id: 'KSBA',
  name: 'Santa Barbara Municipal Airport',
  lat: 34.43,
  lon: -119.84,
  elevationFt: 10,
}

const key = { office: 'LOX', gridX: 100, gridY: 71, stationId: 'KSBA' }

function observed(t: number): ObservedHour {
  return {
    t,
    tempF: 60,
    dewF: 50,
    humidityPct: 70,
    windMph: 5,
    gustMph: null,
    windDeg: 90,
    sky: 'clear',
  }
}

describe('placeId', () => {
  it('joins the office, the cell and the station', () => {
    expect(placeId(key)).toBe('LOX-100-71-KSBA')
  })
})

describe('placeOf', () => {
  it('names the cell, the serving station and the time zone', () => {
    expect(placeOf(CAMPUS_POINT, [KSBA])).toEqual({
      ...key,
      stationName: KSBA.name,
      timeZone: 'America/Los_Angeles',
    })
  })

  it('is null where no station serves', () => {
    const far = { ...KSBA, lat: 34.7, lon: -119.84 }
    expect(placeOf(CAMPUS_POINT, [far])).toBeNull()
  })

  it('uses the cell height where the spot has none of its own', () => {
    const spot = { ...CAMPUS_POINT, elevationFt: null }
    expect(placeOf(spot, [KSBA])).not.toBeNull()
  })

  it('uses the spot own height when it has one', () => {
    const spot = { ...CAMPUS_POINT, elevationFt: 1200 }
    expect(placeOf(spot, [KSBA])).toBeNull()
  })
})

describe('uniquePlaces', () => {
  it('keeps the first of equal keys', () => {
    const a: Place = {
      ...key,
      stationName: 'A',
      timeZone: 'America/Los_Angeles',
    }
    const b: Place = {
      ...key,
      stationName: 'B',
      timeZone: 'America/Los_Angeles',
    }
    expect(uniquePlaces([a, b])).toEqual([a])
  })
})

describe('trimIssued', () => {
  it('drops hours more than an hour before the issue', () => {
    const updatedAt = Date.UTC(2026, 9, 29, 12)
    const hour = (t: number) => ({ t }) as never
    const issued = trimIssued({
      updatedAt,
      hours: [
        hour(updatedAt - 2 * HOUR),
        hour(updatedAt - HOUR / 2),
        hour(updatedAt),
        hour(updatedAt + HOUR),
      ],
    })
    expect(issued.issuedAt).toBe(updatedAt)
    expect(issued.hours.map((h) => h.t)).toEqual([
      updatedAt - HOUR / 2,
      updatedAt,
      updatedAt + HOUR,
    ])
  })
})

describe('endedHours', () => {
  it('keeps only hours that have ended', () => {
    const base = Date.UTC(2026, 9, 29, 9)
    const rows = [
      observed(base),
      observed(base + HOUR),
      observed(base + 2 * HOUR),
    ]
    const now = base + HOUR + HOUR / 2
    expect(endedHours(rows, now).map((r) => r.t)).toEqual([base])
  })
})

describe('stillRecorded', () => {
  const doc = { lastNeeded: 1_000_000 } as PlaceDoc
  it('holds for 30 days since last needed', () => {
    expect(stillRecorded(doc, 1_000_000 + KEEP_UNNEEDED)).toBe(true)
    expect(stillRecorded(doc, 1_000_000 + 30 * DAY + 1)).toBe(false)
  })
})
