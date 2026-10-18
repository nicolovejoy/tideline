// The spots, hard-coded until saving your own arrives. Facts verified against
// the live NOAA and NWS APIs on 2026-10-09, and the station types against
// NOAA's station metadata on 2026-10-10. Directions are the 8-point compass
// name of the bearing from the spot to the station.

import { tidesApply } from './data/tideRule.ts'

/** A NOAA tide station, as it stands from one spot. */
export interface Station {
  id: string
  name: string
  distanceMi: number
  direction: string
  /**
   * NOAA's own distinction. A harmonic station publishes a 6-minute curve;
   * a subordinate one publishes highs and lows only, and a 6-minute request
   * to it returns an error, so its curve is interpolated on the device.
   */
  type: 'harmonic' | 'subordinate'
}

export interface Spot {
  id: string
  name: string
  lat: number
  lon: number
  /** IANA zone. Every displayed time and calendar day uses it. */
  timeZone: string
  /**
   * The spot's own height above sea level: from USGS for a spot the user
   * added, null where that could not be had or was never asked.
   */
  elevationFt: number | null
  /** The 2.5 km NWS forecast cell containing the spot, and its average height. */
  nws: { office: string; gridX: number; gridY: number; elevationFt: number }
  /** Where the predicted curve and the highs and lows come from. */
  tideStation: Station
  /**
   * Where the observed level comes from. The tide station itself when it has
   * a gauge; the nearest station that has one when it does not.
   */
  gauge: Station
}

const SANTA_BARBARA = {
  id: '9411340',
  name: 'Santa Barbara',
  type: 'harmonic',
} as const

export const CAMPUS_POINT: Spot = {
  id: 'campus-point',
  name: 'Campus Point',
  lat: 34.4046,
  lon: -119.844,
  timeZone: 'America/Los_Angeles',
  elevationFt: null,
  nws: { office: 'LOX', gridX: 100, gridY: 71, elevationFt: 3 },
  tideStation: { ...SANTA_BARBARA, distanceMi: 8.6, direction: 'east' },
  gauge: { ...SANTA_BARBARA, distanceMi: 8.6, direction: 'east' },
}

// Station 9411399 is harmonic, so it has a curve, but it has no gauge: a
// water_level request returns an error. The nearest gauge is Santa Barbara.
const GAVIOTA: Spot = {
  id: 'gaviota',
  name: 'Gaviota State Park',
  lat: 34.4716,
  lon: -120.2284,
  timeZone: 'America/Los_Angeles',
  elevationFt: null,
  nws: { office: 'LOX', gridX: 87, gridY: 76, elevationFt: 0 },
  tideStation: {
    id: '9411399',
    name: 'Gaviota State Park',
    distanceMi: 0.2,
    direction: 'south',
    type: 'harmonic',
  },
  gauge: { ...SANTA_BARBARA, distanceMi: 31, direction: 'east' },
}

// Inland and high up, so it has no tide. The cell's average is well below
// the summit.
const LA_CUMBRE_PEAK: Spot = {
  id: 'la-cumbre-peak',
  name: 'La Cumbre Peak',
  lat: 34.4939,
  lon: -119.7147,
  timeZone: 'America/Los_Angeles',
  elevationFt: 3997,
  nws: { office: 'LOX', gridX: 105, gridY: 74, elevationFt: 3258 },
  tideStation: { ...SANTA_BARBARA, distanceMi: 6.3, direction: 'south' },
  gauge: { ...SANTA_BARBARA, distanceMi: 6.3, direction: 'south' },
}

/**
 * The three spots a device starts with. They are seeded into the saved
 * list the first time the app reads it (`readSpots` in
 * `src/data/savedSpots.ts`), and from then on are the user's as any added
 * spot is: renamed, moved or removed from the edit screen. Nothing else
 * reads this list.
 */
export const SPOTS: Spot[] = [CAMPUS_POINT, GAVIOTA, LA_CUMBRE_PEAK]

/** The spot with that id in the list. Any other id, or none, means the first in the list. */
export function spotById(id: string | null, spots: Spot[] = SPOTS): Spot {
  return spots.find((spot) => spot.id === id) ?? spots[0] ?? SPOTS[0]
}

/** What the tide rule goes by. */
type Placed = Pick<Spot, 'elevationFt' | 'nws' | 'tideStation'>

/**
 * Whether the spot has a tide to show: a station near, and the spot low.
 * A fact of the spot, not a choice. Until 2026-10-10 it could be switched
 * on anywhere, and a spot saved then may still carry what was chosen; it
 * is not read. The height is the spot's own where it is known and its
 * forecast cell's average where not.
 */
export function hasTides(spot: Placed): boolean {
  return tidesApply(
    spot.tideStation.distanceMi,
    spot.elevationFt ?? spot.nws.elevationFt,
  )
}

/** Whether the spot's observed level comes from its own tide station. */
export function hasOwnGauge(spot: Spot): boolean {
  return spot.gauge.id === spot.tideStation.id
}

/** Whether the spot's tide station publishes a curve, or highs and lows only. */
export function hasOwnCurve(spot: Spot): boolean {
  return spot.tideStation.type === 'harmonic'
}
