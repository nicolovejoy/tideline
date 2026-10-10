// What a pin on the map becomes: the NWS cell and zone, the nearest
// stations, and whether the tide is shown to start with. The requests are
// handed in, so this can be tested without a network.

import { NwsOutsideError } from './nws.ts'
import type { NwsCell } from './nws.ts'
import { nearestStations } from './stations.ts'
import type { StationRow } from './stations.ts'
import type { Spot } from '../spot.ts'

/** Tides are shown to start with when the station is this near... */
export const TIDES_WITHIN_MI = 25
/** ...and the cell's average height is under this. */
export const TIDES_BELOW_FT = 300

/**
 * Distance alone is not enough: a 4,000 ft peak can be 6 mi from a
 * station. Elevation alone is not enough either: a lake shore is low and
 * hundreds of miles from any tide.
 */
export function defaultTidesShown(
  tideDistanceMi: number,
  cellElevationFt: number,
): boolean {
  return tideDistanceMi <= TIDES_WITHIN_MI && cellElevationFt < TIDES_BELOW_FT
}

/** Everything a spot has apart from what the user gives it. */
export type SpotFacts = Omit<Spot, 'id' | 'name'>

export interface ResolveIo {
  fetchPoints: (lat: number, lon: number) => Promise<NwsCell>
  fetchElevationFt: (
    office: string,
    gridX: number,
    gridY: number,
  ) => Promise<number>
  stations: StationRow[]
}

/** outside: NWS has no forecast there. unreachable: it could not be asked. */
export type ResolveFailure = 'outside' | 'unreachable'

export type ResolveResult =
  { ok: true; facts: SpotFacts } | { ok: false; reason: ResolveFailure }

const round4 = (n: number) => Math.round(n * 1e4) / 1e4

export async function resolveSpot(
  lat: number,
  lon: number,
  io: ResolveIo,
): Promise<ResolveResult> {
  const at = { lat: round4(lat), lon: round4(lon) }
  try {
    const cell = await io.fetchPoints(at.lat, at.lon)
    const elevationFt = await io.fetchElevationFt(
      cell.office,
      cell.gridX,
      cell.gridY,
    )
    const { tideStation, gauge } = nearestStations(at, io.stations)
    return {
      ok: true,
      facts: {
        ...at,
        timeZone: cell.timeZone,
        // No source gives the point's own height; issue #9 is where that goes.
        elevationFt: null,
        nws: {
          office: cell.office,
          gridX: cell.gridX,
          gridY: cell.gridY,
          elevationFt,
        },
        tideStation,
        gauge,
        tidesShown: defaultTidesShown(tideStation.distanceMi, elevationFt),
      },
    }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof NwsOutsideError ? 'outside' : 'unreachable',
    }
  }
}
