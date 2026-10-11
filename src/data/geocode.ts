// A place name turned into a point and an extent, from OpenStreetMap's
// Nominatim. Its usage policy (operations.osmfoundation.org/policies/
// nominatim) asks for one request a second at most, no autocomplete, no
// repeats of the same query and visible credit. The screen searches only on
// submit and one at a time; this module remembers answers for the life of
// the page; the credit is in the map's corner. Each search carries the
// map's view, so the place of that name nearest what the user is looking
// at comes first. Changing provider is this file alone. No React, no
// storage.

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

/**
 * The least a view is taken to span, in degrees each way: about the map as
 * the add screen opens it. After a search the map sits two miles across,
 * and a box that small no longer prefers the next beach down the coast.
 */
const MIN_SPAN_DEG = 0.5

/** Both ends of a span, pushed out about its middle to the least if short. */
function widened(low: number, high: number): [number, number] {
  if (high - low >= MIN_SPAN_DEG) return [low, high]
  const middle = (low + high) / 2
  return [middle - MIN_SPAN_DEG / 2, middle + MIN_SPAN_DEG / 2]
}

const within = (value: number, limit: number) =>
  Math.min(limit, Math.max(-limit, value))

/** To two places, about half a mile: a nudge of the map is the same view. */
const hundredths = (value: number) => Math.round(value * 100) / 100

/**
 * A map's view as Nominatim's `viewbox`: west, north, east, south. Widened
 * to the least span, cut to the world and rounded. null for a view that is
 * no box, which a map panned past the date line can give.
 */
export function viewbox(view: Bounds): string | null {
  const { south, north, west, east } = view
  if (![south, north, west, east].every(Number.isFinite)) return null
  const [s, n] = widened(south, north).map((lat) => hundredths(within(lat, 90)))
  const [w, e] = widened(west, east).map((lon) => hundredths(within(lon, 180)))
  if (s >= n || w >= e) return null
  return `${w},${n},${e},${s}`
}

/**
 * One US place at most. Tideline covers the US; NWS answers 404 elsewhere.
 * With a view, places in it come first and the rest are still found:
 * `bounded=0` prefers the box without closing it.
 */
export function searchUrl(query: string, view: Bounds | null = null): string {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    countrycodes: 'us',
    limit: '1',
  })
  const box = view && viewbox(view)
  if (box) {
    params.set('viewbox', box)
    params.set('bounded', '0')
  }
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
 * The first place for a query, or null for none, preferring the map's view
 * where there is one. Remembered for the life of the page by the query and
 * the view, so the same question is never asked twice and the same name
 * from another view is asked afresh; a failure is not remembered, so a try
 * again asks again. A blank query asks nothing.
 */
export async function fetchPlace(
  query: string,
  view: Bounds | null = null,
): Promise<Place | null> {
  const name = normalizeQuery(query)
  if (name === '') return null
  const box = view === null ? null : viewbox(view)
  const key = `${name}|${box ?? ''}`
  if (remembered.has(key)) return remembered.get(key) ?? null
  const response = await fetch(searchUrl(query.trim(), view))
  if (!response.ok) throw new Error(`Nominatim: HTTP ${response.status}`)
  const [first] = parsePlaces(await response.json())
  const place = first ?? null
  remembered.set(key, place)
  return place
}
