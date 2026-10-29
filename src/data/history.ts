// The shapes of the forecast record and the arithmetic on them: which place
// a spot is recorded as, which forecast hours count as a forecast, which
// observed hours have ended, and how long an unneeded place is kept. Plain
// functions, free of the DOM and of Firebase, so a Node script can import
// them.

import type { Forecast, ForecastHour } from './nws.ts'
import type { ObservedHour } from './observed.ts'
import type { WeatherStation } from './nwsStations.ts'
import { chooseStation } from './weatherRule.ts'
import type { Spot } from '../spot.ts'
import { DAY, HOUR } from '../time.ts'

/** What a record is kept under: a forecast cell and the station that serves it. */
export interface PlaceKey {
  office: string
  gridX: number
  gridY: number
  stationId: string
}

export interface Place extends PlaceKey {
  stationName: string
  /** The spot's own, so days are cut where the spot's days are. */
  timeZone: string
}

/** A place's bookkeeping document. Times are epoch ms. */
export interface PlaceDoc extends Place {
  firstWrite: number
  lastWrite: number
  /** The `updatedAt` of the latest forecast kept, or null before the first. */
  lastIssued: number | null
  /** When a saved spot last needed this place. */
  lastNeeded: number
}

/** One issue of a cell's forecast. */
export interface IssuedDoc {
  issuedAt: number
  hours: ForecastHour[]
}

/** A station's ended hours for one local day. */
export interface ObservedDoc {
  date: string
  hours: ObservedHour[]
}

/** How long a place is still recorded after no saved spot needs it. */
export const KEEP_UNNEEDED = 30 * DAY

export function placeId(key: PlaceKey): string {
  return `${key.office}-${key.gridX}-${key.gridY}-${key.stationId}`
}

/**
 * The place a spot is recorded as, or null where no weather station serves
 * it. The height is the spot's own where known, else its cell's average.
 */
export function placeOf(spot: Spot, stations: WeatherStation[]): Place | null {
  const height = spot.elevationFt ?? spot.nws.elevationFt
  const { serves } = chooseStation(spot, height, stations)
  if (serves === null) return null
  return {
    office: spot.nws.office,
    gridX: spot.nws.gridX,
    gridY: spot.nws.gridY,
    stationId: serves.id,
    stationName: serves.name,
    timeZone: spot.timeZone,
  }
}

/** The places once each, by id; the first of equal ones wins. */
export function uniquePlaces(places: Place[]): Place[] {
  const seen = new Set<string>()
  const out: Place[] = []
  for (const place of places) {
    const id = placeId(place)
    if (seen.has(id)) continue
    seen.add(id)
    out.push(place)
  }
  return out
}

/**
 * A forecast as kept. The grid starts about 6½ hours before NWS issued it,
 * and those hours are not a forecast, so only hours from an hour before the
 * issue on are kept.
 */
export function trimIssued(forecast: Forecast): IssuedDoc {
  return {
    issuedAt: forecast.updatedAt,
    hours: forecast.hours.filter((h) => h.t >= forecast.updatedAt - HOUR),
  }
}

/** The rows whose hour has ended by `now`. */
export function endedHours(hours: ObservedHour[], now: number): ObservedHour[] {
  return hours.filter((h) => h.t + HOUR <= now)
}

/** Whether a place is still recorded: needed within `KEEP_UNNEEDED` of `now`. */
export function stillRecorded(doc: PlaceDoc, now: number): boolean {
  return now - doc.lastNeeded <= KEEP_UNNEEDED
}
