# Wind Arrows and Night Shading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The wind panel draws one small arrow per hour at the hour's speed, pointing where the wind blows, thinned where they would crowd; the words read "10 mph from WSW, gusts 14"; and the hours the sun is down are shaded on all four panels.

**Architecture:** `src/data/astro.ts` gains a day's `night` spans, worked out from the sun's rises and sets with the same observer sunset uses. A new plain module `src/chart/arrows.ts` holds the arrow's angle, calm, and the thinning rule. `src/chart/Panel.tsx` learns to draw bands (a rectangle behind everything) and arrows (a rotated glyph, or a dot), both given as plain data. `src/ui/weatherView.ts` turns the wind series into a list of arrows beside the gust staircase, `src/chart/readout.ts` rewords the wind, `src/ui/selection.ts` turns a day's night into bands, and the two components hand them through. Nothing new is fetched or stored.

**Tech Stack:** Vite, React 19, strict TypeScript, Vitest, `astronomy-engine`, hand-written SVG.

**Spec:** `docs/superpowers/specs/2026-10-12-wind-arrows-and-night-design.md`. Read it first; it says what the user sees and lists the decisions the owner reviews.

## Global Constraints

- Code style: no semicolons, single quotes, relative imports carry their `.ts`/`.tsx` extension, type-only imports use `import type`, no enums. `npm run lint` (oxlint then Prettier) must pass; run `npm run format` before committing.
- Tests run with `TZ=Asia/Tokyo`; nothing may depend on the viewer's time zone.
- Components hold no arithmetic, no rules and no wording. Rules and words go in `src/data/astro.ts`, `src/chart/arrows.ts`, `src/chart/readout.ts`, `src/ui/weatherView.ts`, `src/ui/selection.ts`, each with tests. `Panel.tsx`, `WeatherPanels.tsx` and `SpotScreen.tsx` only arrange what those give them.
- Data modules stay framework-free (no React imports under `src/data/` or in `src/chart/arrows.ts`).
- Words, exactly: the wind readout `9 mph from W` (speed, a space, `from`, a space, the compass point) as one part keyed `wind`; then `gusts 12` keyed `gust`; a calm hour's first part is `Calm`; where there is no speed, the gusts carry the unit (`gusts 12 mph`) and the direction is its own part `from W` with no key. The screen reader's run of words follows from these: `Wind: 9 mph from W, gusts 12; Temperature: 65°F; Sky: 3% cloud, 0% rain`.
- Calm: a speed that rounds to 0 mph (`Math.round(mph) === 0`).
- The arrow is turned half a circle from NWS's direction: `(windDeg + 180) % 360`, in degrees clockwise from up, for SVG `rotate()`. A wind from 270 (W) gives 90 and points right.
- Thinning: with `w` the width of an hour in px and `g` the least distance between arrows, the step is the smallest of 1, 2, 3, 4, 6, 12, 24 that is at least `g / w`; above all of them, 24. An arrow is kept when its hour's index from the start of the span drawn (`Math.floor((t - spanStart) / HOUR)`) is a multiple of the step. Starting sizes: `ARROW_LENGTH = 10` px, `ARROW_GAP = 12` px.
- Night: the parts of the local day the sun is below the horizon, from every rise and set of the sun in the day, by the observer sunset uses (`seenFromFt`). Each time to the nearest minute, as every time in `DayAstro`. The day's start and end are its own local midnights (23, 24 or 25 hours apart). With no rise or set in the day, the whole day is night when the sun's altitude at the middle of the day is below 0°, and none of it otherwise.
- `DayAstro.sunset` and `DayAstro.moonrise` keep their meaning: the first of the day.
- Class names for styling: `band band-night` on the rectangle, `arrow` on the arrow's group, `arrow-dot` on the dot.
- In every tracked file and commit message the first user is "the first user"; no names from `private/`.
- Commit trailer, on every commit, regardless of the model doing the work:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- Node 24. In each shell, before any `npm` or `npx`: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH`. Do not `source` nvm.
- Work only in this worktree (`/Users/nico/src/tideline/.claude/worktrees/feat+wind-arrows`), on the branch `feat/wind-arrows`. No `git stash`, `git reset`, `git checkout` of other branches, or `git clean`. Run each git command as its own plain call with literal arguments (the harness refuses git chained after `cd` or `export`, and heredocs that name git).

## Review Focus

1. A day with two sunsets, as the end of the midnight sun gives (the sun sets just after one midnight and again just before the next), must shade both nights, not the first only. Pinned in Task 1 (the Utqiaġvik walk: every night span is dark at its middle and every gap is light at its middle).
2. The 25-hour day of 1 November 2026 must be shaded to its own end, not to 24 hours after its start. Pinned in Task 1.
3. A stack that has not been measured (hour width 0) must give a finite step and no arrows, never a loop or `NaN`. Pinned in Task 2 (`arrowStep(0)` is 24).
4. Today's forecast starts partway through the day (5 AM), so the hours kept must be counted from the span's start and not from the first hour that exists, or the kept hours would move when a refresh changes the first hour. Pinned in Task 2 (`thinArrows` with hours from index 5 at step 2 keeps the even indexes).
5. A calm hour with a direction must read `Calm` with no `from`, and draw a dot, and an hour with a speed but no direction must read the speed alone and draw a dot at the speed. Pinned in Task 3 (words) and Task 4 (arrows).

---

### Task 1: Sunrise and the night in `DayAstro`

**Files:**
- Modify: `src/data/astro.ts`
- Modify: `src/data/__fixtures__/usno-campus-point.ts`
- Modify: `src/data/astro.test.ts`
- Modify: `src/ui/dayList.test.ts:32-40`, `src/ui/dayList.test.ts:224-231`, `src/ui/tideView.test.ts:93-100`, `src/ui/weatherView.test.ts:23-30` (literal `DayAstro` objects gain `night`)

**Interfaces:**
- Produces: `DayAstro.night: Span[]`, with `Span` as `{ start: number; end: number }` imported as a type from `src/data/cache.ts`. Spans are in order, inside the day, each with `start < end`.

- [ ] **Step 1: Add sunrise to the fixture**

In `src/data/__fixtures__/usno-campus-point.ts`, add `sunrise: string` to `UsnoRow` after `utcOffset`, and give every row its sunrise. These are from the Naval Observatory for Campus Point, fetched on 2026-10-13 from the same API as the sunsets (`https://aa.usno.navy.mil/api/rstt/oneday?date=…&coords=34.4046,-119.8440&tz=-7`), written below in each row's own `utcOffset`: the three November rows use -8, as the file already does for their sunsets, so their sunrises are an hour earlier on the clock than the Observatory's -7 answer (07:20 in -7 is 06:20 in -8). Update the comment at the top to say the file holds sunrise too.

