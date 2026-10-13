// The NWS forecast for one 2.5 km grid cell, from the raw gridpoint endpoint.
// That endpoint is used because /forecast/hourly has no gusts or cloud cover.

import { HOUR } from '../time.ts'

export interface ForecastHour {
  /** Start of the hour, UTC instant in epoch ms. */
  t: number
  tempF: number | null
  windMph: number | null
  gustMph: number | null
  /** The direction the wind blows from, in degrees. */
  windDeg: number | null
  cloudPct: number | null
  rainPct: number | null
}

export interface Forecast {
  /** When NWS last updated this cell's forecast. */
  updatedAt: number
  hours: ForecastHour[]
}

type Field = Exclude<keyof ForecastHour, 't'>

interface LayerSpec {
  /** The layer's name in the NWS response. */
  layer: string
  /** The unit NWS is expected to send it in. */
  unit: string
  convert: (value: number) => number
}

interface GridLayer {
  uom?: string
  values?: { validTime: string; value?: number | null }[]
}

const KMH_TO_MPH = 0.621371
export const FT_PER_M = 3.28084
const asIs = (value: number) => value

/** Kilometres an hour as NWS sends speeds, to miles an hour. */
export function kmhToMph(kmh: number): number {
  return kmh * KMH_TO_MPH
}

/** Celsius as NWS sends temperatures, to Fahrenheit. */
export function celsiusToF(celsius: number): number {
  return (celsius * 9) / 5 + 32
}

const LAYERS: Record<Field, LayerSpec> = {
  tempF: {
    layer: 'temperature',
    unit: 'wmoUnit:degC',
    convert: celsiusToF,
  },
  windMph: {
    layer: 'windSpeed',
    unit: 'wmoUnit:km_h-1',
    convert: kmhToMph,
  },
  gustMph: {
    layer: 'windGust',
    unit: 'wmoUnit:km_h-1',
    convert: kmhToMph,
  },
  windDeg: {
    layer: 'windDirection',
    unit: 'wmoUnit:degree_(angle)',
    convert: asIs,
  },
  cloudPct: { layer: 'skyCover', unit: 'wmoUnit:percent', convert: asIs },
  rainPct: {
    layer: 'probabilityOfPrecipitation',
    unit: 'wmoUnit:percent',
    convert: asIs,
  },
}

export function nwsUrl(office: string, gridX: number, gridY: number): string {
  return `https://api.weather.gov/gridpoints/${office}/${gridX},${gridY}`
}

/**
 * Hours in an ISO 8601 duration made of days and hours, such as 'P2DT4H'.
 * Null for anything else, such as one with minutes. NWS sends whole hours;
 * one odd value must not take the whole forecast down with it.
 */
export function parseDurationHours(duration: string): number | null {
  const match = /^P(?:(\d+)D)?(?:T(\d+)H)?$/.exec(duration)
  const hours = match ? Number(match[1] ?? 0) * 24 + Number(match[2] ?? 0) : 0
  return hours === 0 ? null : hours
}

function emptyHour(t: number): ForecastHour {
  return {
    t,
    tempF: null,
    windMph: null,
    gustMph: null,
    windDeg: null,
    cloudPct: null,
    rainPct: null,
  }
}

export function parseGridpoint(json: unknown): Forecast {
  const properties = (json as { properties?: Record<string, unknown> } | null)
    ?.properties
  if (!properties) throw new Error('NWS: response has no properties')

  const updatedAt = Date.parse(String(properties.updateTime))
  if (Number.isNaN(updatedAt)) {
    throw new Error('NWS: response has no updateTime')
  }

  const byHour = new Map<number, ForecastHour>()
  for (const field of Object.keys(LAYERS) as Field[]) {
    const spec = LAYERS[field]
    const layer = properties[spec.layer] as GridLayer | undefined
    // NWS sends a layer it has no data for as { values: [] } with no unit.
    if (!layer || !Array.isArray(layer.values) || layer.values.length === 0) {
      continue
    }
    if (layer.uom !== spec.unit) {
      throw new Error(
        `NWS: ${spec.layer} is in ${layer.uom}, expected ${spec.unit}`,
      )
    }
    for (const { validTime, value } of layer.values) {
      if (typeof value !== 'number') continue
      // validTime is a start and a duration: '2026-10-08T08:00:00+00:00/PT3H'
      const [startText, duration] = validTime.split('/')
      const start = Date.parse(startText)
      const span = parseDurationHours(duration ?? '')
      // A value that cannot be placed in time is left out. The rest stand.
      if (Number.isNaN(start) || span === null) continue
      for (let i = 0; i < span; i++) {
        const t = start + i * HOUR
        let hour = byHour.get(t)
        if (!hour) {
          hour = emptyHour(t)
          byHour.set(t, hour)
        }
        hour[field] = spec.convert(value)
      }
    }
  }

  const hours = [...byHour.values()].sort((a, b) => a.t - b.t)
  return { updatedAt, hours }
}

