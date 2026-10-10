# Place Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the add screen, type a place name and press Search: the map pans and zooms to the place, the pin drops there, the usual lookup runs, and an empty name field takes the place's name.

**Architecture:** One framework-free module, `src/data/geocode.ts`, holds the Nominatim URL, the parser and a fetch that remembers answers for the life of the page. The add screen's words and two small rules go in `src/ui/addSpotView.ts`. `SpotMap`'s `look` prop learns to fit a bounding box. `AddSpot` gains a search row and a search state. No new dependency.

**Tech Stack:** Vite, React 19, strict TypeScript, Vitest, plain CSS, Leaflet 1.9.4.

**Spec:** `docs/superpowers/specs/2026-10-10-place-search-design.md`. Read it first; it says why each choice was made and lists the decisions the owner reviews.

## Global Constraints

- Code style: no semicolons, single quotes, relative imports carry their `.ts`/`.tsx` extension, type-only imports use `import type`, no enums. `npm run lint` (oxlint then Prettier) must pass; run `npm run format` before committing.
- Tests run with `TZ=Asia/Tokyo`; nothing may depend on the viewer's time zone.
- Components hold no arithmetic, no rules and no wording. Those live in plain modules with tests.
- Data modules stay framework-free (no React imports under `src/data/`).
- Nothing is sent to Nominatim as the user types. Search runs on submit only, one request at a time.
- Commit trailer, regardless of the model doing the work:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` then
  `Claude-Session: https://claude.ai/code/session_011uFB3EqJLYQ5h3p8Hc6jPq`
- In every tracked file and commit message the first user is "the first user"; no names from `private/`.
- Node 24: in a fresh shell `source ~/.nvm/nvm.sh && nvm use`.
- The two fixtures `src/data/__fixtures__/nominatim-santa-barbara.json` and `nominatim-leadbetter-beach.json` are already in the working tree, untracked. Task 1 commits them. Do not fetch from Nominatim in tests or in the build.

## Review Focus

1. A repeat of the same query, however spaced or cased, must not reach Nominatim again; a failed query must not be remembered. Pinned in Task 1.
2. A blank or whitespace query must send nothing. Pinned in Task 1 and Task 3.
3. A typed name must never be overwritten by a search. Pinned in Task 2 and Task 3.
4. A search that answers after the add screen has gone must not set state. Pinned in Task 3.
5. The map must still pan to the device's location at the opening zoom, as before, with no bounds. Pinned in Task 3.

---

### Task 1: The geocoder module

**Files:**
- Create: `src/data/geocode.ts`
- Test: `src/data/geocode.test.ts`
- Commit: `src/data/__fixtures__/nominatim-santa-barbara.json`, `src/data/__fixtures__/nominatim-leadbetter-beach.json` (already on disk)
- Modify: `src/data/__fixtures__/README.md` (two bullets)

**Interfaces:**
- Produces:
  ```ts
  export interface Bounds { south: number; north: number; west: number; east: number }
  export interface Place { lat: number; lon: number; name: string; displayName: string; bounds: Bounds }
  export function searchUrl(query: string): string
  export function parsePlaces(json: unknown): Place[]
  export function normalizeQuery(text: string): string
  export function fetchPlace(query: string): Promise<Place | null>
  export function forgetPlaces(): void   // empties the memory; for tests
  ```

- [ ] **Step 1: Write the failing test**