```ts
export interface UsnoRow {
  date: string
  utcOffset: number
  sunrise: string
  sunset: string
  moonrise: string | null
}
```

Sunrises, by date:

```
2026-10-08 06:59
2026-10-09 07:00
2026-10-10 07:01
2026-10-11 07:02
2026-10-12 07:03
2026-10-13 07:03
2026-10-14 07:04
2026-10-15 07:05
2026-10-16 07:06
2026-10-17 07:07
2026-10-18 07:07
2026-10-19 07:08
2026-10-20 07:09
2026-10-21 07:10
2026-10-22 07:11
2026-10-23 07:12
2026-10-24 07:13
2026-10-25 07:13
2026-10-26 07:14
2026-10-27 07:15
2026-10-28 07:16
2026-10-29 07:17
2026-10-30 07:18
2026-10-31 07:19
2026-11-01 06:20
2026-11-02 06:21
2026-11-03 06:22
```

So the first row becomes `{ date: '2026-10-08', utcOffset: -7, sunrise: '06:59', sunset: '18:34', moonrise: '05:00' }`, and the 1 November row `{ date: '2026-11-01', utcOffset: -8, sunrise: '06:20', sunset: '17:06', moonrise: '23:40' }`. The clocks go back at 2 AM on 1 November, so that morning's sunrise is 6:20 AM standard time where the day before was 7:19 AM daylight time: one minute later by the sun, an hour earlier by the clock.

- [ ] **Step 2: Write the failing tests**

In `src/data/astro.test.ts`, add to the imports `import { Body, Equator, Horizon, Observer } from 'astronomy-engine'` and `addDays`, `localDayStart` to the import from `'../time.ts'` (keep `formatTime`). Then:

In the `'against the US Naval Observatory'` block, after the sunset check inside the test (before the moonrise `if`), add:

```ts
      const sunrise = usnoInstant(row.date, row.sunrise, row.utcOffset)
      expect(day.night).toHaveLength(2)
      expect(Math.abs(day.night[0].end - sunrise)).toBeLessThanOrEqual(TOLERANCE)
      expect(Math.abs(day.night[1].start - sunset)).toBeLessThanOrEqual(
        TOLERANCE,
      )
```

and rename that test to `'$date: sunrise, sunset and moonrise agree within 90 seconds'`.

Add a new block:

```ts
describe('night', () => {
  const zone = CAMPUS_POINT.timeZone

  test('midnight to sunrise, and sunset to midnight', () => {
    const day = dayAstro(CAMPUS_POINT, '2026-10-08')
    const start = localDayStart('2026-10-08', zone)
    const end = localDayStart('2026-10-09', zone)
    expect(day.night).toEqual([
      { start, end: day.night[0].end },
      { start: day.sunset!, end },
    ])
    expect(formatTime(day.night[0].end, zone)).toBe('6:59 AM')
    expect(formatTime(day.night[1].start, zone)).toBe('6:34 PM')
  })

  test('the 25-hour day of 1 November is shaded to its own end', () => {
    const day = dayAstro(CAMPUS_POINT, '2026-11-01')
    const end = localDayStart('2026-11-02', zone)
    expect(end - localDayStart('2026-11-01', zone)).toBe(25 * HOUR)
    expect(day.night[1].end).toBe(end)
    // Standard time from 2 AM: the clock reads an hour earlier than the day before.
    expect(formatTime(day.night[0].end, zone)).toBe('6:20 AM')
    expect(formatTime(day.night[1].start, zone)).toBe('5:06 PM')
  })

  test('to the minute, like every time in the record', () => {
    const day = dayAstro(CAMPUS_POINT, '2026-10-08')
    for (const span of day.night) {
      expect(span.start % MINUTE).toBe(0)
      expect(span.end % MINUTE).toBe(0)
    }
  })

  test("from the spot's own height, the night is shorter", () => {
    const peak = spotById('la-cumbre-peak')
    const high = dayAstro(peak, '2026-10-10')
    const flat = dayAstro({ ...peak, elevationFt: null }, '2026-10-10')
    // Sunrise earlier and sunset later, by 5 to 8 minutes each.
    expect(flat.night[0].end - high.night[0].end).toBeGreaterThanOrEqual(
      5 * MINUTE,
    )
    expect(high.night[1].start - flat.night[1].start).toBeGreaterThanOrEqual(
      5 * MINUTE,
    )
  })

  // Utqiaġvik, Alaska, at 71.3° N: polar night in December, midnight sun in
  // June, and in late July and early August a sun that sets just after one
  // midnight and again just before the next.
  const utqiagvik = {
    ...CAMPUS_POINT,
    lat: 71.29,
    lon: -156.79,
    timeZone: 'America/Anchorage',
  }

  test('polar night: the whole day', () => {
    const day = dayAstro(utqiagvik, '2026-12-21')
    expect(day.sunset).toBeNull()
    expect(day.night).toEqual([
      {
        start: localDayStart('2026-12-21', utqiagvik.timeZone),
        end: localDayStart('2026-12-22', utqiagvik.timeZone),
      },
    ])
  })

  test('midnight sun: none of the day', () => {
    const day = dayAstro(utqiagvik, '2026-06-21')
    expect(day.sunset).toBeNull()
    expect(day.night).toEqual([])
  })

  /** The sun's altitude, unrefracted, over a level horizon. */
  function sunAltitude(t: number): number {
    const observer = new Observer(utqiagvik.lat, utqiagvik.lon, 0)
    const eq = Equator(Body.Sun, new Date(t), observer, true, true)
    return Horizon(new Date(t), observer, eq.ra, eq.dec, 'normal').altitude
  }

  test('where the sun sets twice in a day, both nights are shaded: dark at the middle of each span, light between them', () => {
    // The midnight sun ends in the first days of August, with a sunset
    // near 2:30 AM (solar midnight here) that comes earlier each day. Within
    // these three weeks is a day whose first sunset is just after midnight
    // and whose second is just before the next.
    const dates = Array.from({ length: 21 }, (_, i) =>
      addDays('2026-07-28', i),
    )
    let twoSunsets = 0
    for (const date of dates) {
      const start = localDayStart(date, utqiagvik.timeZone)
      const end = localDayStart(addDays(date, 1), utqiagvik.timeZone)
      const { night } = dayAstro(utqiagvik, date)
      // In order, inside the day, each with some length.
      let last = start
      for (const span of night) {
        expect(span.start).toBeGreaterThanOrEqual(last)
        expect(span.end).toBeGreaterThan(span.start)
        expect(span.end).toBeLessThanOrEqual(end)
        last = span.end
      }
      // Dark in the middle of each span, light in the middle of each gap.
      // The sun grazes the horizon here, so only the middles are checked,
      // and only where the span or the gap is over 20 minutes long.
      const edges = [start, ...night.flatMap((s) => [s.start, s.end]), end]
      for (let i = 0; i + 1 < edges.length; i++) {
        const [a, b] = [edges[i], edges[i + 1]]
        if (b - a < 20 * MINUTE) continue
        const dark = i % 2 === 1
        const altitude = sunAltitude((a + b) / 2)
        if (dark) expect(altitude).toBeLessThan(0)
        else expect(altitude).toBeGreaterThan(-1)
      }
      if (night.length === 2 && night[0].start > start) twoSunsets++
    }
    expect(twoSunsets).toBeGreaterThan(0)
  })
})
```

