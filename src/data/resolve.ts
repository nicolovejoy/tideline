// What a pin on the map becomes: the NWS cell and zone, the nearest
// stations, and whether the tide is shown to start with. The requests are
// handed in, so this can be tested without a network.

import { inUsBounds, wrapLon } from './geo.ts'
import { NwsOutsideError } from './nws.ts'
import type { NwsCell } from './nws.ts'
import { nearestStations } from './stations.ts'
import type { StationRow } from './stations.ts'
import { defaultTidesShown } from './tideDefault.ts'
import type { Spot } from '../spot.ts'

export {
  TIDES_WITHIN_MI,
  TIDES_BELOW_FT,
  defaultTidesShown,
} from './tideDefault.ts'

/** Everything a spot has apart from what the user gives it. */
export type SpotFacts = Omit<Spot, 'id' | 'name'>

export interface ResolveIo {
  fetchPoints: (lat: number, lon: number) => Promise<NwsCell>
  fetchElevationFt: (
    office: string,
    gridX: number,
    gridY: number,
  ) => Promise<number>
  /** The point's own height in feet. The one request that may fail. */
  fetchPointElevationFt: (lat: number, lon: number) => Promise<number>
  stations: StationRow[]
}

/**
 * outside: NWS has no forecast there, or the point is nowhere near the US.
 * unreachable: a point it should answer for could not be asked about.
 */
export type ResolveFailure = 'outside' | 'unreachable'

export type ResolveResult =
  { ok: true; facts: SpotFacts } | { ok: false; reason: ResolveFailure }

const round4 = (n: number) => Math.round(n * 1e4) / 1e4

export async function resolveSpot(
  lat: number,
  lon: number,
  io: ResolveIo,
): Promise<ResolveResult> {
  // Wrapped before rounding: a tap on a world copy is the same place.
  const at = { lat: round4(lat), lon: round4(wrapLon(lon)) }
  // Asked alongside NWS, not after it. Without it the spot is still a spot:
  // null stands in, and the cell's average is what is known of its height.
  const own = io.fetchPointElevationFt(at.lat, at.lon).catch(() => null)
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
        elevationFt: await own,
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
    // NWS says 404 for land it does not cover. For open water in the
    // tropics it says HTTP 500, which reads as an outage; but nowhere near
    // the US there is nothing to try again for.
    const outside = error instanceof NwsOutsideError || !inUsBounds(at)
    return { ok: false, reason: outside ? 'outside' : 'unreachable' }
  }
}
