# Today's Weather Observed Up To Now Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At a spot with a weather station within 10 miles and 500 ft, today's wind, temperature and sky panels show what the station reported up to the current time and the forecast after it, with the station named under the panels; everywhere else today stays forecast only and says why.

**Architecture:** Two new framework-free data modules fetch and parse NWS's station list for a forecast cell and a station's reports, tested against recorded responses. A plain rule module picks the station; a plain module turns a day's reports into one row per hour; both are cached on the device as two new sources. The weather view merges the observed rows with the forecast into the series, arrows, dots and words the panels already draw, with the staircase cut at the current time, and a caption names the station or says why there is none.

**Tech Stack:** Vite, React, strict TypeScript, plain CSS, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-12-observed-weather-design.md`. Issue: https://github.com/nicolovejoy/tideline/issues/56.

## Global Constraints

- Code style is the Vite template's: no semicolons, single quotes, relative imports carry their `.ts`/`.tsx` extension, type-only imports use `import type`, no enums. `npm run lint` (oxlint, then a Prettier check) must pass; run `npx prettier --write` on the files you touch.
- Components hold no arithmetic, no rules and no wording. Those live in plain modules with tests.
- Tests run with `TZ=Asia/Tokyo`. Never derive a day from a UTC ISO string; the spot's zone is explicit.
- Data modules are framework-free TypeScript tested against recorded real responses in `src/data/__fixtures__/`, each listed in that folder's `README.md`.
- Units on screen: °F and mph. Times in the spot's zone, 12-hour clock.
- The station rule: within 10 miles and within 500 ft of the spot's height, the spot's own height where known and its forecast cell's average where not (`spot.elevationFt ?? spot.nws.elevationFt`).
- The gust rule from issue 60 (`shownGust` in `src/chart/arrows.ts`) applies to observed gusts as to forecast ones.
- Node 24. In a worktree session, run commands with `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH;` at the front, and run each git command as its own plain call (no `&&` after `cd`, `export` or `source`; no heredocs).
- Commit trailer on every commit, as one `-m` argument: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- This branch, `feat/observed-weather`, is stacked on `feat/gust-rule` (pull request 62), which it needs for the arrows and the gust rule.

## Review Focus

Inputs the spec implies but did not spell out, each pinned by a test in the task named:

1. **The day the clocks go back** has 25 hours; the hour rows must follow the day's span, not count 24 from midnight (Task 4).
2. **A report stamped exactly on the current time** belongs to the observed side: `t <= now` is observed, and the cut at `now` leaves nothing of the observed step to the right of the line (Tasks 4 and 6).
3. **The current time exactly on an hour boundary**: the observed series has no step for the hour that begins at `now`, and the forecast step for it is whole (Task 6).
4. **A station chosen for a spot, then the saved rows from another station** (the lookup renewed after 30 days): rows whose station is not the one serving are not drawn (Task 4, `todaysObserved`).
5. **A value flagged by NWS as rejected, bad or questioned** is left out, and the rest of the report stands (Task 2).

---

### Task 1: The station list for a forecast cell

**Files:**
- Create: `src/data/nwsStations.ts`
- Create: `src/data/nwsStations.test.ts`
- Modify: `src/data/nws.ts` (export the unit conversions and `FT_PER_M`)
- Modify: `src/data/__fixtures__/README.md`
- Fixture already in place: `src/data/__fixtures__/nws-stations-LOX-100-71.json` (NWS `/gridpoints/LOX/100,71/stations?limit=500` for Campus Point's cell, recorded on 2026-10-13 and cut to six of its 64 stations: KSBA, LPOC1, MOIC1, KIZA, WBPC1, KLAX, in NWS's order)

**Interfaces:**
- Consumes: `nwsUrl(office, gridX, gridY)` from `src/data/nws.ts`.
- Produces: `WeatherStation { id, name, lat, lon, elevationFt }`, `stationsUrl`, `parseStations(json): WeatherStation[]`, `fetchStations(office, gridX, gridY): Promise<WeatherStation[]>`; and from `nws.ts`: `FT_PER_M`, `kmhToMph(kmh)`, `celsiusToF(c)`.

- [ ] **Step 1: Export the conversions from `nws.ts`**

In `src/data/nws.ts`, replace the `KMH_TO_MPH` constant and the two closures with named exports, and move `FT_PER_M` up beside them:

```ts
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
```

and in `LAYERS` use `convert: celsiusToF` for `tempF` and `convert: kmhToMph` for `windMph` and `gustMph`. Delete the later `const FT_PER_M = 3.28084` line above `parseElevationFt`.

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run src/data/nws.test.ts`
Expected: all pass, unchanged.

- [ ] **Step 2: Write the failing tests**

Create `src/data/nwsStations.test.ts`:

```ts
import { afterEach, describe, expect, test, vi } from 'vitest'
import { fetchStations, parseStations, stationsUrl } from './nwsStations.ts'
import realRaw from './__fixtures__/nws-stations-LOX-100-71.json?raw'

afterEach(() => vi.unstubAllGlobals())

test('stationsUrl asks the cell for all of its stations on one page', () => {
  expect(stationsUrl('LOX', 100, 71)).toBe(
    'https://api.weather.gov/gridpoints/LOX/100,71/stations?limit=500',
  )
})

describe('parseStations', () => {
  const stations = parseStations(JSON.parse(realRaw))

  test("gives each station's id, name, point and height in whole feet, in NWS's order", () => {
    expect(stations.map((station) => station.id)).toEqual([
      'KSBA',
      'LPOC1',
      'MOIC1',
      'KIZA',
      'WBPC1',
      'KLAX',
    ])
    expect(stations[0]).toEqual({
      id: 'KSBA',
      name: 'Santa Barbara, Santa Barbara Municipal Airport',
      lat: 34.42611,
      lon: -119.84361,
      elevationFt: 10,
    })
    // 299.3136 m.
    expect(stations[1].elevationFt).toBe(982)
    expect(stations[1].name).toBe('LOS PRIETOS')
  })

  test('leaves out a station it cannot place, and the rest stand', () => {
    const json = JSON.parse(realRaw) as {
      features: { geometry: unknown; properties: Record<string, unknown> }[]
    }
    json.features[1].geometry = null
    delete json.features[2].properties.elevation
    expect(parseStations(json).map((station) => station.id)).toEqual([
      'KSBA',
      'KIZA',
      'WBPC1',
      'KLAX',
    ])
  })

  test('a height in anything but metres is an error', () => {
    const json = JSON.parse(realRaw) as {
      features: { properties: { elevation: { unitCode: string } } }[]
    }
    json.features[0].properties.elevation.unitCode = 'wmoUnit:ft'
    expect(() => parseStations(json)).toThrow(/elevation/)
  })

  test('an answer with no features is an error', () => {
    expect(() => parseStations({})).toThrow(/features/)
    expect(() => parseStations(null)).toThrow(/features/)
  })
})

describe('fetchStations', () => {
  test('asks for the cell and parses the answer', async () => {
    const fetch = vi.fn(async () => new Response(realRaw, { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    const stations = await fetchStations('LOX', 100, 71)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.weather.gov/gridpoints/LOX/100,71/stations?limit=500',
      { headers: { Accept: 'application/geo+json' } },
    )
    expect(stations).toHaveLength(6)
  })

  test('a failed request is an error', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 500 }))
    await expect(fetchStations('LOX', 100, 71)).rejects.toThrow('HTTP 500')
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run src/data/nwsStations.test.ts`
Expected: FAIL, the module is not found.

- [ ] **Step 4: Write the module**

Create `src/data/nwsStations.ts`:

```ts
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
export function stationsUrl(office: string, gridX: number, gridY: number): string {
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run src/data/nwsStations.test.ts src/data/nws.test.ts`
Expected: all pass.

- [ ] **Step 6: List the fixture**

Add to `src/data/__fixtures__/README.md`, after the `nws-points-48.5--3.0.json` line:

```markdown
- `nws-stations-LOX-100-71.json`: NWS `/gridpoints/LOX/100,71/stations?limit=500`, the 64 stations listed for Campus Point's cell, recorded on 2026-10-13 and cut to six in NWS's order: KSBA Santa Barbara Municipal Airport (10 ft, 1.5 mi from Campus Point), LPOC1 Los Prietos (982 ft), MOIC1 Montecito #2 (285 ft), KIZA Santa Ynez Airport (673 ft), WBPC1 West Big Pine (6,360 ft) and KLAX. The `pagination.next` link is NWS's, which names a next page even when there is none.
```

- [ ] **Step 7: Lint and commit**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx prettier --write src/data/nwsStations.ts src/data/nwsStations.test.ts src/data/nws.ts; npm run lint`
Expected: clean.

Then, as separate plain calls:

```
git add src/data/nwsStations.ts src/data/nwsStations.test.ts src/data/nws.ts src/data/__fixtures__/README.md src/data/__fixtures__/nws-stations-LOX-100-71.json
git commit -m "The weather stations NWS lists for a forecast cell" -m "Parsed from the cell's station list to an id, a name, a point and a height in feet, tested against a recorded answer cut to six stations. The unit conversions move out of the forecast's layer table so the reports can share them." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: A station's reports