Note the light check allows down to -1°: the app's sunset is the refracted upper limb, which is about 0.8° below the unrefracted centre. If `twoSunsets` is 0, print each date's `night` with `formatTime` in the Anchorage zone and widen the window of dates rather than weaken the check: the pin is for a day with two sunsets.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/data/astro.test.ts`
Expected: FAIL, `day.night` is undefined (and TypeScript complains about `sunrise` on `UsnoRow` until Step 1 is in; Step 1 first).

- [ ] **Step 4: Implement**

In `src/data/astro.ts`:

Add `import type { Span } from './cache.ts'` and `Equator`, `Horizon` to the `astronomy-engine` import. Add to `DayAstro`, after `sunset`:

```ts
  /**
   * The parts of this local day when the sun is below the horizon, in
   * order: usually midnight to sunrise and sunset to midnight. The whole
   * day in polar night, none of it under the midnight sun.
   */
  night: Span[]
```

Add after `riseOrSet`:

```ts
/** Every rise and set of a body between `from` and `to`, in order. */
function riseAndSetTimes(
  body: Body,
  observer: Observer,
  from: number,
  to: number,
): { t: number; direction: number }[] {
  const events: { t: number; direction: number }[] = []
  for (const direction of [RISE, SET]) {
    let at = from
    while (at < to) {
      const t = riseOrSet(body, observer, direction, at, to - at)
      if (t === null) break
      events.push({ t, direction })
      at = t + MINUTE
    }
  }
  return events.sort((a, b) => a.t - b.t)
}

/** Whether the sun is below the horizon at an instant, over a level horizon. */
function sunIsDown(observer: Observer, t: number): boolean {
  const eq = Equator(Body.Sun, new Date(t), observer, true, true)
  return Horizon(new Date(t), observer, eq.ra, eq.dec, 'normal').altitude < 0
}

/**
 * The spans of a day when the sun is down. The sun's rises and sets are
 * walked in order: it is down from the start until the first rise, or from
 * the start if the first event is a rise. A day without either is wholly
 * night or wholly day, by the sun at its middle.
 */
function nightSpans(observer: Observer, start: number, end: number): Span[] {
  const events = riseAndSetTimes(Body.Sun, observer, start, end)
  if (events.length === 0) {
    return sunIsDown(observer, start + (end - start) / 2)
      ? [{ start, end }]
      : []
  }
  const spans: Span[] = []
  let down = events[0].direction === RISE
  let since = start
  for (const event of events) {
    if (event.direction === RISE && down) {
      spans.push({ start: since, end: toMinute(event.t)! })
      down = false
    } else if (event.direction === SET && !down) {
      since = toMinute(event.t)!
      down = true
    }
  }
  if (down) spans.push({ start: since, end })
  return spans
}
```

In `dayAstro`, after the `moonriseNearSunset` block, add `const night = nightSpans(observer, start, end)` and put `night` in the returned object after `sunset`.

- [ ] **Step 5: Give the test literals a `night`**

Each literal `DayAstro` in `src/ui/dayList.test.ts` (two: `tonightWords` and `the words of a row`), `src/ui/tideView.test.ts` (the `day` helper) and `src/ui/weatherView.test.ts` (the `day` helper) gains `night: []` after `sunset`. These tests do not look at it; the type requires it, and `npm run build` type-checks tests.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/data/astro.test.ts src/ui/dayList.test.ts src/ui/tideView.test.ts src/ui/weatherView.test.ts`
Expected: PASS. If the Utqiaġvik walk fails on a particular date, print `night` for that date with `formatTime` in the Anchorage zone and check it by hand against the sun's altitude before changing the rule: the check allows -1° to 0° to pass as light, and a span under 20 minutes is skipped.

- [ ] **Step 7: Build, lint, commit**

Run: `npm run build && npm run lint`
Expected: both clean (the build type-checks the test literals from Step 5).

```bash
git add src/data/astro.ts src/data/__fixtures__/usno-campus-point.ts src/data/astro.test.ts src/ui/dayList.test.ts src/ui/tideView.test.ts src/ui/weatherView.test.ts
git commit -m "A day's night: the spans the sun is down, from its rises and sets" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The arrow's angle, calm, and the thinning rule

**Files:**
- Create: `src/chart/arrows.ts`
- Create: `src/chart/arrows.test.ts`

**Interfaces:**
- Produces:
  - `ARROW_LENGTH = 10`, `ARROW_GAP = 12` (px)
  - `interface Arrow { t: number; v: number; angle: number | null }` — `t` is the instant the arrow is drawn at (the middle of its hour), `v` its value on the panel's axis, `angle` degrees clockwise from up, or null for a dot.
  - `isCalm(mph: number): boolean`
  - `arrowAngle(windDeg: number): number`
  - `arrowStep(hourWidth: number, gap?: number): number`
  - `hourWidth(x: Scale): number`
  - `thinArrows(arrows: Arrow[], spanStart: number, hourWidthPx: number, gap?: number): Arrow[]`

- [ ] **Step 1: Write the failing tests**

`src/chart/arrows.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import {
  ARROW_GAP,
  arrowAngle,
  arrowStep,
  hourWidth,
  isCalm,
  thinArrows,
} from './arrows.ts'
import type { Arrow } from './arrows.ts'
import { linearScale } from './scales.ts'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const START = Date.UTC(2026, 9, 8, 7) // local midnight, 8 October

