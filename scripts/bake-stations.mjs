// scripts/bake-stations.mjs
// Fetch NOAA's station lists and write the trimmed list the app ships.
// Run by hand: node scripts/bake-stations.mjs. No dependencies.
//
// One row per station: [id, name, lat, lon, kind], where kind is
//   R   harmonic prediction station (publishes a 6-minute curve)
//   S   subordinate prediction station (highs and lows only)
//   W   water-level station with no predictions (the Great Lakes, mostly)
//   RW  or SW: a prediction station that also has a gauge
// Coordinates are kept to four decimals, about 36 ft.

import { writeFile } from 'node:fs/promises'

const BASE = 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi'
const OUT = new URL('../src/data/stations.json', import.meta.url)

async function list(type) {
  const response = await fetch(`${BASE}/stations.json?type=${type}`)
  if (!response.ok) throw new Error(`NOAA: HTTP ${response.status} for ${type}`)
  const { stations } = await response.json()
  return stations
}

const round4 = (n) => Math.round(n * 1e4) / 1e4

const predictions = await list('tidepredictions')
const gauges = await list('waterlevels')
const gaugeIds = new Set(gauges.map((s) => s.id))
const predictionIds = new Set(predictions.map((s) => s.id))

const rows = []
for (const s of predictions) {
  if (s.type !== 'R' && s.type !== 'S') {
    throw new Error(`NOAA: station ${s.id} has type ${s.type}`)
  }
  const kind = gaugeIds.has(s.id) ? `${s.type}W` : s.type
  rows.push([s.id, s.name.trim(), round4(s.lat), round4(s.lng), kind])
}
for (const s of gauges) {
  if (predictionIds.has(s.id)) continue
  rows.push([s.id, s.name.trim(), round4(s.lat), round4(s.lng), 'W'])
}
rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))

// One row per line, so a re-bake diffs by station.
const text = `[\n${rows.map((row) => JSON.stringify(row)).join(',\n')}\n]\n`
await writeFile(OUT, text)
console.log(`${rows.length} stations written to ${OUT.pathname}`)
