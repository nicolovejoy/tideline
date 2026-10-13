# Edit and Remove a Saved Spot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A saved spot gets an "Edit" button beside its name that opens the add screen as "Edit spot", where its name and pin can be changed and from which it can be removed; and tonight's moon line reads "Moonrise 5:00 AM".

**Architecture:** The add screen (`src/ui/AddSpot.tsx`) learns to start from an existing spot. The rules for what Save does in that case (nothing, a rename, or a move) are plain functions in `src/ui/addSpotView.ts`, tested. The edit screen is a third view in `src/ui/viewHistory.ts`, with one history entry like the add screen. `src/data/savedSpots.ts` gains `replaceSpot`. `src/App.tsx` wires the button, the save and the remove; `src/ui/SpotScreen.tsx` loses the remove line. `src/ui/dayList.ts` loses the tense of the moon line. Nothing new is fetched or stored.

**Tech Stack:** Vite, React 19, strict TypeScript, Vitest, Leaflet (already used by the add screen).

**Spec:** `docs/superpowers/specs/2026-10-12-edit-spots-design.md`. Read it first; it says what the user sees and lists the decisions the owner reviews.

## Global Constraints

- Code style: no semicolons, single quotes, relative imports carry their `.ts`/`.tsx` extension, type-only imports use `import type`, no enums. `npm run lint` (oxlint then Prettier) must pass; run `npm run format` before committing.
- Tests run with `TZ=Asia/Tokyo`; nothing may depend on the viewer's time zone.
- Components hold no arithmetic, no rules and no wording. Rules and words go in `src/ui/addSpotView.ts`, `src/ui/dayList.ts`, `src/ui/viewHistory.ts`, `src/data/savedSpots.ts`, each with tests.
- Data modules stay framework-free (no React imports under `src/data/`).
- Words, exactly: the heading `Edit spot`; the button `Edit`; the moon line `Moonrise 5:00 AM` (the word `Moonrise`, a space, the time) whether or not the moon has risen; `No moonrise today` unchanged; the flag `Moonrise near sunset: 6:12 PM` unchanged. The remove line keeps today's words: `Remove this spot`, `Remove Hendry's Beach?`, `Yes, remove`, `Keep`.
- A point is compared at four decimal places, as `resolveSpot` rounds it (`Math.round(n * 1e4) / 1e4`), after `wrapLon` from `src/data/geo.ts`.
- A rename keeps the spot's id and its saved data and fetches nothing. A move saves under a new id from `newSpotId()`, in the old spot's place in the row, and `forgetSpot(oldId)` from `src/data/cache.ts` drops the old id's data.
- The three built-in spots (`isSaved(spot)` false) show no Edit button and cannot be edited.
- In every tracked file and commit message the first user is "the first user"; no names from `private/`.
- Commit trailer, on every commit, regardless of the model doing the work:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- Node 24. In each shell, before any `npm` or `npx`: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH`. Do not `source` nvm.
- Work only in this worktree (`/Users/nico/src/tideline/.claude/worktrees/feat+edit-spots`), on the branch `feat/edit-spots`. No `git stash`, `git reset`, `git checkout` of other branches, or `git clean`.

## Review Focus

1. A spot that could not be kept on the device (storage full) is in the row but not in storage. Editing it must not drop it: `replaceSpot` with an id not in the list adds the spot at the end and reports whether it went in. Pinned in Task 3.
2. A pin tapped away and then back onto the spot's own point (to four decimals) must read as not moved: Save does nothing or renames, and no look-up is waited for. Pinned in Task 4 (`pinMoved` at 0.00004 off; `edited` with the pin back where it was) and Task 5 (`dropPin` restores the saved facts).
3. A tap on a world copy of the map (longitude past 180) at the spot's own point is not a move. Pinned in Task 4 (`pinMoved` with `lon + 360`).
4. A reload while the edit screen is up, with a built-in spot chosen (its id is what `tideline:spot` holds), must show the forecast and leave no stale entry: the view closes itself. Pinned in Task 2 (`viewOf(entryFor('edit'))`) and Task 6 (the effect in `App.tsx`; browser check step 7).
5. A name of spaces, or one over 40 characters, must be refused or cut as on the add screen. Pinned in Task 4 (`edited` with `'   '` is null; a 50-character name is cut to 40).

---

### Task 1: The moon line says "Moonrise" in both tenses

**Files:**
- Modify: `src/ui/dayList.ts:34-56`
- Modify: `src/ui/SpotScreen.tsx:65-68`
- Test: `src/ui/dayList.test.ts:32-77`

**Interfaces:**
- Produces: `tonightWords(day: DayAstro, timeZone: string): TonightWords`. The `now` argument goes.

- [ ] **Step 1: Change the tests**

In `src/ui/dayList.test.ts`, replace the `describe('tonightWords', …)` block (lines 32 to 77) with:

