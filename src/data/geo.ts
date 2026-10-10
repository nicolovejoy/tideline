// Distance and direction over the Earth's surface, for saying where a
// station stands from a spot, a tapped longitude put back in range, and
// whether a point is anywhere near the US. No React, no fetch.

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

/** South, north, west, east. */
type Box = [number, number, number, number]

const US_BOXES: Box[] = [
  // The lower 48 in two parts: west of El Paso the border is at 31.3 N.
  [31.3, 49.5, -125.5, -106.7],
  [24.4, 49.5, -106.7, -66.5],
  // Alaska, and the Aleutians past the date line.
  [51, 72, -180, -129],
  [51, 56, 172, 180],
  // Hawaii out to Midway.
  [18.5, 29, -179, -154],
  // Puerto Rico and the Virgin Islands.
  [17.5, 18.8, -68, -64.3],
  // Guam and the Northern Marianas.
  [13, 21, 144, 146.5],
  // American Samoa.
  [-15, -10.8, -171.5, -168],
]

/**
 * Whether a point is inside one of the loose boxes round the places NWS
 * forecasts for. Loose on purpose: each takes in water and some of a
 * neighbour, and NWS is still the one asked. The boxes are for reading a
 * failure. NWS answers 404 for land it does not cover but HTTP 500 for
 * open water in the tropics (off Oaxaca, off southern Baja and in the
 * Caribbean on 2026-10-10), and outside every box no failure can mean
 * "try again". The longitude is one already brought into -180 to 180.
 */
export function inUsBounds({ lat, lon }: LatLon): boolean {
  return US_BOXES.some(
    ([south, north, west, east]) =>
      lat >= south && lat <= north && lon >= west && lon <= east,
  )
}
