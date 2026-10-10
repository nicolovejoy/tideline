// The spots, hard-coded until saving your own arrives. Facts verified against
// the live NOAA and NWS APIs on 2026-10-09, and the station types against
// NOAA's station metadata on 2026-10-10. Directions are the 8-point compass
// name of the bearing from the spot to the station.

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
  /** The spot's own height, where it is worth saying: a peak. */
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
  /** Whether the tide is shown until the user says otherwise. Hidden inland. */
  tidesShown: boolean
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
  tidesShown: true,
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
  tidesShown: true,
}

// Inland and high up. The cell's average is well below the summit.
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
  tidesShown: false,
}

export const SPOTS: Spot[] = [CAMPUS_POINT, GAVIOTA, LA_CUMBRE_PEAK]

/** The spot with that id. Any other id, or none, means Campus Point. */
export function spotById(id: string | null): Spot {
  return SPOTS.find((spot) => spot.id === id) ?? SPOTS[0]
}

/** Whether the spot's observed level comes from its own tide station. */
export function hasOwnGauge(spot: Spot): boolean {
  return spot.gauge.id === spot.tideStation.id
}

/** Whether the spot's tide station publishes a curve, or highs and lows only. */
export function hasOwnCurve(spot: Spot): boolean {
  return spot.tideStation.type === 'harmonic'
}
