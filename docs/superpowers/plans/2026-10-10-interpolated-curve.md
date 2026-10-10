# Interpolated Tide Curve Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tide curve, cursor readout and caption for a spot whose nearest NOAA station publishes highs and lows only, interpolated with a cosine between consecutive extremes and labelled "interpolated" wherever it is on screen.

**Architecture:** The same as the rest of the app: thin React components over plain modules, with every rule, every piece of arithmetic and every word in a plain function that has tests. A station says which kind it is (`Station.type`). For a subordinate station the predictions loader is never asked to fetch, and `predictions` is derived from the highs and lows by a new framework-free module `src/data/interpolate.ts`. Everything downstream takes `predictions` as it always has; only the readout's word and the caption's sentence change. The highs and lows are fetched from the day before today, for every station, so the curve over today's first hours has an extreme to start from. No component changes.

**Tech Stack:** React 19, TypeScript 6.0, Vite 8, Vitest 5, oxlint, Prettier. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-10-interpolated-curve-design.md`. Issue: https://github.com/nicolovejoy/tideline/issues/5.

**Scope:** One pull request on the branch `stage-2/interpolated-curve`, which already holds the spec and four fixtures in `src/data/__fixtures__/` (`noaa-predictions-9411340-20261010-20261023.json`, `noaa-hilo-9411340-20261009-20261024.json`, `noaa-hilo-9411189-20261009-20261024.json`, `noaa-predictions-9411189-error.json`). No shipped spot changes: the three spots all sit nearest a harmonic station. Nothing from other issues: no new spots (#4), no URL (#7).

## Global Constraints

- **Node 24 for every `npm`, `npx` and `node` command.** In a fresh shell run `source ~/.nvm/nvm.sh && nvm use` first.
- **Public repo, no personal details.** Tracked files, commit messages and pull requests never name people. Write "the first user" and "the owner". Never copy anything out of `private/`.
- **Commit identity.** `git config user.email` must end in `users.noreply.github.com`.
- **Commit trailer.** End every commit message with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **Code style is the Vite template's:** no semicolons, single quotes, relative imports carry their `.ts` or `.tsx` extension, type-only imports use `import type`, no enums. Run `npm run format` before every commit.
- **Lint must print no problems.** `npm run lint` runs oxlint with warnings denied, then a Prettier check.
- **No new dependencies.**
- **Times:** every stored or computed time is a UTC instant in epoch milliseconds. Only `src/time.ts` converts to a zone. Nothing reads the viewer's zone. Tests run with the device in Tokyo (`TZ=Asia/Tokyo` in `vite.config.ts`).
- **Components hold no arithmetic, no rules and no wording.** Those live in plain modules with tests. This plan touches no component.
- **Units:** feet above MLLW to one decimal, never "-0.0" (`feet` in `src/chart/readout.ts` already does this); 12-hour clock.
- **Data, not a verdict.** No scores, no go/no-go, no alerts.
- **The word is "interpolated".** The readout says "3.2 ft interpolated"; the caption says "highs and lows only. Curve interpolated between them, not NOAA's." Nowhere else changes its words.
- **Do not merge.** The last task opens the pull request and stops.
- **Every task ends green:** `npm test`, `npm run lint` and `npm run build` all pass before its commit.

## Review Focus

1. **A cursor step before the first high or low in the data, or after the last**, as at the plot's edge when the highs and lows stop short: no point is made up, the readout says "No prediction here", nothing throws. Pinned in Task 2 (`interpolateCurve` "leaves out steps before the first event and after the last").
2. **Highs and lows that are still loading, failed, or saved from before**: the derived curve carries that status and stamp, so the panel says "Loading tides" or "Tide data unavailable" and the caption reports the failure once, through the highs-and-lows sentence. Pinned in Task 2 (`curveFromHiLo`) and Task 5 (`tideCaption` stale and unavailable at a subordinate station).
3. **Two events at the same instant, or an unsorted list**: no division by zero, no NaN on the plot. Pinned in Task 2 (`interpolateCurve` "events out of order are sorted" and "two events at one instant make no point").
4. **The three shipped spots draw exactly what they drew**: harmonic stations still fetch their curve and say "predicted". Pinned in Task 1 (every shipped station is harmonic), Task 3 (predictions still fetched for a harmonic station) and Task 4 (the existing `tideWords` tests pass unchanged).
5. **The day the clocks go back, 1 November 2026, at the span's start**: the highs and lows' needed span begins at yesterday's local midnight, not 24 hours before today's. Pinned in Task 3 (`frameFor` on 2 November 2026: `hiloSpan.start` is 25 hours before `day.start`).

## File Structure

- `src/spot.ts` (modify): `Station.type`, the three shipped stations marked `'harmonic'`, `hasOwnCurve(spot)`.
- `src/data/interpolate.ts` (create): `interpolateCurve(events, span)` and `curveFromHiLo(hilo, span)`. Framework-free, imports only types and `MINUTE`.
- `src/data/useSpotData.ts` (modify): `frameFor` adds `hiloSpan`; `tideSpecs` uses it; `useSpotData` fetches predictions only where `hasOwnCurve` and derives them otherwise.
- `src/chart/readout.ts` (modify): `tideWords(readout, curve)`.
- `src/ui/tideView.ts` (modify): passes the curve's word.
- `src/ui/captions.ts` (modify): the station sentence at a subordinate station.
- `src/data/__fixtures__/README.md` (modify): the four new fixtures.
- `CLAUDE.md` (modify): status and the data-sources line about subordinate stations.
- Tests beside each module: `src/spot.test.ts`, `src/data/interpolate.test.ts` (create), `src/data/noaa.test.ts`, `src/data/useSpotData.test.ts`, `src/chart/readout.test.ts`, `src/ui/tideView.test.ts`, `src/ui/captions.test.ts`.

---

### Task 1: Each station says whether it has a curve

**Files:**
- Modify: `src/spot.ts`
- Test: `src/spot.test.ts`

**Interfaces:**
- Produces: `Station.type: 'harmonic' | 'subordinate'`; `hasOwnCurve(spot: Spot): boolean`, true when `spot.tideStation.type === 'harmonic'`. Later tasks build test spots as `{ ...spotById('gaviota'), tideStation: { ...spotById('gaviota').tideStation, type: 'subordinate' } }`.

- [ ] **Step 1: Write the failing tests**

Add to `src/spot.test.ts`, inside `describe('the spots', ...)` after the La Cumbre Peak test, and add `hasOwnCurve` to the import from `./spot.ts`:

```ts
  test('every shipped station is harmonic, so each spot has its own curve', () => {
    // Verified against NOAA's station metadata on 2026-10-10: 9411340 and
    // 9411399 are type R. Subordinate stations arrive with #4.
    for (const spot of SPOTS) {
      expect(spot.tideStation.type).toBe('harmonic')
      expect(spot.gauge.type).toBe('harmonic')
      expect(hasOwnCurve(spot)).toBe(true)
    }
  })

  test('a spot at a subordinate station has no curve of its own', () => {
    const gaviota = spotById('gaviota')
    const ventura = {
      ...gaviota,
      tideStation: { ...gaviota.tideStation, type: 'subordinate' as const },
    }
    expect(hasOwnCurve(ventura)).toBe(false)
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/spot.test.ts`
Expected: FAIL. The first fails on `expect(spot.tideStation.type).toBe('harmonic')` with `undefined`; the second with "hasOwnCurve is not a function" (or a type error from the import).

- [ ] **Step 3: Add the type and the function**

In `src/spot.ts`, change `Station` to:

```ts
/** A NOAA tide station, as it stands from one spot. */
export interface Station {
  id: string
  name: string
  distanceMi: number
  direction: string
  /**
   * NOAA's own distinction. A harmonic station publishes a 6-minute curve;
   * a subordinate one publishes highs and lows only, and a 6-minute request
   * to it returns an error, so its curve is interpolated on the device.
   */
  type: 'harmonic' | 'subordinate'
}
```

Change the shared constant and the two other stations so every station carries the type:

```ts
const SANTA_BARBARA = {
  id: '9411340',
  name: 'Santa Barbara',
  type: 'harmonic',
} as const
```

and in `GAVIOTA`:

```ts
  tideStation: {
    id: '9411399',
    name: 'Gaviota State Park',
    distanceMi: 0.2,
    direction: 'south',
    type: 'harmonic',
  },
```

Update the comment above `GAVIOTA` to read: `// Station 9411399 is harmonic, so it has a curve, but it has no gauge: a water_level request returns an error. The nearest gauge is Santa Barbara.` (unchanged in substance). Then add after `hasOwnGauge`:

```ts
/** Whether the spot's tide station publishes a curve, or highs and lows only. */
export function hasOwnCurve(spot: Spot): boolean {
  return spot.tideStation.type === 'harmonic'
}
```

Also change the file's opening comment's second sentence to: `Facts verified against the live NOAA and NWS APIs on 2026-10-09, and the station types against NOAA's station metadata on 2026-10-10.`

- [ ] **Step 4: Run the tests to verify they pass, and the whole suite**

Run: `npx vitest run src/spot.test.ts` then `npm test` then `npx tsc -b`.
Expected: PASS everywhere. If `tsc` complains that some test builds a `Station` without `type`, add `type: 'harmonic'` to that literal; there should be none, because tests build spots by spreading the shipped ones.

- [ ] **Step 5: Format, lint, commit**

```bash
npm run format && npm run lint
git add src/spot.ts src/spot.test.ts
git commit -m "Each station says whether it publishes a curve

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The interpolation, measured against a real curve

**Files:**
- Create: `src/data/interpolate.ts`
- Create: `src/data/interpolate.test.ts`
- Modify: `src/data/noaa.test.ts`
- Modify: `src/data/__fixtures__/README.md`

**Interfaces:**
- Consumes: `TideExtreme`, `TidePoint` from `./noaa.ts`; `Span` from `./cache.ts`; `Loaded` from `./load.ts`; `MINUTE` from `../time.ts`.
- Produces: `interpolateCurve(events: TideExtreme[], span: Span): TidePoint[]` and `curveFromHiLo(hilo: Loaded<TideExtreme[]>, span: Span): Loaded<TidePoint[]>`. Task 3 calls `curveFromHiLo`.

- [ ] **Step 1: Write the failing tests**

Create `src/data/interpolate.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { curveFromHiLo, interpolateCurve } from './interpolate.ts'
import type { Loaded } from './load.ts'
import { parseHiLo, parsePredictions } from './noaa.ts'
import type { TideExtreme } from './noaa.ts'
import realRaw from './__fixtures__/noaa-predictions-9411340-20261010-20261023.json?raw'
import hiloRaw from './__fixtures__/noaa-hilo-9411340-20261009-20261024.json?raw'
import venturaRaw from './__fixtures__/noaa-hilo-9411189-20261009-20261024.json?raw'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const STEP = 6 * MINUTE
// 10 October 2026, 00:00 UTC.
const T0 = Date.UTC(2026, 9, 10)

// A low at midnight and a high six hours on, 1 ft to 5 ft.
const PAIR: TideExtreme[] = [
  { t: T0, ft: 1, type: 'L' },
  { t: T0 + 6 * HOUR, ft: 5, type: 'H' },
]

describe('interpolateCurve', () => {
  test('is the extremes at their instants and halfway at the midpoint', () => {
    const curve = interpolateCurve(PAIR, { start: T0, end: T0 + 6 * HOUR })
    expect(curve[0]).toEqual({ t: T0, ft: 1 })
    expect(curve.at(-1)).toEqual({ t: T0 + 6 * HOUR, ft: 5 })
    const mid = curve.find((p) => p.t === T0 + 3 * HOUR)!
    expect(mid.ft).toBeCloseTo(3, 10)
    // Level at both ends: the first step barely moves.
    expect(curve[1].ft - curve[0].ft).toBeLessThan(0.01)
  })

  test('one point every 6 minutes on the hour's boundaries, both ends included', () => {
    const curve = interpolateCurve(PAIR, { start: T0, end: T0 + 6 * HOUR })
    expect(curve).toHaveLength(61)
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].t - curve[i - 1].t).toBe(STEP)
    }
    // A span that starts between steps begins at the next step.
    const offset = interpolateCurve(PAIR, {
      start: T0 + 4 * MINUTE,
      end: T0 + HOUR,
    })
    expect(offset[0].t).toBe(T0 + STEP)
    expect(offset.at(-1)!.t).toBe(T0 + HOUR)
  })

  test('leaves out steps before the first event and after the last', () => {
    const curve = interpolateCurve(PAIR, {
      start: T0 - HOUR,
      end: T0 + 7 * HOUR,
    })
    expect(curve[0].t).toBe(T0)
    expect(curve.at(-1)!.t).toBe(T0 + 6 * HOUR)
    expect(curve.every((p) => Number.isFinite(p.ft))).toBe(true)
  })

  test('fewer than two events give no points', () => {
    expect(interpolateCurve([], { start: T0, end: T0 + HOUR })).toEqual([])
    expect(interpolateCurve([PAIR[0]], { start: T0, end: T0 + HOUR })).toEqual(
      [],
    )
  })

  test('events out of order are sorted first', () => {
    const backwards = [PAIR[1], PAIR[0]]
    expect(
      interpolateCurve(backwards, { start: T0, end: T0 + 6 * HOUR }),
    ).toEqual(interpolateCurve(PAIR, { start: T0, end: T0 + 6 * HOUR }))
  })

  test('two events at one instant make no point, and no NaN', () => {
    const twins: TideExtreme[] = [
      { t: T0, ft: 1, type: 'L' },
      { t: T0, ft: 1.1, type: 'H' },
      { t: T0 + 6 * HOUR, ft: 5, type: 'H' },
    ]
    const curve = interpolateCurve(twins, { start: T0, end: T0 + 6 * HOUR })
    expect(curve.every((p) => Number.isFinite(p.ft))).toBe(true)
    expect(curve.at(-1)).toEqual({ t: T0 + 6 * HOUR, ft: 5 })
  })

  test("follows a mixed semidiurnal day: Ventura's four extremes in order", () => {
    const events = parseHiLo(JSON.parse(venturaRaw))
    const day = { start: T0, end: T0 + 24 * HOUR }
    const curve = interpolateCurve(events, day)
    expect(curve).toHaveLength(241)
    // Each extreme is the curve's peak or trough: no point between two
    // neighbouring extremes lies outside their heights.
    const onDay = events.filter((e) => e.t >= day.start && e.t <= day.end)
    expect(onDay).toHaveLength(4)
    for (const point of curve) {
      const after = events.findIndex((e) => e.t > point.t)
      const [lo, hi] = [events[after - 1].ft, events[after].ft].sort(
        (a, b) => a - b,
      )
      expect(point.ft).toBeGreaterThanOrEqual(lo - 1e-9)
      expect(point.ft).toBeLessThanOrEqual(hi + 1e-9)
    }
  })

  test("is within the stated error of Santa Barbara's real curve over 14 days", () => {
    const real = parsePredictions(JSON.parse(realRaw))
    const events = parseHiLo(JSON.parse(hiloRaw))
    expect(real).toHaveLength(3360)
    const curve = interpolateCurve(events, {
      start: real[0].t,
      end: real[real.length - 1].t,
    })
    expect(curve).toHaveLength(real.length)
    const errors = curve
      .map((p, i) => {
        expect(p.t).toBe(real[i].t)
        return Math.abs(p.ft - real[i].ft)
      })
      .sort((a, b) => a - b)
    const rms = Math.sqrt(
      errors.reduce((sum, e) => sum + e * e, 0) / errors.length,
    )
    // Measured on 2026-10-10: rms 0.19 ft, 95th percentile 0.33 ft, worst
    // 1.15 ft (a 16-hour run on 17 October where NOAA's list skips a
    // near-stand). The spec states these; the ceilings sit just above.
    expect(rms).toBeLessThan(0.2)
    expect(errors[Math.floor(errors.length * 0.95)]).toBeLessThan(0.35)
    expect(errors[errors.length - 1]).toBeLessThan(1.2)
  })
})

