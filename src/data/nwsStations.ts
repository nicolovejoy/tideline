// The weather stations NWS lists for a forecast cell, in NWS's order, which
// is nearest the cell first. Framework-free, so it can move behind a server
// function unchanged.

import { FT_PER_M, nwsUrl } from './nws.ts'

export interface WeatherStation {
  /** NWS's identifier, such as 'KSBA'. */
  id: string
  name: string
  lat: number
  lon: number
  /** The station's height above sea level, in whole feet. */
  elevationFt: number
}

/** The list is complete on one page: a cell has 64 stations, and a second page is empty. */
export function stationsUrl(
  office: string,
  gridX: number,
  gridY: number,
): string {
  return `${nwsUrl(office, gridX, gridY)}/stations?limit=500`
}

interface Feature {
  geometry?: { coordinates?: unknown } | null
  properties?: Record<string, unknown> | null
}

/**
 * The stations in a GeoJSON answer. A station that cannot be placed, or
 * whose height is missing, is left out: the rest stand. A height in anything
 * but metres is an error, since the whole list would be wrong.
 */
export function parseStations(json: unknown): WeatherStation[] {
  const features = (json as { features?: unknown } | null)?.features
  if (!Array.isArray(features)) {
    throw new Error('NWS: response has no features')
  }
  const stations: WeatherStation[] = []
  for (const feature of features as Feature[]) {
    const coordinates = feature.geometry?.coordinates
    const properties = feature.properties
    if (
      !properties ||
      !Array.isArray(coordinates) ||
      typeof coordinates[0] !== 'number' ||
      typeof coordinates[1] !== 'number'
    ) {
      continue
    }
    const { stationIdentifier, name, elevation } = properties as {
      stationIdentifier?: unknown
      name?: unknown
      elevation?: { unitCode?: unknown; value?: unknown } | null
    }
    if (
      typeof stationIdentifier !== 'string' ||
      typeof name !== 'string' ||
      !elevation ||
      typeof elevation.value !== 'number'
    ) {
      continue
    }
    if (elevation.unitCode !== 'wmoUnit:m') {
      throw new Error(`NWS: elevation is in ${String(elevation.unitCode)}`)
    }
    stations.push({
      id: stationIdentifier,
      name,
      lon: coordinates[0],
      lat: coordinates[1],
      elevationFt: Math.round(elevation.value * FT_PER_M),
    })
  }
  return stations
}

export async function fetchStations(
  office: string,
  gridX: number,
  gridY: number,
): Promise<WeatherStation[]> {
  const response = await fetch(stationsUrl(office, gridX, gridY), {
    headers: { Accept: 'application/geo+json' },
  })
  if (!response.ok) throw new Error(`NWS: HTTP ${response.status}`)
  return parseStations(await response.json())
}