describe('isCalm', () => {
  test('a speed that rounds to zero', () => {
    expect(isCalm(0)).toBe(true)
    expect(isCalm(0.4)).toBe(true)
    expect(isCalm(0.5)).toBe(false)
    expect(isCalm(3)).toBe(false)
  })
})

describe('arrowAngle', () => {
  // NWS gives where the wind comes from. The arrow points where it goes.
  test('a west wind points right, a north wind points down', () => {
    expect(arrowAngle(270)).toBe(90)
    expect(arrowAngle(0)).toBe(180)
    expect(arrowAngle(180)).toBe(0)
    expect(arrowAngle(45)).toBe(225)
  })

  test('always in 0 to 360', () => {
    expect(arrowAngle(359)).toBe(179)
    expect(arrowAngle(360)).toBe(180)
  })
})

describe('arrowStep', () => {
  test('every hour where an hour is at least the gap wide', () => {
    expect(arrowStep(12)).toBe(1)
    expect(arrowStep(14.7)).toBe(1)
    expect(arrowStep(40)).toBe(1)
  })

  test('the smallest of 1, 2, 3, 4, 6, 12, 24 that is at least the gap over the width', () => {
    expect(arrowStep(11)).toBe(2) // 1.09
    expect(arrowStep(6)).toBe(2) // 2
    expect(arrowStep(5)).toBe(3) // 2.4
    expect(arrowStep(3.5)).toBe(4) // 3.43
    expect(arrowStep(2.5)).toBe(6) // 4.8
    expect(arrowStep(1.5)).toBe(12) // 8
    expect(arrowStep(0.6)).toBe(24) // 20
  })

  test('the gap can be given', () => {
    expect(arrowStep(10, 25)).toBe(3)
  })

  test('an hour narrower than a 24th of the gap, or no width at all, is 24', () => {
    expect(arrowStep(0.1)).toBe(24)
    expect(arrowStep(0)).toBe(24)
  })

  test('the default gap is the one the panel uses', () => {
    expect(arrowStep(ARROW_GAP)).toBe(1)
    expect(arrowStep(ARROW_GAP - 0.01)).toBe(2)
  })
})

describe('hourWidth', () => {
  test('is how many pixels one hour takes on the scale', () => {
    const x = linearScale([START, START + DAY], [0, 353])
    expect(hourWidth(x)).toBeCloseTo(353 / 24, 6)
  })
})