describe('curveFromHiLo', () => {
  const span = { start: T0, end: T0 + 6 * HOUR }

  test('carries the highs and lows status and stamp, with the curve as data', () => {
    const hilo: Loaded<TideExtreme[]> = {
      data: PAIR,
      fetchedAt: T0 + HOUR,
      span: { start: T0 - 24 * HOUR, end: T0 + 90 * 24 * HOUR },
      status: 'stale',
    }
    const curve = curveFromHiLo(hilo, span)
    expect(curve.status).toBe('stale')
    expect(curve.fetchedAt).toBe(T0 + HOUR)
    expect(curve.span).toEqual(span)
    expect(curve.data).toEqual(interpolateCurve(PAIR, span))
  })

  test('is nothing while the highs and lows are nothing', () => {
    const hilo: Loaded<TideExtreme[]> = {
      data: null,
      fetchedAt: null,
      span: null,
      status: 'loading',
    }
    expect(curveFromHiLo(hilo, span)).toEqual({
      data: null,
      fetchedAt: null,
      span: null,
      status: 'loading',
    })
  })
})
```

Add to `src/data/noaa.test.ts`, inside the `describe` that holds `'NOAA reporting a problem with HTTP 200 is an error, not an empty curve'`, right after that test. Add the import at the top of the file with the other fixture imports:

```ts
import venturaErrorRaw from './__fixtures__/noaa-predictions-9411189-error.json?raw'
```

and the test:

```ts
  test('a 6-minute request to a subordinate station is an error, as recorded at Ventura', () => {
    // 9411189 publishes highs and lows only. This is NOAA's whole answer.
    expect(() => parsePredictions(JSON.parse(venturaErrorRaw))).toThrow(
      'NOAA: No Predictions data was found. Please make sure the Datum input is valid.',
    )
  })
