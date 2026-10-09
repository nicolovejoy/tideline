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
const asIs = (value: number) => value

const LAYERS: Record<Field, LayerSpec> = {
  tempF: {
    layer: 'temperature',
    unit: 'wmoUnit:degC',
    convert: (celsius) => (celsius * 9) / 5 + 32,
  },
  windMph: {
    layer: 'windSpeed',
    unit: 'wmoUnit:km_h-1',
    convert: (kmh) => kmh * KMH_TO_MPH,
  },
  gustMph: {
    layer: 'windGust',
    unit: 'wmoUnit:km_h-1',
    convert: (kmh) => kmh * KMH_TO_MPH,
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