```ts
// src/data/geocode.test.ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  fetchPlace,
  forgetPlaces,
  normalizeQuery,
  parsePlaces,
  searchUrl,
} from './geocode.ts'
import santaBarbaraRaw from './__fixtures__/nominatim-santa-barbara.json?raw'
import leadbetterRaw from './__fixtures__/nominatim-leadbetter-beach.json?raw'

describe('searchUrl', () => {
  test('asks Nominatim for one US place, with the query encoded', () => {
    expect(searchUrl('Santa Barbara')).toBe(
      'https://nominatim.openstreetmap.org/search?q=Santa+Barbara&format=jsonv2&countrycodes=us&limit=1',
    )
    expect(searchUrl('Doña Ana & co')).toContain('q=Do%C3%B1a+Ana+%26+co')
  })
})

describe('parsePlaces', () => {
  test('the city comes first for Santa Barbara, as numbers', () => {
    const places = parsePlaces(JSON.parse(santaBarbaraRaw))
    expect(places).toHaveLength(3)
    expect(places[0]).toEqual({
      lat: 34.4221319,
      lon: -119.702667,
      name: 'Santa Barbara',
      displayName:
        'Santa Barbara, Santa Barbara County, California, United States',
      bounds: {
        south: 34.336029,
        north: 34.463922,
        west: -119.859791,
        east: -119.6399059,
      },
    })
  })
  test('a beach', () => {
    const [beach] = parsePlaces(JSON.parse(leadbetterRaw))
    expect(beach.name).toBe('Leadbetter Beach')
    expect(beach.lat).toBeCloseTo(34.4009, 3)
    expect(beach.bounds.south).toBeLessThan(beach.bounds.north)
    expect(beach.bounds.west).toBeLessThan(beach.bounds.east)
  })
  test('nothing found is an empty list', () => {
    expect(parsePlaces([])).toEqual([])
  })
  test('an entry missing a field is dropped, the rest kept', () => {
    const [good] = JSON.parse(leadbetterRaw)
    const { boundingbox: _box, ...noBox } = good
    expect(parsePlaces([noBox, good])).toHaveLength(1)
    expect(parsePlaces([{ ...good, lat: 'north' }])).toEqual([])
    expect(parsePlaces([{ ...good, boundingbox: ['1', '2'] }])).toEqual([])
  })
  test('a response that is not a list throws', () => {
    expect(() => parsePlaces({ error: 'x' })).toThrow('Nominatim')
    expect(() => parsePlaces(null)).toThrow('Nominatim')
  })
})

describe('normalizeQuery', () => {
  test('trims, collapses spaces and folds case', () => {
    expect(normalizeQuery('  Santa   Barbara ')).toBe('santa barbara')
    expect(normalizeQuery('\tLeadbetter\nBeach')).toBe('leadbetter beach')
  })
})

describe('fetchPlace', () => {
  beforeEach(() => forgetPlaces())
  afterEach(() => vi.unstubAllGlobals())

  test('the first place, fetched with the trimmed query', async () => {
    const fetchMock = vi.fn(async () => new Response(santaBarbaraRaw))
    vi.stubGlobal('fetch', fetchMock)
    const place = await fetchPlace('  Santa Barbara ')
    expect(place?.name).toBe('Santa Barbara')
    expect(fetchMock).toHaveBeenCalledWith(searchUrl('Santa Barbara'))
  })
  test('nothing found is null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]')))
    expect(await fetchPlace('xqzv nowhere zz')).toBeNull()
  })
  test('a blank query asks nothing and is null', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchPlace('   ')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  test('a failed response throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })))
    await expect(fetchPlace('Santa Barbara')).rejects.toThrow('HTTP 503')
  })
  test('the same query, however spaced or cased, is asked once', async () => {
    const fetchMock = vi.fn(async () => new Response(santaBarbaraRaw))
    vi.stubGlobal('fetch', fetchMock)
    await fetchPlace('Santa Barbara')
    await fetchPlace('santa  barbara')
    await fetchPlace(' SANTA BARBARA ')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  test('nothing found is remembered too', async () => {
    const fetchMock = vi.fn(async () => new Response('[]'))
    vi.stubGlobal('fetch', fetchMock)
    await fetchPlace('nowhere')
    await fetchPlace('nowhere')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  test('a failure is not remembered, so the next try asks again', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response(santaBarbaraRaw))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchPlace('Santa Barbara')).rejects.toThrow()
    expect((await fetchPlace('Santa Barbara'))?.name).toBe('Santa Barbara')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run the test, see it fail**

Run: `npx vitest run src/data/geocode.test.ts`
Expected: fails, module not found.

- [ ] **Step 3: Write the module**

```ts
// src/data/geocode.ts
// A place name turned into a point and an extent, from OpenStreetMap's
// Nominatim. Its usage policy (operations.osmfoundation.org/policies/
// nominatim) asks for one request a second at most, no autocomplete, no
// repeats of the same query and visible credit. The screen searches only on
// submit and one at a time; this module remembers answers for the life of
// the page; the credit is in the map's corner. Changing provider is this
// file alone. No React, no storage.

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

/** One US place at most. Tideline covers the US; NWS answers 404 elsewhere. */
export function searchUrl(query: string): string {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    countrycodes: 'us',
    limit: '1',
  })
  return `${ENDPOINT}?${params}`
}