```

If the file already imports fixtures without `?raw` (plain JSON import), use the same style as its neighbours and drop `JSON.parse`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/data/interpolate.test.ts src/data/noaa.test.ts`
Expected: `interpolate.test.ts` fails to load ("Failed to resolve import ./interpolate.ts"); the new `noaa.test.ts` test passes already, since the parser's error path exists. That is fine: it pins the recorded body.

- [ ] **Step 3: Write the module**

Create `src/data/interpolate.ts`:

```ts
// A tide curve where NOAA publishes none. 2,242 of its 3,502 prediction
// stations are subordinate: they give highs and lows only, and a 6-minute
// request returns an error. Between each pair of extremes the curve is a
// cosine, level at both and halfway at the midpoint, one point every 6
// minutes as NOAA's own curves run. Framework-free.

import type { Span } from './cache.ts'
import type { Loaded } from './load.ts'
import type { TideExtreme, TidePoint } from './noaa.ts'
import { MINUTE } from '../time.ts'

/** NOAA's points fall on 6-minute boundaries from the hour, and so do these. */
const STEP = 6 * MINUTE

/** The height at t between two extremes: from.ft at from.t, to.ft at to.t. */
function between(from: TideExtreme, to: TideExtreme, t: number): number {
  const phase = (Math.PI * (t - from.t)) / (to.t - from.t)
  return (from.ft + to.ft) / 2 + ((from.ft - to.ft) / 2) * Math.cos(phase)
}

/**
 * The curve through the highs and lows over a span, both ends included. A
 * step before the first extreme or after the last is left out rather than
 * guessed, so a plot whose data stops short has a gap, not a slope.
 */
export function interpolateCurve(
  events: TideExtreme[],
  span: Span,
): TidePoint[] {
  const sorted = [...events].sort((a, b) => a.t - b.t)
  const points: TidePoint[] = []
  if (sorted.length < 2) return points
  let i = 0
  for (let t = Math.ceil(span.start / STEP) * STEP; t <= span.end; t += STEP) {
    // The last pair that starts at or before t.
    while (i < sorted.length - 2 && sorted[i + 1].t <= t) i++
    const from = sorted[i]
    const to = sorted[i + 1]
    if (t < from.t || t > to.t || to.t === from.t) continue
    points.push({ t, ft: between(from, to, t) })
  }
  return points
}

/**
 * The curve as a source, standing in for fetched predictions at a station
 * that publishes none. It is as fresh, or as stale, as the highs and lows
 * it is made from, and nothing while they are nothing.
 */
export function curveFromHiLo(
  hilo: Loaded<TideExtreme[]>,
  span: Span,
): Loaded<TidePoint[]> {
  if (hilo.data === null) {
    return { data: null, fetchedAt: null, span: null, status: hilo.status }
  }
  return {
    data: interpolateCurve(hilo.data, span),
    fetchedAt: hilo.fetchedAt,
    span,
    status: hilo.status,
  }
}
```