```ts
describe('tonightWords', () => {
  const day: DayAstro = {
    date: '2026-10-08',
    sunset: Date.UTC(2026, 9, 9, 1, 34), // 6:34 PM
    moonrise: Date.UTC(2026, 9, 8, 12, 0), // 5:00 AM
    illumination: 0.0349,
    phase: 'Waning Crescent',
    moonriseNearSunset: null,
  }

  test('sunset, the moon and moonrise', () => {
    expect(tonightWords(day, ZONE)).toEqual({
      sunset: '6:34 PM',
      moon: '3% lit, waning crescent',
      moonrise: 'Moonrise 5:00 AM',
      flag: null,
    })
  })

  // The first user's wording, chosen on 2026-10-09: no tense, whether or
  // not the moon has risen.
  test('the moon line does not say whether the moonrise has passed', () => {
    expect(tonightWords(day, ZONE).moonrise).not.toMatch(/^R(o|i)ses?/)
  })

  test('a moonrise near sunset is flagged with its time', () => {
    const flagged = { ...day, moonriseNearSunset: Date.UTC(2026, 9, 9, 0, 45) }
    expect(tonightWords(flagged, ZONE).flag).toBe('Moonrise near sunset: 5:45 PM')
  })

  test('a day with no moonrise, or no sunset, says so', () => {
    const words = tonightWords({ ...day, sunset: null, moonrise: null }, ZONE)
    expect(words.sunset).toBe('No sunset today')
    expect(words.moonrise).toBe('No moonrise today')
  })
})
```

- [ ] **Step 2: Run the test file and see it fail**

Run: `npx vitest run src/ui/dayList.test.ts`
Expected: FAIL. The type check does not run under vitest, so the failures are on the words: `'Rises 5:00 AM'` where `'Moonrise 5:00 AM'` was expected.

- [ ] **Step 3: Change `tonightWords`**

In `src/ui/dayList.ts`, replace lines 34 to 56 with:

```ts
/**
 * What the strip at the top says about today. The moon line gives the
 * time with no tense, which is the first user's wording.
 */
export function tonightWords(day: DayAstro, timeZone: string): TonightWords {
  const time = (t: number) => formatTime(t, timeZone)
  return {
    sunset: day.sunset === null ? 'No sunset today' : time(day.sunset),
    moon: `${lit(day)}, ${day.phase.toLowerCase()}`,
    moonrise:
      day.moonrise === null
        ? 'No moonrise today'
        : `Moonrise ${time(day.moonrise)}`,
    flag:
      day.moonriseNearSunset === null
        ? null
        : `Moonrise near sunset: ${time(day.moonriseNearSunset)}`,
  }
}
```

In `src/ui/SpotScreen.tsx`, replace lines 65 to 68 with:

```ts
  const tonight = useMemo(() => tonightWords(days[0], zone), [days, zone])
```

- [ ] **Step 4: Run the tests, the type check and the lint**

Run: `npx vitest run src/ui/dayList.test.ts && npm run build && npm run lint`
Expected: the test file passes; `tsc` finds no other caller of `tonightWords` with three arguments (if it does, fix that caller the same way); lint passes. Run `npm run format` if Prettier complains, then lint again.

- [ ] **Step 5: Commit**

```bash
git add src/ui/dayList.ts src/ui/dayList.test.ts src/ui/SpotScreen.tsx
git commit -m "The moon line reads Moonrise and the time, in both tenses" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The edit screen is a view

**Files:**
- Modify: `src/ui/viewHistory.ts:1-9`
- Test: `src/ui/viewHistory.test.ts:48-68`

**Interfaces:**
- Produces: `type View = 'month' | 'add' | 'edit'`. `openView('edit')` and `closeView()` from `src/ui/useView.ts` then work for it with no change there.

- [ ] **Step 1: Add the test**

In `src/ui/viewHistory.test.ts`, in `describe('viewOf', …)`, change the first test to:

```ts
  test("a view's entry", () => {
    expect(viewOf(entryFor('month'))).toBe('month')
    expect(viewOf(entryFor('add'))).toBe('add')
    expect(viewOf(entryFor('edit'))).toBe('edit')
    expect(viewOf({ tidelineView: 'month', other: 1 })).toBe('month')
  })
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/ui/viewHistory.test.ts`
Expected: FAIL on `viewOf(entryFor('edit'))`, which is null because `'edit'` is not in `VIEWS`.

- [ ] **Step 3: Add the view**

In `src/ui/viewHistory.ts`, replace lines 1 to 9 with:

```ts
// Which view is up over the forecast, the month view, the add screen or
// the edit screen, and the browser history that lets going back close it.
// A view puts one entry in the history, at the address the page already
// has, so going back lands on the forecast and not on whatever came before
// the site. The browser is handed in, so all of this is tested with a
// stand-in.

export type View = 'month' | 'add' | 'edit'

