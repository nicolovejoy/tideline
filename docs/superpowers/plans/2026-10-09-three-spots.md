# Three Spots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two fixed spots beside Campus Point, Gaviota State Park and La Cumbre Peak, with a row of buttons to switch between them; Gaviota reads the Santa Barbara gauge's deviation from its own prediction, La Cumbre hides its tide by default, and the weather caption gives each cell's elevation.

**Architecture:** The same as Stage 1: thin React components over plain modules, with every rule, every piece of arithmetic and every word in a plain function that has tests. The spot list and the two remembered choices (which spot, tides shown) are plain modules. `useSpotData` gains a fourth tide source, the gauge's own prediction, and a `wanted` flag so hidden tides are not fetched. `tideView` takes the spot and works out the gauge line and the hidden line. `App` splits into `App` (which spot) and `SpotScreen` (everything for one spot, remounted per spot by key).

**Tech Stack:** React 19, TypeScript 6.0, Vite 8, Vitest 5, oxlint, Prettier. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-09-three-spots-design.md`. Issue: https://github.com/nicolovejoy/tideline/issues/2.

**Scope:** One pull request on the branch `stage-2/three-spots`, which already holds the spec and the fixtures. Nothing from other issues: no URL for a spot (#7), no saved spots (#4), no interpolated curve (#5).

## Global Constraints

- **Node 24 for every `npm`, `npx` and `node` command.** In a fresh shell run `source ~/.nvm/nvm.sh && nvm use` first.
- **Public repo, no personal details.** Tracked files, commit messages and pull requests never name people. Write "the first user" and "the owner". Never copy anything out of `private/`.
- **Commit identity.** `git config user.email` must end in `users.noreply.github.com`.
- **Commit trailer.** End every commit message with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **Code style is the Vite template's:** no semicolons, single quotes, relative imports carry their `.ts` or `.tsx` extension, type-only imports use `import type`, no enums. Run `npm run format` before every commit.
- **Lint must print no problems.** `npm run lint` runs oxlint with warnings denied, then a Prettier check.
- **No new dependencies.**
- **Times:** every stored or computed time is a UTC instant in epoch milliseconds. Only `src/time.ts` converts to a zone. Nothing reads the viewer's zone. Tests run with the device in Tokyo.
- **Components hold no arithmetic, no rules and no wording.** Those live in plain modules with tests. A component may build its y-scale from a view's bounds and its own height: that is layout, not a rule.
- **Units:** feet above MLLW to one decimal; °F, mph and percent as whole numbers; 12-hour clock. Distances in miles as given in the spot. Elevations in whole feet with a thousands comma.
- **Data, not a verdict.** No scores, no go/no-go, no alerts.
- **Every access to `localStorage` is wrapped in try/catch,** as `src/data/cache.ts` does, so a browser with storage disabled still works.
- **Do not merge.** The last task opens the pull request and stops.
- **Every task ends green:** `npm test`, `npm run lint` and `npm run build` all pass before its commit.

## Review Focus

1. **Gaviota on a day other than today:** no gauge line, no gauge dot, and the words are the prediction alone. Pinned in Task 5 (`'on another day the gauge says nothing'`).
2. **Gaviota when the gauge has a reading but its own prediction has not loaded:** the slot is blank, never "NaN ft". Pinned in Task 5 (`'without the gauge's own prediction there is no deviation'`).
3. **A gauge deviation that rounds to zero, or to a small negative:** "0.0 ft", never "-0.0 ft". Pinned in Task 4 (`gaugeWords`).
4. **La Cumbre with tides hidden, then shown, then the page reloaded:** the choice survives, and showing them starts the tide fetches without a remount. Pinned in Task 2 (`readTidesShown`) and Task 3 (`wanted`), checked in the browser in Task 8.
5. **A remembered spot id that is no longer a spot:** Campus Point, not a crash. Pinned in Task 1 (`spotById`) and Task 2 (`readSpot` round trip).

## File Structure

Created, plain modules:
- `src/ui/choices.ts`: the two choices remembered on the device, wrapped like the cache. Test: `src/ui/choices.test.ts`.
- `src/spot.test.ts`: checks on the three spots.

Modified, plain modules:
- `src/spot.ts`: `Station`, the three spots as `SPOTS`, `spotById`, `hasOwnGauge`.
- `src/data/cache.ts`: `Source` gains `'gauge-predictions'`.
- `src/data/useSpotData.ts`: `tideSpecs` gains `gaugePredictions` and fetches `observed` from the gauge; `useLoaded(spec, now, wanted)`; `useSpotData(spot, tidesShown)`; `SpotData.gaugePredictions`.
- `src/chart/readout.ts`: `gaugeWords`.
- `src/ui/tideView.ts`: takes `tides: { spot, shown }`; `text.second`; `hidden`; `canHide`.
- `src/ui/captions.ts`: the gauge form of the tide caption; elevation in the weather caption.
- `src/ui/dayList.ts`: `dayRows` takes `tidesShown`.

Created, components:
- `src/ui/SpotSwitcher.tsx`: the row of three buttons.
- `src/ui/TidesHidden.tsx`: the one line and its "Show tides" button.
- `src/ui/SpotScreen.tsx`: everything for one spot; what `App.tsx` holds today.

Modified, components:
- `src/App.tsx`: which spot; renders the switcher and `SpotScreen` keyed by spot.
- `src/styles.css`: the switcher, the hidden line, the toggle buttons.

---

### Task 1: The three spots, in `src/spot.ts`

**Files:**
- Modify: `src/spot.ts`
- Create: `src/spot.test.ts`

**Interfaces:**
- Produces, in `src/spot.ts`:
  - `export interface Station { id: string; name: string; distanceMi: number; direction: string }`
  - `export interface Spot { id; name; lat; lon; timeZone; elevationFt: number | null; nws: { office; gridX; gridY; elevationFt: number }; tideStation: Station; gauge: Station; tidesShown: boolean }`
  - `export const SPOTS: Spot[]` in the order Campus Point, Gaviota State Park, La Cumbre Peak.
  - `export const CAMPUS_POINT: Spot` (unchanged name, `SPOTS[0]`).
  - `export function spotById(id: string | null): Spot`: the spot with that id, or `SPOTS[0]`.
  - `export function hasOwnGauge(spot: Spot): boolean`: `spot.gauge.id === spot.tideStation.id`.
- Nothing in the app reads the new fields yet; existing readers of `spot.tideStation` and `spot.nws` keep working.

- [ ] **Step 1: Write the failing tests**

Create `src/spot.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { CAMPUS_POINT, SPOTS, hasOwnGauge, spotById } from './spot.ts'
import gaviotaCell from './data/__fixtures__/nws-gridpoint-LOX-87-76.json'
import laCumbreCell from './data/__fixtures__/nws-gridpoint-LOX-105-74.json'
import campusCell from './data/__fixtures__/nws-gridpoint-LOX-100-71.json'

const FT_PER_M = 3.28084

describe('the spots', () => {
  test('are three, with Campus Point first and unchanged', () => {
    expect(SPOTS.map((spot) => spot.id)).toEqual([
      'campus-point',
      'gaviota',
      'la-cumbre-peak',
    ])
    expect(SPOTS[0]).toBe(CAMPUS_POINT)
    expect(CAMPUS_POINT.tideStation.id).toBe('9411340')
  })

  test('each has its own forecast cell', () => {
    const cells = SPOTS.map((spot) => `${spot.nws.gridX},${spot.nws.gridY}`)
    expect(new Set(cells).size).toBe(3)
  })

  test("each cell's elevation is what NWS gives for it, in feet", () => {
    const fixtures = {
      'campus-point': campusCell,
      gaviota: gaviotaCell,
      'la-cumbre-peak': laCumbreCell,
    }
    for (const spot of SPOTS) {
      const metres = fixtures[spot.id as keyof typeof fixtures].properties
        .elevation.value
      expect(spot.nws.elevationFt).toBe(Math.round(metres * FT_PER_M))
    }
  })

  test("Gaviota's station has no gauge, so its gauge is Santa Barbara", () => {
    const gaviota = spotById('gaviota')
    expect(gaviota.tideStation.id).toBe('9411399')
    expect(gaviota.gauge.id).toBe('9411340')
    expect(hasOwnGauge(gaviota)).toBe(false)
    expect(hasOwnGauge(CAMPUS_POINT)).toBe(true)
  })

  test('La Cumbre Peak hides its tide by default; the others show it', () => {
    expect(SPOTS.map((spot) => spot.tidesShown)).toEqual([true, true, false])
  })

  test('only La Cumbre Peak has an elevation worth saying', () => {
    expect(SPOTS.map((spot) => spot.elevationFt)).toEqual([null, null, 3997])
  })

  test('an id that is not a spot means Campus Point', () => {
    expect(spotById('nowhere')).toBe(CAMPUS_POINT)
    expect(spotById(null)).toBe(CAMPUS_POINT)
    expect(spotById('la-cumbre-peak').name).toBe('La Cumbre Peak')
  })
})
```

The JSON imports need `resolveJsonModule`; check `tsconfig.app.json` has it (the Vite template does). If `tsc -b` complains about the `.json` import, add `"resolveJsonModule": true` under `compilerOptions` there.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/spot.test.ts`
Expected: FAIL, `SPOTS` is not exported.

- [ ] **Step 3: Write the spots**

Replace the whole of `src/spot.ts` with:

```ts
// The spots, hard-coded until saving your own arrives. Facts verified against
// the live NOAA and NWS APIs on 2026-10-09. Directions are the 8-point
// compass name of the bearing from the spot to the station.

/** A NOAA tide station, as it stands from one spot. */
export interface Station {
  id: string
  name: string
  distanceMi: number
  direction: string
}