Note the `while` uses `<=` so that at an extreme's exact instant the pair starting there is used; with twins at one instant the loop moves past the zero-length pair, and the `to.t === from.t` guard covers the last pair.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/data/interpolate.test.ts src/data/noaa.test.ts`
Expected: PASS. If the accuracy test's rms or worst-case exceeds a ceiling, the formula is wrong: check the sign in `between` (at `t === from.t` it must return `from.ft`). Do not loosen the ceilings.

- [ ] **Step 5: Record the fixtures in the README**

Add to the list in `src/data/__fixtures__/README.md`, after the `noaa-hilo-20261010-20270131.json` entry:

```markdown
- `noaa-predictions-9411340-20261010-20261023.json`: the same station's predicted curve at 6-minute resolution, 10 to 23 October 2026 UTC, 3,360 points, recorded on 2026-10-10. The truth the interpolated curve is measured against.
- `noaa-hilo-9411340-20261009-20261024.json`: the same station's highs and lows, 9 to 24 October 2026 UTC, 58 events: a day either side of that curve, so every point of it is bracketed.
- `noaa-hilo-9411189-20261009-20261024.json`: station 9411189 Ventura, a subordinate station, highs and lows for the same days, 58 events.
- `noaa-predictions-9411189-error.json`: NOAA's answer to a 6-minute request at Ventura. A subordinate station publishes no curve, and this error body is the whole response, with HTTP 200.
```

