// A point's own height above sea level, from the US Geological Survey's
// Elevation Point Query Service (apps.nationalmap.gov/epqs). No key, and
// it sends access-control-allow-origin: *. Asked once, when a spot is
// added: the NWS cell's height is an average over 2.5 km, so a beach under
// hills reads as hundreds of feet up, and whether a spot has a tide goes by
// the spot itself. No React, no storage.

const ENDPOINT = 'https://epqs.nationalmap.gov/v1/json'
/** The service is slow now and then. Past this the spot goes without. */
const TIMEOUT = 8_000
/** Its value for a point it has no data for is -1,000,000. */
const NO_DATA_BELOW = -100_000

/** Longitude is x. Feet, from the survey's own 3DEP data. */
export function elevationUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    x: String(lon),
    y: String(lat),
    wkid: '4326',
    units: 'Feet',
    includeDate: 'false',
  })
  return `${ENDPOINT}?${params}`
}

/** The height in whole feet. Throws where the response holds none. */
export function parsePointElevationFt(json: unknown): number {
  const value = (json as { value?: unknown } | null)?.value
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('USGS: response has no elevation')
  }
  if (value < NO_DATA_BELOW) throw new Error('USGS: no data for this point')
  // Not -0, which a point a few inches under the datum would round to.
  return Math.round(value) + 0
}

export async function fetchPointElevationFt(
  lat: number,
  lon: number,
): Promise<number> {
  const response = await fetch(elevationUrl(lat, lon), {
    signal: AbortSignal.timeout(TIMEOUT),
  })
  if (!response.ok) throw new Error(`USGS: HTTP ${response.status}`)
  return parsePointElevationFt(await response.json())
}
