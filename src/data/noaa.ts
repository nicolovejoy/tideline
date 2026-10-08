// NOAA CO-OPS tide data: the predicted curve, predicted highs and lows, and
// the observed water level. Times are requested in GMT, because station-local
// timestamps carry no offset and are ambiguous when the clocks go back.

export interface TidePoint {
  /** UTC instant, epoch ms. */
  t: number
  /** Feet above MLLW. */
  ft: number
}

export interface TideExtreme extends TidePoint {
  type: 'H' | 'L'
}

interface NoaaRow {
  t: string
  v: string
  type?: string
}

const BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'

function utcYmd(t: number): string {
  const d = new Date(t)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
}

/**
 * The request URL for the UTC dates that cover the instants from start up to,
 * but not including, end.
 */
export function noaaUrl(
  stationId: string,
  product: 'predictions' | 'water_level',
  start: number,
  end: number,
  interval?: '6' | 'hilo',
): string {
  const params = new URLSearchParams({ product })
  if (interval) params.set('interval', interval)
  params.set('begin_date', utcYmd(start))
  params.set('end_date', utcYmd(end - 1))
  params.set('station', stationId)
  params.set('datum', 'MLLW')
  params.set('units', 'english')
  params.set('time_zone', 'gmt')
  params.set('format', 'json')
  params.set('application', 'tideline')
  return `${BASE}?${params.toString()}`
}

function rows(json: unknown, key: 'predictions' | 'data'): NoaaRow[] {
  if (typeof json !== 'object' || json === null) {
    throw new Error('NOAA: response is not an object')
  }
  const body = json as Record<string, unknown> & {
    error?: { message?: string }
  }
  // NOAA reports problems as HTTP 200 with an error body.
  if (body.error) {
    throw new Error(`NOAA: ${(body.error.message ?? 'unknown error').trim()}`)
  }
  const list = body[key]
  if (!Array.isArray(list)) throw new Error(`NOAA: response has no ${key}`)
  return list as NoaaRow[]
}

/** 'YYYY-MM-DD HH:MM' in GMT, as a UTC instant. */
function instant(gmt: string): number {
  const [date, time] = gmt.split(' ')
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  return Date.UTC(year, month - 1, day, hour, minute)
}

function points(list: NoaaRow[]): TidePoint[] {
  // A gauge outage shows up as rows with an empty value.
  return list
    .filter((row) => row.v !== '')
    .map((row) => ({ t: instant(row.t), ft: Number(row.v) }))
}

export function parsePredictions(json: unknown): TidePoint[] {
  return points(rows(json, 'predictions'))
}

export function parseHiLo(json: unknown): TideExtreme[] {
  return rows(json, 'predictions')
    .filter((row) => row.v !== '')
    .map((row): TideExtreme => ({
      t: instant(row.t),
      ft: Number(row.v),
      type: row.type === 'H' ? 'H' : 'L',
    }))
}

export function parseWaterLevel(json: unknown): TidePoint[] {
  return points(rows(json, 'data'))
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`NOAA: HTTP ${response.status}`)
  return response.json()
}

function within<T extends TidePoint>(
  list: T[],
  start: number,
  end: number,
): T[] {
  return list.filter((p) => p.t >= start && p.t < end)
}

export async function fetchPredictions(
  stationId: string,
  start: number,
  end: number,
): Promise<TidePoint[]> {
  const json = await getJson(noaaUrl(stationId, 'predictions', start, end, '6'))
  return within(parsePredictions(json), start, end)
}

export async function fetchHiLo(
  stationId: string,
  start: number,
  end: number,
): Promise<TideExtreme[]> {
  const json = await getJson(
    noaaUrl(stationId, 'predictions', start, end, 'hilo'),
  )
  return within(parseHiLo(json), start, end)
}

export async function fetchWaterLevel(
  stationId: string,
  start: number,
  end: number,
): Promise<TidePoint[]> {
  const json = await getJson(noaaUrl(stationId, 'water_level', start, end))
  return within(parseWaterLevel(json), start, end)
}