- [ ] **Step 6: Whole suite, format, lint, commit**

```bash
npm test && npm run format && npm run lint && npm run build
git add src/data/interpolate.ts src/data/interpolate.test.ts src/data/noaa.test.ts src/data/__fixtures__/README.md
git commit -m "A cosine curve between highs and lows, measured against Santa Barbara's

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Derive the curve where the station has none

**Files:**
- Modify: `src/data/useSpotData.ts`
- Test: `src/data/useSpotData.test.ts`

**Interfaces:**
- Consumes: `hasOwnCurve` from `../spot.ts` (Task 1); `curveFromHiLo` from `./interpolate.ts` (Task 2).
- Produces: `SpotData.hiloSpan: Span` (also returned by `frameFor`); `tideSpecs(...).hilo.needed` equals `frame.hiloSpan`; `useSpotData` returns derived `predictions` for a subordinate station.

- [ ] **Step 1: Write the failing tests**

In `src/data/useSpotData.test.ts`, inside `describe('frameFor', ...)`, add:

```ts
  test('the highs and lows span starts the day before today and ends with the months ahead', () => {
    const frame = frameFor(CAMPUS_POINT, '2026-10-08')
    expect(frame.hiloSpan).toEqual({
      start: Date.UTC(2026, 9, 7, 7),
      end: frame.ahead.end,
    })
    expect(frame.ahead.start).toBe(frame.day.start)
  })

  test("the day before is the spot's local day, 25 hours long when the clocks went back in it", () => {
    // 1 November 2026 is the 25-hour day; 2 November is the day after.
    const frame = frameFor(CAMPUS_POINT, '2026-11-02')
    expect((frame.day.start - frame.hiloSpan.start) / HOUR).toBe(25)
  })
```

Inside `describe('tideSpecs', ...)`, change the first test to:

```ts
  test('predictions are needed for the 14 days, and highs and lows from the day before to the months ahead', () => {
    expect(specs.predictions.needed).toEqual(frame.window)
    expect(specs.hilo.needed).toEqual(frame.hiloSpan)
  })
```

Then add a new `describe` at the end of the file. It needs `renderHook`-free testing, since the project has no DOM test environment: test the plain parts only. Add after the `tideSpecs` describe:

```ts
describe('a spot at a subordinate station', () => {
  const gaviota = spotById('gaviota')
  const ventura = {
    ...gaviota,
    id: 'ventura-test',
    tideStation: {
      id: '9411189',
      name: 'Ventura',
      distanceMi: 33,
      direction: 'east',
      type: 'subordinate' as const,
    },
  }

  test('its tide specs still name its own station for the highs and lows', () => {
    const specs = tideSpecs(ventura, frameFor(ventura, '2026-10-10'))
    expect(specs.hilo.spotId).toBe('ventura-test')
    expect(specs.predictions.spotId).toBe('ventura-test')
    expect(hasOwnCurve(ventura)).toBe(false)
  })
})
```

and add `hasOwnCurve` to the import from `../spot.ts`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/data/useSpotData.test.ts`
Expected: FAIL on `frame.hiloSpan` being `undefined` (two tests) and `specs.hilo.needed` not equalling `undefined`. The subordinate `describe` passes already; it documents the setup later tasks reuse.

- [ ] **Step 3: Add the span and the derivation**

In `src/data/useSpotData.ts`:

Add to the imports: `import { curveFromHiLo } from './interpolate.ts'` and change `import { hasOwnGauge } from '../spot.ts'` to `import { hasOwnCurve, hasOwnGauge } from '../spot.ts'`.

In `SpotData`, after `ahead: Span`, add:

```ts
  /**
   * From the midnight that starts yesterday to the end of `ahead`. The highs
   * and lows are fetched for all of it: a curve interpolated from them needs
   * yesterday's last extreme to start today's first hours from.
   */
  hiloSpan: Span
```

In `frameFor`, change the return type to `Pick<SpotData, 'day' | 'window' | 'ahead' | 'hiloSpan' | 'days' | 'spans'>`, and before the `return`:

```ts
  const hiloSpan = {
    start: localDayStart(addDays(today, -1), spot.timeZone),
    end: ahead.end,
  }
```

and add `hiloSpan,` to the returned object after `ahead,`. Update the function's doc comment to: `The spans of time, and the sun and moon, for the 14 days from today; ahead, which runs to the end of the third month ahead; and hiloSpan, which begins the day before.`

In `tideSpecs`, change the parameter type to `Pick<SpotData, 'day' | 'window' | 'ahead' | 'hiloSpan'>` and the `hilo` spec's comment and `needed`:

```ts
    hilo: {
      spotId: spot.id,
      source: 'hilo',
      isData: isTideExtremes,
      // The month view lists highs and lows months ahead, and a curve
      // interpolated from them needs yesterday's last one. They never
      // change, so one longer request a month costs less than a shorter one
      // every day.
      needed: frame.hiloSpan,
      fetch: (needed) => fetchHiLo(station, needed.start, needed.end),
      isEmpty: noPoints,
    },
```

In `useSpotData`, replace the two lines that load predictions and hilo, and the return's `predictions`, so the body reads:

