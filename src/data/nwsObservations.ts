// A weather station's reports from NWS: the temperature, the wind, its gust
// and direction, and the sky as a category. Framework-free. Reports come in
// SI units, newest first, about 7 days deep; a page holds 500 at most.

import { celsiusToF, kmhToMph } from './nws.ts'

/** The sky as stations report it: the cover of the layer that covers most. */
export type Sky = 'clear' | 'few' | 'scattered' | 'broken' | 'overcast'

export interface Report {
  /** When it was taken, UTC instant in epoch ms. */
  t: number
  tempF: number | null
  windMph: number | null
  /** Stations give a gust only when there is one. */
  gustMph: number | null
  /** The direction the wind blows from, in degrees. 0 with a speed of 0 is calm. */
  windDeg: number | null
  sky: Sky | null
}

/** The instant as NWS takes it: seconds, in UTC. */
function isoSeconds(t: number): string {
  return new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export function observationsUrl(stationId: string, start: number): string {
  return `https://api.weather.gov/stations/${encodeURIComponent(stationId)}/observations?start=${isoSeconds(start)}&limit=500`
}

/** How each cloud amount is reported, and what it stands for. */
const AMOUNTS: Record<string, Sky> = {
  CLR: 'clear',
  SKC: 'clear',
  FEW: 'few',
  SCT: 'scattered',
  BKN: 'broken',
  OVC: 'overcast',
  // A sky hidden by fog, reported as how far up can be seen.
  VV: 'overcast',
}
const COVER: Sky[] = ['clear', 'few', 'scattered', 'broken', 'overcast']

/** The cover of the layer that covers most, or null with no layers it knows. */
export function skyOf(layers: unknown): Sky | null {
  if (!Array.isArray(layers)) return null
  let most: Sky | null = null
  for (const layer of layers) {
    const amount = (layer as { amount?: unknown } | null)?.amount
    const sky = typeof amount === 'string' ? AMOUNTS[amount] : undefined
    if (sky && (most === null || COVER.indexOf(sky) > COVER.indexOf(most))) {
      most = sky
    }
  }
  return most
}

/**
 * NWS's quality flags on a value. V verified, S screened, C coarse pass and
 * Z not checked are kept. X rejected, B subjective bad and Q questioned are
 * left out, so a bad sensor does not draw a 200°F hour.
 */
const FAILED = new Set(['X', 'B', 'Q'])

interface Measure {
  unitCode?: unknown
  value?: unknown
  qualityControl?: unknown
}

/** A measured value in the unit expected, or null where there is none worth having. */
function measure(name: string, raw: unknown, unit: string): number | null {
  const m = raw as Measure | null | undefined
  if (!m || typeof m.value !== 'number') return null
  if (m.unitCode !== unit) {
    throw new Error(
      `NWS: ${name} is in ${String(m.unitCode)}, expected ${unit}`,
    )
  }
  if (typeof m.qualityControl === 'string' && FAILED.has(m.qualityControl)) {
    return null
  }
  return m.value
}

export function parseObservations(json: unknown): Report[] {
  const features = (json as { features?: unknown } | null)?.features
  if (!Array.isArray(features)) {
    throw new Error('NWS: response has no features')
  }
  const reports: Report[] = []
  for (const feature of features) {
    const p = (feature as { properties?: Record<string, unknown> } | null)
      ?.properties
    if (!p) continue
    const t = Date.parse(String(p.timestamp))
    // A report that cannot be placed in time is left out. The rest stand.
    if (Number.isNaN(t)) continue
    const celsius = measure('temperature', p.temperature, 'wmoUnit:degC')
    const kmh = measure('windSpeed', p.windSpeed, 'wmoUnit:km_h-1')
    const gust = measure('windGust', p.windGust, 'wmoUnit:km_h-1')
    reports.push({
      t,
      tempF: celsius === null ? null : celsiusToF(celsius),
      windMph: kmh === null ? null : kmhToMph(kmh),
      gustMph: gust === null ? null : kmhToMph(gust),
      windDeg: measure(
        'windDirection',
        p.windDirection,
        'wmoUnit:degree_(angle)',
      ),
      sky: skyOf(p.cloudLayers),
    })
  }
  return reports.sort((a, b) => a.t - b.t)
}

/** The station's reports from `start` on, oldest first. */
export async function fetchObservations(
  stationId: string,
  start: number,
): Promise<Report[]> {
  const response = await fetch(observationsUrl(stationId, start), {
    headers: { Accept: 'application/geo+json' },
  })
  if (!response.ok) throw new Error(`NWS: HTTP ${response.status}`)
  return parseObservations(await response.json())
}