const num = (value: unknown): number | null => {
  if (typeof value !== 'string') return null
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
 * The first place for a query, or null for none. Remembered for the life
 * of the page so the same query is never asked twice; a failure is not
 * remembered, so a try again asks again. A blank query asks nothing.
 */
export async function fetchPlace(query: string): Promise<Place | null> {
  const key = normalizeQuery(query)
  if (key === '') return null
  if (remembered.has(key)) return remembered.get(key) ?? null
  const response = await fetch(searchUrl(query.trim()))
  if (!response.ok) throw new Error(`Nominatim: HTTP ${response.status}`)
  const [first] = parsePlaces(await response.json())
  const place = first ?? null
  remembered.set(key, place)
  return place
}
```

Note the `vi.fn(async () => new Response(...))` mocks: `Response` is available in Node 24 and the tests already use it for NWS.

- [ ] **Step 4: Run the test, see it pass**

Run: `npx vitest run src/data/geocode.test.ts`
Expected: all pass. If `?raw` imports fail to type-check, look at how `src/data/nws.test.ts` imports its fixtures and do the same.

- [ ] **Step 5: Add the fixtures to the README**

In `src/data/__fixtures__/README.md`, after the `nws-points-48.5--3.0.json` bullet, add:

```
- `nominatim-santa-barbara.json`: OpenStreetMap Nominatim's answer to "Santa Barbara" with `format=jsonv2&countrycodes=us&limit=5`, recorded on 2026-10-10: the city, the county and Hatch, New Mexico (a fuzzy match), 3 places. The app asks for `limit=1`; the parser takes the first.
- `nominatim-leadbetter-beach.json`: the same for "Leadbetter Beach", recorded on 2026-10-10: one place of type beach.
```

- [ ] **Step 6: Lint and commit**

```bash
npm run format && npm run lint && npm test
git add src/data/geocode.ts src/data/geocode.test.ts src/data/__fixtures__/nominatim-santa-barbara.json src/data/__fixtures__/nominatim-leadbetter-beach.json src/data/__fixtures__/README.md
git commit -m "Look a place name up with Nominatim, once per query"
```

---

### Task 2: The add screen's words and rules

**Files:**
- Modify: `src/ui/addSpotView.ts`
- Test: `src/ui/addSpotView.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type SearchState =
    | { status: 'idle' }
    | { status: 'searching' }
    | { status: 'found'; place: Place }
    | { status: 'none' }
    | { status: 'failed' }
  export function searchLine(state: SearchState): string | null
  export function suggestedName(typed: string, place: Place): string
  ```
  and in `WORDS`: `placeLabel: 'Place'`, `search: 'Search'`, `searching: 'Searching…'`, `noPlace: 'No place by that name in the US.'`, `searchFailed: "Couldn't reach the place search. Try again in a minute."`.
- Changes: `MAP.attribution` becomes `'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Search by <a href="https://nominatim.org">Nominatim</a>'`.

- [ ] **Step 1: Write the failing tests**

Add to `src/ui/addSpotView.test.ts`, importing `searchLine`, `suggestedName` and `Place` (type) as needed:

```ts
const SANTA_BARBARA: Place = {
  lat: 34.4221319,
  lon: -119.702667,
  name: 'Santa Barbara',
  displayName: 'Santa Barbara, Santa Barbara County, California, United States',
  bounds: { south: 34.336, north: 34.464, west: -119.86, east: -119.64 },
}

describe('searchLine', () => {
  test('nothing before a search, and nothing while one runs', () => {
    expect(searchLine({ status: 'idle' })).toBeNull()
    expect(searchLine({ status: 'searching' })).toBeNull()
  })
  test('the full name of what was found', () => {
    expect(searchLine({ status: 'found', place: SANTA_BARBARA })).toBe(
      'Santa Barbara, Santa Barbara County, California, United States',
    )
  })
  test('the two failures', () => {
    expect(searchLine({ status: 'none' })).toBe(WORDS.noPlace)
    expect(searchLine({ status: 'failed' })).toBe(WORDS.searchFailed)
  })
})

describe('suggestedName', () => {
  test("a typed name stays, the place's fills a blank", () => {
    expect(suggestedName('My beach', SANTA_BARBARA)).toBe('My beach')
    expect(suggestedName('', SANTA_BARBARA)).toBe('Santa Barbara')
    expect(suggestedName('   ', SANTA_BARBARA)).toBe('Santa Barbara')
  })
  test("the place's name is cut to the limit", () => {
    const long = { ...SANTA_BARBARA, name: 'x'.repeat(60) }
    expect(suggestedName('', long)).toHaveLength(NAME_MAX)
  })
})

describe('MAP', () => {
  test('credits OpenStreetMap and Nominatim', () => {
    expect(MAP.attribution).toContain('OpenStreetMap')
    expect(MAP.attribution).toContain('Nominatim')
  })
})
```

Note: `searchLine` returns null while searching because the button itself reads "Searching…"; one word of progress is enough.

- [ ] **Step 2: Run, see them fail**

Run: `npx vitest run src/ui/addSpotView.test.ts`

- [ ] **Step 3: Write the words and the two rules**

In `src/ui/addSpotView.ts`: add `import type { Place } from '../data/geocode.ts'`; add the five words to `WORDS` (put them after `locateFailed`); change `MAP.attribution`; add:

```ts
export type SearchState =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'found'; place: Place }
  | { status: 'none' }
  | { status: 'failed' }