```ts
  const ownGauge = hasOwnGauge(spot)
  const ownCurve = hasOwnCurve(spot)

  // A subordinate station publishes no curve, and a 6-minute request to it
  // returns an error, so its loader is never asked to fetch. Its curve is
  // made from the highs and lows instead.
  const fetched = useLoaded(specs.predictions, now, tidesShown && ownCurve)
  const hilo = useLoaded(specs.hilo, now, tidesShown)
  const predictions = useMemo(
    () => (ownCurve ? fetched : curveFromHiLo(hilo, frame.window)),
    [ownCurve, fetched, hilo, frame.window],
  )
  const observed = useLoaded(specs.observed, now, tidesShown)
```

Keep `gaugeOwn`, `gaugePredictions`, `forecast` and the return as they are; `predictions` in the return now refers to the derived one.

Update the doc comment on `useLoaded` so its list of what is not fetched reads: `a hidden tide is not loaded, a gauge's own prediction is not loaded where the gauge is the spot's own station, and a curve is not loaded where the station publishes none.`

- [ ] **Step 4: Run the tests to verify they pass, and the whole suite**

Run: `npx vitest run src/data/useSpotData.test.ts` then `npm test` then `npx tsc -b`.
Expected: PASS. If `tsc` reports a test or module that builds a frame by hand without `hiloSpan` (search for `ahead:` in `src/**/*.test.ts`), add `hiloSpan` beside it with the same shape as the test above.

- [ ] **Step 5: Format, lint, build, commit**

```bash
npm run format && npm run lint && npm run build
git add src/data/useSpotData.ts src/data/useSpotData.test.ts
git commit -m "Derive the curve from the highs and lows where the station has none

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The readout says "interpolated"

**Files:**
- Modify: `src/chart/readout.ts`
- Modify: `src/ui/tideView.ts`
- Test: `src/chart/readout.test.ts`
- Test: `src/ui/tideView.test.ts`

**Interfaces:**
- Consumes: `hasOwnCurve` from `../spot.ts` (Task 1).
- Produces: `tideWords(readout: TideReadout, curve: 'predicted' | 'interpolated' = 'predicted')`. The existing one-argument calls keep working.

- [ ] **Step 1: Write the failing tests**

In `src/chart/readout.test.ts`, after the test `'the readout in words, with and without a reading'`, add:

```ts
  test('a curve made on the device is worded as interpolated', () => {
    expect(
      tideWords(
        { predictedFt: 0.86, observedFt: 2.04, aboveFt: 1.1 },
        'interpolated',
      ),
    ).toEqual({
      predicted: '0.9 ft interpolated',
      observed: '2.0 ft observed (+1.1)',
    })
    // Off the curve the words do not change: nothing was interpolated there.
    expect(
      tideWords(
        { predictedFt: null, observedFt: null, aboveFt: null },
        'interpolated',
      ),
    ).toEqual({ predicted: 'No prediction here', observed: null })
  })
```

In `src/ui/tideView.test.ts`, add after the `LA_CUMBRE` constant:

```ts
// A spot whose station publishes highs and lows only. Its gauge is elsewhere,
// as Gaviota's is.
const VENTURA = {
  spot: {
    ...spotById('gaviota'),
    id: 'ventura-test',
    tideStation: {
      id: '9411189',
      name: 'Ventura',
      distanceMi: 33,
      direction: 'east',
      type: 'subordinate' as const,
    },
  },
  shown: true,
}
```

and a new `describe` at the end of the file:

```ts
describe('at a spot whose station publishes highs and lows only', () => {
  test('the readout and the spoken words say interpolated, and the curve is drawn as any other', () => {
    const view = tideView(data(), TODAY, null, VENTURA)
    expect(view.text.predicted).toBe('3.0 ft interpolated')
    expect(view.words).toContain('3.0 ft interpolated')
    expect(view.words).not.toContain('predicted')
    expect(view.predicted).toHaveLength(241)
    expect(view.series[0].name).toBe('predicted')
    expect(view.dots).toEqual([{ name: 'predicted', v: 3 }])
    expect(view.notice).toBeNull()
  })

  test('a harmonic station still says predicted', () => {
    const view = tideView(data(), TODAY, null, GAVIOTA)
    expect(view.text.predicted).toBe('3.0 ft predicted')
  })
})
```

(`data()` hands in a flat 3 ft curve as `predictions`; in the app that curve would have come from `curveFromHiLo`, but `tideView` does not know or care where it came from.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/chart/readout.test.ts src/ui/tideView.test.ts`
Expected: FAIL. `tideWords` with two arguments gives `'0.9 ft predicted'` (and `tsc` would reject the second argument); the Ventura view says `'3.0 ft predicted'`.

- [ ] **Step 3: Add the word**

In `src/chart/readout.ts`, change `tideWords` to:

```ts
/**
 * The readout in words: the prediction, and the reading if there is one at
 * the cursor. Shared by what is drawn and what a screen reader is told. The
 * curve is NOAA's prediction, or one interpolated on the device from the
 * highs and lows where the station publishes no curve, and the word says
 * which.
 */
export function tideWords(
  readout: TideReadout,
  curve: 'predicted' | 'interpolated' = 'predicted',
): {
  predicted: string
  observed: string | null
} {
  const { predictedFt, observedFt, aboveFt } = readout
  const above = aboveFt === null ? '' : ` (${signedFeet(aboveFt)})`
  return {
    predicted:
      predictedFt === null
        ? 'No prediction here'
        : `${feet(predictedFt)} ${curve}`,
    observed:
      observedFt === null ? null : `${feet(observedFt)} observed${above}`,
  }
}
```

