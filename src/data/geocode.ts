// A place name turned into a point and an extent, from OpenStreetMap's
// Nominatim. Its usage policy (operations.osmfoundation.org/policies/
// nominatim) asks for one request a second at most, no autocomplete, no
// repeats of the same query and visible credit. The screen searches only on
// submit and one at a time; this module remembers answers for the life of
// the page; the credit is in the map's corner. Changing provider is this
// file alone. No React, no storage.

export interface Bounds {
  south: number
  north: number
  west: number
  east: number
}

export interface Place {
  lat: number
  lon: number
  /** The short name: "Santa Barbara", "Leadbetter Beach". */
  name: string
  /** The full one: "Santa Barbara, Santa Barbara County, California, United States". */
  displayName: string
  bounds: Bounds
}

const ENDPOINT = 'https://nominatim.openstreetmap.org/search'

/** One US place at most. Tideline covers the US; NWS answers 404 elsewhere. */
export function searchUrl(query: string): string {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    countrycodes: 'us',
    limit: '1',
  })
  return `${ENDPOINT}?${params}`
}

const num = (value: unknown): number | null => {
  if (typeof value !== 'string') return null
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function parsePlace(value: unknown): Place | null {
  if (typeof value !== 'object' || value === null) return null
  const p = value as Record<string, unknown>
  const lat = num(p.lat)
  const lon = num(p.lon)
  if (
    lat === null ||
    lon === null ||
    typeof p.name !== 'string' ||
    typeof p.display_name !== 'string' ||
    !Array.isArray(p.boundingbox) ||
    p.boundingbox.length !== 4
  ) {
    return null
  }
  // Nominatim's order: south, north, west, east.
  const [south, north, west, east] = p.boundingbox.map(num)
  if (south === null || north === null || west === null || east === null) {
    return null
  }
  return {
    lat,
    lon,
    name: p.name,
    displayName: p.display_name,
    bounds: { south, north, west, east },
  }
}

/** Every well-formed place in the answer, in Nominatim's order. */
export function parsePlaces(json: unknown): Place[] {
  if (!Array.isArray(json)) throw new Error('Nominatim: response is not a list')
  return json.map(parsePlace).filter((place) => place !== null)
}

/** The key two spellings of one query share. */
export function normalizeQuery(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

const remembered = new Map<string, Place | null>()

export function forgetPlaces(): void {
  remembered.clear()
}

/**
 * The first place for a query, or null for none. Remembered for the life
 * of the page so the same query is never asked twice; a failure is not
 * remembered, so a try again asks again. A blank query asks nothing.
 */
export async function fetchPlace(query: string): Promise<Place | null> {
  const key = normalizeQuery(query)
  if (key === '') return null
  if (remembered.has(key)) return remembered.get(key) ?? null
  const response = await fetch(searchUrl(query.trim()))
  if (!response.ok) throw new Error(`Nominatim: HTTP ${response.status}`)
  const [first] = parsePlaces(await response.json())
  const place = first ?? null
  remembered.set(key, place)
  return place
}