/** The line under the search row: what was found, or why nothing was. */
export function searchLine(state: SearchState): string | null {
  switch (state.status) {
    case 'idle':
    case 'searching':
      return null
    case 'found':
      return state.place.displayName
    case 'none':
      return WORDS.noPlace
    case 'failed':
      return WORDS.searchFailed
  }
}

/** The name field after a search: what was typed, or the place's name for a blank. */
export function suggestedName(typed: string, place: Place): string {
  return cleanName(typed) === '' ? cleanName(place.name) : typed
}
```

- [ ] **Step 4: Run, see them pass; lint and commit**

```bash
npx vitest run src/ui/addSpotView.test.ts
npm run format && npm run lint
git add src/ui/addSpotView.ts src/ui/addSpotView.test.ts
git commit -m "Words and rules for the place search, and Nominatim in the map's credit"
```

---

### Task 3: The search row, the map's fit, and the browser check

**Files:**
- Modify: `src/ui/SpotMap.tsx`, `src/ui/AddSpot.tsx`, `src/styles.css`
- Create: `docs/superpowers/plans/assets/2026-10-10-place-search.png` (from the browser check)

Depends on Tasks 1 and 2.

- [ ] **Step 1: `SpotMap` fits bounds when given them**

In `src/ui/SpotMap.tsx`:

```ts
import type { Bounds } from '../data/geocode.ts'

/** Somewhere to show: a point, or a point with the extent to fit. */
export interface Look extends LatLon {
  bounds?: Bounds
}

/** No closer than this when fitting a place: about two miles across. */
const FIT_MAX_ZOOM = 14
```

`look` becomes `look: Look | null`. The effect:

```ts
useEffect(() => {
  const made = map.current
  if (!look || !made) return
  if (look.bounds) {
    const { south, west, north, east } = look.bounds
    made.fitBounds(
      [
        [south, west],
        [north, east],
      ],
      { maxZoom: FIT_MAX_ZOOM },
    )
  } else {
    made.setView([look.lat, look.lon], ZOOM)
  }
}, [look])
```

- [ ] **Step 2: `AddSpot` gets the search row**

In `src/ui/AddSpot.tsx`:

- Import `fetchPlace` from `../data/geocode.ts`, `searchLine`, `suggestedName` and `SearchState` (type) from `./addSpotView.ts`, `Look` (type) from `./SpotMap.tsx`.
- State: `const [query, setQuery] = useState('')`, `const [search, setSearch] = useState<SearchState>({ status: 'idle' })`, and `look` becomes `useState<Look | null>(null)`. Add `const placeId = useId()`.
- A `gone` ref for the component's life, so a search that answers after unmount sets nothing:

```ts
const gone = useRef(false)
useEffect(() => {
  gone.current = false
  return () => {
    gone.current = true
  }
}, [])
```

- The handler:

```ts
const submitSearch = (event: FormEvent) => {
  event.preventDefault()
  if (query.trim() === '' || search.status === 'searching') return
  setSearch({ status: 'searching' })
  fetchPlace(query).then(
    (place) => {
      if (gone.current) return
      if (!place) {
        setSearch({ status: 'none' })
        return
      }
      setSearch({ status: 'found', place })
      dropPin({ lat: place.lat, lon: place.lon })
      setLook({ lat: place.lat, lon: place.lon, bounds: place.bounds })
      setName((typed) => suggestedName(typed, place))
    },
    () => {
      if (!gone.current) setSearch({ status: 'failed' })
    },
  )
}
```

`FormEvent` is `import type { FormEvent } from 'react'`. `locate` keeps setting `setLook(at)` with the bare point.

- The markup, first inside the `<section className="add-spot">`, above the `.locate` div:

```tsx
<form className="field search" onSubmit={submitSearch}>
  <label htmlFor={placeId}>{WORDS.placeLabel}</label>
  <input
    id={placeId}
    type="search"
    value={query}
    autoComplete="off"
    enterKeyHint="search"
    onChange={(event) => setQuery(event.target.value)}
  />
  <button
    type="submit"
    className="text-button"
    disabled={search.status === 'searching' || query.trim() === ''}
  >
    {search.status === 'searching' ? WORDS.searching : WORDS.search}
  </button>
  {/* Always rendered, so a screen reader is told when the line changes. */}
  <p className="caption search-line" role="status">
    {searchLine(search)}
  </p>