In `src/ui/tideView.ts`, change the import `import { hasOwnGauge } from '../spot.ts'` to `import { hasOwnCurve, hasOwnGauge } from '../spot.ts'`, and the line `const text = tideWords(readout)` to:

```ts
  const text = tideWords(
    readout,
    hasOwnCurve(spot) ? 'predicted' : 'interpolated',
  )
```

- [ ] **Step 4: Run the tests to verify they pass, and the whole suite**

Run: `npx vitest run src/chart/readout.test.ts src/ui/tideView.test.ts` then `npm test`.
Expected: PASS, including every existing `tideWords` test unchanged.

- [ ] **Step 5: Format, lint, build, commit**

```bash
npm run format && npm run lint && npm run build
git add src/chart/readout.ts src/chart/readout.test.ts src/ui/tideView.ts src/ui/tideView.test.ts
git commit -m "The readout says interpolated where the curve is

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The caption says where the curve comes from

**Files:**
- Modify: `src/ui/captions.ts`
- Test: `src/ui/captions.test.ts`

**Interfaces:**
- Consumes: `hasOwnCurve` from `../spot.ts` (Task 1).
- Produces: nothing new; `tideCaption`'s signature is unchanged.

- [ ] **Step 1: Write the failing tests**

Add a new `describe` at the end of `src/ui/captions.test.ts`. It reuses `loaded`, `EARLIER`, `READING`, `DAYS_AGO`, `TODAY` and `HILO` from the top of the file (read the file: `loaded(status, data?)` builds a `Loaded`; `HILO` is a ready highs-and-lows source).

```ts
describe('tideCaption at a spot whose station publishes highs and lows only', () => {
  const gaviota = spotById('gaviota')
  const VENTURA = {
    ...gaviota,
    id: 'ventura-test',
    tideStation: {
      id: '9411189',
      name: 'Ventura',
      distanceMi: 33,
      direction: 'east',
      type: 'subordinate' as const,
    },
  }
  const THEIRS =
    "Tide: NOAA 9411189 Ventura, 33 mi east, highs and lows only. Curve interpolated between them, not NOAA's."
  const GAUGE = 'Gauge: NOAA 9411340 Santa Barbara, 31 mi east'

  function ventura(
    predictions: Loaded<TidePoint[]>,
    observed: Loaded<TidePoint[]>,
    readings: TidePoint[],
    rest: { hilo?: Loaded<TideExtreme[]>; isToday?: boolean } = {},
  ): string {
    return tideCaption(VENTURA, {
      predictions,
      hilo: HILO,
      observed,
      readings,
      today: TODAY,
      isToday: true,
      ...rest,
    })
  }

  test('says the curve is interpolated, then names the gauge as at any spot without one', () => {
    expect(ventura(loaded('ready'), loaded('ready'), [EARLIER, READING])).toBe(
      `${THEIRS} ${GAUGE}, observed through 2:06 PM, preliminary.`,
    )
  })

  test('a failed refresh is reported once, by the highs and lows, not by the curve too', () => {
    const stale: Loaded<TideExtreme[]> = {
      data: [],
      fetchedAt: DAYS_AGO,
      span: null,
      status: 'stale',
    }
    // The derived curve carries the same stale status and stamp.
    const curve: Loaded<TidePoint[]> = {
      data: [],
      fetchedAt: DAYS_AGO,
      span: null,
      status: 'stale',
    }
    expect(ventura(curve, loaded('ready'), [READING], { hilo: stale })).toBe(
      `${THEIRS} Couldn't refresh the high and low times. Showing those from Mon Oct 5, 1:33 AM. ${GAUGE}, observed through 2:06 PM, preliminary.`,
    )
  })

  test('with nothing saved, the highs and lows are unavailable and so is the curve', () => {
    const none: Loaded<TideExtreme[]> = {
      data: null,
      fetchedAt: null,
      span: null,
      status: 'unavailable',
    }
    expect(
      ventura(loaded('unavailable', null), loaded('ready'), [READING], {
        hilo: none,
      }),
    ).toBe(
      `${THEIRS} High and low times unavailable. ${GAUGE}, observed through 2:06 PM, preliminary.`,
    )
  })
})
```

Check the exact signature of the file's `loaded` helper before using it; if it takes `(status, data)` in a different order, match it. The expected strings are what matter.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/captions.test.ts`
Expected: FAIL. The caption begins `Tide: NOAA 9411189 Ventura, 33 mi east, predictions only.` and, in the stale case, adds `Couldn't refresh. Showing predictions from ...` as well.

- [ ] **Step 3: Change the station sentence**

In `src/ui/captions.ts`, change the import to `import { hasOwnCurve, hasOwnGauge } from '../spot.ts'`, and the start of `tideCaption` to:

```ts
export function tideCaption(spot: Spot, tide: TideSources): string {
  const zone = spot.timeZone
  const { predictions, hilo, observed, readings, today } = tide
  const ownGauge = hasOwnGauge(spot)
  const ownCurve = hasOwnCurve(spot)
  const station = stationWords(spot.tideStation)
  // Highs and lows only says more than predictions only, so a station with
  // no curve does not get both tags.
  const parts = [
    !ownCurve
      ? `Tide: ${station}, highs and lows only. Curve interpolated between them, not NOAA's.`
      : ownGauge
        ? `Tide: ${station}.`
        : `Tide: ${station}, predictions only.`,
  ]

  // A curve made from the highs and lows is as stale as they are, and the
  // highs-and-lows sentence below says so once.
  if (
    ownCurve &&
    predictions.status === 'stale' &&
    predictions.fetchedAt !== null
  ) {
    const saved = when(predictions.fetchedAt, today, zone)
    parts.push(`Couldn't refresh. Showing predictions from ${saved}.`)
  }