/** Whether saved data has the shape of a parsed forecast. For the cache. */
export function isForecast(data: unknown): data is Forecast {
  if (typeof data !== 'object' || data === null) return false
  const { updatedAt, hours } = data as Record<string, unknown>
  return (
    typeof updatedAt === 'number' &&
    Array.isArray(hours) &&
    hours.every((hour: unknown) => {
      if (typeof hour !== 'object' || hour === null) return false
      const record = hour as Record<string, unknown>
      return (
        typeof record.t === 'number' &&
        Object.keys(LAYERS).every(
          (field) =>
            record[field] === null || typeof record[field] === 'number',
        )
      )
    })
  )
}

export async function fetchForecast(
  office: string,
  gridX: number,
  gridY: number,
): Promise<Forecast> {
  const response = await fetch(nwsUrl(office, gridX, gridY), {
    headers: { Accept: 'application/geo+json' },
  })
  if (!response.ok) throw new Error(`NWS: HTTP ${response.status}`)
  return parseGridpoint(await response.json())
}

/** The point is outside every NWS grid: no forecast there, ever. */
export class NwsOutsideError extends Error {}

export interface NwsCell {
  office: string
  gridX: number
  gridY: number
  /** IANA zone, the one every time at the spot is shown in. */
  timeZone: string
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4

/** NWS takes four decimals at most and redirects anything longer. */
export function pointsUrl(lat: number, lon: number): string {
  return `https://api.weather.gov/points/${round4(lat)},${round4(lon)}`
}

export function parsePoints(json: unknown): NwsCell {
  const properties = (json as { properties?: Record<string, unknown> } | null)
    ?.properties
  if (!properties) throw new Error('NWS: response has no properties')
  const { gridId, gridX, gridY, timeZone } = properties
  if (
    typeof gridId !== 'string' ||
    typeof gridX !== 'number' ||
    typeof gridY !== 'number' ||
    typeof timeZone !== 'string'
  ) {
    throw new Error('NWS: response has no grid cell')
  }
  return { office: gridId, gridX, gridY, timeZone }
}

/** The forecast cell containing a point. Throws NwsOutsideError on a 404. */
export async function fetchPoints(lat: number, lon: number): Promise<NwsCell> {
  const response = await fetch(pointsUrl(lat, lon), {
    headers: { Accept: 'application/geo+json' },
  })
  if (response.status === 404) {
    throw new NwsOutsideError('NWS: no forecast for this point')
  }
  if (!response.ok) throw new Error(`NWS: HTTP ${response.status}`)
  return parsePoints(await response.json())
}

/** A cell's average height in whole feet, from the gridpoint response. */
export function parseElevationFt(json: unknown): number {
  const properties = (json as { properties?: Record<string, unknown> } | null)
    ?.properties
  const elevation = properties?.elevation as
    { unitCode?: unknown; value?: unknown } | undefined
  if (!elevation || typeof elevation.value !== 'number') {
    throw new Error('NWS: response has no elevation')
  }
  if (elevation.unitCode !== 'wmoUnit:m') {
    throw new Error(`NWS: elevation is in ${String(elevation.unitCode)}`)
  }
  return Math.round(elevation.value * FT_PER_M)
}

export async function fetchElevationFt(
  office: string,
  gridX: number,
  gridY: number,
): Promise<number> {
  const response = await fetch(nwsUrl(office, gridX, gridY), {
    headers: { Accept: 'application/geo+json' },
  })
  if (!response.ok) throw new Error(`NWS: HTTP ${response.status}`)
  return parseElevationFt(await response.json())
}

const COMPASS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
]

/** The 16-point compass name for a direction in degrees. */
export function compassPoint(degrees: number): string {
  const turn = ((degrees % 360) + 360) % 360
  return COMPASS[Math.round(turn / 22.5) % 16]
}