</form>
```

Check whether `.text-button` has enough height as a submit button beside a 44px field; if not, give `.search .text-button` a `min-height: 44px`.

- [ ] **Step 3: Styles**

In `src/styles.css`, after the `.field input[type='text']` rule, make the same rule apply to `input[type='search']` (one selector list), and add:

```css
/* The search row: the field, the button, and the answer on its own line. */
.search .search-line {
  flex-basis: 100%;
  min-height: 1.2em;
}
/* A search field keeps iOS Safari's default look otherwise. */
.field input[type='search'] {
  appearance: none;
  -webkit-appearance: none;
}
```

- [ ] **Step 4: Type-check, lint, test, build**

Run: `npm run build && npm run lint && npm test`
Expected: all pass; the `AddSpot` chunk grows by about 1 KB.

- [ ] **Step 5: Browser check**

Start `npm run dev` in the background and use Playwright (the `mcp__playwright__*` tools) at http://localhost:5173 at a 390 × 844 viewport. Clear `localStorage` first.

1. Press "Add a spot". The search row is at the top: a "Place" field, a disabled "Search" button, then "Use my location", then the map.
2. Type "Leadbetter Beach" and press Enter. The button reads "Searching…" briefly; then the line under the row reads "Leadbetter Beach, Santa Barbara, Santa Barbara County, California, United States"; the map is zoomed in on the beach (zoom 14; check `map` is not reachable, so judge by the tiles); the pin is down; the facts fill in naming NOAA 9411340 Santa Barbara; the Name field reads "Leadbetter Beach". Press Save: the spot screen for "Leadbetter Beach" opens.
3. Remove the spot ("Remove this spot", "Yes, remove"). Press "Add a spot" again. Type "xqzv nowhere zz", press Enter: the line reads "No place by that name in the US."; no pin; the facts area still says to tap the map.
4. Type "Test" in the Name field, then search "Santa Barbara". The line names the city; the Name field still reads "Test"; the map shows the whole city.
5. Search "Santa Barbara" again (same text): the network panel, or a `fetch` spy installed with `page.evaluate` before the two searches, shows no second request to nominatim.openstreetmap.org.
6. Press "Use my location" (Playwright: grant geolocation and set a position for Gaviota, 34.4716, -120.2284): the map pans there at the opening zoom, as before.
7. The map's corner credit reads "© OpenStreetMap contributors · Search by Nominatim".
8. Take a screenshot of the add screen after step 2's search, before Save, saved at `docs/superpowers/plans/assets/2026-10-10-place-search.png`.

Record in the task report which steps passed, with any wording that differs.

- [ ] **Step 6: Lint and commit**

```bash
npm run format && npm run lint
git add src/ui/SpotMap.tsx src/ui/AddSpot.tsx src/styles.css docs/superpowers/plans/assets/2026-10-10-place-search.png
git commit -m "Search for a place by name on the add screen"
```

---

### Task 4: Docs

**Files:**
- Modify: `CLAUDE.md`, `README.md`

- [ ] **Step 1: CLAUDE.md**

- In the Status bullet "Built:", after "...(`scripts/bake-stations.mjs`, `src/data/stations.json`)", add: "; then a place name typed on the add screen, looked up with OpenStreetMap's Nominatim (`src/data/geocode.ts`), which pans the map there and drops the pin".
- In the first paragraph under "## Status", change "own spots from a map is on a pull request" to reflect that own spots are merged and place search is on a pull request.
- In the Stack list, extend the map bullet: "Place search is OpenStreetMap's Nominatim, called from the browser on submit only, one query at a time, with answers remembered for the page; its usage policy is linked in `src/data/geocode.ts`, and changing provider is that one file."
- In the "Components hold no arithmetic" bullet, add `src/data/geocode.ts` to the list of plain modules.
- In Next Steps, replace the own-spots line with: "Place search (`stage-2/place-search`, issue #35, the second half of #4) waits for the owner's phone check and review, and for the owner's decision on Nominatim's usage policy, which the pull request puts to him."

- [ ] **Step 2: README.md**

Change the Map bullet to: "- **Map and place search:** Leaflet on OpenStreetMap tiles, © OpenStreetMap contributors; place names looked up with OpenStreetMap's Nominatim."

- [ ] **Step 3: Commit**

```bash
npm run format && npm run lint
git add CLAUDE.md README.md
git commit -m "Note place search in CLAUDE.md and the README"
```