```

The rest of the function is unchanged.

- [ ] **Step 4: Run the tests to verify they pass, and the whole suite**

Run: `npx vitest run src/ui/captions.test.ts` then `npm test`.
Expected: PASS, with every existing caption test unchanged.

- [ ] **Step 5: Format, lint, build, commit**

```bash
npm run format && npm run lint && npm run build
git add src/ui/captions.ts src/ui/captions.test.ts
git commit -m "The caption says the curve is interpolated where it is

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Browser check at Ventura, docs, pull request

**Files:**
- Modify: `CLAUDE.md`
- Scratch (never committed): `src/spot.ts`

**Interfaces:** none. This task checks the whole in a browser, writes the docs, and opens the pull request.

- [ ] **Step 1: Point Campus Point at Ventura, as a scratch edit**

In `src/spot.ts`, change `CAMPUS_POINT.tideStation` to:

```ts
  tideStation: {
    id: '9411189',
    name: 'Ventura',
    distanceMi: 33,
    direction: 'east',
    type: 'subordinate',
  },
```

leaving `gauge` as Santa Barbara. Do not commit this. Run `npm run dev` (port 5173).

- [ ] **Step 2: Check in a browser**

Use the Playwright tools (`mcp__playwright__browser_navigate`, `mcp__playwright__browser_snapshot`, `mcp__playwright__browser_run_code_unsafe`, `mcp__playwright__browser_take_screenshot`). Open http://localhost:5173/ in a fresh context and clear `localStorage` for the origin first (`localStorage.clear()` via `page.evaluate`), so no saved Santa Barbara curve is drawn. Confirm, and record what you saw in the task report:

1. The tide panel draws a filled curve for today, with the cursor's dot on it. The readout line ends in "interpolated" (e.g. "3.4 ft interpolated").
2. The table under it lists today's highs and lows, and each sits on a peak or trough of the curve (compare the table's heights against the curve at those times via the cursor).
3. The caption begins "Tide: NOAA 9411189 Ventura, 33 mi east, highs and lows only. Curve interpolated between them, not NOAA's. Gauge: NOAA 9411340 Santa Barbara, 31 mi east".
4. The network log (`mcp__playwright__browser_network_requests`) shows a `product=predictions&interval=hilo` request to `station=9411189` and a `product=predictions&interval=6` request to `station=9411340` (the gauge's own curve) but **no** `interval=6` request to `station=9411189`.
5. The hilo request's `begin_date` is yesterday's UTC date or earlier (the span starts at yesterday's local midnight, which is the previous UTC date).
6. Choose a day in the 14-day list a week out: the curve draws for it too and reads "interpolated".
7. The month view opens and lists the highs and lows unchanged.
8. Take a screenshot of the forecast view for the pull request, saved under the scratchpad directory.

Then revert the scratch edit (`git checkout src/spot.ts`), clear `localStorage` again, reload, and confirm Campus Point reads "predicted" with Santa Barbara's curve and that the hilo request now goes to `station=9411340`.

If anything in 1 to 7 fails, stop and report; do not patch the components.

- [ ] **Step 3: Update CLAUDE.md**

In the `## Status` bullet beginning `- Built:`, append before the final period: `; then a curve interpolated from the highs and lows for stations that publish only those, labelled "interpolated" (no shipped spot uses it yet; #4 will)`.

In `## Data sources`, NOAA CO-OPS, change the bullet `2,242 prediction stations are subordinate ... A curve for these has to be interpolated and labeled as such.` to:

```markdown
- 2,242 prediction stations are subordinate (`type: "S"`): they return high/low only, and a 6-minute request returns an error. For these the app interpolates a cosine curve between consecutive highs and lows (`src/data/interpolate.ts`) and says "interpolated" in the readout and the caption. Against Santa Barbara's own curve over 14 days: 0.19 ft rms, 95% within 0.33 ft, worst 1.15 ft in a 16-hour gap where NOAA's list skips a near-stand.
```

In `## Next Steps`, replace the line `- The month-view pull request (...) waits for the owner's phone check and review.` with `- The interpolated-curve pull request (`stage-2/interpolated-curve`, issue #5) waits for the owner's review. It changes nothing on the three shipped spots.` Keep the other lines.

Also in `## Stack`, in the bullet listing plain modules with tests, add `src/data/interpolate.ts` after `src/data/load.ts`.

- [ ] **Step 4: Final green, commit, push, pull request**

```bash
git status --short   # must show only CLAUDE.md
npm test && npm run format && npm run lint && npm run build
git add CLAUDE.md
git commit -m "Note the interpolated curve in CLAUDE.md

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin stage-2/interpolated-curve
```

Then open the pull request with `gh pr create --base main --head stage-2/interpolated-curve`, title `Interpolated tide curve for stations that publish highs and lows only`, and a body that has: `Closes #5`; one paragraph on what it does and that no shipped spot changes; the measured error (rms 0.19 ft, 95% within 0.33 ft, worst 1.15 ft, with the 17 October explanation); the "Decisions this spec makes that the issue leaves open" list copied from the spec; what was checked in the browser (the list from Step 2, with what was seen); and a phone check for the owner that says, since no shipped spot is affected, to open https://tideline-inky.vercel.app (or the preview) and confirm Campus Point's tide panel, readout ("predicted") and caption are unchanged, and that the month view still lists highs and lows. End the body with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Do not merge.