export interface Spot {
  id: string
  name: string
  lat: number
  lon: number
  /** IANA zone. Every displayed time and calendar day uses it. */
  timeZone: string
  /** The spot's own height, where it is worth saying: a peak. */
  elevationFt: number | null
  /** The 2.5 km NWS forecast cell containing the spot, and its average height. */
  nws: { office: string; gridX: number; gridY: number; elevationFt: number }
  /** Where the predicted curve and the highs and lows come from. */
  tideStation: Station
  /**
   * Where the observed level comes from. The tide station itself when it has
   * a gauge; the nearest station that has one when it does not.
   */
  gauge: Station
  /** Whether the tide is shown until the user says otherwise. Hidden inland. */
  tidesShown: boolean
}

const SANTA_BARBARA = { id: '9411340', name: 'Santa Barbara' }

export const CAMPUS_POINT: Spot = {
  id: 'campus-point',
  name: 'Campus Point',
  lat: 34.4046,
  lon: -119.844,
  timeZone: 'America/Los_Angeles',
  elevationFt: null,
  nws: { office: 'LOX', gridX: 100, gridY: 71, elevationFt: 3 },
  tideStation: { ...SANTA_BARBARA, distanceMi: 8.6, direction: 'east' },
  gauge: { ...SANTA_BARBARA, distanceMi: 8.6, direction: 'east' },
  tidesShown: true,
}

// Station 9411399 is harmonic, so it has a curve, but it has no gauge: a
// water_level request returns an error. The nearest gauge is Santa Barbara.
const GAVIOTA: Spot = {
  id: 'gaviota',
  name: 'Gaviota State Park',
  lat: 34.4716,
  lon: -120.2284,
  timeZone: 'America/Los_Angeles',
  elevationFt: null,
  nws: { office: 'LOX', gridX: 87, gridY: 76, elevationFt: 0 },
  tideStation: {
    id: '9411399',
    name: 'Gaviota State Park',
    distanceMi: 0.2,
    direction: 'south',
  },
  gauge: { ...SANTA_BARBARA, distanceMi: 31, direction: 'east' },
  tidesShown: true,
}

// Inland and high up. The cell's average is well below the summit.
const LA_CUMBRE_PEAK: Spot = {
  id: 'la-cumbre-peak',
  name: 'La Cumbre Peak',
  lat: 34.4939,
  lon: -119.7147,
  timeZone: 'America/Los_Angeles',
  elevationFt: 3997,
  nws: { office: 'LOX', gridX: 105, gridY: 74, elevationFt: 3258 },
  tideStation: { ...SANTA_BARBARA, distanceMi: 6.3, direction: 'south' },
  gauge: { ...SANTA_BARBARA, distanceMi: 6.3, direction: 'south' },
  tidesShown: false,
}

export const SPOTS: Spot[] = [CAMPUS_POINT, GAVIOTA, LA_CUMBRE_PEAK]

/** The spot with that id. Any other id, or none, means Campus Point. */
export function spotById(id: string | null): Spot {
  return SPOTS.find((spot) => spot.id === id) ?? SPOTS[0]
}

/** Whether the spot's observed level comes from its own tide station. */
export function hasOwnGauge(spot: Spot): boolean {
  return spot.gauge.id === spot.tideStation.id
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/spot.test.ts`
Expected: 7 tests pass.

- [ ] **Step 5: Run everything**

Run: `npm run format && npm test && npm run lint && npm run build`
Expected: all pass. The existing tests use `CAMPUS_POINT`, which is unchanged in every field they read.

- [ ] **Step 6: Commit**

```bash
git add src/spot.ts src/spot.test.ts tsconfig.app.json
git commit -m "Three spots: Campus Point, Gaviota State Park, La Cumbre Peak

Each spot now names its gauge as well as its tide station, its cell's
elevation, its own elevation where that is worth saying, and whether its
tide is shown by default. Gaviota's station has no gauge, so its gauge is
Santa Barbara, 31 mi east. La Cumbre hides its tide.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

(Drop `tsconfig.app.json` from `git add` if it was not changed.)

---

### Task 2: The two choices remembered on the device, in `src/ui/choices.ts`

**Files:**
- Create: `src/ui/choices.ts`, `src/ui/choices.test.ts`

**Interfaces:**
- Consumes: `Spot`, `spotById` from `src/spot.ts` (Task 1).
- Produces:
  - `export function readSpot(): Spot`: the spot last chosen, by `spotById` of what is saved, so an unknown or missing id is Campus Point.
  - `export function writeSpot(spot: Spot): void`
  - `export function readTidesShown(spot: Spot): boolean`: what was saved for that spot, else `spot.tidesShown`.
  - `export function writeTidesShown(spot: Spot, shown: boolean): void`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/choices.test.ts`:

```ts
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  readSpot,
  readTidesShown,
  writeSpot,
  writeTidesShown,
} from './choices.ts'
import { CAMPUS_POINT, spotById } from '../spot.ts'

const GAVIOTA = spotById('gaviota')
const LA_CUMBRE = spotById('la-cumbre-peak')

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const items = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    clear: () => items.clear(),
    key: () => null,
    get length() {
      return items.size
    },
  }
}

function brokenStorage(): Storage {
  const fail = () => {
    throw new Error('storage is disabled')
  }
  return {
    getItem: fail,
    setItem: fail,
    removeItem: fail,
    clear: fail,
    key: fail,
    length: 0,
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('the spot', () => {
  test('is Campus Point until one is chosen', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    expect(readSpot()).toBe(CAMPUS_POINT)
  })

  test('is remembered once chosen', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    writeSpot(GAVIOTA)
    expect(readSpot()).toBe(GAVIOTA)
  })

  test('a remembered id that is no longer a spot means Campus Point', () => {
    vi.stubGlobal('localStorage', fakeStorage({ 'tideline:spot': 'gone' }))
    expect(readSpot()).toBe(CAMPUS_POINT)
  })

  test('with storage disabled it is Campus Point, and choosing does not throw', () => {
    vi.stubGlobal('localStorage', brokenStorage())
    expect(readSpot()).toBe(CAMPUS_POINT)
    expect(() => writeSpot(GAVIOTA)).not.toThrow()
  })
})

