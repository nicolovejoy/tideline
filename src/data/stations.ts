// src/data/stations.ts
// NOAA's stations, baked into src/data/stations.json by
// scripts/bake-stations.mjs, and which of them a spot uses.

import type { Station } from '../spot.ts'
import { bearingDeg, directionWord, distanceMi, roundMiles } from './geo.ts'
import type { LatLon } from './geo.ts'

/**
 * R: harmonic prediction station, with a 6-minute curve. S: subordinate,
 * highs and lows only. W: a gauge with no predictions. RW or SW: a
 * prediction station with a gauge.
 */
export type StationKind = 'R' | 'S' | 'W' | 'RW' | 'SW'

export type StationRow = [
  id: string,
  name: string,
  lat: number,
  lon: number,
  kind: StationKind,
]

const KINDS = new Set<string>(['R', 'S', 'W', 'RW', 'SW'])

export function isStationRows(data: unknown): data is StationRow[] {
  return (
    Array.isArray(data) &&
    data.every(
      (row: unknown) =>
        Array.isArray(row) &&
        row.length === 5 &&
        typeof row[0] === 'string' &&
        typeof row[1] === 'string' &&
        typeof row[2] === 'number' &&
        typeof row[3] === 'number' &&
        KINDS.has(row[4] as string),
    )
  )
}

/** The baked list, fetched with the add screen rather than every open. */
export async function loadStations(): Promise<StationRow[]> {
  const module = await import('./stations.json')
  const rows: unknown = module.default
  if (!isStationRows(rows)) throw new Error('stations.json is not a list')
  return rows
}

const predicts = (row: StationRow) => row[4] !== 'W'
const gaugeWithCurve = (row: StationRow) => row[4] === 'RW'

function nearest(
  point: LatLon,
  rows: StationRow[],
  fits: (row: StationRow) => boolean,
): StationRow {
  let best: StationRow | null = null
  let bestMi = Infinity
  for (const row of rows) {
    if (!fits(row)) continue
    const mi = distanceMi(point, { lat: row[2], lon: row[3] })
    if (mi < bestMi) {
      best = row
      bestMi = mi
    }
  }
  if (!best) throw new Error('no station of that kind')
  return best
}

function asStation(point: LatLon, row: StationRow): Station {
  const at = { lat: row[2], lon: row[3] }
  return {
    id: row[0],
    name: row[1],
    distanceMi: roundMiles(distanceMi(point, at)),
    direction: directionWord(bearingDeg(point, at)),
    type: row[4].startsWith('R') ? 'harmonic' : 'subordinate',
  }
}

/**
 * The nearest prediction station, and the nearest station that is both
 * harmonic and a gauge. The gauge's readings are set against its own
 * predicted curve, so a gauge with no curve, as on the Great Lakes, would
 * have nothing to deviate from and is never chosen. Where the tide station
 * is itself such a gauge, it is the gauge.
 */
export function nearestStations(
  point: LatLon,
  rows: StationRow[],
): { tideStation: Station; gauge: Station } {
  const tide = nearest(point, rows, predicts)
  const gauge = gaugeWithCurve(tide)
    ? tide
    : nearest(point, rows, gaugeWithCurve)
  return { tideStation: asStation(point, tide), gauge: asStation(point, gauge) }
}