**Files:**
- Create: `src/data/nwsObservations.ts`
- Create: `src/data/nwsObservations.test.ts`
- Modify: `src/data/__fixtures__/README.md`
- Fixtures already in place: `src/data/__fixtures__/nws-observations-KSBA.json` (the airport's 16 newest reports at 17:40 UTC on 2026-10-13, 16:30 to 17:40 UTC, every 5 minutes plus the hourly report at 16:53; all clear sky, no gusts, one calm report at 16:45) and `nws-observations-LPOC1.json` (Los Prietos, 6 hourly reports 11:35 to 16:35 UTC, gusts flagged `S`, two temperatures null and flagged `Z`, no cloud layers)

**Interfaces:**
- Consumes: `kmhToMph`, `celsiusToF` from `src/data/nws.ts`.
- Produces: `Sky = 'clear' | 'few' | 'scattered' | 'broken' | 'overcast'`; `Report { t, tempF, windMph, gustMph, windDeg, sky }`; `observationsUrl(stationId, start)`; `skyOf(layers): Sky | null`; `parseObservations(json): Report[]` oldest first; `fetchObservations(stationId, start): Promise<Report[]>`.

- [ ] **Step 1: Write the failing tests**

Create `src/data/nwsObservations.test.ts`:

```ts
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  fetchObservations,
  observationsUrl,
  parseObservations,
  skyOf,
} from './nwsObservations.ts'
import ksbaRaw from './__fixtures__/nws-observations-KSBA.json?raw'
import lpoc1Raw from './__fixtures__/nws-observations-LPOC1.json?raw'

afterEach(() => vi.unstubAllGlobals())

test('observationsUrl asks for the reports from an instant, newest first, up to a page', () => {
  // 11:30 PM Pacific on 12 October 2026.
  expect(observationsUrl('KSBA', Date.UTC(2026, 9, 13, 6, 30))).toBe(
    'https://api.weather.gov/stations/KSBA/observations?start=2026-10-13T06:30:00Z&limit=500',
  )
})

describe('skyOf', () => {
  test('is the layer that covers most', () => {
    expect(skyOf([{ amount: 'FEW' }, { amount: 'BKN' }, { amount: 'SCT' }])).toBe(
      'broken',
    )
    expect(skyOf([{ amount: 'CLR' }])).toBe('clear')
    expect(skyOf([{ amount: 'SKC' }])).toBe('clear')
    expect(skyOf([{ amount: 'OVC' }])).toBe('overcast')
  })

  test('a sky hidden by fog, reported as a vertical visibility, is overcast', () => {
    expect(skyOf([{ amount: 'VV' }])).toBe('overcast')
  })

  test('no layers, or none it knows, is no sky', () => {
    expect(skyOf([])).toBeNull()
    expect(skyOf(undefined)).toBeNull()
    expect(skyOf([{ amount: 'XYZ' }])).toBeNull()
  })
})

describe('parseObservations', () => {
  const ksba = parseObservations(JSON.parse(ksbaRaw))
  const lpoc1 = parseObservations(JSON.parse(lpoc1Raw))

  test('is the reports oldest first, in °F and mph', () => {
    expect(ksba).toHaveLength(16)
    expect(ksba[0].t).toBe(Date.UTC(2026, 9, 13, 16, 30))
    expect(ksba[15].t).toBe(Date.UTC(2026, 9, 13, 17, 40))
    // 19 °C, 7.416 km/h from 120°, clear, no gust.
    expect(ksba[0].tempF).toBeCloseTo(66.2, 5)
    expect(ksba[0].windMph).toBeCloseTo(4.608, 3)
    expect(ksba[0].windDeg).toBe(120)
    expect(ksba[0].gustMph).toBeNull()
    expect(ksba[0].sky).toBe('clear')
  })

  test('a calm report has a speed of 0 and a direction of 0', () => {
    const calm = ksba.find((report) => report.t === Date.UTC(2026, 9, 13, 16, 45))
    expect(calm).toMatchObject({ windMph: 0, windDeg: 0 })
  })

  test('a value that is null is null, whatever its flag, and a report with no layers has no sky', () => {
    const blank = lpoc1.find((report) => report.t === Date.UTC(2026, 9, 13, 14, 35))
    expect(blank).toMatchObject({ tempF: null, gustMph: null, sky: null })
    expect(blank!.windMph).toBeCloseTo(1.991, 3)
  })

  test('a gust that passed screening is kept', () => {
    expect(lpoc1[5].t).toBe(Date.UTC(2026, 9, 13, 16, 35))
    expect(lpoc1[5].gustMph).toBeCloseTo(8.008, 3)
  })

  test('a value flagged rejected, bad or questioned is left out, and the rest of the report stands', () => {
    const json = JSON.parse(ksbaRaw) as {
      features: { properties: Record<string, { qualityControl: string }> }[]
    }
    json.features[0].properties.temperature.qualityControl = 'X'
    json.features[1].properties.windSpeed.qualityControl = 'B'
    json.features[2].properties.windDirection.qualityControl = 'Q'
    const reports = parseObservations(json)
    // Newest first in the answer, so feature 0 is the last report.
    expect(reports[15].tempF).toBeNull()
    expect(reports[15].windMph).not.toBeNull()
    expect(reports[14].windMph).toBeNull()
    expect(reports[14].windDeg).toBe(210)
    expect(reports[13].windDeg).toBeNull()
  })

  test('a speed in anything but km/h, or a temperature in anything but °C, is an error', () => {
    const json = JSON.parse(ksbaRaw) as {
      features: { properties: Record<string, { unitCode: string }> }[]
    }
    json.features[0].properties.windSpeed.unitCode = 'wmoUnit:m_s-1'
    expect(() => parseObservations(json)).toThrow(/windSpeed/)
  })

  test('a report with no timestamp is left out', () => {
    const json = JSON.parse(ksbaRaw) as {
      features: { properties: Record<string, unknown> }[]
    }
    delete json.features[3].properties.timestamp
    expect(parseObservations(json)).toHaveLength(15)
  })

  test('an answer with no features is an error', () => {
    expect(() => parseObservations({})).toThrow(/features/)
  })
})

describe('fetchObservations', () => {
  test('asks for the station from the instant and parses the answer', async () => {
    const fetch = vi.fn(async () => new Response(ksbaRaw, { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    const reports = await fetchObservations('KSBA', Date.UTC(2026, 9, 13, 6, 30))
    expect(fetch).toHaveBeenCalledWith(
      'https://api.weather.gov/stations/KSBA/observations?start=2026-10-13T06:30:00Z&limit=500',
      { headers: { Accept: 'application/geo+json' } },
    )
    expect(reports).toHaveLength(16)
  })

  test('a failed request is an error', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 503 }))
    await expect(fetchObservations('KSBA', 0)).rejects.toThrow('HTTP 503')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run src/data/nwsObservations.test.ts`
Expected: FAIL, the module is not found.

- [ ] **Step 3: Write the module**

Create `src/data/nwsObservations.ts`:

```ts
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
    throw new Error(`NWS: ${name} is in ${String(m.unitCode)}, expected ${unit}`)
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
      windDeg: measure('windDirection', p.windDirection, 'wmoUnit:degree_(angle)'),
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run src/data/nwsObservations.test.ts`
Expected: all pass. If `lpoc1[5].gustMph` or `blank.windMph` is off in the third decimal, check the fixture's km/h value (12.888 and 3.204) and fix the expected number, not the conversion.

- [ ] **Step 5: List the fixtures**

Add to `src/data/__fixtures__/README.md` after the stations line:

```markdown
- `nws-observations-KSBA.json`: NWS `/stations/KSBA/observations`, the airport's reports, recorded at 17:40 UTC on 2026-10-13 and cut to the 16 newest: 16:30 to 17:40 UTC, every 5 minutes with the hourly report at 16:53, newest first as NWS sends them. All clear sky, no gusts, calm at 16:45. Values carry quality flags: `V` on values that are there, `Z` on nulls.
- `nws-observations-LPOC1.json`: the same for LPOC1 Los Prietos, a station that reports hourly, 11:35 to 16:35 UTC on 2026-10-13, 6 reports: gusts in most, flagged `S`; two temperatures null; no cloud layers at all.
```

- [ ] **Step 6: Lint and commit**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx prettier --write src/data/nwsObservations.ts src/data/nwsObservations.test.ts; npm run lint`

```
git add src/data/nwsObservations.ts src/data/nwsObservations.test.ts src/data/__fixtures__/README.md src/data/__fixtures__/nws-observations-KSBA.json src/data/__fixtures__/nws-observations-LPOC1.json
git commit -m "A weather station's reports from NWS" -m "Temperature, wind, gust, direction and the sky as the cover of the layer that covers most, in °F and mph, oldest first. Values NWS flags as rejected, bad or questioned are left out. Tested against the airport's and Los Prietos's recorded reports." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Which station serves a spot

**Files:**
- Create: `src/data/weatherRule.ts`
- Create: `src/data/weatherRule.test.ts`

**Interfaces:**
- Consumes: `WeatherStation` from `nwsStations.ts`; `distanceMi`, `bearingDeg`, `directionWord`, `roundMiles`, `LatLon` from `geo.ts`.
- Produces: `STATION_WITHIN_MI = 10`, `STATION_WITHIN_FT = 500`, `NearStation extends WeatherStation { distanceMi, direction }`, `StationChoice { serves: NearStation | null; nearest: NearStation | null }`, `stationServes(distanceMi, stationFt, spotFt): boolean`, `chooseStation(at: LatLon, spotFt: number, stations: WeatherStation[]): StationChoice`, `isStationChoice(data): data is StationChoice`.

- [ ] **Step 1: Write the failing tests**

Create `src/data/weatherRule.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { parseStations } from './nwsStations.ts'
import {
  STATION_WITHIN_FT,
  STATION_WITHIN_MI,
  chooseStation,
  isStationChoice,
  stationServes,
} from './weatherRule.ts'
import realRaw from './__fixtures__/nws-stations-LOX-100-71.json?raw'

const STATIONS = parseStations(JSON.parse(realRaw))
const CAMPUS_POINT = { lat: 34.4046, lon: -119.844 }
const GAVIOTA = { lat: 34.4716, lon: -120.2284 }
const LA_CUMBRE = { lat: 34.4939, lon: -119.7147 }

describe('stationServes', () => {
  test('within 10 miles and within 500 ft, above or below', () => {
    expect(STATION_WITHIN_MI).toBe(10)
    expect(STATION_WITHIN_FT).toBe(500)
    expect(stationServes(1.5, 10, 3)).toBe(true)
    expect(stationServes(10, 10, 510)).toBe(true)
    expect(stationServes(10, 510, 10)).toBe(true)
    expect(stationServes(10.1, 10, 3)).toBe(false)
    expect(stationServes(1, 10, 511)).toBe(false)
  })
})

describe('chooseStation', () => {
  test('Campus Point, at 3 ft, is served by the airport, 1.5 mi north at 10 ft', () => {
    const { serves } = chooseStation(CAMPUS_POINT, 3, STATIONS)
    expect(serves).toMatchObject({
      id: 'KSBA',
      distanceMi: 1.5,
      direction: 'north',
      elevationFt: 10,
    })
  })

  test('La Cumbre Peak, at 3,997 ft, has none: every station near is far below it, and the nearest is said', () => {
    const { serves, nearest } = chooseStation(LA_CUMBRE, 3997, STATIONS)
    expect(serves).toBeNull()
    expect(nearest).toMatchObject({ id: 'LPOC1', elevationFt: 982 })
    expect(nearest!.distanceMi).toBeCloseTo(5.6, 0)
  })

  test('Gaviota State Park has none within 10 miles, and the nearest is said', () => {
    const { serves, nearest } = chooseStation(GAVIOTA, 0, STATIONS)
    expect(serves).toBeNull()
    expect(nearest!.id).toBe('KIZA')
    expect(nearest!.distanceMi).toBeGreaterThan(10)
  })

  test('the nearest that serves is chosen, not the first in the list', () => {
    // Listed airport first; a closer station at the spot's own height wins.
    const near = {
      id: 'TEST1',
      name: 'Test',
      lat: 34.405,
      lon: -119.844,
      elevationFt: 3,
    }
    const { serves } = chooseStation(CAMPUS_POINT, 3, [STATIONS[0], near])
    expect(serves!.id).toBe('TEST1')
  })

  test('with no stations at all, both are null', () => {
    expect(chooseStation(CAMPUS_POINT, 3, [])).toEqual({
      serves: null,
      nearest: null,
    })
  })
})

describe('isStationChoice', () => {
  test('is the shape saved on the device', () => {
    const choice = chooseStation(CAMPUS_POINT, 3, STATIONS)
    expect(isStationChoice(JSON.parse(JSON.stringify(choice)))).toBe(true)
    expect(isStationChoice({ serves: null, nearest: null })).toBe(true)
    expect(isStationChoice({ serves: null })).toBe(false)
    expect(isStationChoice({ serves: { id: 'KSBA' }, nearest: null })).toBe(false)
    expect(isStationChoice(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run src/data/weatherRule.test.ts`
Expected: FAIL, the module is not found.

- [ ] **Step 3: Write the module**

Create `src/data/weatherRule.ts`:

```ts
// Which weather station's reports stand for a spot: the nearest within 10
// miles and within 500 ft of the spot's height. Without the height La
// Cumbre Peak would show a canyon's weather as its own. Plain functions.

import { bearingDeg, directionWord, distanceMi, roundMiles } from './geo.ts'
import type { LatLon } from './geo.ts'
import type { WeatherStation } from './nwsStations.ts'

export const STATION_WITHIN_MI = 10
export const STATION_WITHIN_FT = 500

/** A station as it stands from one spot. */
export interface NearStation extends WeatherStation {
  /** As the captions say it: tenths under 10 mi, whole miles from 10. */
  distanceMi: number
  /** The 8-point compass word for where the station lies from the spot. */
  direction: string
}

export interface StationChoice {
  /** The station whose reports stand for the spot, or null where none does. */
  serves: NearStation | null
  /** The nearest station of all, so a spot with none can say why. */
  nearest: NearStation | null
}

export function stationServes(
  distance: number,
  stationFt: number,
  spotFt: number,
): boolean {
  return (
    distance <= STATION_WITHIN_MI &&
    Math.abs(stationFt - spotFt) <= STATION_WITHIN_FT
  )
}

/**
 * The nearest station that serves the spot, and the nearest of all. The
 * rule goes by the exact distance; what is saved is the rounded one.
 */
export function chooseStation(
  at: LatLon,
  spotFt: number,
  stations: WeatherStation[],
): StationChoice {
  let serves: { station: WeatherStation; distance: number } | null = null
  let nearest: { station: WeatherStation; distance: number } | null = null
  for (const station of stations) {
    const distance = distanceMi(at, station)
    if (nearest === null || distance < nearest.distance) {
      nearest = { station, distance }
    }
    if (
      stationServes(distance, station.elevationFt, spotFt) &&
      (serves === null || distance < serves.distance)
    ) {
      serves = { station, distance }
    }
  }
  const near = (found: { station: WeatherStation; distance: number } | null) =>
    found === null
      ? null
      : {
          ...found.station,
          distanceMi: roundMiles(found.distance),
          direction: directionWord(bearingDeg(at, found.station)),
        }
  return { serves: near(serves), nearest: near(nearest) }
}

function isNearStation(value: unknown): value is NearStation {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    typeof s.lat === 'number' &&
    typeof s.lon === 'number' &&
    typeof s.elevationFt === 'number' &&
    typeof s.distanceMi === 'number' &&
    typeof s.direction === 'string'
  )
}

/** Whether saved data has the shape of a station choice. For the cache. */
export function isStationChoice(data: unknown): data is StationChoice {
  if (typeof data !== 'object' || data === null) return false
  if (!('serves' in data) || !('nearest' in data)) return false
  const { serves, nearest } = data as Record<string, unknown>
  return (
    (serves === null || isNearStation(serves)) &&
    (nearest === null || isNearStation(nearest))
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run src/data/weatherRule.test.ts`
Expected: all pass. The spec measured KIZA at 12.8 mi from Gaviota and LPOC1 at 5.6 mi from La Cumbre Peak on 2026-10-12; the tests allow a tenth either way.

- [ ] **Step 5: Lint and commit**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx prettier --write src/data/weatherRule.ts src/data/weatherRule.test.ts; npm run lint`

```
git add src/data/weatherRule.ts src/data/weatherRule.test.ts
git commit -m "Which weather station serves a spot: within 10 miles and 500 ft" -m "The nearest that is both, and the nearest of all so a spot with none can say why. Of the three built-in spots only Campus Point has one." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: A day's reports as one row per hour

**Files:**
- Create: `src/data/observed.ts`
- Create: `src/data/observed.test.ts`

**Interfaces:**
- Consumes: `Report`, `Sky` from `nwsObservations.ts`; `Span` from `cache.ts`; `Loaded` from `load.ts`; `StationChoice` from `weatherRule.ts`; `HOUR`, `MINUTE` from `../time.ts`.
- Produces: `ObservedHour { t, tempF, windMph, gustMph, windDeg, sky }`; `ObservedDay { stationId, through: number | null, hours: ObservedHour[] }`; `REPORT_WITHIN = 30 * MINUTE`; `observedHours(reports, day, now): ObservedHour[]`; `observedDay(stationId, reports, day, now): ObservedDay`; `skyPct(sky): number`; `isObservedDay(data)`; `todaysObserved(station: Loaded<StationChoice>, observed: Loaded<ObservedDay>): ObservedHour[]`.

- [ ] **Step 1: Write the failing tests**

Create `src/data/observed.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import type { Loaded } from './load.ts'
import type { Report } from './nwsObservations.ts'
import {
  REPORT_WITHIN,
  isObservedDay,
  observedDay,
  observedHours,
  skyPct,
  todaysObserved,
} from './observed.ts'
import type { ObservedDay } from './observed.ts'
import type { StationChoice } from './weatherRule.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
// 13 October 2026 at Campus Point: midnight Pacific is 07:00 UTC.
const START = Date.UTC(2026, 9, 13, 7)
const DAY = { start: START, end: START + 24 * HOUR }
const NINE = START + 9 * HOUR

function report(t: number, change: Partial<Report> = {}): Report {
  return {
    t,
    tempF: 60,
    windMph: 8,
    gustMph: null,
    windDeg: 270,
    sky: 'clear',
    ...change,
  }
}

describe('observedHours', () => {
  test("an hour gone by takes the report nearest its top, from the half hour either side", () => {
    const reports = [
      report(NINE - 20 * MINUTE, { tempF: 50 }),
      report(NINE + 5 * MINUTE, { tempF: 55 }),
      report(NINE + 25 * MINUTE, { tempF: 58 }),
    ]
    const hours = observedHours(reports, DAY, NINE + 2 * HOUR)
    expect(hours.map((hour) => hour.t)).toEqual([NINE])
    expect(hours[0].tempF).toBe(55)
  })

  test('a report more than half an hour from the top of an hour does not stand for it', () => {
    const reports = [report(NINE + 31 * MINUTE)]
    expect(observedHours(reports, DAY, NINE + 2 * HOUR)).toEqual([])
    expect(REPORT_WITHIN).toBe(30 * MINUTE)
  })

  test('on a tie, the later report', () => {
    const reports = [
      report(NINE - 10 * MINUTE, { tempF: 50 }),
      report(NINE + 10 * MINUTE, { tempF: 55 }),
    ]
    expect(observedHours(reports, DAY, NINE + 2 * HOUR)[0].tempF).toBe(55)
  })

  test("the current hour takes the latest report, if it is no older than half an hour before the hour began", () => {
    const now = NINE + 40 * MINUTE
    const reports = [
      report(NINE - 25 * MINUTE, { tempF: 50 }),
      report(NINE + 35 * MINUTE, { tempF: 57 }),
    ]
    const hours = observedHours(reports, DAY, now)
    expect(hours.map((hour) => hour.t)).toEqual([NINE])
    expect(hours[0].tempF).toBe(57)
    // Only the older report: it stands for the current hour.
    expect(observedHours([reports[0]], DAY, now)[0].tempF).toBe(50)
    // A report older than that does not.
    expect(observedHours([report(NINE - 31 * MINUTE)], DAY, now)).toEqual([])
  })

  test('a report stamped on the current time is on the observed side; one after it is not', () => {
    const now = NINE + 30 * MINUTE
    expect(observedHours([report(now, { tempF: 61 })], DAY, now)[0].tempF).toBe(61)
    expect(observedHours([report(now + MINUTE)], DAY, now)).toEqual([])
  })

  test("the hour's gust is the highest in any report within the hour, and an hour with reports and no gust has none", () => {
    const reports = [
      report(NINE + 5 * MINUTE, { gustMph: 15 }),
      report(NINE + 20 * MINUTE, { gustMph: 22 }),
      report(NINE + 40 * MINUTE, { gustMph: 18 }),
      report(NINE + HOUR + 5 * MINUTE),
    ]
    const hours = observedHours(reports, DAY, NINE + 3 * HOUR)
    expect(hours[0].gustMph).toBe(22)
    expect(hours[1].gustMph).toBeNull()
  })

  test('a report with nothing in it but a gust still makes a row, with the gust alone', () => {
    const reports = [report(NINE + 15 * MINUTE, { gustMph: 20, tempF: null, windMph: null, windDeg: null, sky: null })]
    const hours = observedHours(reports, DAY, NINE + 2 * HOUR)
    expect(hours).toEqual([
      { t: NINE, tempF: null, windMph: null, gustMph: 20, windDeg: null, sky: null },
    ])
  })

  test('the first hour of the day may take a report from the last half hour of the day before', () => {
    const reports = [report(START - 25 * MINUTE, { tempF: 48 })]
    expect(observedHours(reports, DAY, START + 2 * HOUR)[0]).toMatchObject({
      t: START,
      tempF: 48,
    })
  })

  test('the rows follow the day: 25 of them on the day the clocks go back', () => {
    // 1 November 2026: midnight PDT is 07:00 UTC, the next midnight PST is 08:00 UTC.
    const fallBack = {
      start: Date.UTC(2026, 10, 1, 7),
      end: Date.UTC(2026, 10, 2, 8),
    }
    const reports = Array.from({ length: 25 }, (_, i) =>
      report(fallBack.start + i * HOUR + 5 * MINUTE),
    )
    const hours = observedHours(reports, fallBack, fallBack.end + HOUR)
    expect(hours).toHaveLength(25)
    expect(hours[24].t).toBe(fallBack.start + 24 * HOUR)
  })

  test('an hour not yet begun has no row, whatever the reports say', () => {
    const reports = [report(NINE + HOUR + 5 * MINUTE)]
    expect(observedHours(reports, DAY, NINE + 30 * MINUTE)).toEqual([])
  })
})

describe('observedDay', () => {
  test("names the station and the latest report of the day, and holds the hours", () => {
    const reports = [report(START - 10 * MINUTE), report(NINE + 5 * MINUTE)]
    const day = observedDay('KSBA', reports, DAY, NINE + 2 * HOUR)
    expect(day.stationId).toBe('KSBA')
    expect(day.through).toBe(NINE + 5 * MINUTE)
    expect(day.hours.map((hour) => hour.t)).toEqual([START, NINE])
  })

  test('with no report yet today, through is null', () => {
    const day = observedDay('KSBA', [report(START - 10 * MINUTE)], DAY, START + 10 * MINUTE)
    expect(day.through).toBeNull()
  })
})

describe('skyPct', () => {
  test('is the middle of the range each category stands for, in eighths', () => {
    expect(skyPct('clear')).toBe(0)
    expect(skyPct('few')).toBe(19)
    expect(skyPct('scattered')).toBe(44)
    expect(skyPct('broken')).toBe(75)
    expect(skyPct('overcast')).toBe(100)
  })
})

describe('isObservedDay', () => {
  test('is the shape saved on the device', () => {
    const day = observedDay('KSBA', [report(NINE + 5 * MINUTE)], DAY, NINE + 2 * HOUR)
    expect(isObservedDay(JSON.parse(JSON.stringify(day)))).toBe(true)
    expect(isObservedDay({ stationId: 'KSBA', through: null, hours: [] })).toBe(true)
    expect(isObservedDay({ stationId: 'KSBA', hours: [] })).toBe(false)
    expect(isObservedDay({ stationId: 'KSBA', through: null, hours: [{ t: 1 }] })).toBe(false)
    expect(isObservedDay(null)).toBe(false)
  })
})

describe('todaysObserved', () => {
  const ksba = { id: 'KSBA', name: 'Santa Barbara', lat: 34.4, lon: -119.8, elevationFt: 10, distanceMi: 1.5, direction: 'north' }
  function loaded<T>(data: T | null, status: Loaded<T>['status'] = 'ready'): Loaded<T> {
    return { data, fetchedAt: data ? NINE : null, span: null, status }
  }
  const day: ObservedDay = { stationId: 'KSBA', through: NINE, hours: [{ t: NINE, tempF: 60, windMph: 8, gustMph: null, windDeg: 270, sky: 'clear' }] }
  const serves: StationChoice = { serves: ksba, nearest: ksba }

  test("the rows of the day where the station serving is the one they came from", () => {
    expect(todaysObserved(loaded(serves), loaded(day))).toEqual(day.hours)
  })

  test('none where no station serves, where none is known yet, or where the rows are from another station', () => {
    expect(todaysObserved(loaded({ serves: null, nearest: ksba }), loaded(day))).toEqual([])
    expect(todaysObserved(loaded<StationChoice>(null, 'loading'), loaded(day))).toEqual([])
    expect(todaysObserved(loaded(serves), loaded({ ...day, stationId: 'KIZA' }))).toEqual([])
    expect(todaysObserved(loaded(serves), loaded<ObservedDay>(null, 'loading'))).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run src/data/observed.test.ts`
Expected: FAIL, the module is not found.

- [ ] **Step 3: Write the module**

Create `src/data/observed.ts`:

```ts
// A day's reports from a weather station turned into one row for each hour,
// as the forecast has, so the two can be drawn on one axis. Plain functions.

import type { Span } from './cache.ts'
import type { Loaded } from './load.ts'
import type { Report, Sky } from './nwsObservations.ts'
import type { StationChoice } from './weatherRule.ts'
import { HOUR, MINUTE } from '../time.ts'

export interface ObservedHour {
  /** Start of the hour, UTC instant in epoch ms. */
  t: number
  tempF: number | null
  windMph: number | null
  /** The highest gust reported in the hour, or null where none was. */
  gustMph: number | null
  windDeg: number | null
  sky: Sky | null
}

/** What is saved for a spot's day: the rows, not the reports. */
export interface ObservedDay {
  /** The station the rows came from. */
  stationId: string
  /** When the latest report of the day was taken, or null before the first. */
  through: number | null
  hours: ObservedHour[]
}

/** How far from the top of an hour a report may be and still stand for it. */
export const REPORT_WITHIN = 30 * MINUTE

function row(t: number, base: Report | null, gustMph: number | null): ObservedHour {
  return {
    t,
    tempF: base?.tempF ?? null,
    windMph: base?.windMph ?? null,
    gustMph,
    windDeg: base?.windDeg ?? null,
    sky: base?.sky ?? null,
  }
}

/**
 * One row for each hour of the day that has begun, from the reports:
 *
 * - An hour that has ended takes the report nearest its top, from the half
 *   hour either side; on a tie, the later one.
 * - The current hour takes the latest report, if it is no older than half an
 *   hour before the hour began.
 * - The hour's gust is the highest in any report stamped within it. Stations
 *   give a gust only when there is one, so an hour with reports and no gust
 *   has none.
 *
 * An hour with neither has no row. A report stamped after `now` is not used.
 */
export function observedHours(
  reports: Report[],
  day: Span,
  now: number,
): ObservedHour[] {
  const usable = reports.filter((report) => report.t <= now)
  const hours: ObservedHour[] = []
  for (let t = day.start; t < day.end && t <= now; t += HOUR) {
    const ended = t + HOUR <= now
    let base: Report | null = null
    if (ended) {
      let nearest = Infinity
      for (const report of usable) {
        const distance = Math.abs(report.t - t)
        if (distance <= REPORT_WITHIN && distance <= nearest) {
          base = report
          nearest = distance
        }
      }
    } else {
      for (const report of usable) {
        if (report.t >= t - REPORT_WITHIN) base = report
      }
    }
    let gustMph: number | null = null
    for (const report of usable) {
      if (report.t >= t && report.t < t + HOUR && report.gustMph !== null) {
        gustMph = gustMph === null ? report.gustMph : Math.max(gustMph, report.gustMph)
      }
    }
    if (base !== null || gustMph !== null) hours.push(row(t, base, gustMph))
  }
  return hours
}

/** The rows for a spot's day from one station, with the time of the latest report. */
export function observedDay(
  stationId: string,
  reports: Report[],
  day: Span,
  now: number,
): ObservedDay {
  let through: number | null = null
  for (const report of reports) {
    if (report.t >= day.start && report.t <= now && (through === null || report.t > through)) {
      through = report.t
    }
  }
  return { stationId, through, hours: observedHours(reports, day, now) }
}

/**
 * Where an observed sky sits on the percent axis: the middle of the range
 * its category stands for, in eighths of the sky. Few is 1 to 2, scattered
 * 3 to 4, broken 5 to 7, overcast 8.
 */
export function skyPct(sky: Sky): number {
  switch (sky) {
    case 'clear':
      return 0
    case 'few':
      return 19
    case 'scattered':
      return 44
    case 'broken':
      return 75
    case 'overcast':
      return 100
  }
}

const SKIES = new Set(['clear', 'few', 'scattered', 'broken', 'overcast'])

function isObservedHour(value: unknown): value is ObservedHour {
  if (typeof value !== 'object' || value === null) return false
  const hour = value as Record<string, unknown>
  const number = (field: string) =>
    hour[field] === null || typeof hour[field] === 'number'
  return (
    typeof hour.t === 'number' &&
    number('tempF') &&
    number('windMph') &&
    number('gustMph') &&
    number('windDeg') &&
    (hour.sky === null || (typeof hour.sky === 'string' && SKIES.has(hour.sky)))
  )
}

/** Whether saved data has the shape of an observed day. For the cache. */
export function isObservedDay(data: unknown): data is ObservedDay {
  if (typeof data !== 'object' || data === null) return false
  const day = data as Record<string, unknown>
  return (
    typeof day.stationId === 'string' &&
    'through' in day &&
    (day.through === null || typeof day.through === 'number') &&
    Array.isArray(day.hours) &&
    day.hours.every(isObservedHour)
  )
}

/**
 * The rows to draw today: those saved for the station that serves the spot.
 * None where no station serves, where none is known yet, or where the saved
 * rows are from a station chosen earlier.
 */
export function todaysObserved(
  station: Loaded<StationChoice>,
  observed: Loaded<ObservedDay>,
): ObservedHour[] {
  const serves = station.data?.serves ?? null
  const day = observed.data
  if (serves === null || day === null || day.stationId !== serves.id) return []
  return day.hours
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run src/data/observed.test.ts`
Expected: all pass.

- [ ] **Step 5: Lint and commit**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx prettier --write src/data/observed.ts src/data/observed.test.ts; npm run lint`

```
git add src/data/observed.ts src/data/observed.test.ts
git commit -m "A day's reports as one row for each hour" -m "An hour gone by takes the report nearest its top from the half hour either side; the current hour the latest report; the gust is the highest in the hour. What is saved is the rows and the station they came from, so rows from a station chosen earlier are not drawn." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Two more sources, loaded with the rest

**Files:**
- Modify: `src/data/cache.ts` (the `Source` union, `SOURCES`, `isStale`)
- Modify: `src/data/cache.test.ts`
- Modify: `src/data/useSpotData.ts` (`SpotData`, `stationSpec`, `observedWeatherSpec`, `useSpotData`)
- Modify: `src/data/useSpotData.test.ts`

**Interfaces:**
- Consumes: `fetchStations`, `chooseStation`, `isStationChoice`, `StationChoice`, `fetchObservations`, `observedDay`, `isObservedDay`, `ObservedDay`, `REPORT_WITHIN` from Tasks 1 to 4.
- Produces: `Source` gains `'weather-station' | 'observed-weather'`; `SpotData` gains `station: Loaded<StationChoice>` and `observedWeather: Loaded<ObservedDay>`; `stationSpec(spot, frame): SourceSpec<StationChoice>`; `observedWeatherSpec(spot, frame, stationId: string | null, now): SourceSpec<ObservedDay>`.

- [ ] **Step 1: Write the failing cache tests**

Find the `describe('isStale'` block in `src/data/cache.test.ts` and add inside it:

```ts
  test('the weather station chosen is good for 30 days', () => {
    const DAY = 24 * HOUR
    const entry = { fetchedAt: NOW - 29 * DAY, span: null, data: null }
    expect(isStale('weather-station', entry, NOW, NEEDED)).toBe(false)
    const old = { fetchedAt: NOW - 31 * DAY, span: null, data: null }
    expect(isStale('weather-station', old, NOW, NEEDED)).toBe(true)
  })

  test('the hours observed go stale after 6 minutes, as the observed tide does', () => {
    const fresh = { fetchedAt: NOW - 5 * MINUTE, span: null, data: null }
    expect(isStale('observed-weather', fresh, NOW, NEEDED)).toBe(false)
    const old = { fetchedAt: NOW - 7 * MINUTE, span: null, data: null }
    expect(isStale('observed-weather', old, NOW, NEEDED)).toBe(true)
  })
```

Use the names that block already has for the clock and the needed span (read the file: they may be `NOW`/`needed` or similar; match them). Also find the `forgetSpot` test and add the two sources to the keys it expects dropped, following its pattern.

- [ ] **Step 2: Run the cache tests to verify they fail**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run src/data/cache.test.ts`
Expected: FAIL, with a type error or a wrong result for the new sources.

- [ ] **Step 3: Add the sources**

In `src/data/cache.ts`:

```ts
import { DAY, HOUR, MINUTE } from '../time.ts'

export type Source =
  | 'predictions'
  | 'hilo'
  | 'observed'
  | 'gauge-predictions'
  | 'forecast'
  | 'weather-station'
  | 'observed-weather'
```

Add `'weather-station'` and `'observed-weather'` to `SOURCES`. In `isStale`, add cases:

```ts
    // Stations are not built every week. The spot's own facts never change.
    case 'weather-station':
      return age > 30 * DAY || fromTheFuture
    case 'observed':
    case 'observed-weather':
      return age > 6 * MINUTE || fromTheFuture
```

(replacing the existing `case 'observed':` with the pair). Check `DAY` is exported from `src/time.ts` (it is: `export const DAY = 24 * HOUR`).

- [ ] **Step 4: Run the cache tests to verify they pass**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run src/data/cache.test.ts`
Expected: all pass.

- [ ] **Step 5: Write the failing spec tests**

Add to `src/data/useSpotData.test.ts`, importing `stationSpec` and `observedWeatherSpec` from `./useSpotData.ts`, `isStationChoice` from `./weatherRule.ts`, `isObservedDay` from `./observed.ts`, and the two raw fixtures:

```ts
import stationsRaw from './__fixtures__/nws-stations-LOX-100-71.json?raw'
import ksbaRaw from './__fixtures__/nws-observations-KSBA.json?raw'

describe('stationSpec', () => {
  const frame = frameFor(CAMPUS_POINT, '2026-10-13')

  test("asks NWS for the spot's cell's stations and picks the one that serves", async () => {
    const fetch = vi.fn(async () => new Response(stationsRaw, { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    const spec = stationSpec(CAMPUS_POINT, frame)
    const choice = await spec.fetch(spec.needed)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.weather.gov/gridpoints/LOX/100,71/stations?limit=500',
      { headers: { Accept: 'application/geo+json' } },
    )
    expect(choice.serves?.id).toBe('KSBA')
    expect(spec.isEmpty(choice)).toBe(false)
  })

  test('is saved and checked as the weather station, and a cell with none is still an answer', () => {
    const spec = stationSpec(CAMPUS_POINT, frame)
    expect(spec.spotId).toBe('campus-point')
    expect(spec.source).toBe('weather-station')
    expect(spec.isData).toBe(isStationChoice)
    expect(spec.isEmpty({ serves: null, nearest: null })).toBe(false)
  })

  test("goes by the spot's own height where it has one, so La Cumbre Peak gets no station", async () => {
    vi.stubGlobal('fetch', async () => new Response(stationsRaw, { status: 200 }))
    const peak = spotById('la-cumbre-peak')
    const spec = stationSpec(peak, frameFor(peak, '2026-10-13'))
    const choice = await spec.fetch(spec.needed)
    expect(choice.serves).toBeNull()
    expect(choice.nearest?.id).toBe('LPOC1')
  })
})

describe('observedWeatherSpec', () => {
  const frame = frameFor(CAMPUS_POINT, '2026-10-13')
  // 10:42 AM Pacific.
  const NOW = Date.UTC(2026, 9, 13, 17, 42)

  test("asks for the station's reports from half an hour before the day begins, and keeps the rows", async () => {
    const fetch = vi.fn(async () => new Response(ksbaRaw, { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    const spec = observedWeatherSpec(CAMPUS_POINT, frame, 'KSBA', NOW)
    expect(spec.needed).toEqual(frame.day)
    const day = await spec.fetch(spec.needed)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.weather.gov/stations/KSBA/observations?start=2026-10-13T06:30:00Z&limit=500',
      { headers: { Accept: 'application/geo+json' } },
    )
    expect(day.stationId).toBe('KSBA')
    // The fixture's reports are 9:30 to 10:40 AM Pacific; 9 AM has ended, 10 AM is current.
    expect(day.hours.map((hour) => hour.t)).toEqual([
      Date.UTC(2026, 9, 13, 16),
      Date.UTC(2026, 9, 13, 17),
    ])
    expect(day.through).toBe(Date.UTC(2026, 9, 13, 17, 40))
  })

  test('is saved and checked as the observed weather, and a day with no rows yet is not a failure', () => {
    const spec = observedWeatherSpec(CAMPUS_POINT, frame, 'KSBA', NOW)
    expect(spec.source).toBe('observed-weather')
    expect(spec.isData).toBe(isObservedDay)
    expect(spec.isEmpty({ stationId: 'KSBA', through: null, hours: [] })).toBe(false)
  })

  test('with no station it fetches nothing', async () => {
    const spec = observedWeatherSpec(CAMPUS_POINT, frame, null, NOW)
    await expect(spec.fetch(spec.needed)).rejects.toThrow(/no station/)
  })
})
```

The 9 AM hour (16:00 UTC) has a row because the 16:30 report is within the half hour after its top; 10 AM (17:00 UTC) is the current hour at 10:42 and takes the 17:40 report.

- [ ] **Step 6: Run the spec tests to verify they fail**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run src/data/useSpotData.test.ts`
Expected: FAIL, `stationSpec` is not exported.

- [ ] **Step 7: Add the specs and load them**

In `src/data/useSpotData.ts`, add the imports:

```ts
import { fetchStations } from './nwsStations.ts'
import { fetchObservations } from './nwsObservations.ts'
import { REPORT_WITHIN, isObservedDay, observedDay } from './observed.ts'
import type { ObservedDay } from './observed.ts'
import { chooseStation, isStationChoice } from './weatherRule.ts'
import type { StationChoice } from './weatherRule.ts'
```

Add to `SpotData`, after `forecast`:

```ts
  /** The weather station whose reports stand for the spot, or that none does. */
  station: Loaded<StationChoice>
  /** Today's reports from that station, one row an hour. */
  observedWeather: Loaded<ObservedDay>
```

Add after `forecastSpec`:

```ts
/**
 * Which weather station serves the spot. Looked up once from the cell's
 * list and kept for 30 days. A cell with no station that serves is an
 * answer, not a failure, so the screen can say why today is forecast only.
 */
export function stationSpec(
  spot: Spot,
  frame: Pick<SpotData, 'window'>,
): SourceSpec<StationChoice> {
  const { office, gridX, gridY } = spot.nws
  const at = { lat: spot.lat, lon: spot.lon }
  const heightFt = spot.elevationFt ?? spot.nws.elevationFt
  return {
    spotId: spot.id,
    source: 'weather-station',
    isData: isStationChoice,
    needed: frame.window,
    fetch: async () =>
      chooseStation(at, heightFt, await fetchStations(office, gridX, gridY)),
    isEmpty: () => false,
  }
}

/**
 * Today's reports from the station, as rows. Asked for from half an hour
 * before the day begins, so the first hour can take a report from the last
 * minutes of the day before. The rows are cut at `now`, the clock reading of
 * the check that fetched them.
 */
export function observedWeatherSpec(
  spot: Spot,
  frame: Pick<SpotData, 'day'>,
  stationId: string | null,
  now: number,
): SourceSpec<ObservedDay> {
  return {
    spotId: spot.id,
    source: 'observed-weather',
    isData: isObservedDay,
    needed: frame.day,
    fetch: async (needed) => {
      if (stationId === null) throw new Error('no station serves this spot')
      const reports = await fetchObservations(stationId, needed.start - REPORT_WITHIN)
      return observedDay(stationId, reports, needed, now)
    },
    // Just after midnight there are no reports yet, and that is fine.
    isEmpty: () => false,
  }
}
```

In `useSpotData`, after the forecast line:

```ts
  const station = useLoaded(stationSpec(spot, frame), now, true)
  const serving = station.data?.serves?.id ?? null
  // Asked for only once a station is known to serve, and only for today.
  const observedWeather = useLoaded(
    observedWeatherSpec(spot, frame, serving, now),
    now,
    serving !== null,
  )
```

and return `station` and `observedWeather`.

- [ ] **Step 8: Run the whole suite**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run`
Expected: all pass. Tests that build a `SpotData` by hand (search for `gaugePredictions:` in `src/ui/*.test.ts`) may need the two new fields; add `station: loaded(null, 'loading')`-style values following each file's own helper.

- [ ] **Step 9: Lint and commit**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx prettier --write src/data/cache.ts src/data/cache.test.ts src/data/useSpotData.ts src/data/useSpotData.test.ts; npm run lint; npx tsc --noEmit -p tsconfig.app.json`
Expected: clean.

```
git add src/data/cache.ts src/data/cache.test.ts src/data/useSpotData.ts src/data/useSpotData.test.ts
git commit -m "The weather station and today's observed hours, loaded with the rest" -m "Two more sources: the station chosen, or that none serves, kept for 30 days; and the day's rows, stale after 6 minutes as the observed tide is. The reports are asked for only once a station is known to serve, and only for today." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

If any `src/ui` test file was changed in Step 8, add it to the commit.

---

### Task 6: A staircase cut at an instant, and an observed look

**Files:**
- Modify: `src/chart/scales.ts` (`Cut`, `stepPath`)
- Modify: `src/chart/scales.test.ts`
- Modify: `src/chart/arrows.ts` (`Arrow.observed`, `ARROW_SOLID_PATH`, `DOT_RADIUS_OBSERVED`)
- Modify: `src/chart/arrows.test.ts`
- Modify: `src/chart/Panel.tsx` (`Series.look`, `Series.cut`, observed arrows)
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `Cut { at: number; keep: 'before' | 'after' }`; `stepPath(points, x, y, width, cut?: Cut)`; `Series.cut?: Cut`; `Arrow.observed?: boolean`; `ARROW_SOLID_PATH`; `DOT_RADIUS_OBSERVED = 3`.

- [ ] **Step 1: Write the failing path tests**

Add inside `describe('stepPath'` in `src/chart/scales.test.ts`:

```ts
  test('cut to keep what is before an instant: the step containing it ends there, and later steps are not drawn', () => {
    const points = [
      { t: 0, v: 20 },
      { t: HOUR, v: 50 },
      { t: 2 * HOUR, v: 50 },
    ]
    const cut = { at: HOUR + 30 * 60_000, keep: 'before' as const }
    expect(stepPath(points, x, y, HOUR, cut)).toBe('M0.0,80.0H30.0V50.0H45.0')
  })

  test('cut to keep what is after an instant: the step containing it starts there, and earlier steps are drawn whole', () => {
    const points = [
      { t: 0, v: 20 },
      { t: HOUR, v: 50 },
      { t: 2 * HOUR, v: 50 },
    ]
    const cut = { at: HOUR + 30 * 60_000, keep: 'after' as const }
    expect(stepPath(points, x, y, HOUR, cut)).toBe(
      'M0.0,80.0H30.0M45.0,50.0H60.0V50.0H90.0',
    )
  })

  test('an instant on a step boundary leaves nothing of that step before it, and all of it after', () => {
    const points = [
      { t: 0, v: 20 },
      { t: HOUR, v: 50 },
    ]
    expect(stepPath(points, x, y, HOUR, { at: HOUR, keep: 'before' })).toBe(
      'M0.0,80.0H30.0',
    )
    expect(stepPath(points, x, y, HOUR, { at: HOUR, keep: 'after' })).toBe(
      'M0.0,80.0H30.0V50.0H60.0',
    )
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run src/chart/scales.test.ts`
Expected: FAIL: the paths are drawn whole.

- [ ] **Step 3: Cut the staircase**

Replace `stepPath` in `src/chart/scales.ts`:

```ts
/** Where a staircase is cut, and which side of the cut is drawn. */
export interface Cut {
  at: number
  /**
   * 'before': the step containing `at` ends there, and steps from `at` on are
   * not drawn. 'after': the step containing `at` starts there; steps before
   * it are drawn whole, since they may be what fills a gap on that side.
   */
  keep: 'before' | 'after'
}

/**
 * A staircase through values that each hold for `width`, as an hourly
 * forecast's do: level across each one, then straight up or down to the next.
 * Where the next value starts later than this one ends, the line breaks, and
 * so it does on either side of a cut.
 */
export function stepPath(
  points: Point[],
  x: Scale,
  y: Scale,
  width: number,
  cut?: Cut,
): string {
  let path = ''
  // Where the last step drawn ended in time, or null before the first.
  let drawnTo: number | null = null
  for (const point of points) {
    let from = point.t
    let to = point.t + width
    if (cut) {
      if (cut.keep === 'before') {
        if (from >= cut.at) continue
        if (to > cut.at) to = cut.at
      } else if (from < cut.at && cut.at < to) {
        from = cut.at
      }
    }
    const level = y(point.v).toFixed(1)
    const joined = drawnTo !== null && from === point.t && from <= drawnTo
    path += joined ? `V${level}` : `M${x(from).toFixed(1)},${level}`
    path += `H${x(to).toFixed(1)}`
    drawnTo = to
  }
  return path
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run src/chart/scales.test.ts`
Expected: all pass, the four earlier `stepPath` tests included.

- [ ] **Step 5: Write the failing arrow tests**

Add to `src/chart/arrows.test.ts`, importing `ARROW_SOLID_PATH` and `DOT_RADIUS_OBSERVED`:

```ts
describe('the observed glyphs', () => {
  test('the solid arrow is the open one with its head closed, so it fills', () => {
    expect(ARROW_SOLID_PATH).toBe(`${ARROW_PATH}Z`)
  })

  test('the observed dot is a little larger than the forecast one', () => {
    expect(DOT_RADIUS_OBSERVED).toBeGreaterThan(DOT_RADIUS)
    expect(DOT_RADIUS_OBSERVED).toBe(3)
  })
})
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run src/chart/arrows.test.ts`
Expected: FAIL, the names are not exported.

- [ ] **Step 7: Add the observed glyphs and the series look**

In `src/chart/arrows.ts`, after `ARROW_PATH`:

```ts
/** The same arrow with its head closed, so it can be filled: an observed hour. */
export const ARROW_SOLID_PATH = `${ARROW_PATH}Z`
```

after `DOT_RADIUS`:

```ts
/** The dot for an observed calm hour, a little larger so the two sides tell apart. */
export const DOT_RADIUS_OBSERVED = 3
```

and in `Arrow`:

```ts
  /** Drawn solid, as what the station reported. Absent for the forecast. */
  observed?: boolean
```

In `src/chart/Panel.tsx`, import `ARROW_SOLID_PATH`, `DOT_RADIUS_OBSERVED` and `type { Cut }`; add to `Series`:

```ts
  /** Where the staircase is cut, and which side is drawn. Only with `step`. */
  cut?: Cut
```

Change the step branch to `stepPath(one.points, x, y, one.step, one.cut)`. Change the arrows:

```tsx
        {arrows.map((arrow) =>
          arrow.angle === null ? (
            <circle
              key={arrow.t}
              className={arrow.observed ? 'arrow-dot arrow-dot-observed' : 'arrow-dot'}
              cx={x(arrow.t)}
              cy={y(arrow.v)}
              r={arrow.observed ? DOT_RADIUS_OBSERVED : DOT_RADIUS}
            />
          ) : (
            <g
              key={arrow.t}
              className={arrow.observed ? 'arrow arrow-observed' : 'arrow'}
              transform={`translate(${x(arrow.t).toFixed(1)} ${y(arrow.v).toFixed(1)}) rotate(${arrow.angle})`}
            >
              <path d={arrow.observed ? ARROW_SOLID_PATH : ARROW_PATH} />
            </g>
          ),
        )}
```

In `src/styles.css`, after the `.arrow-dot` rule:

```css
/* Today's observed side: what the station reported, heavier than the
   forecast beside it, and its arrows filled. */
.series-temp-observed .line,
.series-cloud-observed .line {
  stroke: var(--observed);
  stroke-width: 3.5;
}
.series-gust-observed .line {
  stroke: var(--muted);
  stroke-width: 2.5;
}
.arrow-observed path {
  fill: var(--observed);
  stroke: var(--observed);
  stroke-width: 2;
}
.arrow-dot-observed {
  fill: var(--observed);
}
```

and after `.dot-gust, .dot-rain`:

```css
.dot-wind-observed,
.dot-temp-observed,
.dot-cloud-observed {
  fill: var(--observed);
}
.dot-gust-observed {
  fill: var(--muted);
}
```

- [ ] **Step 8: Run the suite, lint, type-check**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run; npx prettier --write src/chart/scales.ts src/chart/scales.test.ts src/chart/arrows.ts src/chart/arrows.test.ts src/chart/Panel.tsx; npm run lint; npx tsc --noEmit -p tsconfig.app.json`
Expected: all pass, clean.

- [ ] **Step 9: Commit**

```
git add src/chart/scales.ts src/chart/scales.test.ts src/chart/arrows.ts src/chart/arrows.test.ts src/chart/Panel.tsx src/styles.css
git commit -m "A staircase cut at an instant, and the observed look" -m "stepPath takes a cut: keep what is before it, or what is after. An arrow can be observed, drawn solid with a larger dot. The styles for the observed side." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: The words say which side

**Files:**
- Modify: `src/chart/readout.ts` (`SourceWord`, `ReadoutPart.source`/`label`, `withSourceWords`, `partsText`, `skyWords`, `windParts`/`tempParts`/`skyParts` take a source, `cloudPart`/`rainPart`)
- Modify: `src/chart/readout.test.ts`
- Modify: `src/ui/WeatherPanels.tsx` (label parts muted)
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `Sky` from `../data/nwsObservations.ts`.
- Produces: `SourceWord = 'observed' | 'forecast'`; `ReadoutPart { key, text, source?: SourceWord, label?: true }`; `withSourceWords(parts): ReadoutPart[]`; `partsText(parts)` joins with ', ' and with '; ' after a label; `skyWords(sky): string`; `windParts(hour, source?)`, `tempParts(hour, source?)`, `skyParts(hour, source?)`, `cloudPart(pct, source?)`, `rainPart(pct, source?)`, `skyCategoryPart(sky, source?)`.

- [ ] **Step 1: Write the failing tests**

Add to `src/chart/readout.test.ts`, inside `describe('the weather under the cursor'`, importing the new names:

```ts
  describe('the source words', () => {
    test('each part can say which side it is from, and the word is said once after a run', () => {
      const parts = withSourceWords(windParts(hour(NOON), 'observed'))
      expect(parts).toEqual([
        { key: 'wind', text: '9 mph from W', source: 'observed' },
        { key: 'gust', text: 'gusts 12', source: 'observed' },
        { key: null, text: 'observed', source: 'observed', label: true },
      ])
      expect(partsText(parts)).toBe('9 mph from W, gusts 12, observed')
    })

    test('two runs from different sides are set apart by a semicolon', () => {
      const parts = withSourceWords([
        skyCategoryPart('scattered', 'observed'),
        rainPart(0, 'forecast'),
      ])
      expect(partsText(parts)).toBe('Scattered cloud, observed; 0% rain, forecast')
    })

    test('with no sources nothing is added, as on any other day', () => {
      const parts = windParts(hour(NOON))
      expect(withSourceWords(parts)).toEqual(parts)
      expect(partsText(parts)).toBe('9 mph from W, gusts 12')
    })

    test('no parts is no parts', () => {
      expect(withSourceWords([])).toEqual([])
    })
  })

  describe('skyWords', () => {
    test('the category in words', () => {
      expect(skyWords('clear')).toBe('Clear')
      expect(skyWords('few')).toBe('Few clouds')
      expect(skyWords('scattered')).toBe('Scattered cloud')
      expect(skyWords('broken')).toBe('Broken cloud')
      expect(skyWords('overcast')).toBe('Overcast')
    })
  })

  test('tempParts and skyParts carry the source too', () => {
    expect(tempParts(hour(NOON), 'observed')).toEqual([
      { key: 'temp', text: '74°F', source: 'observed' },
    ])
    expect(skyParts(hour(NOON), 'forecast')).toEqual([
      { key: 'cloud', text: '3% cloud', source: 'forecast' },
      { key: 'rain', text: '0% rain', source: 'forecast' },
    ])
    expect(cloudPart(40, 'forecast')).toEqual({ key: 'cloud', text: '40% cloud', source: 'forecast' })
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run src/chart/readout.test.ts`
Expected: FAIL, the names are not exported.

- [ ] **Step 3: Add the source words**

In `src/chart/readout.ts`, import `type { Sky } from '../data/nwsObservations.ts'`, and replace `ReadoutPart` and the wind, temperature, sky and text functions:

```ts
/** Which side of today a value is from. Absent on any other day. */
export type SourceWord = 'observed' | 'forecast'

/** One piece of a weather readout, and the series it describes, if any. */
export interface ReadoutPart {
  /** Names the series, for its colour key: 'wind', 'gust' and so on. */
  key: string | null
  text: string
  /** Which side of today the value is from, where that is said. */
  source?: SourceWord
  /** The word that says it, 'observed' or 'forecast', after a run of parts. */
  label?: true
}

/** The part for a value, with its source where there is one. */
function part(key: string | null, text: string, source?: SourceWord): ReadoutPart {
  return source === undefined ? { key, text } : { key, text, source }
}

/**
 * The wind in an hour: '9 mph from W', then 'gusts 12'. The words say where
 * the wind comes from; the arrow on the panel points where it goes. A calm
 * hour is 'Calm', with no direction. Each part is there only if the
 * forecast has it, the gusts only where they stand out from the wind
 * (`shownGust`), and the unit is given once, by the first number.
 */
export function windParts(
  hour: ForecastHour | null,
  source?: SourceWord,
): ReadoutPart[] {
  if (!hour) return []
  const parts: ReadoutPart[] = []
  const from =
    hour.windDeg === null ? null : `from ${compassPoint(hour.windDeg)}`
  let unitGiven = false
  if (hour.windMph !== null) {
    if (isCalm(hour.windMph)) {
      parts.push(part('wind', 'Calm', source))
    } else {
      const speed = `${whole(hour.windMph)} mph`
      parts.push(part('wind', from ? `${speed} ${from}` : speed, source))
      unitGiven = true
    }
  }
  const gust = shownGust(hour)
  if (gust !== null) {
    const unit = unitGiven ? '' : ' mph'
    parts.push(part('gust', `gusts ${whole(gust)}${unit}`, source))
  }
  if (hour.windMph === null && from) parts.push(part(null, from, source))
  return parts
}

/** The temperature in an hour, as '74°F'. */
export function tempParts(
  hour: ForecastHour | null,
  source?: SourceWord,
): ReadoutPart[] {
  if (!hour || hour.tempF === null) return []
  return [part('temp', `${whole(hour.tempF)}°F`, source)]
}

export function cloudPart(pct: number, source?: SourceWord): ReadoutPart {
  return part('cloud', `${whole(pct)}% cloud`, source)
}

export function rainPart(pct: number, source?: SourceWord): ReadoutPart {
  return part('rain', `${whole(pct)}% rain`, source)
}

/** An observed sky as a station reports it: the category, not a percentage. */
export function skyWords(sky: Sky): string {
  switch (sky) {
    case 'clear':
      return 'Clear'
    case 'few':
      return 'Few clouds'
    case 'scattered':
      return 'Scattered cloud'
    case 'broken':
      return 'Broken cloud'
    case 'overcast':
      return 'Overcast'
  }
}

export function skyCategoryPart(sky: Sky, source?: SourceWord): ReadoutPart {
  return part('cloud', skyWords(sky), source)
}

/** Cloud cover and the chance of rain in an hour: '3% cloud', '0% rain'. */
export function skyParts(
  hour: ForecastHour | null,
  source?: SourceWord,
): ReadoutPart[] {
  if (!hour) return []
  const parts: ReadoutPart[] = []
  if (hour.cloudPct !== null) parts.push(cloudPart(hour.cloudPct, source))
  if (hour.rainPct !== null) parts.push(rainPart(hour.rainPct, source))
  return parts
}

/**
 * The parts with the side said after each run from one side: '9 mph from
 * W, gusts 12, observed'. Parts with no side are left as they are.
 */
export function withSourceWords(parts: ReadoutPart[]): ReadoutPart[] {
  const out: ReadoutPart[] = []
  parts.forEach((one, i) => {
    out.push(one)
    const next = parts[i + 1]
    if (one.source !== undefined && next?.source !== one.source) {
      out.push({ key: null, text: one.source, source: one.source, label: true })
    }
  })
  return out
}

/**
 * A readout as one run of words, such as '9 mph, gusts 12, from W'. Runs
 * from different sides are set apart by a semicolon, after the side's word.
 */
export function partsText(parts: ReadoutPart[]): string {
  let text = ''
  parts.forEach((one, i) => {
    if (i > 0) text += parts[i - 1].label ? '; ' : ', '
    text += one.text
  })
  return text
}
```

Also make `hourAt` take any list of hours, since Task 8 looks up a merged hour with it:

```ts
/** The hour that contains an instant, if the list has it. */
export function hourAt<T extends { t: number }>(hours: T[], t: number): T | null {
  const start = Math.floor(t / HOUR) * HOUR
  return hours.find((hour) => hour.t === start) ?? null
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run src/chart/readout.test.ts src/ui/dayList.test.ts src/ui/weatherView.test.ts`
Expected: all pass. `partsText` on parts without labels is unchanged.

- [ ] **Step 5: Draw the label parts muted**

In `src/ui/WeatherPanels.tsx`, change the readout's map:

```tsx
          {one.readout.map((part, i) => (
            <span
              key={`${i}-${part.text}`}
              className={
                part.label
                  ? 'source'
                  : part.key === null
                    ? undefined
                    : `key key-${part.key}`
              }
            >
              {part.text}
            </span>
          ))}
```

In `src/styles.css`, after the `.readout-row` rule:

```css
/* 'observed' or 'forecast' after a run of values, on today only. */
.readout-row .source {
  color: var(--muted);
}
```

- [ ] **Step 6: Lint and commit**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx prettier --write src/chart/readout.ts src/chart/readout.test.ts src/ui/WeatherPanels.tsx; npm run lint; npx tsc --noEmit -p tsconfig.app.json`

```
git add src/chart/readout.ts src/chart/readout.test.ts src/ui/WeatherPanels.tsx src/styles.css
git commit -m "The words at the cursor can say which side of today they are from" -m "Each part may carry its source, said once after a run: '9 mph from W, gusts 12, observed'. Runs from different sides are set apart by a semicolon. An observed sky is its category in words." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: The panels draw two sides of today

**Files:**
- Modify: `src/ui/weatherView.ts`
- Modify: `src/ui/weatherView.test.ts`

**Interfaces:**
- Consumes: `ObservedHour`, `skyPct` from `../data/observed.ts`; `Cut` from `../chart/scales.ts`; `shownGust`, `arrowAngle`, `isCalm` from `../chart/arrows.ts`.
- Produces: `weatherView(forecast, selected, cursor, now, observed: ObservedHour[] = [])`. On today, each panel's `series` holds an observed staircase per value (name `temp-observed`, `cloud-observed`, `gust-observed`, cut before `now`), then the forecast staircase (cut after `now` where the current hour is observed), `arrows` marks observed hours, and `bounds` take the observed values in. This task leaves the readout and the dots to Task 9.

- [ ] **Step 1: Write the failing tests**

Add to `src/ui/weatherView.test.ts` a helper and a describe block. The file's `NOW` is 3:36 PM on day 0 and `START` its midnight; `hourly` makes forecast hours (temp 50 + hour of day, wind 9, gust 12, from 270, cloud 3, rain 0).

```ts
import type { ObservedHour } from '../data/observed.ts'

/** Observed rows from midnight to the hour containing `until`, one an hour. */
function observed(
  until: number,
  change: (hour: ObservedHour) => void = () => {},
): ObservedHour[] {
  const rows: ObservedHour[] = []
  for (let t = START; t <= until; t += HOUR) {
    const row: ObservedHour = {
      t,
      tempF: 60 + ((t - START) / HOUR) % 24,
      windMph: 5,
      gustMph: null,
      windDeg: 180,
      sky: 'scattered',
    }
    change(row)
    rows.push(row)
  }
  return rows
}

describe('today with a station', () => {
  // NOW is 3:36 PM: fifteen hours have ended, and 3 PM is the current hour.
  const rows = observed(NOW)

  test('each value has an observed staircase up to now and the forecast after, with the current hour cut at the line', () => {
    const view = weatherView(week, day(0), NOW, NOW, rows)
    expect(view.temp.series.map((series) => series.name)).toEqual([
      'temp-observed',
      'temp',
    ])
    const [obs, fc] = view.temp.series
    expect(obs.points).toHaveLength(16)
    expect(obs.points[0]).toEqual({ t: START, v: 60 })
    expect(obs.points[15].t).toBe(START + 15 * HOUR)
    expect(obs.cut).toEqual({ at: NOW, keep: 'before' })
    // The forecast runs from 5 AM, but its hours up to 2 PM are covered by
    // rows. The current hour, 3 PM, is in both: observed to the line, forecast after.
    expect(fc.points[0].t).toBe(START + 15 * HOUR)
    expect(fc.points).toHaveLength(9)
    expect(fc.cut).toEqual({ at: NOW, keep: 'after' })
  })

  test('an hour gone by with no row shows the forecast for it, whole, and the forecast of the current hour is whole where there is no row for it', () => {
    const patchy = rows.filter((row) => row.t !== START + 10 * HOUR && row.t !== START + 15 * HOUR)
    const [obs, fc] = weatherView(week, day(0), NOW, NOW, patchy).temp.series
    expect(obs.points.map((point) => point.t)).not.toContain(START + 10 * HOUR)
    expect(fc.points.map((point) => point.t)).toContain(START + 10 * HOUR)
    expect(fc.cut).toBeUndefined()
  })

  test('a value a row lacks is filled from the forecast for that hour, worded and drawn as forecast', () => {
    const blind = observed(NOW, (row) => {
      if (row.t === START + 12 * HOUR) row.tempF = null
    })
    const [obs, fc] = weatherView(week, day(0), NOW, NOW, blind).temp.series
    expect(obs.points.map((point) => point.t)).not.toContain(START + 12 * HOUR)
    expect(fc.points.find((point) => point.t === START + 12 * HOUR)).toEqual({
      t: START + 12 * HOUR,
      v: 62,
    })
  })

  test("an observed sky is drawn at the middle of its category's range, and the rain stays forecast all day", () => {
    const view = weatherView(week, day(0), NOW, NOW, rows)
    expect(view.sky.series.map((series) => series.name)).toEqual([
      'cloud-observed',
      'cloud',
      'rain',
    ])
    expect(view.sky.series[0].points[0]).toEqual({ t: START, v: 44 })
    // Rain from 5 AM, as the forecast has it, uncut.
    expect(view.sky.series[2].points[0].t).toBe(FIRST)
    expect(view.sky.series[2].points).toHaveLength(19)
    expect(view.sky.series[2].cut).toBeUndefined()
  })

  test('a row with no sky leaves the forecast cloud for that hour', () => {
    const noSky = observed(NOW, (row) => {
      row.sky = null
    })
    const view = weatherView(week, day(0), NOW, NOW, noSky)
    expect(view.sky.series[0].points).toEqual([])
    expect(view.sky.series[1].points).toHaveLength(19)
    expect(view.sky.series[1].cut).toBeUndefined()
  })

  test('observed gusts go by the gust rule, and an hour with a row and no gust has no gust from the forecast either', () => {
    const gusty = observed(NOW, (row) => {
      if (row.t === START + 8 * HOUR) row.gustMph = 12 // 12 over 5 stands out.
      if (row.t === START + 9 * HOUR) row.gustMph = 6 // 6 over 5 does not.
    })
    const view = weatherView(week, day(0), NOW, NOW, gusty)
    expect(view.wind.series.map((series) => series.name)).toEqual([
      'gust-observed',
      'gust',
    ])
    expect(view.wind.series[0].points).toEqual([{ t: START + 8 * HOUR, v: 12 }])
    // The forecast's gust of 12 is not drawn for any hour gone by that has a
    // row, and in the current hour only right of the line.
    expect(view.wind.series[1].points[0].t).toBe(START + 15 * HOUR)
    expect(view.wind.series[1].cut).toEqual({ at: NOW, keep: 'after' })
  })

  test('observed hours have solid arrows, at their own speed, and the current hour is observed where it has a row', () => {
    const view = weatherView(week, day(0), NOW, NOW, rows)
    const arrows = view.wind.arrows
    const at = (t: number) => arrows.find((arrow) => arrow.t === t + HOUR / 2)
    // A south wind (180) points up (0).
    expect(at(START)).toEqual({ t: START + HOUR / 2, v: 5, angle: 0, observed: true })
    expect(at(START + 15 * HOUR)?.observed).toBe(true)
    expect(at(START + 16 * HOUR)).toEqual({
      t: START + 16 * HOUR + HOUR / 2,
      v: 9,
      angle: 90,
    })
    // One arrow per hour: midnight to 11 PM.
    expect(arrows).toHaveLength(24)
  })

  test('the ranges take the observed values in', () => {
    const hot = observed(NOW, (row) => {
      row.tempF = 95
      row.windMph = 31
    })
    const view = weatherView(week, day(0), NOW, NOW, hot)
    expect(view.temp.bounds).toEqual([50, 100])
    expect(view.wind.bounds).toEqual([0, 40])
  })

  test('on another day the rows are ignored', () => {
    const view = weatherView(week, day(1), NOW, NOW, rows)
    expect(view.temp.series.map((series) => series.name)).toEqual(['temp'])
    expect(view.temp.series[0].cut).toBeUndefined()
    expect(view.wind.arrows.every((arrow) => arrow.observed === undefined)).toBe(true)
  })

  test('with rows and no forecast at all, today is drawn from the rows alone', () => {
    const view = weatherView(loaded(null, 'unavailable'), day(0), NOW, NOW, rows)
    expect(view.notice).toBeNull()
    expect(view.temp.series[0].points).toHaveLength(16)
    expect(view.temp.series[1].points).toEqual([])
  })
})
```

Also update the existing test `'one staircase per value but the wind, over the hours of the day on screen'` if it asserts on `series` names for today with no rows: with no rows the names stay `['gust']`, `['temp']`, `['cloud', 'rain']` (no observed series is added when there are no rows), so it should still pass as written.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run src/ui/weatherView.test.ts`
Expected: FAIL, in the new block.

- [ ] **Step 3: Merge the rows into the view**

Rewrite `src/ui/weatherView.ts`. Keep `forecastHours`, `NOTHING_HERE`, the `PanelSpec`s, `withShownGusts`, `values` and the notice logic; change `panel` and `weatherView` as below. The whole file after the change:

```ts
// What the three weather panels show, worked out from the forecast, today's
// observed rows where a station serves, which day is on screen and where the
// cursor is. A plain function, so the rules have tests and App.tsx only
// arranges the result.

import { arrowAngle, isCalm, shownGust } from '../chart/arrows.ts'
import type { Arrow } from '../chart/arrows.ts'
import type { Dot, Rule, Series } from '../chart/Panel.tsx'
import {
  cloudPart,
  hourAt,
  partsText,
  rainPart,
  skyCategoryPart,
  tempParts,
  windParts,
  withSourceWords,
} from '../chart/readout.ts'
import type { ReadoutPart, SourceWord } from '../chart/readout.ts'
import { steppedBounds, wholeSteps } from '../chart/scales.ts'
import type { Loaded } from '../data/load.ts'
import type { Forecast, ForecastHour } from '../data/nws.ts'
import type { Sky } from '../data/nwsObservations.ts'
import { skyPct } from '../data/observed.ts'
import type { ObservedHour } from '../data/observed.ts'
import { HOUR } from '../time.ts'
import { onDay } from './selection.ts'
import type { Selected } from './selection.ts'

const NOTHING_HERE: ReadoutPart[] = [{ key: null, text: 'No forecast here' }]

export interface WeatherPanelView {
  title: string
  /** The values under the cursor, in words, each with its series' key. */
  readout: ReadoutPart[]
  /** The plot's vertical range. */
  bounds: [number, number]
  rules: Rule[]
  /**
   * One staircase per value, each point holding for an hour. On today with
   * a station, an observed staircase first, cut at the current time, then
   * the forecast's, which fills the hours the station did not report.
   */
  series: Series[]
  /** The wind panel's arrows, one per hour that has a speed. None elsewhere. */
  arrows: Arrow[]
  /** Where the cursor meets each value the hour under it has. */
  dots: Dot[]
}

export interface WeatherView {
  /** What to say where the three panels would be, when they are not drawn. */
  notice: string | null
  /** Everything the panels say at the cursor, as one run of words. */
  words: string
  wind: WeatherPanelView
  temp: WeatherPanelView
  sky: WeatherPanelView
}

/**
 * The saved forecast's hours, or none when every one of them has passed: a
 * forecast that old counts as no forecast, in the panels and the list alike.
 */
export function forecastHours(
  forecast: Loaded<Forecast>,
  now: number,
): ForecastHour[] {
  const all = forecast.data?.hours ?? []
  const last = all.length > 0 ? all[all.length - 1].t : null
  return last === null || last + HOUR <= now ? [] : all
}

type Field = Exclude<keyof ForecastHour, 't'>

/**
 * An observed row in the forecast's shape, so the same rules word and draw
 * it: its sky at the middle of its category's range, and no chance of rain.
 */
export function asForecastHour(row: ObservedHour): ForecastHour {
  return {
    t: row.t,
    tempF: row.tempF,
    windMph: row.windMph,
    gustMph: row.gustMph,
    windDeg: row.windDeg,
    cloudPct: row.sky === null ? null : skyPct(row.sky),
    rainPct: null,
  }
}

/** One hour of today: the forecast for it, and what the station reported. */
interface TodayHour {
  t: number
  forecast: ForecastHour | null
  /** The row in the forecast's shape, or null where there is no row. */
  observed: ForecastHour | null
  /** The row's sky as a category, for the words. Null where there is no row or no sky. */
  sky: Sky | null
}

interface PanelSpec {
  title: string
  /** The staircases, in the order drawn: each one's name and the field it draws. */
  fields: [name: string, field: Field][]
  /** The values the cursor's dots sit on: the staircases, and for the wind its speed. */
  dots: [name: string, field: Field][]
  /** How far apart the rules are, and the unit written on each label. */
  every: number
  unit: string
}

const WIND: PanelSpec = {
  title: 'Wind',
  // The wind's speed is drawn as arrows, not a line; see `windArrows`.
  fields: [['gust', 'gustMph']],
  dots: [
    ['wind', 'windMph'],
    ['gust', 'gustMph'],
  ],
  every: 10,
  unit: ' mph',
}
const TEMP: PanelSpec = {
  title: 'Temperature',
  fields: [['temp', 'tempF']],
  dots: [['temp', 'tempF']],
  every: 10,
  unit: '°F',
}
const SKY: PanelSpec = {
  title: 'Sky',
  fields: [
    ['cloud', 'cloudPct'],
    ['rain', 'rainPct'],
  ],
  dots: [
    ['cloud', 'cloudPct'],
    ['rain', 'rainPct'],
  ],
  every: 50,
  unit: '%',
}

/** The fields a station reports. The chance of rain is forecast all day. */
const OBSERVED_FIELDS = new Set<Field>([
  'tempF',
  'windMph',
  'gustMph',
  'windDeg',
  'cloudPct',
])

/**
 * The hours with only the gusts worth showing: an hour whose gust does not
 * stand out from its wind has none. The staircase, the dot and the words
 * then agree. The vertical range is worked out from the hours as given, so
 * the panel does not jump as the rule hides a gust.
 */
function withShownGusts<T extends ForecastHour | null>(hour: T): T {
  return hour === null ? hour : { ...hour, gustMph: shownGust(hour) }
}

function arrowFor(hour: ForecastHour, observed: boolean): Arrow | null {
  if (hour.windMph === null) return null
  const angle =
    hour.windDeg === null || isCalm(hour.windMph)
      ? null
      : arrowAngle(hour.windDeg)
  const arrow: Arrow = { t: hour.t + HOUR / 2, v: hour.windMph, angle }
  return observed ? { ...arrow, observed: true } : arrow
}

/**
 * One arrow per hour that has a wind speed, drawn at the middle of its hour
 * at that speed, pointing where the wind is going. A calm hour, or one with
 * no direction, is a dot. An hour the station reported takes its arrow from
 * the report, drawn solid.
 */
function windArrows(hours: TodayHour[]): Arrow[] {
  return hours.flatMap((hour) => {
    const observed = hour.observed !== null && hour.observed.windMph !== null
    const from = observed ? hour.observed : hour.forecast
    const arrow = from === null ? null : arrowFor(from, observed)
    return arrow === null ? [] : [arrow]
  })
}

/**
 * Whether the station's row stands for a field in this hour. For most
 * values that is a row that has the value: a value the row lacks is filled
 * from the forecast. A gust is the exception: a station gives a gust only
 * when there is one, so a row stands for the gust whether it has one or not,
 * and the forecast's gust is never drawn over a row.
 */
function rowStands(hour: TodayHour, field: Field): boolean {
  if (hour.observed === null || !OBSERVED_FIELDS.has(field)) return false
  return field === 'gustMph' || hour.observed[field] !== null
}

/**
 * The staircases for one field: the observed one, cut at `now`, and the
 * forecast's for the hours the station did not report. Where the station's
 * row stands for the current hour, the forecast's step for it starts at
 * `now`. With no current time (another day) there is only the forecast's,
 * whole. A field stations do not report has only the forecast's too.
 */
function staircases(
  name: string,
  field: Field,
  hours: TodayHour[],
  now: number | null,
): Series[] {
  const observed: Series = {
    name: `${name}-observed`,
    step: HOUR,
    points: [],
  }
  const forecast: Series = { name, step: HOUR, points: [] }
  if (now === null || !OBSERVED_FIELDS.has(field)) {
    for (const hour of hours) {
      const v = hour.forecast === null ? null : hour.forecast[field]
      // An hour with no value for this field leaves a break in its line.
      if (v !== null) forecast.points.push({ t: hour.t, v })
    }
    return [forecast]
  }
  let cutAfter = false
  for (const hour of hours) {
    const current = hour.t <= now && now < hour.t + HOUR
    const reported = rowStands(hour, field)
    if (reported) {
      const v = hour.observed![field]
      if (v !== null) observed.points.push({ t: hour.t, v })
      // An hour gone by that the station reported needs no forecast. The
      // current hour needs it right of the line.
      if (!current) continue
      cutAfter = true
    }
    const v = hour.forecast === null ? null : hour.forecast[field]
    if (v !== null) forecast.points.push({ t: hour.t, v })
  }
  return [
    { ...observed, cut: { at: now, keep: 'before' } },
    cutAfter ? { ...forecast, cut: { at: now, keep: 'after' } } : forecast,
  ]
}

function panel(
  spec: PanelSpec,
  readout: ReadoutPart[],
  bounds: [number, number],
  hours: TodayHour[],
  now: number | null,
  dots: Dot[],
  arrows: Arrow[] = [],
): WeatherPanelView {
  return {
    title: spec.title,
    readout: readout.length > 0 ? readout : NOTHING_HERE,
    bounds,
    rules: wholeSteps(bounds[0], bounds[1], spec.every).map((v) => ({
      v,
      label: `${v}${spec.unit}`,
    })),
    series: spec.fields.flatMap(([name, field]) =>
      staircases(name, field, hours, now),
    ),
    arrows,
    dots,
  }
}

function values(hours: (ForecastHour | null)[], fields: Field[]): number[] {
  return hours.flatMap((hour) =>
    hour === null
      ? []
      : fields.flatMap((field) => {
          const v = hour[field]
          return v === null ? [] : [v]
        }),
  )
}

/** The hours of the day on screen, forecast and observed side by side. */
function todayHours(
  forecast: ForecastHour[],
  observed: ObservedHour[],
): TodayHour[] {
  const byHour = new Map<number, TodayHour>()
  for (const hour of forecast) {
    byHour.set(hour.t, { t: hour.t, forecast: hour, observed: null, sky: null })
  }
  for (const row of observed) {
    const hour = byHour.get(row.t) ?? {
      t: row.t,
      forecast: null,
      observed: null,
      sky: null,
    }
    hour.observed = withShownGusts(asForecastHour(row))
    hour.sky = row.sky
    byHour.set(row.t, hour)
  }
  return [...byHour.values()].sort((a, b) => a.t - b.t)
}

/**
 * The dots at the cursor: on the observed value where the row stands for
 * it, else on the forecast's. A row that stands for a gust and has none
 * gives no dot, as it gives no step.
 */
function dotsFor(spec: PanelSpec, at: TodayHour | null): Dot[] {
  const dots: Dot[] = []
  if (at === null) return dots
  for (const [name, field] of spec.dots) {
    if (rowStands(at, field)) {
      const v = at.observed![field]
      if (v !== null) dots.push({ name: `${name}-observed`, v })
    } else if (at.forecast !== null && at.forecast[field] !== null) {
      dots.push({ name, v: at.forecast[field] })
    }
  }
  return dots
}

export function weatherView(
  forecast: Loaded<Forecast>,
  selected: Selected,
  cursor: number,
  now: number,
  observed: ObservedHour[] = [],
): WeatherView {
  const { span } = selected
  const all = forecastHours(forecast, now)
  // Rows belong to today only, and only where there are any.
  const rows = selected.isToday ? onDay(observed, span) : []
  const today = rows.length > 0 ? now : null

  let notice: string | null = null
  let hours: TodayHour[] = []
  if (all.length === 0 && rows.length === 0) {
    // Nothing saved, or a saved forecast so old that all of it is in the
    // past and nothing has replaced it.
    notice =
      forecast.status === 'loading'
        ? 'Loading forecast'
        : 'Forecast unavailable'
  } else {
    // A day is inside the forecast if the forecast reaches the hour of its
    // anchor. Today is inside it for as long as the forecast has any of
    // today left, whatever the hour, and always where the station reported.
    const last = all.length > 0 ? all[all.length - 1].t : -Infinity
    const reaches = Math.floor(selected.anchor / HOUR) * HOUR <= last
    hours = todayHours(onDay(all, span).map(withShownGusts), rows)
    if (hours.length === 0 || !(reaches || selected.isToday)) {
      notice = 'No forecast this far out.'
      hours = []
    }
  }

  // At the right-hand edge the cursor is on the next day's midnight. It reads
  // the last hour drawn, not the first hour of a day that is not on screen.
  const cursorT = Math.min(cursor, span.end - 1)
  const at = notice === null ? hourAt(hours, cursorT) : null
  // Left of the line at the current time the cursor reads the observed side.
  const left = today !== null && cursorT < now

  // One vertical range for every day, so one day can be compared with another.
  const observedHours = rows.map(asForecastHour)
  const windBounds = steppedBounds(
    [0, ...values([...all, ...observedHours], ['windMph', 'gustMph'])],
    10,
  )
  const tempBounds = steppedBounds(
    values([...all, ...observedHours], ['tempF']),
    10,
  )

  // The hour as the cursor reads it: with its row left of the line, and
  // the forecast alone right of it. On another day there is no row.
  const atSide = left ? at : forecastOnly(at)
  const read = readoutFor(atSide, today !== null)

  const wind = panel(
    WIND,
    read.wind,
    windBounds,
    hours,
    today,
    dotsFor(WIND, atSide),
    windArrows(hours),
  )
  const temp = panel(TEMP, read.temp, tempBounds, hours, today, dotsFor(TEMP, atSide))
  const sky = panel(SKY, read.sky, [0, 100], hours, today, dotsFor(SKY, atSide))
  // For a screen reader. Each panel is named, so "No forecast here" never
  // reads as if it were the temperature. Where none of them has anything to
  // say, that is said once, not three times.
  const panels = [wind, temp, sky]
  const nothing = panels.every((one) => one.readout === NOTHING_HERE)
  const words =
    notice ??
    (nothing
      ? partsText(NOTHING_HERE)
      : panels
          .map((one) => `${one.title}: ${partsText(one.readout)}`)
          .join('; '))

  return { notice, words, wind, temp, sky }
}

/** The hour with its row set aside: right of the line the forecast is read. */
function forecastOnly(at: TodayHour | null): TodayHour | null {
  return at === null ? null : { ...at, observed: null, sky: null }
}

/**
 * The words for each panel at the cursor. On today with a station each
 * value says which side it is from: the row's value where the row stands
 * for it, the forecast's where not. The wind's words come from the row
 * whole, so a row without a gust has no gust in the words either.
 */
function readoutFor(
  at: TodayHour | null,
  labelled: boolean,
): { wind: ReadoutPart[]; temp: ReadoutPart[]; sky: ReadoutPart[] } {
  if (at === null) return { wind: [], temp: [], sky: [] }
  const forecast: SourceWord | undefined = labelled ? 'forecast' : undefined
  const wind = rowStands(at, 'windMph')
    ? windParts(at.observed, 'observed')
    : windParts(at.forecast, forecast)
  const temp = rowStands(at, 'tempF')
    ? tempParts(at.observed, 'observed')
    : tempParts(at.forecast, forecast)
  const sky: ReadoutPart[] = []
  if (rowStands(at, 'cloudPct') && at.sky !== null) {
    sky.push(skyCategoryPart(at.sky, 'observed'))
  } else if (at.forecast !== null && at.forecast.cloudPct !== null) {
    sky.push(cloudPart(at.forecast.cloudPct, forecast))
  }
  if (at.forecast !== null && at.forecast.rainPct !== null) {
    sky.push(rainPart(at.forecast.rainPct, forecast))
  }
  return {
    wind: withSourceWords(wind),
    temp: withSourceWords(temp),
    sky: withSourceWords(sky),
  }
}
```

Add `import type { Sky } from '../data/nwsObservations.ts'` with the other type imports. `hourAt` must accept the merged hour: Task 7 made it generic over anything with a `t`.

This task's tests cover the series, the arrows and the bounds; Task 9's tests drive the words and the dots. Implement the whole file now so the type-check passes, and let Task 9's tests confirm the words.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run src/ui/weatherView.test.ts`
Expected: all pass, the earlier tests included. If `'with rows and no forecast at all'` fails on the notice, check the `all.length === 0 && rows.length === 0` condition.

- [ ] **Step 5: Run the whole suite, lint, type-check**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run; npx prettier --write src/ui/weatherView.ts src/ui/weatherView.test.ts; npm run lint; npx tsc --noEmit -p tsconfig.app.json`
Expected: clean.

- [ ] **Step 6: Commit**

```
git add src/ui/weatherView.ts src/ui/weatherView.test.ts
git commit -m "Today's panels draw the observed side up to now and the forecast after" -m "Each value has an observed staircase cut at the current time and the forecast's for the hours the station did not report, cut to start at the line where the current hour is observed. Observed hours have solid arrows. The sky is the category at the middle of its range; the rain stays forecast. The ranges take the rows in." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: The cursor reads the side it is on

**Files:**
- Modify: `src/ui/weatherView.test.ts`
- Modify: `src/ui/weatherView.ts` (only if a test finds a gap)

**Interfaces:**
- Consumes: Task 8's view.
- Produces: on today with rows, `readout` parts carry `source` and end in a label part; `dots` are named `<name>-observed` for observed values; `words` reads "Wind: 9 mph from W, gusts 15, observed; Temperature: 64°F, observed; Sky: Scattered cloud, observed; 0% rain, forecast".

- [ ] **Step 1: Write the failing tests**

Add inside `describe('today with a station'` in `src/ui/weatherView.test.ts`:

```ts
  test('left of the line the words are the observed values and say so, and the dots sit on them', () => {
    // 2:30 PM: the 2 PM hour has ended and has a row.
    const cursor = START + 14 * HOUR + 30 * 60_000
    const view = weatherView(week, day(0), cursor, NOW, rows)
    expect(partsText(view.wind.readout)).toBe('5 mph from S, observed')
    expect(partsText(view.temp.readout)).toBe('74°F, observed')
    expect(partsText(view.sky.readout)).toBe('Scattered cloud, observed; 0% rain, forecast')
    expect(view.wind.dots).toEqual([{ name: 'wind-observed', v: 5 }])
    expect(view.temp.dots).toEqual([{ name: 'temp-observed', v: 74 }])
    expect(view.sky.dots).toEqual([
      { name: 'cloud-observed', v: 44 },
      { name: 'rain', v: 0 },
    ])
    expect(view.words).toBe(
      'Wind: 5 mph from S, observed; Temperature: 74°F, observed; Sky: Scattered cloud, observed; 0% rain, forecast',
    )
  })

  test('right of the line the words are the forecast and say so, even in the current hour', () => {
    // 3:50 PM: the 3 PM hour has a row, but the cursor is past the line.
    const view = weatherView(week, day(0), NOW + 14 * 60_000, NOW, rows)
    expect(partsText(view.wind.readout)).toBe('9 mph from W, gusts 12, forecast')
    expect(partsText(view.temp.readout)).toBe('65°F, forecast')
    expect(partsText(view.sky.readout)).toBe('3% cloud, 0% rain, forecast')
    expect(view.temp.dots).toEqual([{ name: 'temp', v: 65 }])
  })

  test('at the line itself the cursor reads the forecast', () => {
    const view = weatherView(week, day(0), NOW, NOW, rows)
    expect(partsText(view.temp.readout)).toBe('65°F, forecast')
  })

  test('left of the line, a value the row lacks reads the forecast for that hour and says so', () => {
    const blind = observed(NOW, (row) => {
      if (row.t === START + 14 * HOUR) {
        row.tempF = null
        row.sky = null
      }
    })
    const cursor = START + 14 * HOUR + 30 * 60_000
    const view = weatherView(week, day(0), cursor, NOW, blind)
    expect(partsText(view.temp.readout)).toBe('64°F, forecast')
    expect(partsText(view.sky.readout)).toBe('3% cloud, 0% rain, forecast')
    expect(partsText(view.wind.readout)).toBe('5 mph from S, observed')
  })

  test('an hour gone by with no row at all reads the forecast, with its word', () => {
    const patchy = rows.filter((row) => row.t !== START + 14 * HOUR)
    const cursor = START + 14 * HOUR + 30 * 60_000
    const view = weatherView(week, day(0), cursor, NOW, patchy)
    expect(partsText(view.temp.readout)).toBe('64°F, forecast')
  })

  test('an observed gust that stands out is worded, and the dot is the observed one', () => {
    const gusty = observed(NOW, (row) => {
      if (row.t === START + 14 * HOUR) row.gustMph = 15
    })
    const cursor = START + 14 * HOUR + 30 * 60_000
    const view = weatherView(week, day(0), cursor, NOW, gusty)
    expect(partsText(view.wind.readout)).toBe('5 mph from S, gusts 15, observed')
    expect(view.wind.dots).toEqual([
      { name: 'wind-observed', v: 5 },
      { name: 'gust-observed', v: 15 },
    ])
  })

  test('on another day no side is said', () => {
    const view = weatherView(week, day(1), day(1).anchor, NOW, rows)
    expect(view.temp.readout.every((part) => part.source === undefined)).toBe(true)
  })

  test('on today with no rows no side is said either', () => {
    const view = weatherView(week, day(0), NOW, NOW, [])
    expect(partsText(view.temp.readout)).toBe('65°F')
  })
```

`partsText` is imported from `'../chart/readout.ts'`.

- [ ] **Step 2: Run the tests**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run src/ui/weatherView.test.ts`
Expected: pass if Task 8's `readoutFor` and `dotsFor` are right; otherwise fix `weatherView.ts` until they pass. Watch two things: the sky at 2 PM reads the row's category (the row's `sky`, not its percent), and at the line itself (`cursorT === now`) the forecast is read.

- [ ] **Step 3: Run the whole suite, lint, commit**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run; npx prettier --write src/ui/weatherView.ts src/ui/weatherView.test.ts; npm run lint`

```
git add src/ui/weatherView.ts src/ui/weatherView.test.ts
git commit -m "The cursor reads the side of the line it is on, and says which" -m "Left of the current time the observed values where the station reported them, the forecast where not; right of it the forecast. Each run of values ends in its word. The dots sit on the values read." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: The caption names the station, and the screen wires it up

**Files:**
- Modify: `src/ui/captions.ts` (`observedCaption`, `weatherStationName`)
- Modify: `src/ui/captions.test.ts`
- Modify: `src/ui/SpotScreen.tsx`

**Interfaces:**
- Consumes: `Loaded`, `StationChoice`, `NearStation`, `ObservedDay`, `todaysObserved`, `STATION_WITHIN_MI`.
- Produces: `observedCaption(spot, station: Loaded<StationChoice>, observed: Loaded<ObservedDay>, today: string, isToday: boolean): string | null`; `weatherStationName(name): string` (an all-caps NWS name in title case).

- [ ] **Step 1: Write the failing tests**

Add to `src/ui/captions.test.ts`, importing `observedCaption` and `weatherStationName` from `./captions.ts`, `type { StationChoice, NearStation } from '../data/weatherRule.ts'` and `type { ObservedDay } from '../data/observed.ts'`:

```ts
describe('weatherStationName', () => {
  test('an all-caps name is put in title case; a mixed one is left alone', () => {
    expect(weatherStationName('LOS PRIETOS')).toBe('Los Prietos')
    expect(weatherStationName('MONTECITO #2')).toBe('Montecito #2')
    expect(weatherStationName('Santa Barbara, Santa Barbara Municipal Airport')).toBe(
      'Santa Barbara, Santa Barbara Municipal Airport',
    )
    expect(weatherStationName('KSBA')).toBe('KSBA')
  })
})

describe('observedCaption', () => {
  const KSBA: NearStation = {
    id: 'KSBA',
    name: 'Santa Barbara, Santa Barbara Municipal Airport',
    lat: 34.42611,
    lon: -119.84361,
    elevationFt: 10,
    distanceMi: 1.5,
    direction: 'north',
  }
  const KIZA: NearStation = { ...KSBA, id: 'KIZA', name: 'Santa Ynez, Santa Ynez Airport', elevationFt: 673, distanceMi: 12.8, direction: 'northwest' }
  const LPOC1: NearStation = { ...KSBA, id: 'LPOC1', name: 'LOS PRIETOS', elevationFt: 982, distanceMi: 5.6, direction: 'northwest' }
  const NAMED = 'Observed: NWS KSBA Santa Barbara, Santa Barbara Municipal Airport, 1.5 mi north, at 10 ft'

  function station(
    data: StationChoice | null,
    status: Loaded<StationChoice>['status'] = 'ready',
  ): Loaded<StationChoice> {
    return { data, fetchedAt: data ? FETCHED : null, span: null, status }
  }
  function day(
    data: ObservedDay | null,
    status: Loaded<ObservedDay>['status'] = 'ready',
  ): Loaded<ObservedDay> {
    return { data, fetchedAt: data ? FETCHED : null, span: null, status }
  }
  const serves = station({ serves: KSBA, nearest: KSBA })
  const hour = { t: Date.UTC(2026, 9, 8, 21), tempF: 64, windMph: 9, gustMph: null, windDeg: 270, sky: 'clear' as const }
  const reported: ObservedDay = { stationId: 'KSBA', through: READING.t, hours: [hour] }

  test('names the station, its distance, its height and the latest report', () => {
    expect(observedCaption(CAMPUS_POINT, serves, day(reported), TODAY, true)).toBe(
      `${NAMED}, through 2:06 PM. Sky is the cloud layer that covers most. Rain chance is forecast.`,
    )
  })

  test('a station that reports no sky says so', () => {
    const noSky = { ...reported, hours: [{ ...hour, sky: null }] }
    expect(observedCaption(CAMPUS_POINT, serves, day(noSky), TODAY, true)).toBe(
      `${NAMED}, through 2:06 PM. It reports no sky, so sky is forecast. Rain chance is forecast.`,
    )
  })

  test('before the first report of the day', () => {
    const none = { stationId: 'KSBA', through: null, hours: [] }
    expect(observedCaption(CAMPUS_POINT, serves, day(none), TODAY, true)).toBe(
      `${NAMED}. No reports yet today.`,
    )
  })

  test('what went wrong with the reports, if anything', () => {
    expect(observedCaption(CAMPUS_POINT, serves, day(reported, 'stale'), TODAY, true)).toBe(
      `${NAMED}, through 2:06 PM. Sky is the cloud layer that covers most. Rain chance is forecast. Couldn't refresh the reports.`,
    )
    expect(observedCaption(CAMPUS_POINT, serves, day(null, 'unavailable'), TODAY, true)).toBe(
      `${NAMED}. Reports unavailable.`,
    )
    expect(observedCaption(CAMPUS_POINT, serves, day(null, 'loading'), TODAY, true)).toBe(
      `${NAMED}. Loading reports.`,
    )
  })

  test('rows saved from another station are not counted', () => {
    const theirs = { ...reported, stationId: 'KIZA' }
    expect(observedCaption(CAMPUS_POINT, serves, day(theirs), TODAY, true)).toBe(
      `${NAMED}. Loading reports.`,
    )
  })

  test('a spot with no station near says why: too far, or too high or low', () => {
    const far = station({ serves: null, nearest: KIZA })
    expect(observedCaption(spotById('gaviota'), far, day(null, 'loading'), TODAY, true)).toBe(
      'Today is forecast only: the nearest weather station, KIZA Santa Ynez, Santa Ynez Airport, is 12.8 mi away.',
    )
    const low = station({ serves: null, nearest: LPOC1 })
    expect(observedCaption(spotById('la-cumbre-peak'), low, day(null, 'loading'), TODAY, true)).toBe(
      'Today is forecast only: the nearest weather station, LPOC1 Los Prietos, is at 982 ft and this spot at 3,997 ft.',
    )
  })

  test('a cell with no stations at all, and a lookup that failed', () => {
    expect(observedCaption(CAMPUS_POINT, station({ serves: null, nearest: null }), day(null, 'loading'), TODAY, true)).toBe(
      'Today is forecast only: NWS lists no weather station for this forecast cell.',
    )
    expect(observedCaption(CAMPUS_POINT, station(null, 'unavailable'), day(null, 'loading'), TODAY, true)).toBe(
      "Today is forecast only: couldn't look up the weather stations near this spot.",
    )
  })

  test('nothing while the station is still being looked up, and nothing on any other day', () => {
    expect(observedCaption(CAMPUS_POINT, station(null, 'loading'), day(null, 'loading'), TODAY, true)).toBeNull()
    expect(observedCaption(CAMPUS_POINT, serves, day(reported), TODAY, false)).toBeNull()
  })
})
```

`READING.t` is 2:06 PM Pacific on 8 October 2026 in that file. For the spot with no own height, "this spot at" uses `spot.elevationFt ?? spot.nws.elevationFt`; La Cumbre Peak has 3,997 ft of its own.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run src/ui/captions.test.ts`
Expected: FAIL, the names are not exported.

- [ ] **Step 3: Write the caption**

In `src/ui/captions.ts`, add the imports:

```ts
import type { ObservedDay } from '../data/observed.ts'
import type { NearStation, StationChoice } from '../data/weatherRule.ts'
```

and after `weatherCaption`:

```ts
/**
 * A station's name as NWS gives it, with an all-caps one put in title case:
 * 'LOS PRIETOS' is 'Los Prietos'. An id-like name of one word is left alone.
 */
export function weatherStationName(name: string): string {
  if (name !== name.toUpperCase() || !name.includes(' ')) return name
  return name
    .toLowerCase()
    .replace(/(^|[\s(])(\S)/g, (match) => match.toUpperCase())
}

/** 'NWS KSBA Santa Barbara, Santa Barbara Municipal Airport' */
function weatherStationWords(station: NearStation): string {
  return `NWS ${station.id} ${weatherStationName(station.name)}`
}

/**
 * Under the weather's caption on today: the station whose reports are
 * drawn, with its distance, its height and the latest report; or why today
 * is forecast only. Null on any other day, and while the station is still
 * being looked up with nothing saved.
 */
export function observedCaption(
  spot: Spot,
  station: Loaded<StationChoice>,
  observed: Loaded<ObservedDay>,
  today: string,
  isToday: boolean,
): string | null {
  if (!isToday) return null
  const zone = spot.timeZone
  const choice = station.data
  if (choice === null) {
    return station.status === 'unavailable'
      ? "Today is forecast only: couldn't look up the weather stations near this spot."
      : null
  }
  const { serves, nearest } = choice
  if (serves === null) {
    if (nearest === null) {
      return 'Today is forecast only: NWS lists no weather station for this forecast cell.'
    }
    const name = `${nearest.id} ${weatherStationName(nearest.name)}`
    const why =
      nearest.distanceMi > STATION_WITHIN_MI
        ? `is ${nearest.distanceMi} mi away`
        : `is at ${feetHigh(nearest.elevationFt)} and this spot at ${feetHigh(spot.elevationFt ?? spot.nws.elevationFt)}`
    return `Today is forecast only: the nearest weather station, ${name}, ${why}.`
  }

  const named = `Observed: ${weatherStationWords(serves)}, ${serves.distanceMi} mi ${serves.direction}, at ${feetHigh(serves.elevationFt)}`
  // Rows from a station chosen earlier are not this station's.
  const day =
    observed.data !== null && observed.data.stationId === serves.id
      ? observed.data
      : null
  if (day === null) {
    const state =
      observed.status === 'unavailable' ? 'Reports unavailable.' : 'Loading reports.'
    return `${named}. ${state}`
  }
  if (day.through === null) return `${named}. No reports yet today.`

  const parts = [`${named}, through ${formatTime(day.through, zone)}.`]
  const anySky = day.hours.some((hour) => hour.sky !== null)
  parts.push(
    anySky
      ? 'Sky is the cloud layer that covers most.'
      : 'It reports no sky, so sky is forecast.',
  )
  parts.push('Rain chance is forecast.')
  if (observed.status === 'stale') parts.push("Couldn't refresh the reports.")
  return parts.join(' ')
}
```

with `STATION_WITHIN_MI` imported from `'../data/weatherRule.ts'`. Where `feetHigh` for the station is `'10 ft'`: it already rounds and adds the comma.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run src/ui/captions.test.ts`
Expected: all pass. The "rows from another station" case reads "Loading reports." because the rows for this station are what is being fetched.

- [ ] **Step 5: Wire the screen**

In `src/ui/SpotScreen.tsx`:

```ts
import { observedCaption, sunCaption, tideCaption, weatherCaption } from './captions.ts'
import { todaysObserved } from '../data/observed.ts'
```

After `const { days, spans, hilo, forecast } = data`, add `const observedToday = todaysObserved(data.station, data.observedWeather)` and pass it: `weatherView(forecast, selected, tide.cursor, data.now, observedToday)`. Then under the weather caption:

```tsx
        {observed !== null && <p className="caption">{observed}</p>}
```

with, beside `sun`:

```ts
  const observed = observedCaption(
    spot,
    data.station,
    data.observedWeather,
    data.today,
    selected.isToday,
  )
```

placed after `selected` is known (it needs `selected.isToday`).

- [ ] **Step 6: Run everything**

Run: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH; npx vitest run; npx prettier --write src/ui/captions.ts src/ui/captions.test.ts src/ui/SpotScreen.tsx; npm run lint; npm run build`
Expected: all pass, lint clean, build succeeds.

- [ ] **Step 7: Commit**

```
git add src/ui/captions.ts src/ui/captions.test.ts src/ui/SpotScreen.tsx
git commit -m "The caption names the weather station, or says why today is forecast only" -m "Under the weather's caption on today: the station, its distance and height and the latest report, what the sky is and that rain is forecast; or the nearest station and why it does not serve. The screen hands today's rows to the panels." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: CLAUDE.md, the browser check and screenshots

**Files:**
- Modify: `CLAUDE.md`
- Create: `docs/superpowers/plans/assets/2026-10-13-observed-weather-light.png` and `-dark.png`

- [ ] **Step 1: CLAUDE.md**

In the Status bullet "Built:", append after the night sentence: "Then today's weather observed up to the current time and forecast after it, at a spot with a weather station within 10 miles and 500 ft (`src/data/weatherRule.ts`): NWS's station list for the cell and the station's reports (`src/data/nwsStations.ts`, `src/data/nwsObservations.ts`), one row an hour (`src/data/observed.ts`), the staircases cut at the current time, solid arrows, the words ending in "observed" or "forecast", and a caption naming the station or saying why there is none."

Change the "Not built" line to drop issue 56 and the "Approved and specified" bullet to say all three are built.

In the Stack bullet beginning "Weather is drawn as staircases", append: "On today at a spot with a station, each value's observed staircase is cut at the current time and the forecast's starts there (`Cut` in `src/chart/scales.ts`); the observed side is heavier and its arrows solid."

Under Data sources, NWS, replace the "Observations, not used yet (issue 56)" bullet with: "Observations (issue 56, built): `/gridpoints/{wfo}/{x},{y}/stations?limit=500` lists a cell's 64 nearest stations with their heights on one page (the answer names a next page even when there is none); `/stations/{id}/observations?start={iso}&limit=500` has a station's reports from that instant, newest first, in SI units, with quality flags (`V`, `S`, `C`, `Z` kept; `X`, `B`, `Q` dropped). The airport reports every 5 minutes, about 310 a day and 1.2 MB; hourly stations 24. The app keeps the rows, not the reports."

In Next Steps, under the phases bullet, mark phase 2 built on this branch and waiting for the owner's merge and phone check.

- [ ] **Step 2: Browser check on the dev server**

Start the dev server (`npx vite --port 5199 --strictPort`, in the background) and open http://localhost:5199/ with the Playwright tools at 390 × 844. Campus Point is the first spot. Check, after about 10 AM Pacific so that hours have gone by:

1. The Wind, Temperature and Sky panels: left of the dotted line at the current time the staircases are heavier and the arrows solid; right of it, as before. Evaluate `document.querySelectorAll('.series-temp-observed .line').length === 1` and that its path's last `H` is at the same x as `.marker-now`'s `x1` (to 0.1 px).
2. Set the cursor left of the line (dispatch a pointer event on `.panel-plot` at a quarter of its width, or use the keyboard if the plot has it); the readout ends in "observed" and the Sky readout gives a category. Right of the line it ends in "forecast".
3. The caption beginning "Observed: NWS KSBA" gives a distance, a height and a time within the last 15 minutes.
4. Switch to Gaviota State Park: the caption begins "Today is forecast only: the nearest weather station, KIZA" and no `.series-temp-observed` path has points.
5. Switch to La Cumbre Peak: the caption gives two heights.
6. Back at Campus Point, tap tomorrow in the 14 days: no "Observed" line and the words end in neither word.
7. No console errors (`read_console_messages`).
8. Screenshot the viewport at Campus Point in light, then with `browser_emulate_media` `colorScheme: 'dark'`, into `docs/superpowers/plans/assets/2026-10-13-observed-weather-light.png` and `-dark.png`. Set the scheme back.

Record what passed and what did not in the pull request body. Stop the dev server.

- [ ] **Step 3: Commit**

```
git add CLAUDE.md docs/superpowers/plans/assets/2026-10-13-observed-weather-light.png docs/superpowers/plans/assets/2026-10-13-observed-weather-dark.png
git commit -m "Record observed weather as built, with screenshots" -m "CLAUDE.md: the status, the stack's cut staircase, and what the two NWS endpoints serve. Screenshots from the dev server on 2026-10-13." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Decisions this plan makes beyond the spec

For the pull request body, so the owner can overrule any:

1. **The gust rule of issue 60 applies to observed gusts.** One function for both sides. Stations report a gust only when there is one, so nearly all pass.
2. **Values NWS flags `X` (rejected), `B` (bad) or `Q` (questioned) are dropped**; `V`, `S`, `C` and `Z` are kept. The spec asked for failed values to be left out and for the flags to be read when the plan was written.
3. **On a tie between two reports equally near the top of an hour, the later one.**
4. **The current hour's arrow is the observed one where the station has reported it**, drawn at the middle of the hour as all arrows are, even though the middle may be right of the line.
5. **At the line itself (the cursor exactly on the current time) the forecast is read.** Left of it is strictly less than now.
6. **The look**: observed staircases 3.5 px in the observed colour, observed gusts 2.5 px solid in the muted colour, observed arrows filled with a 2 px stroke, observed calm dots 3 px. The spec leaves the look to screenshots on the pull request.
7. **The words**: 'observed' or 'forecast' said once after each run of values from one side, muted, with a semicolon between runs: "Scattered cloud, observed; 0% rain, forecast". Observed sky categories read "Clear", "Few clouds", "Scattered cloud", "Broken cloud", "Overcast".
8. **NWS's all-caps station names are put in title case** in the caption: "LPOC1 Los Prietos".
9. **The station list is asked for with the 14-day window as its recorded span** (it has no span of its own), and rows saved from a station chosen earlier are neither drawn nor counted.
10. **With rows and no forecast at all, today is drawn from the rows alone**, with no notice.