describe('whether tides are shown', () => {
  test("is the spot's own default until the user says otherwise", () => {
    vi.stubGlobal('localStorage', fakeStorage())
    expect(readTidesShown(CAMPUS_POINT)).toBe(true)
    expect(readTidesShown(LA_CUMBRE)).toBe(false)
  })

  test('is remembered per spot', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    writeTidesShown(LA_CUMBRE, true)
    expect(readTidesShown(LA_CUMBRE)).toBe(true)
    expect(readTidesShown(CAMPUS_POINT)).toBe(true)
    writeTidesShown(CAMPUS_POINT, false)
    expect(readTidesShown(CAMPUS_POINT)).toBe(false)
    expect(readTidesShown(LA_CUMBRE)).toBe(true)
  })

  test('a saved value that is neither word means the default', () => {
    vi.stubGlobal(
      'localStorage',
      fakeStorage({ 'tideline:tides:la-cumbre-peak': 'maybe' }),
    )
    expect(readTidesShown(LA_CUMBRE)).toBe(false)
  })

  test('with storage disabled it is the default, and choosing does not throw', () => {
    vi.stubGlobal('localStorage', brokenStorage())
    expect(readTidesShown(LA_CUMBRE)).toBe(false)
    expect(() => writeTidesShown(LA_CUMBRE, true)).not.toThrow()
  })

  test('with no localStorage at all, the same', () => {
    expect(readSpot()).toBe(CAMPUS_POINT)
    expect(readTidesShown(LA_CUMBRE)).toBe(false)
    expect(() => writeSpot(GAVIOTA)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/ui/choices.test.ts`
Expected: FAIL, cannot find `./choices.ts`.

- [ ] **Step 3: Write the module**

Create `src/ui/choices.ts`:

```ts
// What the user chose last time, remembered on the device: which spot, and
// whether a spot's tide is shown. Every access is wrapped, as the cache's
// are, so a browser with storage disabled still works.

import { spotById } from '../spot.ts'
import type { Spot } from '../spot.ts'

const SPOT_KEY = 'tideline:spot'
const tidesKey = (spot: Spot) => `tideline:tides:${spot.id}`

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage is full or disabled. The choice holds for this open at least.
  }
}

/** The spot last chosen. Nothing chosen, or a spot since gone, is the first. */
export function readSpot(): Spot {
  return spotById(read(SPOT_KEY))
}

export function writeSpot(spot: Spot): void {
  write(SPOT_KEY, spot.id)
}

/** Whether the spot's tide is shown: what the user said, else the default. */
export function readTidesShown(spot: Spot): boolean {
  switch (read(tidesKey(spot))) {
    case 'shown':
      return true
    case 'hidden':
      return false
    default:
      return spot.tidesShown
  }
}

export function writeTidesShown(spot: Spot, shown: boolean): void {
  write(tidesKey(spot), shown ? 'shown' : 'hidden')
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/ui/choices.test.ts`
Expected: 9 tests pass.

- [ ] **Step 5: Run everything**

Run: `npm run format && npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/choices.ts src/ui/choices.test.ts
git commit -m "Remember the chosen spot and whether its tide is shown

Two choices on the device, wrapped like the cache. A remembered spot that
no longer exists is Campus Point; an unreadable tide choice is the spot's
own default.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The gauge's own prediction as a fourth tide source, in `src/data/cache.ts` and `src/data/useSpotData.ts`

**Files:**
- Modify: `src/data/cache.ts`, `src/data/cache.test.ts`, `src/data/useSpotData.ts`, `src/data/useSpotData.test.ts`

**Interfaces:**
- Consumes: `Spot`, `hasOwnGauge` from `src/spot.ts` (Task 1).
- Produces:
  - In `cache.ts`: `Source` is `'predictions' | 'hilo' | 'observed' | 'gauge-predictions' | 'forecast'`. `isStale` treats `'gauge-predictions'` as it treats `'predictions'`.
  - In `useSpotData.ts`: `tideSpecs(spot, frame)` returns `{ predictions, hilo, observed, gaugePredictions }`, where `observed` and `gaugePredictions` fetch from `spot.gauge.id` and `gaugePredictions` needs `frame.day`. `SpotData` gains `gaugePredictions: Loaded<TidePoint[]>`, which for a spot with its own gauge is the very same object as `predictions`. `useSpotData(spot: Spot, tidesShown: boolean): SpotData`. The hook fetches no tide source while `tidesShown` is false, and never fetches gauge predictions for a spot with its own gauge.
- `App.tsx` keeps compiling only if its call is updated: in this task change `useSpotData(spot)` in `src/App.tsx` to `useSpotData(spot, true)`. Task 8 replaces that.

- [ ] **Step 1: Write the failing tests**

In `src/data/cache.test.ts`, find the test `'nothing saved is always stale'` inside `describe('isStale', …)` and add after it:

```ts
  test("the gauge's own prediction is stale by coverage, like the spot's", () => {
    const covering = { fetchedAt: NOW - 30 * DAY, span: WINDOW, data: null }
    expect(isStale('gauge-predictions', covering, NOW, WINDOW)).toBe(false)
    const short = {
      fetchedAt: NOW,
      span: { start: WINDOW.start, end: WINDOW.end - HOUR },
      data: null,
    }
    expect(isStale('gauge-predictions', short, NOW, WINDOW)).toBe(true)
  })
```

In `src/data/useSpotData.test.ts`, change the import from `'../spot.ts'` to `import { CAMPUS_POINT, spotById } from '../spot.ts'`, and inside `describe('tideSpecs', …)` add after the test `"each source asks NOAA for its own product at the spot's station"`:

```ts
  test("the gauge's own prediction is for today, at the gauge, and is saved as its own source", () => {
    expect(specs.gaugePredictions.needed).toEqual(frame.day)
    expect(specs.gaugePredictions.source).toBe('gauge-predictions')
    expect(specs.gaugePredictions.spotId).toBe('campus-point')
    expect(specs.gaugePredictions.isEmpty([])).toBe(true)
  })

  test('where the gauge is another station, readings and its prediction come from there', async () => {
    const gaviota = spotById('gaviota')
    const theirs = tideSpecs(gaviota, frameFor(gaviota, '2026-10-09'))
    const fetchMock = vi.fn(
      async (_url: string) => new Response('{"predictions":[],"data":[]}'),
    )
    vi.stubGlobal('fetch', fetchMock)

    await theirs.predictions.fetch(frame.day)
    await theirs.hilo.fetch(frame.day)
    await theirs.observed.fetch(frame.day)
    await theirs.gaugePredictions.fetch(frame.day)

    const urls = fetchMock.mock.calls.map((call) => call[0])
    expect(urls[0]).toContain('station=9411399')
    expect(urls[1]).toContain('station=9411399')
    expect(urls[2]).toContain('product=water_level&')
    expect(urls[2]).toContain('station=9411340')
    expect(urls[3]).toContain('product=predictions&interval=6&')
    expect(urls[3]).toContain('station=9411340')
  })
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/data/cache.test.ts src/data/useSpotData.test.ts`
Expected: the cache test fails on the type (or on `isStale` returning `undefined`); the spec tests fail with `gaugePredictions` undefined.

- [ ] **Step 3: Add the source to the cache**

In `src/data/cache.ts`, change the `Source` type to:

```ts
export type Source =
  | 'predictions'
  | 'hilo'
  | 'observed'
  | 'gauge-predictions'
  | 'forecast'
```

and in `isStale`, change the `case 'predictions': case 'hilo':` pair to:

```ts
    case 'predictions':
    case 'hilo':
    case 'gauge-predictions':
```

- [ ] **Step 4: Add the spec and the `wanted` flag to the hook**

In `src/data/useSpotData.ts`:

Change `import type { Spot } from '../spot.ts'` to:

```ts
import { hasOwnGauge } from '../spot.ts'
import type { Spot } from '../spot.ts'
```

In `SpotData`, after `observed: Loaded<TidePoint[]>`, add:

```ts
  /**
   * The gauge station's own predicted curve for today, so its reading can be
   * set against its own prediction. For a spot whose gauge is its tide
   * station this is `predictions` itself.
   */
  gaugePredictions: Loaded<TidePoint[]>
```

Replace `tideSpecs` with:

```ts
/** What to load for the tide: which source, for which span, and how. */
export function tideSpecs(
  spot: Spot,
  frame: Pick<SpotData, 'day' | 'window'>,
): {
  predictions: SourceSpec<TidePoint[]>
  hilo: SourceSpec<TideExtreme[]>
  observed: SourceSpec<TidePoint[]>
  gaugePredictions: SourceSpec<TidePoint[]>
} {
  const station = spot.tideStation.id
  const gauge = spot.gauge.id
  const noPoints = (data: unknown[]) => data.length === 0
  return {
    predictions: {
      spotId: spot.id,
      source: 'predictions',
      isData: isTidePoints,
      needed: frame.window,
      fetch: (needed) => fetchPredictions(station, needed.start, needed.end),
      isEmpty: noPoints,
    },
    hilo: {
      spotId: spot.id,
      source: 'hilo',
      isData: isTideExtremes,
      needed: frame.window,
      fetch: (needed) => fetchHiLo(station, needed.start, needed.end),
      isEmpty: noPoints,
    },
    observed: {
      spotId: spot.id,
      source: 'observed',
      isData: isTidePoints,
      // Readings are only drawn for today, so only today is asked for.
      needed: frame.day,
      fetch: (needed) => fetchWaterLevel(gauge, needed.start, needed.end),
      // Just after midnight there are no readings yet, and that is fine.
      isEmpty: () => false,
    },
    // Only fetched where the gauge is another station. Its readings are
    // set against its own prediction, not the spot's.
    gaugePredictions: {
      spotId: spot.id,
      source: 'gauge-predictions',
      isData: isTidePoints,
      needed: frame.day,
      fetch: (needed) => fetchPredictions(gauge, needed.start, needed.end),
      isEmpty: noPoints,
    },
  }
}
```

Replace `useLoaded` with:

```ts
/**
 * One source over time. The loader is always made, so the hooks are called
 * in one order, but it fetches nothing while `wanted` is false: a hidden
 * tide is not loaded, and a gauge's own prediction is not loaded where the
 * gauge is the spot's own station.
 */
function useLoaded<T>(
  spec: SourceSpec<T>,
  now: number,
  wanted: boolean,
): Loaded<T> {
  const [loader] = useState(() => createLoader(spec, now))
  // After every render. The loader decides whether anything needs fetching,
  // and guards against asking twice or retrying a failure too soon.
  useEffect(() => {
    if (wanted) loader.check(spec, now)
  })
  return useSyncExternalStore(loader.subscribe, loader.current)
}
```

Replace `useSpotData` with:

```ts
export function useSpotData(spot: Spot, tidesShown: boolean): SpotData {
  const { now, shown } = useClock()
  const today = localDate(now, spot.timeZone)
  // Recomputed only when the date at the spot changes, such as at midnight
  // on a phone left open.
  const frame = useMemo(() => frameFor(spot, today), [spot, today])
  const specs = tideSpecs(spot, frame)
  const ownGauge = hasOwnGauge(spot)

  const predictions = useLoaded(specs.predictions, now, tidesShown)
  const hilo = useLoaded(specs.hilo, now, tidesShown)
  const observed = useLoaded(specs.observed, now, tidesShown)
  const gaugeOwn = useLoaded(
    specs.gaugePredictions,
    now,
    tidesShown && !ownGauge,
  )
  const gaugePredictions = ownGauge ? predictions : gaugeOwn
  const forecast = useLoaded(forecastSpec(spot, frame), now, true)

  return {
    now,
    shown,
    today,
    ...frame,
    predictions,
    hilo,
    observed,
    gaugePredictions,
    forecast,
  }
}
```

In `src/App.tsx`, change `const data = useSpotData(spot)` to `const data = useSpotData(spot, true)`.

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run src/data/cache.test.ts src/data/useSpotData.test.ts`
Expected: all pass.

- [ ] **Step 6: Run everything**

Run: `npm run format && npm test && npm run lint && npm run build`
Expected: all pass. If `tideView.test.ts` or `dayList.test.ts` now fail the type check because their `data()` helpers build a `SpotData` without `gaugePredictions`: they build `Pick<SpotData, …>` objects and should not. If one does, add `gaugePredictions: ready(curve)` beside its `predictions` field.

- [ ] **Step 7: Commit**

```bash
git add src/data/cache.ts src/data/cache.test.ts src/data/useSpotData.ts src/data/useSpotData.test.ts src/App.tsx
git commit -m "Load the gauge's own prediction, and only what is wanted

Where a spot's gauge is another station, its readings are set against its
own prediction, so that curve for today is a fourth tide source. Readings
come from the gauge. A loader is always made but fetches only while it is
wanted: nothing for a hidden tide, and no gauge prediction where the gauge
is the spot's own station.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The gauge's words, in `src/chart/readout.ts`

**Files:**
- Modify: `src/chart/readout.ts`, `src/chart/readout.test.ts`

**Interfaces:**
- Consumes: `signedFeet` in the same file.
- Produces: `export function gaugeWords(name: string, aboveFt: number): string`, giving `'Santa Barbara gauge +1.2 ft vs its prediction'`, `'… -0.3 ft …'`, `'… 0.0 ft …'`.

- [ ] **Step 1: Write the failing test**

In `src/chart/readout.test.ts`, add `gaugeWords,` to the import list from `./readout.ts` (keep it alphabetical: after `feet,`), and at the end of the file add:

```ts
describe('gaugeWords', () => {
  test("names the gauge and signs its deviation from its own prediction", () => {
    expect(gaugeWords('Santa Barbara', 1.18)).toBe(
      'Santa Barbara gauge +1.2 ft vs its prediction',
    )
    expect(gaugeWords('Santa Barbara', -0.3)).toBe(
      'Santa Barbara gauge -0.3 ft vs its prediction',
    )
  })

  test('a deviation that rounds to nothing is 0.0, never -0.0', () => {
    expect(gaugeWords('Santa Barbara', 0)).toBe(
      'Santa Barbara gauge 0.0 ft vs its prediction',
    )
    expect(gaugeWords('Santa Barbara', -0.04)).toBe(
      'Santa Barbara gauge 0.0 ft vs its prediction',
    )
  })
})
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/chart/readout.test.ts`
Expected: FAIL, `gaugeWords` is not exported.

- [ ] **Step 3: Write it**

In `src/chart/readout.ts`, after `tideWords`, add:

```ts
/**
 * A gauge elsewhere, set against its own prediction: 'Santa Barbara gauge
 * +1.2 ft vs its prediction'. For a spot whose tide station has no gauge.
 */
export function gaugeWords(name: string, aboveFt: number): string {
  return `${name} gauge ${signedFeet(aboveFt)} ft vs its prediction`
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run src/chart/readout.test.ts`
Expected: all pass.

- [ ] **Step 5: Run everything, then commit**

Run: `npm run format && npm test && npm run lint && npm run build`

```bash
git add src/chart/readout.ts src/chart/readout.test.ts
git commit -m "Words for a gauge's deviation from its own prediction

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The tide view knows its spot, in `src/ui/tideView.ts`

**Files:**
- Modify: `src/ui/tideView.ts`, `src/ui/tideView.test.ts`, `src/App.tsx`

**Interfaces:**
- Consumes: `Spot`, `hasOwnGauge` (Task 1); `SpotData.gaugePredictions` (Task 3); `gaugeWords`, `tideReadout` (Task 4).
- Produces: `tideView(data, selected, pick, tides: { spot: Spot; shown: boolean }): TideView`, where `TideView` changes as follows:
  - `text` becomes `{ predicted: string; second: { words: string; key: 'observed' | null } | null }`. The second line is the reading with its difference at a spot with its own gauge (key `'observed'`, for its colour bar), or the gauge's deviation at a spot without (key `null`), or nothing.
  - `hidden: string | null`: the one line to show in place of the panel, table and caption when the tide is hidden: `'Tides hidden. Nearest station: NOAA 9411340 Santa Barbara, 6.3 mi south.'`. When set, `predicted`, `observed` and `events` are empty, `series`, `rules` and `dots` are empty, `notice` is null, and `words` is the hidden line.
  - `canHide: boolean`: whether to offer "Hide tides": true for a spot whose tide is hidden by default, once shown.
  - `readings: TidePoint[]`: the gauge's readings for today whether drawn or not, for the caption's "observed through" time.
  - `observed` is empty, and no observed series or dot is produced, for a spot without its own gauge.
- `App.tsx` is updated in this task only as far as it must compile: its `tideView` call gains the fourth argument `{ spot, shown: true }`, and its readout reads `tide.text.second`. Task 8 reworks it.

- [ ] **Step 1: Update the existing tests and write the new ones**

In `src/ui/tideView.test.ts`:

Change the imports at the top to:

```ts
import { describe, expect, test } from 'vitest'
import type { Selected } from './selection.ts'
import { tideView } from './tideView.ts'
import type { Loaded } from '../data/load.ts'
import type { TideExtreme, TidePoint } from '../data/noaa.ts'
import { CAMPUS_POINT, spotById } from '../spot.ts'
```

After the `none` helper, add:

```ts
const OWN = { spot: CAMPUS_POINT, shown: true }
const GAVIOTA = { spot: spotById('gaviota'), shown: true }
const LA_CUMBRE = { spot: spotById('la-cumbre-peak'), shown: false }
```

In the `data()` helper, add `gaugePredictions: ready(curve),` after `predictions: ready(curve),`.

Every existing call to `tideView` is at Campus Point with its tide shown. Rather than edit thirty calls, rename them to a helper. Change the type import `import type { Selected } from './selection.ts'` to stay, and add after the `LA_CUMBRE` constant:

```ts
/** The view at Campus Point, which has its own gauge and shows its tide. */
function own(
  data: Parameters<typeof tideView>[0],
  selected: Selected,
  pick: Parameters<typeof tideView>[2],
) {
  return tideView(data, selected, pick, OWN)
}
```

Then, from the repo root, rename every existing call (the import line has no parenthesis after the name, so it is left alone):

```bash
perl -pi -e 's/\btideView\(/own(/g' src/ui/tideView.test.ts
```

Check with `grep -c 'own(' src/ui/tideView.test.ts` that there are about 30, and that the import line still reads `import { tideView } from './tideView.ts'`. The new tests below call `tideView` directly with their own fourth argument.

Change the test `'the panel is named, and its words for a screen reader start with its name'` so its `text` expectation reads:

```ts
    expect(view.text).toEqual({
      predicted: '3.0 ft predicted',
      second: { words: '4.0 ft observed (+1.0)', key: 'observed' },
    })
```

(That test's calls are now `own(data(), TODAY, null)` and `own(data(), TOMORROW, null)` after the rename.)

At the end of the file add:

```ts
describe('a spot whose gauge is another station', () => {
  // The gauge's own curve runs 0.5 ft below the spot's, so its readings,
  // which are 4 ft, stand 1.5 ft above it.
  const gaugeCurve = curve.map((point) => ({ ...point, ft: point.ft - 0.5 }))
  const gauge = () => data({ gaugePredictions: ready(gaugeCurve) })

  test("draws the spot's own curve and no readings on it", () => {
    const view = tideView(gauge(), TODAY, null, GAVIOTA)
    expect(view.predicted[0]).toEqual({ t: START, ft: 3 })
    expect(view.observed).toEqual([])
    expect(view.series.map((series) => series.name)).toEqual(['predicted'])
    expect(view.dots).toEqual([{ name: 'predicted', v: 3 }])
  })

  test("reads the gauge's deviation from its own prediction at the cursor, without a colour key", () => {
    const view = tideView(gauge(), TODAY, null, GAVIOTA)
    expect(view.text).toEqual({
      predicted: '3.0 ft predicted',
      second: {
        words: 'Santa Barbara gauge +1.5 ft vs its prediction',
        key: null,
      },
    })
    expect(view.words).toBe(
      'Tide: 3.0 ft predicted, Santa Barbara gauge +1.5 ft vs its prediction',
    )
  })

  test("at rest the cursor sits on the gauge's latest reading", () => {
    const view = tideView(gauge(), TODAY, null, GAVIOTA)
    expect(view.cursor).toBe(START + 15 * HOUR + 24 * MINUTE)
  })

  test('past the last reading the second line is blank', () => {
    const pick = { t: START + 16 * HOUR, day: '2026-10-08', shown: 0 }
    expect(tideView(gauge(), TODAY, pick, GAVIOTA).text.second).toBeNull()
  })

  test("without the gauge's own prediction there is no deviation", () => {
    const view = tideView(
      data({ gaugePredictions: none('loading') }),
      TODAY,
      null,
      GAVIOTA,
    )
    expect(view.text.second).toBeNull()
    expect(view.words).toBe('Tide: 3.0 ft predicted')
  })

  test('on another day the gauge says nothing', () => {
    const view = tideView(gauge(), TOMORROW, null, GAVIOTA)
    expect(view.text.second).toBeNull()
    expect(view.observed).toEqual([])
    expect(view.words).toBe('Tide: 3.0 ft predicted')
  })

  test("the gauge's readings are kept for the caption, though not drawn", () => {
    const view = tideView(gauge(), TODAY, null, GAVIOTA)
    expect(view.readings).toHaveLength(readings.length)
    expect(view.observed).toEqual([])
  })

  test("the vertical range does not count the gauge's readings, which are not drawn", () => {
    const high = [...readings, { t: NOW, ft: 8.2 }]
    const view = tideView(
      data({ observed: ready(high), gaugePredictions: ready(gaugeCurve) }),
      TODAY,
      null,
      GAVIOTA,
    )
    expect(view.bounds).toEqual([3, 7])
  })

  test('the hide control is not offered where the tide is shown by default', () => {
    expect(tideView(gauge(), TODAY, null, GAVIOTA).canHide).toBe(false)
    expect(tideView(data(), TODAY, null, OWN).canHide).toBe(false)
  })
})

describe('a spot whose tide is hidden', () => {
  test('gives one line naming the nearest station, and nothing to draw', () => {
    const view = tideView(data(), TODAY, null, LA_CUMBRE)
    expect(view.hidden).toBe(
      'Tides hidden. Nearest station: NOAA 9411340 Santa Barbara, 6.3 mi south.',
    )
    expect(view.words).toBe(view.hidden)
    expect(view.notice).toBeNull()
    expect(view.predicted).toEqual([])
    expect(view.observed).toEqual([])
    expect(view.events).toEqual([])
    expect(view.series).toEqual([])
    expect(view.rules).toEqual([])
    expect(view.dots).toEqual([])
    expect(view.text.second).toBeNull()
  })

  test('the cursor still rests where it would, so the weather under it is right', () => {
    const view = tideView(data(), TODAY, null, LA_CUMBRE)
    expect(view.cursor).toBe(START + 15 * HOUR + 24 * MINUTE)
    expect(tideView(data(), TOMORROW, null, LA_CUMBRE).cursor).toBe(
      END + 18 * HOUR + 30 * MINUTE,
    )
  })

  test('once shown it is drawn like any spot with its own gauge, with the hide control offered', () => {
    const shown = { ...LA_CUMBRE, shown: true }
    const view = tideView(data(), TODAY, null, shown)
    expect(view.hidden).toBeNull()
    expect(view.canHide).toBe(true)
    expect(view.series.map((series) => series.name)).toEqual([
      'predicted',
      'observed',
    ])
    expect(view.text.second).toEqual({
      words: '4.0 ft observed (+1.0)',
      key: 'observed',
    })
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/ui/tideView.test.ts`
Expected: the type check or the assertions fail on `text.second`, `hidden`, `canHide`, and the fourth argument.

- [ ] **Step 3: Rewrite `tideView`**

Replace the whole of `src/ui/tideView.ts` with:

```ts
// What the tide part of the screen shows, worked out from what is loaded,
// which day is on screen, where the cursor was last put, and which spot it
// is. A plain function, so the rules have tests and the components only
// arrange the result.

import type { Dot, Rule, Series } from '../chart/Panel.tsx'
import {
  STEP,
  gaugeWords,
  restingCursor,
  tideReadout,
  tideWords,
} from '../chart/readout.ts'
import type { TideReadout } from '../chart/readout.ts'
import { steppedBounds, wholeSteps } from '../chart/scales.ts'
import type { TideExtreme, TidePoint } from '../data/noaa.ts'
import type { SpotData } from '../data/useSpotData.ts'
import { hasOwnGauge } from '../spot.ts'
import type { Spot } from '../spot.ts'
import { MINUTE } from '../time.ts'
import { onDay } from './selection.ts'
import type { Selected } from './selection.ts'

/** Readings come every 6 minutes. A longer gap is an outage. */
const OBSERVED_GAP = 13 * MINUTE
/** A rule and a label every this many feet. */
const RULE_EVERY = 2
const TITLE = 'Tide'

/** Where the cursor was put by hand, and when. */
export interface CursorPick {
  t: number
  /** The date of the day that was on screen when it was put there. */
  day: string
  /** How many times the page had come back into view by then. */
  shown: number
}

/** The readout's second line, under the prediction. */
export interface SecondLine {
  words: string
  /** The series it is the key to, for its colour bar. None for a gauge elsewhere. */
  key: 'observed' | null
}

export interface TideView {
  title: string
  /** The day's predicted curve, reaching both edges of the plot. */
  predicted: TidePoint[]
  /** The gauge's readings for today, drawn or not. For the caption. */
  readings: TidePoint[]
  /** The readings that are drawn: today's, at a spot with its own gauge. */
  observed: TidePoint[]
  /** The day's highs and lows. */
  events: TideExtreme[]
  cursor: number
  /** The plot's vertical range, in whole feet. */
  bounds: [number, number]
  readout: TideReadout
  /**
   * The readout in words: the prediction, and under it the reading with its
   * difference, or a gauge elsewhere set against its own prediction, or
   * nothing.
   */
  text: { predicted: string; second: SecondLine | null }
  /** Everything the panel says at the cursor, as one run of words. */
  words: string
  rules: Rule[]
  /** The curve, filled, with the readings over it where there are any. */
  series: Series[]
  /**
   * Where the cursor meets the curve, and the reading if there is one. None
   * when there is no curve to draw.
   */
  dots: Dot[]
  /** What to say where the plot would be, when there is no curve to draw. */
  notice: string | null
  /**
   * The one line that stands in for the panel, the table and the caption
   * when the tide is hidden. Null when it is shown.
   */
  hidden: string | null
  /** Whether to offer "Hide tides": at a spot that hides them by default. */
  canHide: boolean
}

type Inputs = Pick<
  SpotData,
  'now' | 'shown' | 'day' | 'predictions' | 'hilo' | 'observed' | 'gaugePredictions'
>

/** Which spot, and whether its tide is on screen. */
export interface TideChoice {
  spot: Spot
  shown: boolean
}

/** The points on a day, both ends included. */
function within(points: TidePoint[] | null, day: { start: number; end: number }) {
  return (points ?? []).filter((p) => p.t >= day.start && p.t <= day.end)
}

/** The one line shown in place of the tide when it is hidden. */
function hiddenLine(spot: Spot): string {
  const { id, name, distanceMi, direction } = spot.tideStation
  return `Tides hidden. Nearest station: NOAA ${id} ${name}, ${distanceMi} mi ${direction}.`
}

export function tideView(
  data: Inputs,
  selected: Selected,
  pick: CursorPick | null,
  tides: TideChoice,
): TideView {
  const { spot } = tides
  const { span } = selected
  const ownGauge = hasOwnGauge(spot)
  // Both ends are included, so the curve reaches the right edge of the plot
  // by using the first point of the next day.
  const predicted = tides.shown ? within(data.predictions.data, span) : []
  // The gauge's readings for today, wherever the gauge is.
  const readings = within(data.observed.data, data.day)
  // Drawn only where they are this station's own.
  const observed = selected.isToday && ownGauge ? readings : []
  const events = tides.shown ? onDay(data.hilo.data ?? [], span) : []

  // Where the cursor sits until someone moves it. Today that is the latest
  // reading, or the clock. Any other day it is the day's anchor. It is the
  // step that contains the anchor, never the one after: a sunset at 4:59 PM
  // must not tip the cursor into the 5 PM hour, or the weather under it
  // would not be the hour that the day's row in the list gives.
  const rest = selected.isToday
    ? restingCursor(data.now, readings)
    : Math.floor(selected.anchor / STEP) * STEP
  // A pick belongs to the day it was made on, and lasts until the page is put
  // away and brought back. After that the cursor goes back to rest, so
  // reopening the app shows the latest reading and not wherever the cursor
  // was left. Choosing a day from the list clears the pick, in SpotScreen.
  const held =
    pick !== null && pick.day === selected.date && pick.shown === data.shown
  const cursor = held ? Math.min(Math.max(pick.t, span.start), span.end) : rest

  // One vertical range for all 14 days, so one day can be compared with
  // another, widened if needed to fit today's readings. Those count on every
  // day, so the scale does not jump when another day is chosen. A gauge
  // elsewhere is not drawn, so its readings do not count.
  const drawn = ownGauge ? readings : []
  const bounds = steppedBounds(
    [...(data.predictions.data ?? []), ...drawn].map((point) => point.ft),
    1,
  )

  const hidden = tides.shown ? null : hiddenLine(spot)
  let notice: string | null = null
  if (hidden === null && predicted.length === 0) {
    notice =
      data.predictions.status === 'loading'
        ? 'Loading tides'
        : 'Tide data unavailable'
  }

  const readout = tideReadout(predicted, observed, cursor)
  const text = tideWords(readout)
  // The second line: this station's reading, or a gauge elsewhere set
  // against its own prediction for the same step.
  let second: SecondLine | null = null
  if (text.observed !== null) {
    second = { words: text.observed, key: 'observed' }
  } else if (!ownGauge && selected.isToday && hidden === null) {
    const theirs = within(data.gaugePredictions.data, data.day)
    const { aboveFt } = tideReadout(theirs, readings, cursor)
    if (aboveFt !== null) {
      second = { words: gaugeWords(spot.gauge.name, aboveFt), key: null }
    }
  }

  const dots: Dot[] = []
  if (notice === null && hidden === null) {
    if (readout.predictedFt !== null) {
      dots.push({ name: 'predicted', v: readout.predictedFt })
    }
    if (readout.observedFt !== null) {
      dots.push({ name: 'observed', v: readout.observedFt })
    }
  }
  // For a screen reader. The panel is named, so the words are never left
  // hanging among the weather panels'. Without a curve there is no panel,
  // and the notice is said instead; hidden, the hidden line is said.
  const said = [text.predicted, second?.words ?? null].filter(
    (part) => part !== null,
  )
  const words = hidden ?? notice ?? `${TITLE}: ${said.join(', ')}`

  const series: Series[] = []
  if (hidden === null) {
    series.push({
      name: 'predicted',
      filled: true,
      points: predicted.map((p) => ({ t: p.t, v: p.ft })),
    })
    if (ownGauge) {
      series.push({
        name: 'observed',
        maxGap: OBSERVED_GAP,
        points: observed.map((p) => ({ t: p.t, v: p.ft })),
      })
    }
  }

  return {
    title: TITLE,
    predicted,
    readings,
    observed,
    events,
    cursor,
    bounds,
    readout,
    text: { predicted: text.predicted, second },
    words,
    rules:
      notice === null && hidden === null
        ? wholeSteps(bounds[0], bounds[1], RULE_EVERY).map((v) => ({
            v,
            label: `${v} ft`,
          }))
        : [],
    series,
    dots,
    notice,
    hidden,
    canHide: tides.shown && !spot.tidesShown,
  }
}
```

Note what moved: the resting cursor now uses `readings` (the gauge's, whichever station it is) rather than `observed` (only what is drawn), which is what puts Gaviota's cursor on the Santa Barbara gauge's latest reading. At Campus Point the two are the same list.

- [ ] **Step 4: Make `App.tsx` compile**

In `src/App.tsx`:
- Change `const tide = tideView(data, selected, pick)` to `const tide = tideView(data, selected, pick, { spot, shown: true })`.
- Replace the readout's second span:

```tsx
                      <span
                        className={
                          tide.text.second?.key === 'observed'
                            ? 'key key-observed'
                            : undefined
                        }
                      >
                        {tide.text.second?.words}
                      </span>
```

Task 8 moves this into `SpotScreen.tsx`; here it only has to compile.

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run src/ui/tideView.test.ts`
Expected: all pass, including every existing test with `OWN` added.

- [ ] **Step 6: Run everything, then commit**

Run: `npm run format && npm test && npm run lint && npm run build`

```bash
git add src/ui/tideView.ts src/ui/tideView.test.ts src/App.tsx
git commit -m "The tide view knows its spot: a gauge elsewhere, or hidden

At a spot whose tide station has no gauge, the readout's second line is
the nearest gauge's deviation from its own prediction at the cursor's
step, with the cursor resting on that gauge's latest reading. Nothing of
another station is drawn on the spot's curve. At a spot whose tide is
hidden, the view is one line naming the nearest station, with nothing to
draw, and offers the hide control once shown.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Captions for a gauge elsewhere and for the cell's elevation, in `src/ui/captions.ts`

**Files:**
- Modify: `src/ui/captions.ts`, `src/ui/captions.test.ts`

**Interfaces:**
- Consumes: `Spot`, `hasOwnGauge` (Task 1).
- Produces: `tideCaption(spot, tide)` and `weatherCaption(spot, forecast, today)` with the same signatures and these words:
  - Tide, own gauge (unchanged): `Tide: NOAA 9411340 Santa Barbara, 8.6 mi east. Observed through 2:06 PM, preliminary.`
  - Tide, gauge elsewhere: `Tide: NOAA 9411399 Gaviota State Park, 0.2 mi south, predictions only. Gauge: NOAA 9411340 Santa Barbara, 31 mi east, observed through 2:06 PM, preliminary.` With no reading yet: `… predictions only. Gauge: NOAA 9411340 Santa Barbara, 31 mi east. No observed readings yet today.` The prediction and high/low sentences keep their place between the two.
  - Weather, no own elevation: `Weather: NWS forecast for the 2.5 km cell at this spot, 3 ft above sea level. Updated 7:26 AM.` With no forecast: `Weather: NWS forecast for the 2.5 km cell at this spot, 3 ft above sea level.`
  - Weather, own elevation: `Weather: NWS forecast for the 2.5 km cell at this spot, which averages 3,258 ft above sea level; the spot itself is at 3,997 ft. Updated 7:26 AM.`
  - The failure sentences are unchanged.

- [ ] **Step 1: Update the existing tests and write the new ones**

In `src/ui/captions.test.ts`:

Change the import from `'../spot.ts'` to `import { CAMPUS_POINT, spotById } from '../spot.ts'`.

In `describe('weatherCaption', …)`, change `SOURCE` to:

```ts
  const SOURCE =
    'Weather: NWS forecast for the 2.5 km cell at this spot, 3 ft above sea level'
```

and change every `, updated ` in that describe's expectations to `. Updated `. There are four: `${SOURCE}, updated 7:26 AM.` becomes `${SOURCE}. Updated 7:26 AM.`, and so on. The no-forecast case `${SOURCE}.` stays as it is.

At the end of `describe('weatherCaption', …)` add:

```ts
  test("gives the cell's average and the spot's own height where the two differ", () => {
    const laCumbre = spotById('la-cumbre-peak')
    expect(weatherCaption(laCumbre, forecast('ready'), TODAY)).toBe(
      'Weather: NWS forecast for the 2.5 km cell at this spot, which averages 3,258 ft above sea level; the spot itself is at 3,997 ft. Updated 7:26 AM.',
    )
    expect(weatherCaption(laCumbre, forecast('loading', null), TODAY)).toBe(
      'Weather: NWS forecast for the 2.5 km cell at this spot, which averages 3,258 ft above sea level; the spot itself is at 3,997 ft.',
    )
  })

  test('a cell at sea level says 0 ft', () => {
    const gaviota = spotById('gaviota')
    expect(weatherCaption(gaviota, forecast('ready'), TODAY)).toBe(
      'Weather: NWS forecast for the 2.5 km cell at this spot, 0 ft above sea level. Updated 7:26 AM.',
    )
  })
```

After `describe('tideCaption', …)` add a new describe:

```ts
describe('tideCaption at a spot whose gauge is another station', () => {
  const GAVIOTA = spotById('gaviota')
  const THEIRS =
    'Tide: NOAA 9411399 Gaviota State Park, 0.2 mi south, predictions only.'
  const GAUGE = 'Gauge: NOAA 9411340 Santa Barbara, 31 mi east'

  function theirs(
    predictions: Loaded<TidePoint[]>,
    observed: Loaded<TidePoint[]>,
    readings: TidePoint[],
    rest: { hilo?: Loaded<TideExtreme[]>; isToday?: boolean } = {},
  ): string {
    return tideCaption(GAVIOTA, {
      predictions,
      hilo: HILO,
      observed,
      readings,
      today: TODAY,
      isToday: true,
      ...rest,
    })
  }

  test('names both stations, and the gauge gives the time of its last reading', () => {
    expect(theirs(loaded('ready'), loaded('ready'), [EARLIER, READING])).toBe(
      `${THEIRS} ${GAUGE}, observed through 2:06 PM, preliminary.`,
    )
  })

  test('with no reading yet, the gauge is named and then the reason', () => {
    expect(theirs(loaded('ready'), loaded('ready', []), [])).toBe(
      `${THEIRS} ${GAUGE}. No observed readings yet today.`,
    )
    expect(theirs(loaded('ready'), loaded('unavailable', null), [])).toBe(
      `${THEIRS} ${GAUGE}. Observed level unavailable.`,
    )
    expect(theirs(loaded('ready'), loaded('loading', null), [])).toBe(
      `${THEIRS} ${GAUGE}.`,
    )
  })

  test("a refresh that failed keeps the gauge's last reading and says so", () => {
    expect(theirs(loaded('ready'), loaded('stale'), [READING])).toBe(
      `${THEIRS} ${GAUGE}, observed through 2:06 PM, preliminary. Couldn't refresh the observed level.`,
    )
  })

  test('old predictions are reported before the gauge', () => {
    expect(theirs(loaded('stale'), loaded('ready'), [READING])).toBe(
      `${THEIRS} Couldn't refresh. Showing predictions from 2:05 PM. ${GAUGE}, observed through 2:06 PM, preliminary.`,
    )
  })

  test('on another day the gauge is not mentioned', () => {
    expect(theirs(loaded('ready'), loaded('ready'), [], { isToday: false })).toBe(
      THEIRS,
    )
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/ui/captions.test.ts`
Expected: the weather captions fail on `, updated` versus `. Updated` and the missing elevation; the gauge describe fails on the words.

- [ ] **Step 3: Rewrite the captions**

Replace the whole of `src/ui/captions.ts` with:

```ts
// The small print under the panels: where the data comes from, how recent it
// is, and what went wrong if something did. Plain functions.

import type { Loaded } from '../data/load.ts'
import type { TideExtreme, TidePoint } from '../data/noaa.ts'
import type { Forecast } from '../data/nws.ts'
import { hasOwnGauge } from '../spot.ts'
import type { Spot, Station } from '../spot.ts'
import { formatDay, formatTime, localDate } from '../time.ts'

/** A time, with its day in front when that day is not today. */
function when(t: number, today: string, timeZone: string): string {
  const day = localDate(t, timeZone)
  const time = formatTime(t, timeZone)
  return day === today ? time : `${formatDay(day)}, ${time}`
}

/** 'NOAA 9411340 Santa Barbara, 8.6 mi east' */
function stationWords(station: Station): string {
  const { id, name, distanceMi, direction } = station
  return `NOAA ${id} ${name}, ${distanceMi} mi ${direction}`
}

/** A height in whole feet with a thousands comma: '3,258 ft'. */
function feetHigh(ft: number): string {
  return `${Math.round(ft).toLocaleString('en-US')} ft`
}

export interface TideSources {
  predictions: Loaded<TidePoint[]>
  hilo: Loaded<TideExtreme[]>
  observed: Loaded<TidePoint[]>
  /** The readings that are drawn, or read out, in order. Only today has any. */
  readings: TidePoint[]
  /** Today's date at the spot. */
  today: string
  /** Whether the day on screen is today. Readings belong to today only. */
  isToday: boolean
}

export function tideCaption(spot: Spot, tide: TideSources): string {
  const zone = spot.timeZone
  const { predictions, hilo, observed, readings, today } = tide
  const ownGauge = hasOwnGauge(spot)
  const parts = [
    ownGauge
      ? `Tide: ${stationWords(spot.tideStation)}.`
      : `Tide: ${stationWords(spot.tideStation)}, predictions only.`,
  ]

  if (predictions.status === 'stale' && predictions.fetchedAt !== null) {
    const saved = when(predictions.fetchedAt, today, zone)
    parts.push(`Couldn't refresh. Showing predictions from ${saved}.`)
  }

  // Without this the table of highs and lows is simply missing, or stops
  // short of the last days, with nothing to say why.
  if (hilo.status === 'unavailable') {
    parts.push('High and low times unavailable.')
  } else if (hilo.status === 'stale' && hilo.fetchedAt !== null) {
    const saved = when(hilo.fetchedAt, today, zone)
    parts.push(
      `Couldn't refresh the high and low times. Showing those from ${saved}.`,
    )
  }

  if (!tide.isToday) return parts.join(' ')

  const last = readings[readings.length - 1]
  // A gauge elsewhere is named, with its distance, before its reading.
  const gauge = ownGauge ? null : `Gauge: ${stationWords(spot.gauge)}`
  if (last) {
    const through = formatTime(last.t, zone)
    parts.push(
      gauge
        ? `${gauge}, observed through ${through}, preliminary.`
        : `Observed through ${through}, preliminary.`,
    )
  } else if (gauge) {
    parts.push(`${gauge}.`)
  }
  if (observed.status === 'stale') {
    parts.push("Couldn't refresh the observed level.")
  } else if (observed.status === 'unavailable') {
    parts.push('Observed level unavailable.')
  } else if (!last && observed.status === 'ready') {
    parts.push('No observed readings yet today.')
  }

  return parts.join(' ')
}

/** The weather caption. `today` is today's date at the spot. */
export function weatherCaption(
  spot: Spot,
  forecast: Loaded<Forecast>,
  today: string,
): string {
  const zone = spot.timeZone
  const cell = feetHigh(spot.nws.elevationFt)
  // The cell is an average over 2.5 km. Where the spot is a peak, that
  // average is well below it, and saying so stops the forecast looking
  // wrong.
  const height =
    spot.elevationFt === null
      ? `${cell} above sea level`
      : `which averages ${cell} above sea level; the spot itself is at ${feetHigh(spot.elevationFt)}`
  const source = `Weather: NWS forecast for the 2.5 km cell at this spot, ${height}.`
  if (forecast.data === null) return source

  const updated = when(forecast.data.updatedAt, today, zone)
  const parts = [source, `Updated ${updated}.`]
  if (forecast.status === 'stale' && forecast.fetchedAt !== null) {
    const saved = when(forecast.fetchedAt, today, zone)
    parts.push(`Couldn't refresh. Showing the forecast from ${saved}.`)
  }
  return parts.join(' ')
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/ui/captions.test.ts`
Expected: all pass.

- [ ] **Step 5: Run everything, then commit**

Run: `npm run format && npm test && npm run lint && npm run build`

```bash
git add src/ui/captions.ts src/ui/captions.test.ts
git commit -m "Captions name a gauge elsewhere and give the cell's elevation

At a spot whose tide station has no gauge, the tide caption says so and
names the gauge with its distance before its reading. The weather caption
gives the cell's elevation, and where the spot is a peak, its own height
beside the cell's average.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: The list leaves out tides that are hidden, in `src/ui/dayList.ts`

**Files:**
- Modify: `src/ui/dayList.ts`, `src/ui/dayList.test.ts`, `src/App.tsx`

**Interfaces:**
- Produces: `dayRows(data, picked, timeZone, tidesShown: boolean): DayRow[]`. With `tidesShown` false, every row's `tides` is `[]`.
- `App.tsx` gains the fourth argument `true` so it compiles. Task 8 replaces it.

- [ ] **Step 1: Update the existing tests and write the new one**

In `src/ui/dayList.test.ts`, inside `describe('dayRows', …)`: change `const rows = dayRows(data, null, ZONE)` to `const rows = dayRows(data, null, ZONE, true)`, and `dayRows(data, '2026-10-13', ZONE)` to `dayRows(data, '2026-10-13', ZONE, true)`. Search the describe for any other `dayRows(` call and add `, true` to each. Then add, after the test `"a row's highs and lows are that day's, in order, and one at midnight belongs to the day it starts"`:

```ts
  test('with the tide hidden, no row lists highs and lows, and the rest of the row stands', () => {
    const hidden = dayRows(data, null, ZONE, false)
    expect(hidden.every((row) => row.tides.length === 0)).toBe(true)
    expect(hidden[0].sunset).toBe(rows[0].sunset)
    expect(hidden[0].weather).toEqual(rows[0].weather)
  })
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/ui/dayList.test.ts`
Expected: FAIL, the hidden rows still list tides.

- [ ] **Step 3: Add the argument**

In `src/ui/dayList.ts`, change the signature and the doc comment of `dayRows`:

```ts
/**
 * One row for each of the 14 days. `picked` is the date of the row last
 * tapped, if any, and decides which row is marked. With the tide hidden the
 * rows list no highs and lows.
 */
export function dayRows(
  data: Inputs,
  picked: string | null,
  timeZone: string,
  tidesShown: boolean,
): DayRow[] {
```

and change `const events = data.hilo.data ?? []` to `const events = tidesShown ? (data.hilo.data ?? []) : []`.

In `src/App.tsx`, change the `dayRows(…)` call inside `useMemo` so it ends `, pickedDay, zone, true)`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/ui/dayList.test.ts`
Expected: all pass.

- [ ] **Step 5: Run everything, then commit**

Run: `npm run format && npm test && npm run lint && npm run build`

```bash
git add src/ui/dayList.ts src/ui/dayList.test.ts src/App.tsx
git commit -m "The 14-day list leaves out highs and lows while the tide is hidden

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: The switcher, the hidden line, and one screen per spot, in the components

**Files:**
- Create: `src/ui/SpotSwitcher.tsx`, `src/ui/TidesHidden.tsx`, `src/ui/SpotScreen.tsx`
- Modify: `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `SPOTS`, `Spot` (Task 1); `readSpot`, `writeSpot`, `readTidesShown`, `writeTidesShown` (Task 2); `useSpotData(spot, tidesShown)` (Task 3); `tideView(…, { spot, shown })`, `TideView.text.second`, `.hidden`, `.canHide` (Task 5); `dayRows(…, tidesShown)` (Task 7).
- Produces: nothing later tasks use. This is the last code task.

There are no unit tests for components in this project; they are checked in a browser. The type check, lint and build are this task's gate, and then the browser check in Step 6.

- [ ] **Step 1: The switcher**

Create `src/ui/SpotSwitcher.tsx`:

```tsx
import type { Spot } from '../spot.ts'

interface SpotSwitcherProps {
  spots: Spot[]
  current: Spot
  onSelect: (spot: Spot) => void
}

/** The spots, in a row. The one on screen is marked. */
export function SpotSwitcher({ spots, current, onSelect }: SpotSwitcherProps) {
  return (
    <nav className="spots" aria-label="Spots">
      {spots.map((spot) => (
        <button
          key={spot.id}
          type="button"
          className="spot-choice"
          aria-pressed={spot.id === current.id}
          onClick={() => onSelect(spot)}
        >
          {spot.name}
        </button>
      ))}
    </nav>
  )
}
```

- [ ] **Step 2: The hidden line**

Create `src/ui/TidesHidden.tsx`:

```tsx
interface TidesHiddenProps {
  /** The one line that stands in for the tide. */
  words: string
  onShow: () => void
}

/** Where the tide panel would be, when the spot hides it. */
export function TidesHidden({ words, onShow }: TidesHiddenProps) {
  return (
    <p className="notice tides-hidden">
      <span>{words}</span>
      <button type="button" className="tides-toggle" onClick={onShow}>
        Show tides
      </button>
    </p>
  )
}
```

- [ ] **Step 3: One screen per spot**

Create `src/ui/SpotScreen.tsx` by moving the body of today's `App` into it. The result:

```tsx
import { useCallback, useMemo, useRef, useState } from 'react'
import { Panel } from '../chart/Panel.tsx'
import { PanelStack } from '../chart/PanelStack.tsx'
import { cursorText } from '../chart/readout.ts'
import { linearScale } from '../chart/scales.ts'
import { useSpotData } from '../data/useSpotData.ts'
import type { Spot } from '../spot.ts'
import { formatDay, formatTime } from '../time.ts'
import { tideCaption, weatherCaption } from './captions.ts'
import { readTidesShown, writeTidesShown } from './choices.ts'
import { DayList } from './DayList.tsx'
import { dayRows, tonightWords } from './dayList.ts'
import { HiLoTable } from './HiLoTable.tsx'
import { dayMarkers, selectedDay } from './selection.ts'
import { TidesHidden } from './TidesHidden.tsx'
import { tideView } from './tideView.ts'
import type { CursorPick } from './tideView.ts'
import { TonightStrip } from './TonightStrip.tsx'
import { WeatherPanels } from './WeatherPanels.tsx'
import { weatherView } from './weatherView.ts'

const TIDE_HEIGHT = 168
/** Room above the highest tide for a rule's label. */
const HEADROOM = 14

interface SpotScreenProps {
  spot: Spot
}

/**
 * Everything for one spot: tonight, the day's panels, its highs and lows,
 * the captions and the 14 days. Mounted afresh for each spot, so a switch
 * starts from saved data, today and a resting cursor, as a first open does.
 */
export function SpotScreen({ spot }: SpotScreenProps) {
  const zone = spot.timeZone
  const [tidesShown, setTidesShown] = useState(() => readTidesShown(spot))
  const data = useSpotData(spot, tidesShown)
  const { days, spans, hilo, forecast } = data

  const [pickedDay, setPickedDay] = useState<string | null>(null)
  const [pick, setPick] = useState<CursorPick | null>(null)
  const selected = selectedDay(data, pickedDay)
  const tide = tideView(data, selected, pick, { spot, shown: tidesShown })
  const weather = weatherView(forecast, selected, tide.cursor, data.now)
  const cursorTime = formatTime(tide.cursor, zone)
  const markers = dayMarkers(selected, data.now)

  const tonight = useMemo(
    () => tonightWords(days[0], data.now, zone),
    [days, data.now, zone],
  )
  // The rows do not depend on the cursor, so they are not worked out again,
  // and the list is not drawn again, each time it moves. They are worked out
  // again once a minute, with the clock.
  const rows = useMemo(
    () =>
      dayRows(
        { now: data.now, days, spans, hilo, forecast },
        pickedDay,
        zone,
        tidesShown,
      ),
    [data.now, days, spans, hilo, forecast, pickedDay, zone, tidesShown],
  )

  const dayTop = useRef<HTMLElement>(null)
  const selectDay = useCallback((date: string) => {
    setPickedDay(date)
    // The cursor goes back to rest, on this day and on the one left behind.
    setPick(null)
    // The panels are above the list, usually off screen. The page jumps to
    // them. A glide would move the list under a second tap and choose
    // whichever row had arrived under the finger.
    dayTop.current?.scrollIntoView({ block: 'start' })
  }, [])

  const showTides = (shown: boolean) => {
    writeTidesShown(spot, shown)
    setTidesShown(shown)
  }

  return (
    <>
      <TonightStrip words={tonight} />

      <section className="day" ref={dayTop}>
        <header className="day-head">
          <h2>{formatDay(selected.date)}</h2>
          <p className="day-cursor">at {cursorTime}</p>
        </header>

        {/* Outside the stack, which takes every press for the cursor; a
            button inside it would not get its tap. */}
        {tide.hidden !== null && (
          <TidesHidden words={tide.hidden} onShow={() => showTides(true)} />
        )}

        <PanelStack
          start={selected.span.start}
          end={selected.span.end}
          timeZone={zone}
          cursor={tide.cursor}
          cursorText={cursorText(cursorTime, [tide.words, weather.words])}
          onCursor={(t) =>
            setPick({ t, day: selected.date, shown: data.shown })
          }
          pick={pick}
          onRestore={setPick}
        >
          {({ width, x }) => (
            <>
              {tide.hidden !== null ? null : tide.notice !== null ? (
                <p className="notice">{tide.notice}</p>
              ) : (
                <Panel
                  title={tide.title}
                  readout={
                    <>
                      <span className="key key-predicted">
                        {tide.text.predicted}
                      </span>
                      {/* Always there, so the plot does not move when the
                          second line comes and goes. */}
                      <span
                        className={
                          tide.text.second?.key === 'observed'
                            ? 'key key-observed'
                            : undefined
                        }
                      >
                        {tide.text.second?.words}
                      </span>
                    </>
                  }
                  width={width}
                  height={TIDE_HEIGHT}
                  x={x}
                  y={linearScale(tide.bounds, [TIDE_HEIGHT, HEADROOM])}
                  rules={tide.rules}
                  series={tide.series}
                  markers={markers}
                  cursor={tide.cursor}
                  dots={tide.dots}
                />
              )}
              <WeatherPanels
                view={weather}
                width={width}
                x={x}
                markers={markers}
                cursor={tide.cursor}
              />
            </>
          )}
        </PanelStack>

        {tide.events.length > 0 && (
          <HiLoTable events={tide.events} timeZone={zone} />
        )}

        {tide.hidden === null && (
          <p className="caption">
            {tideCaption(spot, {
              predictions: data.predictions,
              hilo,
              observed: data.observed,
              readings: tide.readings,
              today: data.today,
              isToday: selected.isToday,
            })}
            {tide.canHide && (
              <>
                {' '}
                <button
                  type="button"
                  className="tides-toggle"
                  onClick={() => showTides(false)}
                >
                  Hide tides
                </button>
              </>
            )}
          </p>
        )}
        <p className="caption">{weatherCaption(spot, forecast, data.today)}</p>
      </section>

      <DayList rows={rows} onSelect={selectDay} />
    </>
  )
}
```

The caption gets `tide.readings`, the gauge's readings whether drawn or not, so at Gaviota it gives the Santa Barbara gauge's "observed through" time rather than "No observed readings yet today".

- [ ] **Step 4: `App` chooses the spot**

Replace the whole of `src/App.tsx` with:

```tsx
import { useState } from 'react'
import { SPOTS } from './spot.ts'
import type { Spot } from './spot.ts'
import { readSpot, writeSpot } from './ui/choices.ts'
import { SpotScreen } from './ui/SpotScreen.tsx'
import { SpotSwitcher } from './ui/SpotSwitcher.tsx'

export default function App() {
  const [spot, setSpot] = useState<Spot>(readSpot)
  const selectSpot = (next: Spot) => {
    writeSpot(next)
    setSpot(next)
  }

  return (
    <main>
      <h1>{spot.name}</h1>
      <SpotSwitcher spots={SPOTS} current={spot} onSelect={selectSpot} />
      {/* Keyed, so a switch mounts the screen afresh, as a first open does. */}
      <SpotScreen key={spot.id} spot={spot} />
    </main>
  )
}
```

- [ ] **Step 5: Styles**

In `src/styles.css`, before the `/* Tonight */` comment, add:

```css
/* The spots, in a row under the title. The one on screen is marked the way
   the chosen day is marked in the list. */
.spots {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
.spot-choice {
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--rule);
  border-radius: 999px;
  background: none;
  color: var(--muted);
  font: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.spot-choice[aria-pressed='true'] {
  border-color: var(--sea);
  background: var(--sea-fill);
  color: var(--ink);
  font-weight: 600;
}
.spot-choice:focus-visible {
  outline: 2px solid var(--sea);
  outline-offset: 2px;
}

/* Where the tide would be, when the spot hides it, and the control that
   shows or hides it. */
.tides-hidden {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 0.9em;
  row-gap: 0.25rem;
  margin-top: 0.75rem;
}
.tides-toggle {
  padding: 0;
  border: 0;
  background: none;
  color: var(--sea);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.tides-toggle:focus-visible {
  outline: 2px solid var(--sea);
  outline-offset: 2px;
}
```

- [ ] **Step 6: Run everything**

Run: `npm run format && npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 7: Check it in a browser**

Start the dev server on a port of its own: `npx vite --port 5198` in the background. Then, with Playwright (the `mcp__playwright__browser_run_code_unsafe` tool, or a script run with `npx playwright` if that is what is available), at a 390 px wide viewport against `http://localhost:5198/`, with the live APIs:

1. **Campus Point** is the title, three buttons are under it with "Campus Point" pressed, and the tide panel, table and both captions look as they did before. The weather caption now ends ", 3 ft above sea level. Updated <time>." Take a screenshot.
2. **Tap "Gaviota State Park".** The title changes. The tide panel has a filled curve and no second line drawn over it. Its readout's second line reads "Santa Barbara gauge <signed number> ft vs its prediction" (whatever the live deviation is). The tide caption starts "Tide: NOAA 9411399 Gaviota State Park, 0.2 mi south, predictions only. Gauge: NOAA 9411340 Santa Barbara, 31 mi east, observed through". Tap a row other than today: the second line is blank. Screenshot.
3. **Tap "La Cumbre Peak".** No tide panel, no table. In its place: "Tides hidden. Nearest station: NOAA 9411340 Santa Barbara, 6.3 mi south." with "Show tides". No tide caption. The weather caption reads "…which averages 3,258 ft above sea level; the spot itself is at 3,997 ft. Updated…". The rows of the list have no High/Low line. Read `localStorage` and confirm no key `tideline:v2:la-cumbre-peak:predictions` exists yet. Screenshot.
4. **Tap "Show tides".** The panel, table and caption appear, the caption ends with "Hide tides", the rows list highs and lows, and `localStorage` now holds `tideline:tides:la-cumbre-peak` = `shown` and a `tideline:v2:la-cumbre-peak:predictions` entry. Reload: tides are still shown. Tap "Hide tides": the hidden line is back. Reload: still hidden. Screenshot of the shown state.
5. **Reload on Campus Point after choosing Gaviota:** choose Gaviota, reload, and the page opens on Gaviota.
6. Dark scheme: one screenshot of Gaviota with `prefers-color-scheme: dark` emulated, to see the pressed button and the toggle colours hold.
7. Clear `localStorage` for the origin when done, and stop the dev server.

Note anything that looks wrong in the task report rather than fixing the view modules here; the plain modules have tests and a fix belongs with its test.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/ui/SpotScreen.tsx src/ui/SpotSwitcher.tsx src/ui/TidesHidden.tsx src/styles.css
git commit -m "A switcher for three spots, and one screen per spot

App chooses the spot and remembers it; SpotScreen is everything for one
spot, mounted afresh on a switch. A hidden tide is one line with a Show
tides control; shown at a spot that hides it by default, the caption ends
with Hide tides. The components arrange what the views work out.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: CLAUDE.md and the pull request

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the status in `CLAUDE.md`**

In the `## Status` section, change the first "Built:" bullet to end "…and the manifest and icons; then three spots with a switcher (Campus Point, Gaviota State Park, La Cumbre Peak), the Santa Barbara gauge's deviation at Gaviota, and tides hidden by default at La Cumbre." Leave the rest as it is.

In `## Data sources`, under NOAA CO-OPS, after the bullet beginning "9411340 Santa Barbara is harmonic and observing", add:

```
- 9411399 Gaviota State Park is 0.2 mi from the beach. Its nearest gauge is Santa Barbara, 31 mi east. La Cumbre Peak's nearest station is Santa Barbara, 6.3 mi south.
```

Under NWS, after the bullet about cell elevation, add nothing new (it already gives all three cells' elevations), but change "LOX 100,71 / 105,70 / 87,76 / 105,74" to make clear which is which: "Campus Point LOX 100,71, Leadbetter Beach LOX 105,70, Gaviota State Park LOX 87,76, La Cumbre Peak LOX 105,74".

- [ ] **Step 2: Push and open the pull request**

```bash
npm run format && npm test && npm run lint && npm run build
git add CLAUDE.md
git commit -m "Note the three spots in CLAUDE.md

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin stage-2/three-spots
gh pr create --title "Three spots with a switcher: Campus Point, Gaviota, La Cumbre Peak" --body "$(cat <<'EOF'
Closes #2. Spec: `docs/superpowers/specs/2026-10-09-three-spots-design.md`. Plan: `docs/superpowers/plans/2026-10-09-three-spots.md`.

Two fixed spots beside Campus Point, with a row of buttons under the title to switch between them. The chosen spot is remembered on the device.

- **Gaviota State Park:** station 9411399 has a curve but no gauge. The tide panel draws Gaviota's own curve with nothing of another station on it. The readout's second line is the Santa Barbara gauge's deviation from its own prediction at the cursor's step: "Santa Barbara gauge +1.2 ft vs its prediction". The cursor rests on that gauge's latest reading. The caption: "Tide: NOAA 9411399 Gaviota State Park, 0.2 mi south, predictions only. Gauge: NOAA 9411340 Santa Barbara, 31 mi east, observed through 2:06 PM, preliminary."
- **La Cumbre Peak:** tides hidden by default. One line in their place: "Tides hidden. Nearest station: NOAA 9411340 Santa Barbara, 6.3 mi south." with Show tides. The choice is remembered per spot, and nothing tidal is fetched while hidden.
- **Cell elevation** in the weather caption: "3 ft above sea level" at Campus Point; at La Cumbre "which averages 3,258 ft above sea level; the spot itself is at 3,997 ft."

Decisions the issue left open are listed at the end of the spec. The two worth a look: the deviation is read at the cursor like a reading, not shown as one fixed number; and the switcher does not touch the URL, which is for #7 to decide.

This branch was cut from `main` before the install hint (#27). If that merges first, `App.tsx` needs the `InstallHint` import and element put back under the title.

## Checking it on a phone

Open the Vercel preview link on this pull request on an iPhone, signed in to Vercel.

Pass, all of:
1. Under "Campus Point" there are three buttons. Everything else looks as it does on https://tideline.ibuild4you.com, except the weather caption ends ", 3 ft above sea level. Updated <time>."
2. Tap Gaviota State Park. The tide panel shows a curve with no second line drawn over it. Above the curve the second readout line reads "Santa Barbara gauge … ft vs its prediction". Drag across the panel: the number changes with the cursor. The tide caption names both stations with distances.
3. Tap La Cumbre Peak. No tide panel or table; one line says tides are hidden and names Santa Barbara at 6.3 mi, with Show tides. The weather caption gives 3,258 ft and 3,997 ft. Rows in the list have no High/Low line.
4. Tap Show tides. The panel, table and caption appear, the caption ends with Hide tides, and the rows list highs and lows. Close the page and reopen it: still shown, still on La Cumbre.
5. Tap Hide tides, then Campus Point. Reopen from the home-screen icon: it opens on Campus Point with tides shown.

Fail: any of these not holding. Say which.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Stop**

Report the pull request URL. Do not merge.

---

## After this plan

- The owner checks the page on a phone as the pull request says, and merges.
- If #27 merges first, rebase and restore `InstallHint` in `App.tsx`.
