// One run of the forecast recorder: which places are wanted, and for each the
// forecast issue and the station's ended hours to keep. The store and the
// fetchers are passed in, so a Node script wires the real ones and the tests
// wire fakes. Nothing here touches the DOM or Firebase.

import { toList } from './accountDoc.ts'
import type { Forecast } from './nws.ts'
import type { Report } from './nwsObservations.ts'
import type { WeatherStation } from './nwsStations.ts'
import { REPORT_WITHIN, observedHours } from './observed.ts'
import {
  endedHours,
  placeId,
  placeOf,
  stillRecorded,
  trimIssued,
  uniquePlaces,
} from './history.ts'
import type { IssuedDoc, ObservedDoc, Place, PlaceDoc } from './history.ts'
import { SPOTS } from '../spot.ts'
import type { Spot } from '../spot.ts'
import { HOUR, addDays, localDate, localDayStart } from '../time.ts'

export interface RecorderStore {
  /** Every `users/{uid}` document's data. */
  accountDocs(): Promise<unknown[]>
  places(): Promise<PlaceDoc[]>
  writePlace(id: string, doc: PlaceDoc): Promise<void>
  writeIssued(id: string, doc: IssuedDoc): Promise<void>
  writeObserved(id: string, doc: ObservedDoc): Promise<void>
}

export interface RecorderFetch {
  stations(
    office: string,
    gridX: number,
    gridY: number,
  ): Promise<WeatherStation[]>
  forecast(office: string, gridX: number, gridY: number): Promise<Forecast>
  observations(stationId: string, start: number): Promise<Report[]>
}

/**
 * Until this long into a place's day, yesterday is fetched and rewritten too,
 * so its last hours are kept. After it, today alone: a station that reports
 * every 5 minutes fills NWS's one page of 500 within two days.
 */
export const YESTERDAY_UNTIL = 6 * HOUR

export interface RunResult {
  recorded: string[]
  /** Places that failed, by id. */
  failed: { id: string; error: string }[]
  /** How many cells' station lists failed; cells are not named in the log. */
  failedCells: number
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** The starting spots and every spot in the accounts. */
async function allSpots(store: RecorderStore): Promise<Spot[]> {
  const spots = [...SPOTS]
  for (const data of await store.accountDocs()) {
    const list = toList(data)
    if (list !== null) spots.push(...list)
  }
  return spots
}

/** Records one place; throws if a step fails, before the place is written. */
async function recordPlace(
  store: RecorderStore,
  net: RecorderFetch,
  id: string,
  place: Place,
  stored: PlaceDoc | undefined,
  lastNeeded: number,
  now: number,
): Promise<void> {
  const { office, gridX, gridY, stationId, timeZone } = place
  let lastIssued = stored?.lastIssued ?? null
  const forecast = await net.forecast(office, gridX, gridY)
  if (forecast.updatedAt > (lastIssued ?? -Infinity)) {
    await store.writeIssued(id, trimIssued(forecast))
    lastIssued = forecast.updatedAt
  }

  // From half an hour before the first day, so its midnight hour can take a
  // report from before it, as the device does.
  const today = localDate(now, timeZone)
  const yesterday = addDays(today, -1)
  const days =
    now < localDayStart(today, timeZone) + YESTERDAY_UNTIL
      ? [yesterday, today]
      : [today]
  const reports = await net.observations(
    stationId,
    localDayStart(days[0], timeZone) - REPORT_WITHIN,
  )
  for (const date of days) {
    const span = {
      start: localDayStart(date, timeZone),
      end: localDayStart(addDays(date, 1), timeZone),
    }
    const hours = endedHours(observedHours(reports, span, now), now)
    if (hours.length > 0) await store.writeObserved(id, { date, hours })
  }

  await store.writePlace(id, {
    ...place,
    firstWrite: stored?.firstWrite ?? now,
    lastWrite: now,
    lastIssued,
    lastNeeded,
  })
}

export async function recordOnce(
  store: RecorderStore,
  net: RecorderFetch,
  now: number,
): Promise<RunResult> {
  const result: RunResult = { recorded: [], failed: [], failedCells: 0 }
  const spots = await allSpots(store)

  // Each cell's station list once; a cell that fails is skipped.
  const stationsByCell = new Map<string, WeatherStation[] | null>()
  const needed: Place[] = []
  for (const spot of spots) {
    const { office, gridX, gridY } = spot.nws
    const cell = `${office}-${gridX}-${gridY}`
    if (!stationsByCell.has(cell)) {
      try {
        stationsByCell.set(cell, await net.stations(office, gridX, gridY))
      } catch {
        stationsByCell.set(cell, null)
        result.failedCells += 1
      }
    }
    const stations = stationsByCell.get(cell)
    if (!stations) continue
    const place = placeOf(spot, stations)
    if (place !== null) needed.push(place)
  }

  // Wanted now, then the stored places still inside their keep.
  const todo = new Map<
    string,
    { place: Place; lastNeeded: number; stored?: PlaceDoc }
  >()
  const stored = new Map<string, PlaceDoc>()
  for (const doc of await store.places()) stored.set(placeId(doc), doc)
  for (const place of uniquePlaces(needed)) {
    const id = placeId(place)
    todo.set(id, { place, lastNeeded: now, stored: stored.get(id) })
  }
  for (const [id, doc] of stored) {
    if (!todo.has(id) && stillRecorded(doc, now)) {
      todo.set(id, { place: doc, lastNeeded: doc.lastNeeded, stored: doc })
    }
  }

  // One place at a time, to be polite to NWS.
  for (const [id, { place, lastNeeded, stored: doc }] of todo) {
    try {
      await recordPlace(store, net, id, place, doc, lastNeeded, now)
      result.recorded.push(id)
    } catch (error) {
      result.failed.push({ id, error: message(error) })
    }
  }
  return result
}