describe('thinArrows', () => {
  const arrow = (index: number): Arrow => ({
    t: START + index * HOUR + HOUR / 2,
    v: 9,
    angle: 90,
  })
  const all = Array.from({ length: 24 }, (_, i) => arrow(i))

  test('keeps every arrow where the hours are wide enough', () => {
    expect(thinArrows(all, START, 14)).toEqual(all)
  })

  test('keeps the hours whose index from the start of the span is a multiple of the step', () => {
    const kept = thinArrows(all, START, 5) // step 3
    expect(kept.map((a) => (a.t - START - HOUR / 2) / HOUR)).toEqual([
      0, 3, 6, 9, 12, 15, 18, 21,
    ])
  })

  test('counts from the span, not from the first arrow, so the same hours keep theirs whichever hours exist', () => {
    // Today's forecast starts at 5 AM.
    const fromFive = all.slice(5)
    const kept = thinArrows(fromFive, START, 6) // step 2
    expect(kept.map((a) => (a.t - START - HOUR / 2) / HOUR)).toEqual([
      6, 8, 10, 12, 14, 16, 18, 20, 22,
    ])
  })

  test('keeps nothing of nothing, and does not mind an hour of no width', () => {
    expect(thinArrows([], START, 14)).toEqual([])
    expect(thinArrows(all, START, 0)).toEqual([arrow(0)])
  })

  test('a span of several days thins the same way', () => {
    const week = Array.from({ length: 7 * 24 }, (_, i) => arrow(i))
    const kept = thinArrows(week, START, 2) // step 6
    expect(kept).toHaveLength(28)
    expect(kept[1].t).toBe(START + 6 * HOUR + HOUR / 2)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/chart/arrows.test.ts`
Expected: FAIL, cannot find module `./arrows.ts`.

- [ ] **Step 3: Implement**

`src/chart/arrows.ts`:

```ts
// The wind's arrows: one per hour, at the hour's speed, pointing where the
// wind is going. Plain functions, so the thinning rule has tests and is
// ready for a panel that shows more than a day.

import { HOUR } from '../time.ts'
import type { Scale } from './scales.ts'

/** How long an arrow is drawn, in px. */
export const ARROW_LENGTH = 10
/** The least distance between arrows, in px. Closer than this they are thinned. */
export const ARROW_GAP = 12

/** The steps the thinning can take, in hours. */
const STEPS = [1, 2, 3, 4, 6, 12, 24]

export interface Arrow {
  /** The instant it is drawn at: the middle of its hour. */
  t: number
  /** Its place on the panel's axis: the hour's wind speed. */
  v: number
  /** Degrees clockwise from up, or null for a dot: calm, or no direction. */
  angle: number | null
}

/** A speed that rounds to 0 mph. */
export function isCalm(mph: number): boolean {
  return Math.round(mph) === 0
}

/**
 * The way an arrow points, in degrees clockwise from up. NWS gives where
 * the wind comes from; the arrow is turned half a circle from it.
 */
export function arrowAngle(windDeg: number): number {
  return (windDeg + 180) % 360
}

/**
 * How many hours apart the arrows are drawn: the smallest step that keeps
 * them at least `gap` apart, from the steps that divide a day. An hour of
 * no width, before the panel is measured, takes the largest.
 */
export function arrowStep(hourWidth: number, gap = ARROW_GAP): number {
  const need = gap / hourWidth
  return STEPS.find((step) => step >= need) ?? STEPS[STEPS.length - 1]
}

/** How many pixels one hour takes on a time scale. */
export function hourWidth(x: Scale): number {
  return x(HOUR) - x(0)
}

/**
 * The arrows that keep their place: those whose hour, counted from the
 * start of the span drawn, is a multiple of the step. Counting from the
 * span and not from the first arrow keeps the same hours as the forecast's
 * first hour changes.
 */
export function thinArrows(
  arrows: Arrow[],
  spanStart: number,
  hourWidthPx: number,
  gap = ARROW_GAP,
): Arrow[] {
  const step = arrowStep(hourWidthPx, gap)
  if (step === 1) return arrows
  return arrows.filter(
    (arrow) => Math.floor((arrow.t - spanStart) / HOUR) % step === 0,
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/chart/arrows.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

Run: `npm run lint`

```bash
git add src/chart/arrows.ts src/chart/arrows.test.ts
git commit -m "The arrow's angle, calm, and the thinning rule" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The wind in words: "9 mph from W, gusts 12"

**Files:**
- Modify: `src/chart/readout.ts:151-170`
- Modify: `src/chart/readout.test.ts:208-243`
- Modify: `src/ui/weatherView.test.ts` (the three expectations that spell the wind's words: lines 174-178, 201-203, 212-214, 249-252)

**Interfaces:**
- Consumes: `isCalm` from `src/chart/arrows.ts`, `compassPoint` from `src/data/nws.ts`.
- Produces: `windParts(hour: ForecastHour | null): ReadoutPart[]` with the words in Global Constraints.

- [ ] **Step 1: Change the tests**

In `src/chart/readout.test.ts`, replace the `describe('windParts', …)` block with:

```ts
  describe('windParts', () => {
    test('the speed and where it comes from as one part, then the gusts', () => {
      const parts = windParts(hour(NOON))
      expect(parts).toEqual([
        { key: 'wind', text: '9 mph from W' },
        { key: 'gust', text: 'gusts 12' },
      ])
      expect(partsText(parts)).toBe('9 mph from W, gusts 12')
    })

    test('leaves out what the forecast does not have', () => {
      expect(partsText(windParts(hour(NOON, { gustMph: null })))).toBe(
        '9 mph from W',
      )
      expect(partsText(windParts(hour(NOON, { windDeg: null })))).toBe(
        '9 mph, gusts 12',
      )
    })

    test('with no speed, the gusts carry the unit and the direction stands alone', () => {
      expect(windParts(hour(NOON, { windMph: null }))).toEqual([
        { key: 'gust', text: 'gusts 12 mph' },
        { key: null, text: 'from W' },
      ])
    })

    test('calm is the word, with no direction, and the gusts carry the unit', () => {
      expect(windParts(hour(NOON, { windMph: 0.4, gustMph: 3 }))).toEqual([
        { key: 'wind', text: 'Calm' },
        { key: 'gust', text: 'gusts 3 mph' },
      ])
      expect(partsText(windParts(hour(NOON, { windMph: 0, gustMph: 0 })))).toBe(
        'Calm, gusts 0 mph',
      )
      expect(partsText(windParts(hour(NOON, { windMph: 0, gustMph: null })))).toBe(
        'Calm',
      )
    })

    test('no hour, or an hour with no wind at all, is no parts', () => {
      expect(windParts(null)).toEqual([])
      expect(windParts(NOTHING)).toEqual([])
    })
  })
```

In `src/ui/weatherView.test.ts`:
- In `'the forecast hour that contains the cursor'`, the wind readout becomes `[{ key: 'wind', text: '9 mph from W' }, { key: 'gust', text: 'gusts 12' }]`.
- In `'says it all in one run of words…'`, the string becomes `'Wind: 9 mph from W, gusts 12; Temperature: 65°F; Sky: 3% cloud, 0% rain'`.
- In `'a panel with nothing to say is still named…'`, the string becomes `'Wind: 9 mph from W, gusts 12; Temperature: No forecast here; Sky: 3% cloud, 0% rain'`.
- In `'an hour with only some values reads out those…'`, the wind readout becomes `[{ key: 'wind', text: '9 mph from W' }]`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/chart/readout.test.ts src/ui/weatherView.test.ts`
Expected: FAIL on the wind words.

- [ ] **Step 3: Implement**

In `src/chart/readout.ts`, add `import { isCalm } from './arrows.ts'` and replace `windParts` with:

```ts
/**
 * The wind in an hour: '9 mph from W', then 'gusts 12'. The words say where
 * the wind comes from; the arrow on the panel points where it goes. A calm
 * hour is 'Calm', with no direction. Each part is there only if the
 * forecast has it, and the unit is given once, by the first number.
 */
export function windParts(hour: ForecastHour | null): ReadoutPart[] {
  if (!hour) return []
  const parts: ReadoutPart[] = []
  const from = hour.windDeg === null ? null : `from ${compassPoint(hour.windDeg)}`
  let unitGiven = false
  if (hour.windMph !== null) {
    if (isCalm(hour.windMph)) {
      parts.push({ key: 'wind', text: 'Calm' })
    } else {
      const speed = `${whole(hour.windMph)} mph`
      parts.push({ key: 'wind', text: from ? `${speed} ${from}` : speed })
      unitGiven = true
    }
  }
  if (hour.gustMph !== null) {
    const unit = unitGiven ? '' : ' mph'
    parts.push({ key: 'gust', text: `gusts ${whole(hour.gustMph)}${unit}` })
  }
  if (hour.windMph === null && from) parts.push({ key: null, text: from })
  return parts
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/chart/readout.test.ts src/ui/weatherView.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

Run: `npm run lint`

```bash
git add src/chart/readout.ts src/chart/readout.test.ts src/ui/weatherView.test.ts
git commit -m "The wind reads 9 mph from W, gusts 12, and Calm" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The wind panel's arrows in `weatherView`

**Files:**
- Modify: `src/ui/weatherView.ts`
- Modify: `src/ui/weatherView.test.ts`

**Interfaces:**
- Consumes: `Arrow`, `arrowAngle`, `isCalm` from `src/chart/arrows.ts`.
- Produces: `WeatherPanelView.arrows: Arrow[]`, one per hour on screen that has a wind speed, for the wind panel; `[]` for temperature and sky. The wind panel's `series` is the gust staircase alone. `bounds`, `rules`, `dots` and `readout` are as before.

- [ ] **Step 1: Write the failing tests**

In `src/ui/weatherView.test.ts`, in `'what is drawn'`:

Change `'one staircase per value, over the hours of the day on screen'`: the wind's series names become `['gust']` and its last line `expect(view.wind.series[1].points[0])` becomes `expect(view.wind.series[0].points[0]).toEqual({ t: FIRST, v: 12 })`. Rename the test `'one staircase per value but the wind, over the hours of the day on screen'`.

Change `'an hour with no value for one thing is left out of that line only'`: its last line, `expect(view.wind.series[0].points.map(...)).toContain(gap)`, becomes `expect(view.wind.arrows.map((arrow) => arrow.t)).toContain(gap + HOUR / 2)`.

Add:

```ts
  test('the wind is an arrow per hour, at the middle of the hour, at its speed, pointing where it goes', () => {
    const view = weatherView(week, day(0), NOW, NOW)
    expect(view.wind.arrows).toHaveLength(19)
    // A wind from the west (270) points right (90).
    expect(view.wind.arrows[0]).toEqual({ t: FIRST + HOUR / 2, v: 9, angle: 90 })
    expect(view.wind.arrows.at(-1)!.t).toBe(END - HOUR / 2)
    expect(view.temp.arrows).toEqual([])
    expect(view.sky.arrows).toEqual([])
  })

  test('a calm hour is a dot, and so is an hour with no direction', () => {
    const calmAtTen = START + 10 * HOUR
    const blindAtEleven = START + 11 * HOUR
    const patchy = loaded(
      hourly(FIRST, 185, (hour) => {
        if (hour.t === calmAtTen) hour.windMph = 0.3
        if (hour.t === blindAtEleven) hour.windDeg = null
      }),
    )
    const arrows = weatherView(patchy, day(0), NOW, NOW).wind.arrows
    expect(arrows.find((a) => a.t === calmAtTen + HOUR / 2)).toEqual({
      t: calmAtTen + HOUR / 2,
      v: 0.3,
      angle: null,
    })
    expect(arrows.find((a) => a.t === blindAtEleven + HOUR / 2)).toEqual({
      t: blindAtEleven + HOUR / 2,
      v: 9,
      angle: null,
    })
  })

  test('an hour with no speed has no arrow', () => {
    const noSpeed = START + 12 * HOUR
    const patchy = loaded(
      hourly(FIRST, 185, (hour) => {
        if (hour.t === noSpeed) hour.windMph = null
      }),
    )
    const view = weatherView(patchy, day(0), NOW, NOW)
    expect(view.wind.arrows).toHaveLength(18)
    expect(view.wind.arrows.map((a) => a.t)).not.toContain(noSpeed + HOUR / 2)
    // The gust line and the range do not change.
    expect(view.wind.series[0].points).toHaveLength(19)
    expect(view.wind.bounds).toEqual([0, 20])
  })
```

In `'when the panels are not drawn'`, extend the `blank` helper so it also requires `panel.arrows.length === 0`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/weatherView.test.ts`
Expected: FAIL, `arrows` is undefined.

- [ ] **Step 3: Implement**

In `src/ui/weatherView.ts`:

Add `import { arrowAngle, isCalm } from '../chart/arrows.ts'` and `import type { Arrow } from '../chart/arrows.ts'`.

Add to `WeatherPanelView`, after `series`:

```ts
  /** The wind panel's arrows, one per hour that has a speed. None elsewhere. */
  arrows: Arrow[]
```

Change `WIND` to draw only the gusts:

```ts
const WIND: PanelSpec = {
  title: 'Wind',
  // The wind's speed is drawn as arrows, not a line; see `windArrows`.
  fields: [['gust', 'gustMph']],
  every: 10,
  unit: ' mph',
}
```

Give `panel()` a sixth parameter `arrows: Arrow[] = []` and put `arrows` in the returned object after `series`. Add:

```ts
/**
 * One arrow per hour that has a wind speed, drawn at the middle of its hour
 * at that speed, pointing where the wind is going. A calm hour, or one with
 * no direction, is a dot.
 */
function windArrows(hours: ForecastHour[]): Arrow[] {
  return hours.flatMap((hour) => {
    if (hour.windMph === null) return []
    const angle =
      hour.windDeg === null || isCalm(hour.windMph)
        ? null
        : arrowAngle(hour.windDeg)
    return [{ t: hour.t + HOUR / 2, v: hour.windMph, angle }]
  })
}
```

In `weatherView`, the wind panel becomes `panel(WIND, windParts(at), windBounds, hours, at, windArrows(hours))`. The dots are unchanged: `panel()` builds them from `spec.fields`, so add the wind's dot by hand. Replace the `dots` loop in `panel()` with one that takes the dot fields separately: give `PanelSpec` a `dots: [name: string, field: Field][]` and use it for the dots, keeping `fields` for the staircases. `WIND.dots` is `[['wind', 'windMph'], ['gust', 'gustMph']]`; `TEMP.dots` is `[['temp', 'tempF']]`; `SKY.dots` is `[['cloud', 'cloudPct'], ['rain', 'rainPct']]`.

```ts
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
```

and in `panel()`:

```ts
  const dots: Dot[] = []
  for (const [name, field] of spec.dots) {
    const v = at ? at[field] : null
    if (v !== null) dots.push({ name, v })
  }
```

The vertical range stays `steppedBounds([0, ...values(all, ['windMph', 'gustMph'])], 10)`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/ui/weatherView.test.ts`
Expected: PASS, including the unchanged `'a dot for each value that hour has'`.

- [ ] **Step 5: Lint and commit**

Run: `npm run lint`

```bash
git add src/ui/weatherView.ts src/ui/weatherView.test.ts
git commit -m "The wind panel's view: arrows per hour beside the gust staircase" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The day's night as bands

**Files:**
- Modify: `src/chart/Panel.tsx:20-24` (the `Band` type only; Task 6 draws it)
- Modify: `src/ui/selection.ts`
- Modify: `src/ui/selection.test.ts`

**Interfaces:**
- Produces: `interface Band { name: string; start: number; end: number }` exported from `src/chart/Panel.tsx` beside `Marker`, `Rule` and `Dot`, and `dayBands(selected: Selected): Band[]` in `selection.ts`, one band named `night` per span of `selected.astro.night`.

- [ ] **Step 1: Write the failing tests**

In `src/ui/selection.test.ts`, add `dayBands` to the import from `./selection.ts` and `localDayStart` to the import from `'../time.ts'`, then:

```ts
describe('dayBands', () => {
  test('a night band before sunrise and one after sunset', () => {
    const today = selectedDay(frame, null)
    const bands = dayBands(today)
    expect(bands).toEqual([
      { name: 'night', start: frame.day.start, end: today.astro.night[0].end },
      { name: 'night', start: today.astro.sunset, end: frame.day.end },
    ])
    expect(bands[0].end).toBe(
      localDayStart('2026-10-08', CAMPUS_POINT.timeZone) + 6 * HOUR + 59 * MINUTE,
    )
  })

  test('a day with no night has no band', () => {
    const polar = {
      days: [{ ...frame.days[0], night: [] }],
      spans: [frame.spans[0]],
    }
    expect(dayBands(selectedDay(polar, null))).toEqual([])
  })
})
```

Add `const MINUTE = 60_000` near the top (the file has `HOUR` from `'../time.ts'`; import `MINUTE` from there instead).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/selection.test.ts`
Expected: FAIL, `dayBands` is not exported.

- [ ] **Step 3: Implement**

In `src/chart/Panel.tsx`, after the `Marker` interface, add:

```ts
/** A span of time shaded across the plot, behind everything. Its class is `band-<name>`. */
export interface Band {
  name: string
  start: number
  end: number
}
```

In `src/ui/selection.ts`, add `import type { Band } from '../chart/Panel.tsx'` and:

```ts
/** The spans to shade across every panel: the parts of the day the sun is down. */
export function dayBands(selected: Selected): Band[] {
  return selected.astro.night.map((span) => ({ name: 'night', ...span }))
}
```

Update the file's header comment to: `// Which of the 14 days is on screen, the vertical lines drawn across its panels and the spans shaded on them. Plain functions.`

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/ui/selection.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

Run: `npm run lint`

```bash
git add src/chart/Panel.tsx src/ui/selection.ts src/ui/selection.test.ts
git commit -m "The day's night as bands for the panels" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Draw the bands and the arrows

**Files:**
- Modify: `src/chart/Panel.tsx`
- Modify: `src/ui/WeatherPanels.tsx`
- Modify: `src/ui/SpotScreen.tsx:58,158-195`
- Modify: `src/styles.css:307-333,367-389` (and the colour tokens at the top)

**Interfaces:**
- Consumes: `Band` from `src/chart/Panel.tsx` and `dayBands` from `src/ui/selection.ts` (Task 5); `Arrow`, `ARROW_LENGTH`, `hourWidth`, `thinArrows` from `src/chart/arrows.ts` (Task 2); `WeatherPanelView.arrows` (Task 4).
- Produces: `Panel` props `bands: Band[]` (required) and `arrows?: Arrow[]` (default `[]`). `WeatherPanels` props `start: number` and `bands: Band[]`.

No unit tests: components are checked in a browser (Task 7). `npm run build` type-checks them.

- [ ] **Step 1: Panel draws bands first and arrows after the series**

In `src/chart/Panel.tsx`:

Add `import { ARROW_LENGTH } from './arrows.ts'` and `import type { Arrow } from './arrows.ts'`. `Band` is already in this file from Task 5.

Add to `PanelProps`, after `series`:

```ts
  /** Spans shaded behind everything, such as the night. */
  bands: Band[]
  /** One small arrow per instant, at a value, turned to an angle; a dot where there is no angle. */
  arrows?: Arrow[]
```

Destructure `bands` and `arrows = []`. Inside the `<svg>`, before the series, draw the bands:

```tsx
        {bands.map((band) => (
          <rect
            key={`${band.name}-${band.start}`}
            className={`band band-${band.name}`}
            x={x(band.start)}
            y={0}
            width={x(band.end) - x(band.start)}
            height={height}
          />
        ))}
```

After the series and before the rules, draw the arrows. The glyph is `ARROW_LENGTH` tall, drawn pointing up and turned by its angle; its shaft runs through the point, so the arrow is centred on the value:

```tsx
        {arrows.map((arrow) =>
          arrow.angle === null ? (
            <circle
              key={arrow.t}
              className="arrow-dot"
              cx={x(arrow.t)}
              cy={y(arrow.v)}
              r={2}
            />
          ) : (
            <g
              key={arrow.t}
              className="arrow"
              transform={`translate(${x(arrow.t).toFixed(1)} ${y(arrow.v).toFixed(1)}) rotate(${arrow.angle})`}
            >
              <path d={ARROW_PATH} />
            </g>
          ),
        )}
```

with, at module level:

```ts
// An arrow pointing up, centred on the origin: a shaft and two barbs.
const HALF = ARROW_LENGTH / 2
const ARROW_PATH = `M0,${HALF}V${-HALF}M${-3.5},${-HALF + 3.5}L0,${-HALF}L3.5,${-HALF + 3.5}`
```

Update the comment on the component to mention bands and arrows.

- [ ] **Step 2: WeatherPanels thins the arrows and hands the bands through**

In `src/ui/WeatherPanels.tsx`, add `import { hourWidth, thinArrows } from '../chart/arrows.ts'` and `Band` to the type import from `'../chart/Panel.tsx'`. Add to the props:

```ts
  /** The instant the day drawn begins, which the thinning counts hours from. */
  start: number
  bands: Band[]
```

and in `panel()` pass `bands={bands}` and `arrows={thinArrows(one.arrows, start, hourWidth(x))}` to `Panel`. Add a comment on the arrows line: `// Fewer arrows where an hour is narrower than the gap between them.`

- [ ] **Step 3: SpotScreen hands the bands to the tide panel and the weather panels**

In `src/ui/SpotScreen.tsx`: import `dayBands` beside `dayMarkers` and `selectedDay`. After `const markers = dayMarkers(selected, data.now)` add `const bands = dayBands(selected)`. Pass `bands={bands}` to the tide `Panel`, and to `WeatherPanels` add `start={selected.span.start}` and `bands={bands}`.

- [ ] **Step 4: Styles**

In `src/styles.css`:

Add a token to `:root`, after `--moon`:

```css
  /* The night, laid over the panels. Ink at low strength by day; by night,
     darker than the ground, which is already dark. */
  --night: rgb(18 34 46 / 0.07);
```

and in the dark `:root` block, after `--moon`:

```css
    --night: rgb(0 0 0 / 0.28);
```

After the `.series-gust .line, .series-rain .line` rule, add:

```css
/* The night, behind everything. */
.band-night {
  fill: var(--night);
}

/* The wind: one arrow per hour, pointing where the wind is going. A dot
   where it is calm or the forecast gives no direction. */
.arrow path {
  fill: none;
  stroke: var(--ink);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.arrow-dot {
  fill: var(--ink);
}
```

Remove `.series-wind .line,` from the `.series-wind .line, .series-temp .line, .series-cloud .line` selector (no wind line is drawn now). Keep `.key-wind` and `.dot-wind`.

- [ ] **Step 5: Build, test, lint**

Run: `npm run build && npm test && npm run lint`
Expected: all clean. The build's type check is the test of the three components.

- [ ] **Step 6: Commit**

```bash
git add src/chart/Panel.tsx src/ui/WeatherPanels.tsx src/ui/SpotScreen.tsx src/styles.css
git commit -m "Arrows on the wind panel and the night shaded on every panel" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Browser check

**Files:** none changed unless the check finds something; screenshots go in `docs/superpowers/plans/assets/` only if Task 8 wants them.

Run the dev server in the worktree (`npm run dev`, which answers at http://localhost:5173 or the next free port; read the port from its output) and drive a browser at 390 × 844 with the Playwright tools (`mcp__playwright__browser_*`; load them with ToolSearch first) or Claude in Chrome. Live NWS and NOAA are needed. Record each step's result in the task's report; on a failure, fix the code in the task that owns it and commit.

- [ ] **Step 1: Arrows.** Open the page on Campus Point. Take a screenshot. Pass: in the Wind panel a row of small arrows, one per hour of the forecast, at different heights where the speed changes, and the gust staircase in the muted colour above them; no solid line for the wind. Fail: a wind line, or no arrows.
- [ ] **Step 2: Direction.** Click in the Wind panel at an hour whose readout says "from W" or "from WNW" (the afternoon sea breeze at Campus Point usually does). Pass: the words read like "10 mph from W, gusts 14", and the arrow under the cursor points to the right. If every hour says something else, use the compass point given: a wind "from S" points up, "from E" points left.
- [ ] **Step 3: One mark per hour.** Run `document.querySelectorAll('.panel-plot .arrow, .panel-plot .arrow-dot').length` in the console. Pass: between 1 and 24, and one mark for each hour of today the gust staircase covers (count its steps, or compare with the number of hours from the forecast's first hour today to 11 PM). Where an hour is calm or has no direction, its mark is a dot, at the foot when calm.
- [ ] **Step 4: Night on all four panels.** Scroll the panels into view. Pass: the tide, wind, temperature and sky panels each show a shaded band from the left edge to the morning and from the sunset line to the right edge, the second beginning exactly at the ember sunset line. Fail: a panel without the shade, or a shade that starts elsewhere.
- [ ] **Step 5: Both schemes.** With `mcp__playwright__browser_emulate_media` set `colorScheme` to `dark`, then screenshot. Pass: the shade reads as night on the dark ground, the arrows are light on dark. Set it back to `light`.
- [ ] **Step 6: La Cumbre Peak.** Choose La Cumbre Peak. Pass: no tide panel; the three weather panels shaded; arrows present.
- [ ] **Step 7: Another day.** Tap the row for a day three days out. Pass: 24 arrows (or fewer where NWS has no speed), the night bands at that day's own sunrise and sunset.
- [ ] **Step 8: Thinning.** Resize the window to 320 × 844 (`mcp__playwright__browser_resize`). Pass: still arrows, with none closer than about 12 px; if the plot is narrower than 288 px, every second hour. Resize back to 390.
- [ ] **Step 9: Wide window.** Resize to 1280 × 800. Pass: the panels in the left column with arrows and bands as before.
- [ ] **Step 10: Screen reader words.** Read the stack's `aria-valuetext` (`document.querySelector('.stack').getAttribute('aria-valuetext')`). Pass: contains `Wind: ` followed by words like `10 mph from W, gusts 14`.
- [ ] **Step 11: Commit any fix**, with the trailer, naming what the check found.

---

### Task 8: Docs

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-10-12-wind-arrows-and-night-design.md:3`

- [ ] **Step 1: Status.** In the "Status" section's "Built:" bullet, after `and the moon line in tonight's strip as "Moonrise 5:00 AM".` at its end, add: ` Then the wind as an arrow per hour (`src/chart/arrows.ts`), at the hour's speed and pointing where the wind is going, thinned where an hour is narrower than 12 px, with the words "10 mph from WSW, gusts 14" and "Calm"; and the night, from sunset to sunrise by the horizon sunset uses, shaded on all four panels (`night` in `DayAstro`, `dayBands` in `src/ui/selection.ts`).` In the same section's "Approved and specified" bullet, change `Issue 54, edit and remove a saved spot and the moon line as "Moonrise 5:00 AM", is built (above). Not built: issue 55, wind as an arrow per hour, and night shaded on every panel; issue 56` to `Issues 54 (edit and remove a saved spot, the moon line) and 55 (wind arrows, night shading) are built (above). Not built: issue 56`.

- [ ] **Step 2: Stack.** Replace the bullet `- Weather is drawn as staircases, level across the hour each value is forecast for, so the line, the cursor's dot and the words always agree.` with: `- Weather is drawn as staircases, level across the hour each value is forecast for, so the line, the cursor's dot and the words always agree. The wind's speed is the exception: an arrow at the middle of each hour, at the hour's speed, pointing where the wind is going, and a dot where it is calm or has no direction; the gusts stay a staircase. The arrows are thinned to every second, third, fourth, sixth or twelfth hour where an hour is narrower than the gap between them (`src/chart/arrows.ts`), which is built for a panel that shows more than a day. The night is a band behind every panel, by the sun's rises and sets over the horizon sunset uses.` Add `src/chart/arrows.ts` to the list of plain modules in the "Components hold no arithmetic" bullet, after `src/chart/`.

- [ ] **Step 3: Next Steps.** Replace the bullet `- Issue 54 (edit and remove a saved spot, the moon line) is built on `feat/edit-spots`, waiting for the owner's review of the pull request and his phone check on production. Next are issue 55 (wind arrows, night shading) and issue 56 (observed weather today), in that order, each its own pull request, from their specs in `docs/superpowers/specs/`.` with: `- Issue 54 (edit and remove a saved spot, the moon line) was merged on 2026-10-13 (pull request 58); its phone check on production is still to run. Issue 55 (wind arrows, night shading) is built on `feat/wind-arrows`, waiting for the owner's review of the pull request and his check on production. Next is issue 56 (observed weather today), its own pull request, from its spec in `docs/superpowers/specs/`.`

- [ ] **Step 4: The spec's status line.** In the spec, change `Status: approved by the owner on 2026-10-12 as the second of three pieces of this stage, before anything was built.` to `Status: approved by the owner on 2026-10-12 as the second of three pieces of this stage; built on 2026-10-13 from `docs/superpowers/plans/2026-10-13-wind-arrows-and-night.md`.`

- [ ] **Step 5: Lint and commit**

Run: `npm run lint`

```bash
git add CLAUDE.md docs/superpowers/specs/2026-10-12-wind-arrows-and-night-design.md
git commit -m "Record wind arrows and night shading as built" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
