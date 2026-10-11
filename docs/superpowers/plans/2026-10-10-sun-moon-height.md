# Sun and Moon From the Spot's Height Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sunset and moonrise are worked out from a spot's own height where the spot is 100 ft up or more and near the sea, and a caption says so.

**Architecture:** One plain rule module, `src/data/horizon.ts`, says what height a spot's times are worked out from (0 means a level horizon). `src/data/astro.ts` hands that height to `astronomy-engine`, which already knows how to lower the horizon for it. `src/ui/captions.ts` words the caption, and `SpotScreen.tsx` and `MonthView.tsx` show it. No new dependency, nothing fetched, nothing stored.

**Tech Stack:** Vite, React 19, strict TypeScript, Vitest, `astronomy-engine` 2.1.19 (`SearchRiseSet`'s sixth argument, `metersAboveGround`).

**Spec:** `docs/superpowers/specs/2026-10-10-sun-moon-height-design.md`. Read it first; it says why the rule is what it is and lists the decisions the owner reviews.

## Global Constraints

- Code style: no semicolons, single quotes, relative imports carry their `.ts`/`.tsx` extension, type-only imports use `import type`, no enums. `npm run lint` (oxlint then Prettier) must pass; run `npm run format` before committing.
- Tests run with `TZ=Asia/Tokyo`; nothing may depend on the viewer's time zone.
- Components hold no arithmetic, no rules and no wording. The rule is in `src/data/horizon.ts`, the words in `src/ui/captions.ts`.
- Data modules stay framework-free (no React imports under `src/data/`).
- The rule, exactly: a spot's times are worked out from its own height when `elevationFt` is not null and is `>= 100` (`SEEN_FROM_FT`), and `tideStation.distanceMi <= 25` (`TIDES_WITHIN_MI` from `src/data/tideRule.ts`). Otherwise the height is 0, a level horizon. The forecast cell's average (`nws.elevationFt`) is never used for this.
- A height of 0 must leave every time exactly as it is today. The existing tests in `src/data/astro.test.ts` against the Naval Observatory must pass unchanged, and no existing test may be edited.
- Feet to metres: `0.3048`.
- The caption, exactly: `Sun and moon: times as seen from 3,997 ft, over a sea-level horizon. Hills in the way are not counted.` with the spot's height in whole feet and a thousands comma.
- `CLAUDE.md`: another open pull request edits the bullet that begins "- Components hold no arithmetic", the last bullet of the Stack section, and the "Share by link" bullet in Next Steps. Do not touch those three, or the lines directly next to them, so the two merge without conflict.
- Commit trailer, on every commit, regardless of the model doing the work:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` then
  `Claude-Session: https://claude.ai/code/session_011uFB3EqJLYQ5h3p8Hc6jPq`
- In every tracked file and commit message the first user is "the first user"; no names from `private/`.
- Node 24. In each shell, before any `npm` or `npx`: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH`. Do not `source` nvm.
- Work only in this worktree, on the branch it is on. No `git stash`, `git reset`, `git checkout` of other branches, or `git clean`.

## Review Focus

1. A spot with no height of its own, or a low one, must not move by a minute: Campus Point must still match the Naval Observatory on every recorded day. Pinned in Task 1 (the existing Observatory tests, unedited, and "a height under 100 ft, or far from the sea, changes nothing").
2. A spot saved before spots had heights has `elevationFt: null` and may sit in a forecast cell that averages thousands of feet. The cell's average must not be used. Pinned in Task 1 (`seenFromFt` with a null height at La Cumbre Peak, whose cell averages 3,258 ft).
3. A high spot far from the sea must get no change and no caption. Pinned in Task 1 (`seenFromFt` at 25.1 mi and 900 mi) and Task 2 (`sunCaption` at 636 mi).
4. A spot below sea level must not reach the library with a negative height, which makes `SearchRiseSet` throw. Pinned in Task 1 (`seenFromFt` at -282 ft is 0).
5. At a height, the flagged moonrise and the day's own moonrise must still be one instant, and a day with no moonrise must still have none. Pinned in Task 1 ("the moonrise flag is worked out from the same times", "2 November 2026 still has no moonrise").

---

### Task 1: The rule, and the times

**Files:**
- Create: `src/data/horizon.ts`
- Test: `src/data/horizon.test.ts`
- Modify: `src/data/astro.ts`
- Test: `src/data/astro.test.ts` (add one `describe` block and one import; change nothing that is there)

**Interfaces:**
- Consumes: `TIDES_WITHIN_MI` (25) from `src/data/tideRule.ts`; `Spot` from `src/spot.ts`; `SearchRiseSet(body, observer, direction, dateStart, limitDays, metersAboveGround?)` and `Observer(latitude, longitude, heightInMetres)` from `astronomy-engine`.
- Produces:
  ```ts
  // src/data/horizon.ts
  export const SEEN_FROM_FT = 100
  export function seenFromFt(spot: Pick<Spot, 'elevationFt' | 'tideStation'>): number
  ```
  `dayAstro(spot, date)` and `astroForDays(spot, startDate, days)` keep their names and return types. Their `spot` now also needs `elevationFt` and `tideStation`; every caller already passes a whole `Spot`.

- [ ] **Step 1: Write the failing test for the rule**

Create `src/data/horizon.test.ts` with exactly this:

```ts
import { describe, expect, test } from 'vitest'
import { SEEN_FROM_FT, seenFromFt } from './horizon.ts'
import { CAMPUS_POINT, spotById } from '../spot.ts'

const PEAK = spotById('la-cumbre-peak')

describe('seenFromFt', () => {
  test('a high spot near the sea: its own height', () => {
    // 3,997 ft, 6.3 mi from the Santa Barbara tide station.
    expect(seenFromFt(PEAK)).toBe(3997)
  })

  test('a spot with no height of its own: a level horizon', () => {
    expect(seenFromFt(CAMPUS_POINT)).toBe(0)
    // Its forecast cell averages 3,258 ft. That is not the spot's height.
    expect(seenFromFt({ ...PEAK, elevationFt: null })).toBe(0)
  })

  test('under 100 ft: a level horizon', () => {
    expect(SEEN_FROM_FT).toBe(100)
    expect(seenFromFt({ ...PEAK, elevationFt: 21 })).toBe(0)
    expect(seenFromFt({ ...PEAK, elevationFt: 99.9 })).toBe(0)
    expect(seenFromFt({ ...PEAK, elevationFt: 100 })).toBe(100)
  })

  test('at or below sea level: a level horizon', () => {
    expect(seenFromFt({ ...PEAK, elevationFt: 0 })).toBe(0)
    expect(seenFromFt({ ...PEAK, elevationFt: -282 })).toBe(0)
  })

  test('far from the sea: a level horizon, however high', () => {
    const at = (distanceMi: number) => ({
      elevationFt: 5280,
      tideStation: { ...PEAK.tideStation, distanceMi },
    })
    expect(seenFromFt(at(25))).toBe(5280)
    expect(seenFromFt(at(25.1))).toBe(0)
    expect(seenFromFt(at(900))).toBe(0)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/data/horizon.test.ts`
Expected: FAIL. The file cannot be loaded because `./horizon.ts` does not exist.

- [ ] **Step 3: Write the rule**

Create `src/data/horizon.ts` with exactly this:

```ts
// The height that sunset and moonrise are worked out from. From high up the
// horizon is lower, so the sun sets later and the moon rises earlier: by 6
// to 7 minutes at 4,000 ft. What counts is how far the spot stands above
// the ground it looks out over, tens of miles off, and the app has no map
// of that ground. Near the sea it is the sea, so the spot's height above
// sea level is the height. Inland it may be a plain as high as the spot,
// and nothing is counted.

import type { Spot } from '../spot.ts'
import { TIDES_WITHIN_MI } from './tideRule.ts'

/**
 * Below this a spot's height moves sunset by under a minute, and times are
 * shown to the minute: 26 seconds at 21 ft, 57 seconds at 100 ft.
 */
export const SEEN_FROM_FT = 100

/**
 * The height in feet that a spot's sun and moon times are worked out from,
 * over a sea-level horizon. 0 means a level horizon, as almanacs use. It
 * is the spot's own height where that is known, is 100 ft or more, and the
 * sea is near: a tide station within the distance the tide rule goes by.
 * The forecast cell's average is never used. It puts a beach under hills
 * hundreds of feet up, which here would be minutes of error.
 */
export function seenFromFt(
  spot: Pick<Spot, 'elevationFt' | 'tideStation'>,
): number {
  const own = spot.elevationFt
  if (own === null || own < SEEN_FROM_FT) return 0
  return spot.tideStation.distanceMi <= TIDES_WITHIN_MI ? own : 0
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/data/horizon.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the failing tests for the times**

In `src/data/astro.test.ts`, change the import line

```ts
import { CAMPUS_POINT } from '../spot.ts'
```

to

```ts
import { CAMPUS_POINT, spotById } from '../spot.ts'
```

and add this block at the end of the file. Change nothing else in the file.

```ts
describe("from the spot's own height", () => {
  const peak = spotById('la-cumbre-peak')
  const zone = peak.timeZone
  // The same point with no height of its own: a level horizon.
  const level = { ...peak, elevationFt: null }

  test('10 October 2026 from 3,997 ft: sunset 6:37 PM, moonrise 6:59 AM', () => {
    // The Naval Observatory gives 18:31 and 07:05 for this point whatever
    // height it is asked for: its times are for a level horizon.
    const flat = dayAstro(level, '2026-10-10')
    expect(formatTime(flat.sunset!, zone)).toBe('6:31 PM')
    expect(formatTime(flat.moonrise!, zone)).toBe('7:05 AM')

    const high = dayAstro(peak, '2026-10-10')
    expect(formatTime(high.sunset!, zone)).toBe('6:37 PM')
    expect(formatTime(high.moonrise!, zone)).toBe('6:59 AM')
  })

  // From 1,218 m the horizon is about 1.2° below level. The sun and the
  // moon cross that in 6 to 7 minutes at this latitude, a little more at
  // the solstices, when they meet the horizon at more of a slant.
  test.each(['2026-10-10', '2026-12-21', '2027-03-20', '2027-06-21'])(
    '%s: sunset is 5 to 8 minutes later, moonrise 5 to 8 minutes earlier',
    (date) => {
      const flat = dayAstro(level, date)
      const high = dayAstro(peak, date)
      const later = (high.sunset! - flat.sunset!) / MINUTE
      const earlier = (flat.moonrise! - high.moonrise!) / MINUTE
      expect(later).toBeGreaterThanOrEqual(5)
      expect(later).toBeLessThanOrEqual(8)
      expect(earlier).toBeGreaterThanOrEqual(5)
      expect(earlier).toBeLessThanOrEqual(8)
    },
  )

  test('the higher the spot, the later the sunset', () => {
    const sunsetFrom = (elevationFt: number) =>
      dayAstro({ ...peak, elevationFt }, '2026-10-10').sunset!
    expect(sunsetFrom(1000)).toBeGreaterThan(sunsetFrom(100))
    expect(sunsetFrom(3997)).toBeGreaterThan(sunsetFrom(1000))
    expect(sunsetFrom(9000)).toBeGreaterThan(sunsetFrom(3997))
  })

  test('a height under 100 ft, or far from the sea, changes nothing', () => {
    const date = '2026-10-10'
    expect(dayAstro({ ...peak, elevationFt: 99 }, date)).toEqual(
      dayAstro(level, date),
    )
    const inland = {
      ...peak,
      tideStation: { ...peak.tideStation, distanceMi: 26 },
    }
    expect(dayAstro(inland, date)).toEqual(dayAstro(level, date))
  })

  test('the moonrise flag is worked out from the same times', () => {
    // 25 October 2026 from the peak: moonrise 5:38 PM, sunset 6:18 PM.
    const day = dayAstro(peak, '2026-10-25')
    expect(formatTime(day.sunset!, zone)).toBe('6:18 PM')
    expect(formatTime(day.moonrise!, zone)).toBe('5:38 PM')
    expect(day.moonriseNearSunset).toBe(day.moonrise)
  })

  test('2 November 2026 still has no moonrise', () => {
    // The moon rises at 11:33 PM on the 1st and 12:40 AM on the 3rd.
    const day = dayAstro(peak, '2026-11-02')
    expect(day.moonrise).toBeNull()
    expect(day.moonriseNearSunset).toBeNull()
    expect(formatTime(day.sunset!, zone)).toBe('5:10 PM')
  })
})
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npx vitest run src/data/astro.test.ts`
Expected: FAIL in the new block only. "10 October 2026 from 3,997 ft" fails with `6:31 PM` received where `6:37 PM` was expected; the four dated tests fail with `later` at 0; "the higher the spot" fails; "the moonrise flag" fails on `6:18 PM`; "2 November" fails on `5:10 PM`. "a height under 100 ft, or far from the sea, changes nothing" passes already. Every test that was in the file before still passes.

- [ ] **Step 7: Hand the height to the library**

In `src/data/astro.ts`, five edits.

(a) Replace the two comment lines at the top of the file

```ts
// Sunset, moonrise and moon phase, computed on the device. Times are for a
// flat sea-level horizon, which is what most weather sites show.
```

with

```ts
// Sunset, moonrise and moon phase, computed on the device. Times are for a
// level horizon, which is what most weather sites show, except where the
// spot's own height is counted (`horizon.ts`).
```

(b) After the line `import { DAY, HOUR, MINUTE, addDays, localDayStart } from '../time.ts'` add:

```ts
import { seenFromFt } from './horizon.ts'
```

(c) Replace

```ts
type Place = Pick<Spot, 'lat' | 'lon' | 'timeZone'>

const RISE = 1
```

with

```ts
type Place = Pick<
  Spot,
  'lat' | 'lon' | 'timeZone' | 'elevationFt' | 'tideStation'
>

const FT_TO_M = 0.3048
const RISE = 1
```

(d) In `riseOrSet`, replace

```ts
  const found = SearchRiseSet(
    body,
    observer,
    direction,
    new Date(from),
    spanMs / DAY,
  )
```

with

```ts
  const found = SearchRiseSet(
    body,
    observer,
    direction,
    new Date(from),
    spanMs / DAY,
    // The horizon is the sea, so the observer stands as far above the
    // ground it looks out over as above sea level. Zero is a level horizon.
    observer.height,
  )
```

(e) In `dayAstro`, replace

```ts
  const observer = new Observer(spot.lat, spot.lon, 0)
```

with

```ts
  // The height the times are worked out from, or 0. It lowers the horizon,
  // and the library also allows for the thinner air up there.
  const observer = new Observer(spot.lat, spot.lon, seenFromFt(spot) * FT_TO_M)
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/data/astro.test.ts src/data/horizon.test.ts`
Expected: PASS. Every test that was in `astro.test.ts` before passes unchanged, and the 9 new ones pass (the `test.each` counts as 4).

If a pinned clock time is off by one minute, do not change the test: stop and report the value you got. The pinned values were worked out with this library at this point (10 October: sunset 6:30:30 PM level and 6:36:31 PM from the peak; moonrise 7:04:55 AM and 6:58:33 AM).

- [ ] **Step 9: Format, lint, type-check, run everything**

Run: `npm run format && npm run lint && npm run typecheck && npm test`
Expected: all pass. The count is 14 more than before this task (5 in `horizon.test.ts`, 9 in `astro.test.ts`) and one more test file.

- [ ] **Step 10: Commit**

```bash
git add src/data/horizon.ts src/data/horizon.test.ts src/data/astro.ts src/data/astro.test.ts
git commit -m "Work out sunset and moonrise from a spot's own height near the sea

From 3,997 ft at La Cumbre Peak the sun sets 6 to 7 minutes later and
the moon rises 6 to 7 minutes earlier than over a level horizon. A
height is counted where it is the spot's own, is 100 ft or more, and a
tide station is within 25 miles. Everywhere else nothing changes.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011uFB3EqJLYQ5h3p8Hc6jPq"
```

---

### Task 2: The caption, on the two screens, checked in a browser and recorded

**Files:**
- Modify: `src/ui/captions.ts`
- Test: `src/ui/captions.test.ts` (add one `describe` block and one name to an import)
- Modify: `src/ui/SpotScreen.tsx`
- Modify: `src/ui/MonthView.tsx`
- Modify: `CLAUDE.md`
- Modify: `README.md`

**Interfaces:**
- Consumes, from Task 1: `seenFromFt(spot: Pick<Spot, 'elevationFt' | 'tideStation'>): number` in `src/data/horizon.ts`. 0 means a level horizon.
- Produces:
  ```ts
  // src/ui/captions.ts
  export function sunCaption(spot: Pick<Spot, 'elevationFt' | 'tideStation'>): string | null
  ```

- [ ] **Step 1: Write the failing test for the words**

In `src/ui/captions.test.ts`, add `sunCaption` to the import from `./captions.ts`, so it reads:

```ts
import {
  monthCaption,
  noTidesWords,
  sunCaption,
  tideCaption,
  weatherCaption,
} from './captions.ts'
```

and add this block at the end of the file. Change nothing else in the file.

```ts
describe('sunCaption', () => {
  const laCumbre = spotById('la-cumbre-peak')

  test("says the height where the spot's own height is counted", () => {
    expect(sunCaption(laCumbre)).toBe(
      'Sun and moon: times as seen from 3,997 ft, over a sea-level horizon. Hills in the way are not counted.',
    )
  })

  test('a height in whole feet', () => {
    expect(sunCaption({ ...laCumbre, elevationFt: 583.4 })).toBe(
      'Sun and moon: times as seen from 583 ft, over a sea-level horizon. Hills in the way are not counted.',
    )
  })

  test('nothing where the times are for a level horizon', () => {
    expect(sunCaption(CAMPUS_POINT)).toBeNull()
    expect(sunCaption(spotById('gaviota'))).toBeNull()
    expect(sunCaption({ ...laCumbre, elevationFt: null })).toBeNull()
    expect(sunCaption({ ...laCumbre, elevationFt: 99 })).toBeNull()
    expect(
      sunCaption({
        ...laCumbre,
        tideStation: { ...laCumbre.tideStation, distanceMi: 636 },
      }),
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/ui/captions.test.ts`
Expected: FAIL. `sunCaption` is not exported from `./captions.ts`, so the new tests fail with "sunCaption is not a function".

- [ ] **Step 3: Write the words**

In `src/ui/captions.ts`:

(a) Add this as the first import of the file, directly before `import type { Loaded } from '../data/load.ts'`, so the `../data/` imports stay in the order of their file names:

```ts
import { seenFromFt } from '../data/horizon.ts'
```

(b) Add this function at the end of the file:

```ts
/**
 * What sunset and moonrise are worked out from, where that is the spot's
 * own height. Null where it is a level horizon, as it is at most spots and
 * on most weather sites. Said under the weather's caption and under the
 * month view's.
 */
export function sunCaption(
  spot: Pick<Spot, 'elevationFt' | 'tideStation'>,
): string | null {
  const from = seenFromFt(spot)
  if (from === 0) return null
  return `Sun and moon: times as seen from ${feetHigh(from)}, over a sea-level horizon. Hills in the way are not counted.`
}
```

`feetHigh` is already in the file: it rounds to whole feet and puts in the thousands comma.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/ui/captions.test.ts`
Expected: PASS, 3 more tests than before.

- [ ] **Step 5: Show it on the spot's screen**

In `src/ui/SpotScreen.tsx`, three edits. Touch no other line: another open pull request changes this file's first two lines, its `view` state and its `openMonths` and `backToForecast` functions.

(a) Replace

```ts
import { tideCaption, weatherCaption } from './captions.ts'
```

with

```ts
import { sunCaption, tideCaption, weatherCaption } from './captions.ts'
```

(b) Directly after the line `const tidal = hasTides(spot)` add:

```ts
  // Said only where the spot's own height is counted.
  const sun = sunCaption(spot)
```

(c) Directly after the line

```tsx
        <p className="caption">{weatherCaption(spot, forecast, data.today)}</p>
```

add:

```tsx
        {sun !== null && <p className="caption">{sun}</p>}
```

- [ ] **Step 6: Show it on the month view**

In `src/ui/MonthView.tsx`, three edits.

(a) Replace

```ts
import { monthCaption } from './captions.ts'
```

with

```ts
import { monthCaption, sunCaption } from './captions.ts'
```

(b) Directly after the line `const nav = monthNav(month, today)` add:

```ts
  // Said only where the spot's own height is counted.
  const sun = sunCaption(spot)
```

(c) Directly after the line

```tsx
      <p className="caption">{noTides ?? monthCaption(spot, hilo, today)}</p>
```

add:

```tsx
      {sun !== null && <p className="caption">{sun}</p>}
```

- [ ] **Step 7: Type-check, lint, run the tests**

Run: `npm run format && npm run lint && npm run build && npm test`
Expected: all pass; the build finishes.

- [ ] **Step 8: Check it in a browser**

Start the dev server on its own port, in the background: `npm run dev -- --port 5184 --strictPort`. Use the Playwright browser tools (`mcp__playwright__*`; load them with ToolSearch if they are not loaded). Set the window to 390 px wide. Part D uses the live NWS, USGS and Nominatim services.

Record pass or fail for every numbered step in your report, with the times you read off the page.

**A. Campus Point is unchanged**
1. Open `http://localhost:5184/`. The forecast for Campus Point draws. Note tonight's sunset in the strip at the top, and the sunset in the first three rows of the 14-day list. Pass: there is no caption beginning "Sun and moon:" anywhere on the page.

**B. La Cumbre Peak**
2. Click "La Cumbre Peak" in the row. Pass: tonight's sunset is 5 to 8 minutes later than Campus Point's from step 1, and so is each of the first three rows of the 14-day list against Campus Point's rows for the same days.
3. Pass: under the caption that begins "Weather:" there is a caption that reads exactly "Sun and moon: times as seen from 3,997 ft, over a sea-level horizon. Hills in the way are not counted."
4. Click "Months ahead". Pass: the first rows show the same sunsets as the 14-day list did in step 2, and under the list there are two captions: "Tides are not shown here: the spot is 3,997 ft above sea level." and then the "Sun and moon:" caption, word for word as in step 3.
5. Click "Back to forecast". Click "Gaviota State Park". Pass: no "Sun and moon:" caption, and tonight's sunset is within 2 minutes of Campus Point's.

**C. The page at 390 px**
6. Back on La Cumbre Peak, take a screenshot of the captions. Pass: the new caption wraps inside the column like the two above it, with no sideways scroll (`document.documentElement.scrollWidth <= window.innerWidth`).

**D. A spot with a height from USGS**
7. Click "Add a spot". In the place field type "Gaviota Peak" and search. Wait for the facts under the map. Pass: the facts show a height of about 2,400 ft and the nearest tide station within 25 mi. If the search finds some other place, click the map on high ground a few miles inland of the Santa Barbara coast in its place, and say which you did.
8. Name it "Browser check" and click "Save". Pass: its screen shows the caption "Sun and moon: times as seen from N ft, over a sea-level horizon. Hills in the way are not counted.", where N is the height from step 7 in whole feet, and tonight's sunset is 3 to 7 minutes later than Campus Point's.
9. Click "Remove this spot", then confirm. Pass: it is gone from the row.

If a live service does not answer in part D, say so and mark those steps "not run", with what the page said. Parts A to C must all be run.

Afterwards: evaluate `localStorage.clear()` on `http://localhost:5184`, close the browser page, and stop the dev server.

If any step fails, find out why before changing anything, fix it within this task's files, and run Step 7 and the failed part again.

- [ ] **Step 9: Commit the code**

```bash
git add src/ui/captions.ts src/ui/captions.test.ts src/ui/SpotScreen.tsx src/ui/MonthView.tsx
git commit -m "Say where sun and moon times count the spot's height

A caption under the weather's, and under the month view's, at a spot
whose own height is counted. Nothing is said anywhere else.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011uFB3EqJLYQ5h3p8Hc6jPq"
```

- [ ] **Step 10: Record it in `CLAUDE.md` and `README.md`**

Seven edits to `CLAUDE.md` and one to `README.md`. Keep clear of the three bullets named in the Global Constraints.

(a) Status section, the bullet that begins "- Built:". It ends "and a link to a point the device already has a spot at opens that spot." Change that ending to:

```
and a link to a point the device already has a spot at opens that spot; then sunset and moonrise worked out from the spot's own height where it is 100 ft up or more and near the sea (`src/data/horizon.ts`), with a caption that says so.
```

(b) Product rules section, directly after the bullet "- Moon phase per day; if moonrise is within 2 hours of sunset, flag it and show the time.", add:

```
- Sun and moon times count the spot's own height where it is 100 ft or more and a tide station is within 25 mi, over a sea-level horizon, and the screen says so. Everywhere else they are for a level horizon, as almanacs give them.
```

(c) Decisions section, the bullet "- Sun and moon times should account for the spot's elevation, after launch (issue 9)." Replace it with:

```
- Sun and moon times should account for the spot's elevation, after launch (issue 9). Built on 2026-10-10 for spots near the sea only; see the question below.
```

(d) Decisions section, the paragraph that begins "Still open with the first user, as of 2026-10-09:". Directly after that paragraph add a blank line and this paragraph:

```
Open with the first user since 2026-10-10: what a spot's height is counted above. He asked for sun and moon times to count the elevation. The app counts it only where the sea is near (a tide station within 25 mi), over a sea-level horizon, because inland the horizon may be as high as the spot: Denver's own height would put its sunset 7 minutes late. The rule is in `src/data/horizon.ts`. He has not been asked whether that is what he meant.
```

(e) Data sources section, the last paragraph, which begins "**Sun and moon** — computed locally with `astronomy-engine`." Add to the end of that paragraph, on the same line:

```
 It is no reference for a height: asked for La Cumbre Peak on 2026-10-10 with `height=0` and with `height=1218` it gave the same times, 18:31 and 07:05. `astronomy-engine` takes the observer's height, and how far that is above the ground it looks out over as the last argument of `SearchRiseSet`; from 3,997 ft it puts sunset 6 to 7 minutes later and moonrise 6 to 7 minutes earlier.
```

(f) Next Steps section, directly after the bullet that begins "- Spots saved before that change have no height of their own.", add:

```
- Sun and moon times count a spot's own height near the sea (issue #9). Waiting for the owner's check, and for the first user's answer on what the height should be counted above. A spot saved before spots had heights stays at a level horizon until it is removed and added again.
```

(g) Next Steps section, the bullet "- The first user: the two questions still open under Decisions (the sunset-hour row, the moon line wording)." Replace it with:

```
- The first user: the three questions still open under Decisions (the sunset-hour row, the moon line wording, what a spot's height is counted above).
```

(h) `README.md`, the bullet that begins "- **Sun and moon:**". Replace it with:

```
- **Sun and moon:** computed in the browser with `astronomy-engine`, and tested against US Naval Observatory times. Where a spot is 100 feet up or more and near the sea, the times are for that height over a sea-level horizon, and the screen says so.
```

Prettier does not check Markdown here (`*.md` is in `.prettierignore`), so read the edits back once in the diff of the two files and make sure nothing else moved.

- [ ] **Step 11: Commit the record**

```bash
git add CLAUDE.md README.md
git commit -m "Record sun and moon times from a spot's height in CLAUDE.md and the README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011uFB3EqJLYQ5h3p8Hc6jPq"
```
