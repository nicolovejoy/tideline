// Distance and direction over the Earth's surface, for saying where a
// station stands from a spot, and a tapped longitude put back in range.
// No React, no fetch.

export interface LatLon {
  lat: number
  lon: number
}

const EARTH_RADIUS_MI = 3958.8
const toRadians = (degrees: number) => (degrees * Math.PI) / 180
const toDegrees = (radians: number) => (radians * 180) / Math.PI

/**
 * A longitude brought into -180 to 180. Leaflet reports the longitude of
 * the world copy that was tapped, so Hawaii one copy east is 202.1, and
 * NWS answers 404 for that. 180 comes back as -180, the same meridian.
 */
export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180
}

/** Great-circle distance in miles, by the haversine formula. */
export function distanceMi(a: LatLon, b: LatLon): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLon = toRadians(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h))
}

/** The initial bearing from a to b in degrees, 0 north and 90 east. */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)
  const dLon = toRadians(b.lon - a.lon)
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (toDegrees(Math.atan2(y, x)) + 360) % 360
}

const WORDS = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
]

/** The 8-point compass word for a bearing in degrees. */
export function directionWord(degrees: number): string {
  const turn = ((degrees % 360) + 360) % 360
  return WORDS[Math.round(turn / 45) % 8]
}

/**
 * Miles as the captions say them: one decimal under 10 mi, whole miles
 * from 10, matching "8.6 mi", "0.2 mi" and "31 mi" on the hard-coded spots.
 */
export function roundMiles(mi: number): number {
  const tenths = Math.round(mi * 10) / 10
  return tenths < 10 ? tenths : Math.round(mi)
}