const VIEWS: readonly View[] = ['month', 'add', 'edit']
```

- [ ] **Step 4: Run the tests and the lint**

Run: `npx vitest run src/ui/viewHistory.test.ts && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/viewHistory.ts src/ui/viewHistory.test.ts
git commit -m "The edit screen is a view with a history entry" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `replaceSpot` in the saved list

**Files:**
- Modify: `src/data/savedSpots.ts:79-86`
- Test: `src/data/savedSpots.test.ts`

**Interfaces:**
- Produces: `replaceSpot(id: string, next: Spot): boolean`. The spot with `id` is replaced where it stands by `next`, whose own id may differ. An `id` not in the list adds `next` at the end. Returns whether the list went in, as `addSpot` does.

- [ ] **Step 1: Write the failing tests**

In `src/data/savedSpots.test.ts`, add `replaceSpot` to the import from `./savedSpots.ts`, and add after `describe('removeSpot', …)`:

```ts
describe('replaceSpot', () => {
  const SECOND = { ...LEADBETTER, id: 'spot-def', name: 'Second' }
  const THIRD = { ...LEADBETTER, id: 'spot-ghi', name: 'Third' }

  test('a rename takes the place of the old spot, under the same id', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    addSpot(LEADBETTER)
    addSpot(SECOND)
    addSpot(THIRD)
    expect(replaceSpot('spot-def', { ...SECOND, name: 'Renamed' })).toBe(true)
    expect(readSavedSpots().map((spot) => spot.name)).toEqual([
      'Leadbetter Beach',
      'Renamed',
      'Third',
    ])
  })

  test('a move keeps the place in the row under the new id', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    addSpot(LEADBETTER)
    addSpot(SECOND)
    addSpot(THIRD)
    const moved = { ...SECOND, id: 'spot-new', lat: 34.41, lon: -119.71 }
    replaceSpot('spot-def', moved)
    expect(readSavedSpots().map((spot) => spot.id)).toEqual([
      'spot-abc',
      'spot-new',
      'spot-ghi',
    ])
    expect(readSavedSpots()[1]).toEqual(moved)
  })

  // A spot that could not be kept is in the row but not in storage. Editing
  // it is another try at keeping it, not a way to lose it.
  test('an id not in the list adds the spot at the end', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    addSpot(LEADBETTER)
    expect(replaceSpot('spot-gone', SECOND)).toBe(true)
    expect(readSavedSpots().map((spot) => spot.id)).toEqual([
      'spot-abc',
      'spot-def',
    ])
  })

  test('with storage disabled says the spot was not kept', () => {
    vi.stubGlobal('localStorage', brokenStorage())
    expect(replaceSpot('spot-abc', LEADBETTER)).toBe(false)
  })
})
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run src/data/savedSpots.test.ts`
Expected: FAIL, `replaceSpot` is not exported.

- [ ] **Step 3: Write `replaceSpot`**

In `src/data/savedSpots.ts`, after `addSpot` (line 82), add:

```ts
/**
 * Puts `next` where the spot with `id` stands, so an edit keeps its place
 * in the row; its own id may differ, as a moved spot's does. An id not in
 * the list adds the spot at the end: a spot that could not be kept is in
 * the row but not here, and an edit is another try at keeping it. Says
 * whether the list went in, as `addSpot` does.
 */
export function replaceSpot(id: string, next: Spot): boolean {
  const spots = readSavedSpots()
  const at = spots.findIndex((spot) => spot.id === id)
  if (at === -1) return writeSavedSpots([...spots, next])
  return writeSavedSpots(spots.map((spot, i) => (i === at ? next : spot)))
}
```

- [ ] **Step 4: Run the tests and the lint**

Run: `npx vitest run src/data/savedSpots.test.ts && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/savedSpots.ts src/data/savedSpots.test.ts
git commit -m "replaceSpot keeps an edited spot's place in the row" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The words and rules of an edit

**Files:**
- Modify: `src/ui/addSpotView.ts`
- Test: `src/ui/addSpotView.test.ts`

**Interfaces:**
- Consumes: `SpotFacts`, `ResolveResult` from `src/data/resolve.ts`; `wrapLon` from `src/data/geo.ts`; `Spot` from `src/spot.ts`.
- Produces:
  - `WORDS.editHeading === 'Edit spot'`, `WORDS.edit === 'Edit'`.
  - `spotFacts(spot: Spot): SpotFacts`: the spot without its id and name.
  - `pinMoved(spot: Pick<Spot, 'lat' | 'lon'>, pin: LatLon): boolean`: whether the pin is somewhere else, at four decimal places, after wrapping the longitude.
  - `type Edit = { kind: 'nothing' } | { kind: 'rename'; spot: Spot } | { kind: 'move'; spot: Spot }`.
  - `edited(spot: Spot, name: string, pin: LatLon, result: ResolveResult | null, newId: string): Edit | null`: what Save would do, or null when it cannot save (a blank name, or a moved pin not yet looked up or looked up and failed).

- [ ] **Step 1: Write the failing tests**

In `src/ui/addSpotView.test.ts`, add `edited`, `pinMoved`, `spotFacts` to the import from `./addSpotView.ts`, add `import { CAMPUS_POINT } from '../spot.ts'` and `import type { Spot } from '../spot.ts'`, and add at the end of the file:

```ts
const HENDRYS: Spot = {
  ...CAMPUS_POINT,
  id: 'spot-abc',
  name: "Hendry's Beach",
  lat: 34.4026,
  lon: -119.7437,
  elevationFt: 12,
}

