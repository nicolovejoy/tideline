// Which weather station's reports stand for a spot: the nearest within 10
// miles and within 500 ft of the spot's height. Without the height La
// Cumbre Peak would show a canyon's weather as its own. Plain functions.

import { bearingDeg, directionWord, distanceMi, roundMiles } from './geo.ts'
import type { LatLon } from './geo.ts'
import type { WeatherStation } from './nwsStations.ts'

export const STATION_WITHIN_MI = 10
export const STATION_WITHIN_FT = 500

/** A station as it stands from one spot. */
export interface NearStation extends WeatherStation {
  /** As the captions say it: tenths under 10.5 mi, whole miles from there. */
  distanceMi: number
  /** The 8-point compass word for where the station lies from the spot. */
  direction: string
}

export interface StationChoice {
  /** The station whose reports stand for the spot, or null where none does. */
  serves: NearStation | null
  /** The nearest station of all, so a spot with none can say why. */
  nearest: NearStation | null
}

export function stationServes(
  distance: number,
  stationFt: number,
  spotFt: number,
): boolean {
  return (
    distance <= STATION_WITHIN_MI &&
    Math.abs(stationFt - spotFt) <= STATION_WITHIN_FT
  )
}

/**
 * The nearest station that serves the spot, and the nearest of all. The
 * rule goes by the exact distance; what is saved is the rounded one.
 */
export function chooseStation(
  at: LatLon,
  spotFt: number,
  stations: WeatherStation[],
): StationChoice {
  let serves: { station: WeatherStation; distance: number } | null = null
  let nearest: { station: WeatherStation; distance: number } | null = null
  for (const station of stations) {
    const distance = distanceMi(at, station)
    if (nearest === null || distance < nearest.distance) {
      nearest = { station, distance }
    }
    if (
      stationServes(distance, station.elevationFt, spotFt) &&
      (serves === null || distance < serves.distance)
    ) {
      serves = { station, distance }
    }
  }
  const near = (found: { station: WeatherStation; distance: number } | null) =>
    found === null
      ? null
      : {
          ...found.station,
          distanceMi:
            found.distance < 10.5
              ? Math.round(found.distance * 10) / 10
              : roundMiles(found.distance),
          direction: directionWord(bearingDeg(at, found.station)),
        }
  return { serves: near(serves), nearest: near(nearest) }
}

function isNearStation(value: unknown): value is NearStation {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    typeof s.lat === 'number' &&
    typeof s.lon === 'number' &&
    typeof s.elevationFt === 'number' &&
    typeof s.distanceMi === 'number' &&
    typeof s.direction === 'string'
  )
}

/** Whether saved data has the shape of a station choice. For the cache. */
export function isStationChoice(data: unknown): data is StationChoice {
  if (typeof data !== 'object' || data === null) return false
  if (!('serves' in data) || !('nearest' in data)) return false
  const { serves, nearest } = data as Record<string, unknown>
  return (
    (serves === null || isNearStation(serves)) &&
    (nearest === null || isNearStation(nearest))
  )
}