describe('WORDS for an edit', () => {
  test('the heading and the button', () => {
    expect(WORDS.editHeading).toBe('Edit spot')
    expect(WORDS.edit).toBe('Edit')
  })
})

describe('spotFacts', () => {
  test('is the spot without its id and name', () => {
    const facts = spotFacts(HENDRYS)
    expect(facts).not.toHaveProperty('id')
    expect(facts).not.toHaveProperty('name')
    expect(facts.lat).toBe(34.4026)
    expect(facts.tideStation).toEqual(HENDRYS.tideStation)
  })
})

describe('pinMoved', () => {
  test('the same point, or one that rounds to it, is not a move', () => {
    expect(pinMoved(HENDRYS, { lat: 34.4026, lon: -119.7437 })).toBe(false)
    expect(pinMoved(HENDRYS, { lat: 34.40264, lon: -119.74366 })).toBe(false)
  })
  test('a point that rounds elsewhere is a move', () => {
    expect(pinMoved(HENDRYS, { lat: 34.4027, lon: -119.7437 })).toBe(true)
    expect(pinMoved(HENDRYS, { lat: 34.4026, lon: -119.7436 })).toBe(true)
  })
  // A tap on a world copy of the map is the same place.
  test('the same point on a world copy is not a move', () => {
    expect(pinMoved(HENDRYS, { lat: 34.4026, lon: -119.7437 + 360 })).toBe(
      false,
    )
  })
})

describe('edited', () => {
  const here = { lat: HENDRYS.lat, lon: HENDRYS.lon }
  const there = { lat: 34.41, lon: -119.75 }
  const found = {
    ok: true as const,
    facts: { ...spotFacts(HENDRYS), lat: 34.41, lon: -119.75, elevationFt: 30 },
  }

  test('the same name and pin is nothing', () => {
    expect(edited(HENDRYS, "Hendry's Beach", here, null, 'spot-new')).toEqual({
      kind: 'nothing',
    })
  })
  test('the same name with spaces round it is still nothing', () => {
    expect(
      edited(HENDRYS, "  Hendry's Beach ", here, null, 'spot-new'),
    ).toEqual({ kind: 'nothing' })
  })
  test('a blank name cannot save', () => {
    expect(edited(HENDRYS, '   ', here, null, 'spot-new')).toBeNull()
  })
  test('a new name with the pin in place is a rename under the same id', () => {
    expect(edited(HENDRYS, 'Arroyo Burro', here, null, 'spot-new')).toEqual({
      kind: 'rename',
      spot: { ...HENDRYS, name: 'Arroyo Burro' },
    })
  })
  test('a long name is cut to the limit', () => {
    const edit = edited(HENDRYS, 'x'.repeat(50), here, null, 'spot-new')
    expect(edit?.kind).toBe('rename')
    expect(edit?.kind === 'rename' && edit.spot.name).toHaveLength(NAME_MAX)
  })
  test('a moved pin not yet looked up, or looked up and failed, cannot save', () => {
    expect(edited(HENDRYS, "Hendry's Beach", there, null, 'spot-new')).toBeNull()
    expect(
      edited(
        HENDRYS,
        "Hendry's Beach",
        there,
        { ok: false, reason: 'outside' },
        'spot-new',
      ),
    ).toBeNull()
  })
  test('a moved pin that was looked up is a move, under the new id', () => {
    expect(edited(HENDRYS, "Hendry's Beach", there, found, 'spot-new')).toEqual(
      {
        kind: 'move',
        spot: { ...found.facts, id: 'spot-new', name: "Hendry's Beach" },
      },
    )
  })
  test('a move can rename too', () => {
    const edit = edited(HENDRYS, 'Arroyo Burro', there, found, 'spot-new')
    expect(edit?.kind === 'move' && edit.spot.name).toBe('Arroyo Burro')
  })
  test('a moved pin with a blank name cannot save', () => {
    expect(edited(HENDRYS, '', there, found, 'spot-new')).toBeNull()
  })
  // The pin went away and came back: the saved facts stand, whatever the
  // look-up said in between.
  test('the pin back where it was is not a move', () => {
    expect(edited(HENDRYS, "Hendry's Beach", here, found, 'spot-new')).toEqual(
      { kind: 'nothing' },
    )
  })
})
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run src/ui/addSpotView.test.ts`
Expected: FAIL, `edited`, `pinMoved` and `spotFacts` are not exported, and `WORDS.editHeading` is undefined.

- [ ] **Step 3: Write the words and the rules**

In `src/ui/addSpotView.ts`:

Add to the imports:

```ts
import { wrapLon } from '../data/geo.ts'
import type { Spot, Station } from '../spot.ts'
```

(and drop the existing `import type { Station } from '../spot.ts'`, since it is now in the line above).

In `WORDS`, after `heading: 'New spot',` add:

```ts
  editHeading: 'Edit spot',
  edit: 'Edit',
```

At the end of the file add:

```ts
/** Everything the spot has apart from what the user gave it. */
export function spotFacts(spot: Spot): SpotFacts {
  const { id: _id, name: _name, ...facts } = spot
  return facts
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4

/**
 * Whether the pin is somewhere other than the spot, at the four decimal
 * places a spot's point is kept to. The longitude is wrapped first: a tap
 * on a world copy of the map is the same place.
 */
export function pinMoved(spot: Pick<Spot, 'lat' | 'lon'>, pin: LatLon): boolean {
  return (
    round4(pin.lat) !== round4(spot.lat) ||
    round4(wrapLon(pin.lon)) !== round4(spot.lon)
  )
}

export type Edit =
  | { kind: 'nothing' }
  | { kind: 'rename'; spot: Spot }
  | { kind: 'move'; spot: Spot }

/**
 * What Save would do to `spot` with the screen as it stands, and the spot
 * it would save; null when it cannot save. A rename keeps the id and
 * everything looked up before. A move is a new spot under `newId`, from
 * what the look-up found for the new pin.
 */
export function edited(
  spot: Spot,
  name: string,
  pin: LatLon,
  result: ResolveResult | null,
  newId: string,
): Edit | null {
  const clean = cleanName(name)
  if (clean === '') return null
  if (pinMoved(spot, pin)) {
    if (result?.ok !== true) return null
    return { kind: 'move', spot: { ...result.facts, id: newId, name: clean } }
  }
  if (clean === spot.name) return { kind: 'nothing' }
  return { kind: 'rename', spot: { ...spot, name: clean } }
}
```

- [ ] **Step 4: Run the tests and the lint**

Run: `npx vitest run src/ui/addSpotView.test.ts && npm run lint`
Expected: PASS. If oxlint objects to the unused `_id` and `_name`, the underscore prefix is the convention this repo already uses (`savedSpots.test.ts` line 151); keep it.

- [ ] **Step 5: Commit**

```bash
git add src/ui/addSpotView.ts src/ui/addSpotView.test.ts
git commit -m "Words and rules for editing a spot: pinMoved and edited" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The add screen can start from a spot, and can remove it

**Files:**
- Modify: `src/ui/AddSpot.tsx`

**Interfaces:**
- Consumes: `edited`, `pinMoved`, `spotFacts`, `WORDS`, `removeQuestion` from Task 4; `newSpotId` from `src/data/savedSpots.ts`.
- Produces: `AddSpotProps` gains `editing?: Spot` and `onRemove?: () => void`. With `editing`, `onSave` is called with the spot `edited` would save (a rename under the same id, or a move under a new one); with nothing changed, `onCancel` is called instead.

This task is checked by the type check and in a browser in Task 7; `AddSpot.tsx` has no unit tests, as no component does.

- [ ] **Step 1: Take the spot being edited**

In `src/ui/AddSpot.tsx`, replace the props and the start of the component (lines 31 to 58) with:

```ts
export interface AddSpotProps {
  /** The spot the user came from: where the map opens. */
  from: Spot
  /** The spot being edited, when the screen is for one. The pin starts at it. */
  editing?: Spot
  onSave: (spot: Spot) => void
  onCancel: () => void
  /** Given with `editing`: the spot can be removed from here. */
  onRemove?: () => void
}

/**
 * A pin on a map or the device's position, a name, and what the pin gets:
 * its forecast cell, its height, and its stations or why it has no tide.
 * For a spot being edited the pin, the name and the facts start from the
 * spot, and nothing is looked up until the pin moves. Loaded only when
 * opened, with Leaflet and the station list.
 */
export default function AddSpot({
  from,
  editing,
  onSave,
  onCancel,
  onRemove,
}: AddSpotProps) {
  // What is known of the spot being edited, shown until the pin moves and
  // again if it comes back.
  const known: ResolveResult | null = editing
    ? { ok: true, facts: spotFacts(editing) }
    : null
  const [pin, setPin] = useState<LatLon | null>(
    editing ? { lat: editing.lat, lon: editing.lon } : null,
  )
  const [look, setLook] = useState<Look | null>(null)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<SearchState>({ status: 'idle' })
  const [name, setName] = useState(editing?.name ?? '')
  const [stations, setStations] = useState<StationRow[] | null>(null)
  const [stationsFailed, setStationsFailed] = useState(false)
  const [stationsAttempt, setStationsAttempt] = useState(0)
  const [result, setResult] = useState<ResolveResult | null>(known)
  const [attempt, setAttempt] = useState(0)
  const [locating, setLocating] = useState<'idle' | 'finding' | 'failed'>(
    'idle',
  )
  // Removing asks once, on the line itself.
  const [removing, setRemoving] = useState(false)
  const nameId = useId()
  const placeId = useId()
```

Add to the imports from `./addSpotView.ts`: `edited`, `pinMoved`, `removeQuestion`, `spotFacts`.

- [ ] **Step 2: Look nothing up until the pin moves**

Replace the look-up effect (lines 89 to 105 of the original) with:

```ts
  // Each pin, and each try-again, looks the pin up afresh. What the last
  // look-up found is cleared by the tap that asks again, below. A spot
  // being edited is already known: its pin is looked up only once moved.
  useEffect(() => {
    if (!pin || !stations) return
    if (editing && !pinMoved(editing, pin)) return
    let gone = false
    resolveSpot(pin.lat, pin.lon, {
      fetchPoints,
      fetchElevationFt,
      fetchPointElevationFt,
      stations,
    }).then((answer) => {
      if (!gone) setResult(answer)
    })
    return () => {
      gone = true
    }
  }, [pin, stations, attempt, editing])
```

Replace `dropPin` (lines 107 to 110 of the original) with:

```ts
  const dropPin = (at: LatLon) => {
    setPin(at)
    // Back on the spot's own point, what was saved for it stands.
    setResult(editing && !pinMoved(editing, at) ? known : null)
  }
```

- [ ] **Step 3: Save what the edit would**

Replace `save` (lines 165 to 168 of the original) with:

```ts
  // For an edit, what Save would do. Null when it cannot save yet.
  const edit =
    editing && pin ? edited(editing, name, pin, result, newSpotId()) : null
  const save = () => {
    if (!pin) return
    if (editing) {
      if (edit === null) return
      // Nothing changed: the screen closes, as Cancel does.
      if (edit.kind === 'nothing') onCancel()
      else onSave(edit.spot)
      return
    }
    if (!result?.ok) return
    onSave({ ...result.facts, id: newSpotId(), name: cleanName(name) })
  }
  const saveable = editing ? edit !== null : canSave(pin, name, result)
```

`newSpotId()` is called on each draw here, which is harmless: it is the time in base 36, and the one used is the one on the draw Save was tapped on.

- [ ] **Step 4: Centre the map on the spot, enable Save by `saveable`, add the remove line**

Change the `SpotMap`'s `center` prop to `center={{ lat: (editing ?? from).lat, lon: (editing ?? from).lon }}`.

Change the Save button's `disabled` to `disabled={!saveable}`.

After the closing `</div>` of `add-actions` and before `</section>`, add:

```tsx
      {onRemove &&
        (removing ? (
          <p className="caption remove-spot">
            <span>{removeQuestion(editing?.name ?? '')}</span>{' '}
            <button type="button" className="text-button" onClick={onRemove}>
              {WORDS.removeYes}
            </button>{' '}
            <span aria-hidden="true">{WORDS.separator}</span>{' '}
            <button
              type="button"
              className="text-button"
              onClick={() => setRemoving(false)}
            >
              {WORDS.removeNo}
            </button>
          </p>
        ) : (
          <p className="caption remove-spot">
            <button
              type="button"
              className="text-button"
              onClick={() => setRemoving(true)}
            >
              {WORDS.remove}
            </button>
          </p>
        ))}
```

- [ ] **Step 5: Type-check and lint**

Run: `npm run build && npm run lint`
Expected: both pass. `App.tsx` still calls `AddSpot` without the new props, which are optional, so nothing else changes yet. Run `npm run format` if Prettier complains.

- [ ] **Step 6: Commit**

```bash
git add src/ui/AddSpot.tsx
git commit -m "The add screen can start from a saved spot and remove it" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: The Edit button, the save and the remove, wired in App

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/ui/SpotScreen.tsx` (loses the remove line and `onRemove`)
- Modify: `src/styles.css:645-657` and the `h1` rule at line 72

**Interfaces:**
- Consumes: `replaceSpot` (Task 3), `WORDS.edit`, `WORDS.editHeading` (Task 4), `AddSpotProps.editing` and `onRemove` (Task 5), `View` `'edit'` (Task 2).

- [ ] **Step 1: Take the remove line out of `SpotScreen`**

In `src/ui/SpotScreen.tsx`:
- Change the import on line 10 to `import { WORDS } from './addSpotView.ts'` only if `WORDS` is still used after the edits below; if not, delete the line. (`removeQuestion` goes either way.)
- Delete `onRemove?: () => void` and its comment from `SpotScreenProps` (lines 31 to 32), and `onRemove` from the destructuring on line 41.
- Delete the `removing` state and its comment (lines 57 to 58).
- Delete the whole `{onRemove && (…)}` block (lines 228 to 254), leaving `<ShareSpot spot={spot} />` as the last child before `</section>`.

- [ ] **Step 2: Wire App**

In `src/App.tsx`:

Change the import on line 3 to:

```ts
import { readSavedSpots, addSpot, replaceSpot } from './data/savedSpots.ts'
```

Replace lines 39 to 41 (the `adding` line and its comment) with:

```ts
  // The add screen and the edit screen each have an entry in the browser's
  // history, so going back closes them. An edit is only of a saved spot: a
  // reload can bring the edit view up with a built-in one chosen, and then
  // the forecast is shown and the entry taken off.
  const view = useView()
  const adding = view === 'add'
  const editing = view === 'edit' && isSaved(spot)
  useEffect(() => {
    if (view === 'edit' && !isSaved(spot)) closeView()
  }, [view, spot])
```

After `saveSpot` (after line 65) add:

```ts
  // A rename keeps the id and what was fetched. A move is a new id, in the
  // old one's place; what was fetched for the old point is dropped, so a
  // late answer for it cannot be drawn for the new one.
  const editSpot = (next: Spot) => {
    if (next.id !== spot.id) forgetSpot(spot.id)
    setNotKept(replaceSpot(spot.id, next) ? null : next.id)
    setSaved(saved.map((each) => (each.id === spot.id ? next : each)))
    selectSpot(next)
    window.scrollTo(0, 0)
  }
```

Replace the `if (adding) { … }` block (lines 101 to 111) with:

```tsx
  if (adding || editing) {
    return (
      <main>
        <h1>{editing ? WORDS.editHeading : WORDS.heading}</h1>
        <Suspense fallback={<p className="notice">{WORDS.loadingMap}</p>}>
          <AddSpot
            key={editing ? spot.id : 'new'}
            from={spot}
            editing={editing ? spot : undefined}
            onSave={editing ? editSpot : saveSpot}
            onCancel={closeView}
            onRemove={editing ? removeSpot : undefined}
          />
        </Suspense>
        <BuildStamp />
      </main>
    )
  }
```

Replace the forecast's `<h1>{spot.name}</h1>` (line 115) with:

```tsx
      <header className="spot-head">
        <h1>{spot.name}</h1>
        {isSaved(spot) && (
          <button
            type="button"
            className="text-button"
            onClick={() => openView('edit')}
          >
            {WORDS.edit}
          </button>
        )}
      </header>
```

Replace the `SpotScreen` element (lines 129 to 133) with:

```tsx
      <SpotScreen key={spot.id} spot={spot} />
```

- [ ] **Step 3: The heading row**

In `src/styles.css`, after the `h1 { … }` rule (ends line 75) add:

```css
/* The spot's name, and for a saved spot the button to edit it, on one line. */
.spot-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  column-gap: 1rem;
}
```

The button keeps `.text-button`'s vertical padding, which is its tap target; `baseline` alignment keeps it level with the name.

Replace the `.remove-spot` rule and the `.share-spot + .remove-spot` rule (lines 645 to 657; keep the `.share-spot` rule and its comment, trimmed of the sentence about the remove line) with:

```css
/* Under Save and Cancel on the edit screen, set apart from them. */
.remove-spot {
  margin-top: 1.5rem;
}

/* The share line: the button, then what came of it. A link shown to be
   copied by hand breaks wherever the line ends, and one touch selects the
   whole of it. */
.share-spot {
  margin-top: 1rem;
}
```

- [ ] **Step 4: Type-check, lint and run all tests**

Run: `npm run build && npm run lint && npm test`
Expected: all pass. `tsc` will catch a `removeSpot` or `WORDS` left unused, or `onRemove` still passed to `SpotScreen`.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/ui/SpotScreen.tsx src/styles.css
git commit -m "Edit beside a saved spot's name opens the add screen as Edit spot, with Remove at its foot" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Browser check

**Files:** none changed unless the check finds something.

Run the dev server in the worktree (`npm run dev`, which answers at http://localhost:5173 or the next free port; read the port from its output) and drive a browser at 390 × 844 with the Playwright tools (`mcp__playwright__browser_*`; load them with ToolSearch first) or Claude in Chrome. Live NWS, USGS and NOAA are needed. Record each step's result in the task's report; on a failure, fix the code in the task that owns it and commit.

- [ ] **Step 1: A built-in spot has no Edit.** Open the page on Campus Point. Pass: the name on its own, no "Edit" beside it; no "Remove this spot" under the captions.
- [ ] **Step 2: Add a spot.** "Add a spot", click the map on the coast near Santa Barbara, name it "Test one", Save. Pass: its forecast, with "Edit" to the right of "Test one" on the same line, and nothing about removing under the captions.
- [ ] **Step 3: Edit opens filled in.** Click "Edit". Pass: the heading "Edit spot", the name field "Test one", the map centred with the pin on the spot, the lines under the name showing the cell, the height and the stations at once, no "Looking up" wait. The network panel shows no request to api.weather.gov or epqs.nationalmap.gov on opening. "Remove this spot" is at the foot, under Save and Cancel.
- [ ] **Step 4: Rename.** Change the name to "Test two", Save. Pass: the forecast at once under "Test two", the row of spots says "Test two" in the same place, no new NWS or NOAA request, and the page is at the top.
- [ ] **Step 5: Save with nothing changed.** "Edit", then Save straight away. Pass: the forecast, nothing changed, and the history did not grow (`history.length` the same as before "Edit").
- [ ] **Step 6: Move.** "Edit", click the map a few miles along the coast, wait for the lines under the name to change, Save. Pass: the forecast is for the new point (the tide caption names the station nearest to it, and the height line changed), "Test two" in the same place in the row, and in `localStorage` under `tideline:spots:v1` the spot has a new id while the old id's `tideline:v2:<old id>:*` keys are gone.
- [ ] **Step 7: Back and reload.** "Edit", then the browser's back. Pass: the forecast, unchanged. "Edit", then reload. Pass: the edit screen again, filled in. Click Cancel. Then choose Campus Point, open the edit view by hand with `history.pushState({ tidelineView: 'edit' }, '')` and reload. Pass: Campus Point's forecast, and one back leaves the site (or lands on the page before it).
- [ ] **Step 8: Remove.** Choose "Test two", "Edit", "Remove this spot". Pass: "Remove Test two?", "Yes, remove", "Keep". Click "Keep": the line goes back to "Remove this spot". Click "Remove this spot", "Yes, remove". Pass: Campus Point's forecast at the top of the page, "Test two" gone from the row.
- [ ] **Step 9: The moon line.** On Campus Point, the strip at the top. Pass: the moon's line reads "Moonrise" and a time, or "No moonrise today", never "Rose" or "Rises".
- [ ] **Step 10: Wide window.** At 1280 × 800, the forecast: "Edit" at the right end of the name's line, inside the 1,080 px page; the edit screen's remove line in the left column under Save and Cancel.
- [ ] **Step 11: Commit any fix**, with the trailer, naming what the check found.

---

### Task 8: Docs

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Status.** In the "Status" section's "Built:" bullet, after "with a caption that says so." at its end, add: "; then an Edit button beside a saved spot's name, which opens the add screen as "Edit spot" with the name, the pin and the facts filled in, where the name or the pin can be changed (a rename keeps the spot's data, a move looks the new point up and saves it under a new id in the same place in the row) and from which the spot is removed; and the moon line in tonight's strip as "Moonrise 5:00 AM"."

- [ ] **Step 2: Stack.** In the bullet that begins "- The month view and the add screen each put one entry in the browser's history", change its first words to "- The month view, the add screen and the edit screen each put one entry".

- [ ] **Step 3: Decisions.** Under "Still open with the first user, as of 2026-10-09:", change the sentence to: "Still open with the first user, as of 2026-10-09: whether the forecast at the hour of sunset is the right moment for a day's row. The moon line is "Moonrise 5:00 AM", as he asked, since 2026-10-13."

- [ ] **Step 4: Next Steps.** Replace the bullet that begins "- Share by link (issue #7) is built and waiting for the owner's phone check" with: "- Share by link (issue #7) passed the owner's phone check on production on 2026-10-13, all eight steps. Step 6 confirmed issue #45: a spot saved in Safari is not in the home-screen app, which keeps its own storage. Views still have no addresses (issue #48)."

  Replace the bullet that begins "- Going back closes the month view and the add screen (issue #46)" with: "- Going back closes the month view, the add screen and the edit screen (issue #46). Steps 1 to 6 of pull request 49's check passed in Safari on a Mac on 2026-10-13, with a brief white flash on the reload in step 4. Steps 7 and 8 need the iPhone and were not run."

  Add after it: "- Edit and remove a saved spot, and the moon line (issue #54, the first of three pieces approved on 2026-10-12): built, waiting for the owner's phone check in the pull request. Next are issue #55 (wind arrows, night shading) and issue #56 (observed weather today), specs in `docs/superpowers/specs/`."

  Replace the last bullet, "- The first user: the three questions still open under Decisions (the sunset-hour row, the moon line wording, what a spot's height is counted above).", with "- The first user: the two questions still open under Decisions (the sunset-hour row, and what a spot's height is counted above)."

- [ ] **Step 5: Lint and commit**

Run: `npm run lint`
Expected: PASS (Prettier checks Markdown too).

```bash
git add CLAUDE.md
git commit -m "Record edit and remove, the moon line, and the phone checks of 2026-10-13" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
