# Stage 1 Review Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three issues the final review of pull request #22 left behind (#23, #24, #25), and take out the duplication that review did not reach: one fix to what a list row says offline, one to how an odd NWS value is handled, the last arithmetic and wording out of the components, and one definition each of the things that are currently defined in several places.

**Architecture:** The same as Stage 1. Thin React components over plain modules, with every rule, every piece of arithmetic and every word in a plain function that has tests. This plan moves the tide panel's grid, dots and wording into `tideView`, the weather panels' grid, step and titles into `weatherView`, and the screen reader's run of words into both, so `App.tsx` and `WeatherPanels.tsx` only hand each view's fields to `Panel`. The rule "a saved forecast whose every hour has passed counts as no forecast" becomes one function used by the panels and the list alike. The anchor instant of a day (sunset, or midday where the sun does not set) and the "midnight belongs to the day it starts" filter are each defined once, in `selection.ts`. The time constants are defined once, in `time.ts`.

**Tech Stack:** React 19, TypeScript 6.0, Vite 8, Vitest 5, oxlint, Prettier. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-stage-1-campus-point-design.md`, and the three issues: https://github.com/nicolovejoy/tideline/issues/23, https://github.com/nicolovejoy/tideline/issues/24, https://github.com/nicolovejoy/tideline/issues/25.

**Scope:** One pull request on the branch `stage-1/review-follow-ups`. Nothing from Stage 2: no new spots, no hint, no new data.

## Decisions this plan makes that the issues leave open

1. **The screen reader's words name every panel, with a colon:** "3:36 PM; Tide: 3.0 ft predicted, 4.0 ft observed (+1.0); Wind: 9 mph, gusts 12, from W; Temperature: 65°F; Sky: 3% cloud, 0% rain". Panels are set apart by semicolons because the words within one are already set apart by commas. A panel with nothing at the cursor is still named ("Temperature: No forecast here"), so the phrase is never left hanging. Where no weather panel has anything to say, "No forecast here" is said once, as before. A panel that is not drawn says its notice instead ("Tide data unavailable", "Forecast unavailable").
2. **The panel titles move into the views** (`tideView.title`, `weatherView.wind.title` and so on), because the screen reader's words use them and the title on screen must be the same word.
3. **An NWS value with a duration the parser cannot read, or a start it cannot read, is left out,** and the rest of the forecast stands. It is not an error. NWS sends whole hours today; one odd value must not take the whole forecast down.
4. **The strip says "No sunset today"** where the sun does not set, matching its own "No moonrise today". A row keeps "No sunset". The issue only asked for the two to agree; they now share the phrase.
5. **`wholeBounds` goes.** It is `steppedBounds(values, 1)`, and the tide now says so.
6. **`dayRows` takes `now` through its data,** like `tideView` does, so the list is worked out again once a minute and the row changes at the minute the forecast wholly passes, as the panels do.

## Global Constraints

- **Node 24 for every `npm`, `npx` and `node` command.** In a fresh shell run `source ~/.nvm/nvm.sh && nvm use` first.
- **Public repo, no personal details.** Tracked files, commit messages and pull requests never name people. Write "the first user" and "the owner". Never copy anything out of `private/`.
- **Commit identity.** `git config user.email` must end in `users.noreply.github.com`.
- **Commit trailer.** End every commit message with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **Code style is the Vite template's:** no semicolons, single quotes, relative imports carry their `.ts` or `.tsx` extension, type-only imports use `import type`, no enums. Run `npm run format` before every commit.
- **Lint must print no problems.** `npm run lint` runs oxlint with warnings denied, then a Prettier check.
- **No new dependencies.**
- **Times:** every stored or computed time is a UTC instant in epoch milliseconds. Only `src/time.ts` converts to a zone. Nothing reads the viewer's zone. Tests run with the device in Tokyo.
- **Components hold no arithmetic, no rules and no wording.** Those live in plain modules with tests. A component may still build its y-scale from a view's bounds and its own height: that is layout, not a rule.
- **Units:** feet above MLLW to one decimal; °F, mph and percent as whole numbers; 12-hour clock.
- **Data, not a verdict.** No scores, no go/no-go, no alerts.
- **Do not merge.** The last task opens the pull request and stops.
- **Every task ends green:** `npm test`, `npm run lint` and `npm run build` all pass before its commit.

## Review Focus

1. A saved forecast whose last hour ends at this very minute: it has wholly passed, and the row and the panels agree. Pinned in Task 5 (`forecastHours` at `over` and `over - 1`).
2. An NWS value whose start cannot be parsed: left out, never a `NaN` hour. Pinned in Task 4.
3. A tide range below the datum: the rules read "-2 ft" and "0 ft", never "-0 ft". Pinned in Task 6.
4. The tide has no curve while the weather draws: the screen reader hears "Tide data unavailable" and then the weather, not "No prediction here". Pinned in Task 6 (`words` with no curve) and checked in the browser in Task 8.
5. A day where the sun does not set: the cursor rests at midday and the forecast is judged by midday. Pinned in Task 3 (`anchor`) with the existing tests in `tideView.test.ts` and `weatherView.test.ts`.

## File Structure

Modified, plain modules:
- `src/time.ts`: exports `MINUTE`, `HOUR`, `DAY`.
- `src/chart/scales.ts`: `wholeBounds` removed.
- `src/chart/readout.ts`: `cursorText` added.
- `src/chart/Panel.tsx`: `Rule` and `Dot` exported (types only; the component is unchanged otherwise).
- `src/ui/selection.ts`: `Selected.anchor` and `onDay` added.
- `src/data/nws.ts`: `parseDurationHours` returns null instead of throwing; `parseGridpoint` skips what it cannot read.
- `src/ui/weatherView.ts`: `forecastHours` added; each panel view gets `title`, `rules` and a `step` on its series; `words` names the panels.
- `src/ui/tideView.ts`: gets `title`, `text`, `words`, `rules`, `series`, `dots`.
- `src/ui/dayList.ts`: `dayRows` takes `now`; the strip says "No sunset today".
- `src/data/cache.ts`, `src/data/astro.ts`, `src/data/useSpotData.ts`, `src/chart/PanelStack.tsx`: use the constants from `time.ts`.

Modified, components:
- `src/App.tsx` and `src/ui/WeatherPanels.tsx`: hand the views' fields to `Panel`; no arithmetic, rules or wording left.

Tests: the `.test.ts` beside each module above.

---

### Task 1: One definition of the time constants, in `src/time.ts`

**Files:**
- Modify: `src/time.ts`, `src/data/nws.ts`, `src/data/cache.ts`, `src/data/astro.ts`, `src/data/useSpotData.ts`, `src/chart/readout.ts`, `src/chart/PanelStack.tsx`, `src/ui/weatherView.ts`, `src/ui/WeatherPanels.tsx`

**Interfaces:**
- Produces, in `src/time.ts`: `export const MINUTE = 60_000`, `export const HOUR = 60 * MINUTE`, `export const DAY = 24 * HOUR`. Every later task imports these instead of defining its own.

This task changes no behaviour. The existing suite is its test.

- [ ] **Step 1: Add the constants to `src/time.ts`**

Under the opening comment, before `const clockFormats`, add:

```ts
export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR
```

Then in `hourMarks`, replace `t += 3_600_000` with `t += HOUR`.

- [ ] **Step 2: Replace the local definitions**

In each file, delete the local `const MINUTE`, `const HOUR` and `const DAY` lines named below and add the import. Imports are sorted as the file already sorts them: relative imports after package imports, `../` paths after `./` paths.

`src/data/nws.ts`: delete `const HOUR = 3_600_000`. Add `import { HOUR } from '../time.ts'` as the file's first import (it has none yet).

`src/data/cache.ts`: delete `const MINUTE = 60_000` and `const HOUR = 60 * MINUTE`. Add `import { HOUR, MINUTE } from '../time.ts'` as the file's first import. While here, rewrap the one-line comment above `storageKey` so no line passes 80 columns:

```ts
// Bump the version when the shape or coverage of a saved entry changes, so
// saved entries from an older build are not reused. v2: the predicted curve
// includes its end instant.
```

`src/data/astro.ts`: delete `const MINUTE = 60_000`, `const HOUR = 60 * MINUTE` and `const DAY = 24 * HOUR`. Change the existing `import { addDays, localDayStart } from '../time.ts'` to `import { DAY, HOUR, MINUTE, addDays, localDayStart } from '../time.ts'`.

`src/data/useSpotData.ts`: delete `const MINUTE = 60_000`. Change the existing `import { addDays, localDate, localDayStart } from '../time.ts'` to `import { MINUTE, addDays, localDate, localDayStart } from '../time.ts'`.

`src/chart/readout.ts`: delete `const HOUR = 3_600_000`. Add `import { HOUR } from '../time.ts'` after the `nws.ts` imports. `STEP` stays as it is.

`src/chart/PanelStack.tsx`: delete `const MINUTE = 60_000` and `const HOUR = 60 * MINUTE`. Change the existing `import { hourMarks } from '../time.ts'` to `import { HOUR, MINUTE, hourMarks } from '../time.ts'`.

`src/ui/weatherView.ts`: delete `const HOUR = 3_600_000`. Add `import { HOUR } from '../time.ts'` after the `selection.ts` import.

`src/ui/WeatherPanels.tsx`: delete the comment `/** Each forecast value holds for an hour. */` and `const HOUR = 3_600_000`. Add `import { HOUR } from '../time.ts'` after the `weatherView.ts` import. (Task 7 removes this import again; for now the component still sets the step.)

- [ ] **Step 3: Check that nothing else defines them**

Run: `grep -rn "const HOUR\|const MINUTE\|const DAY\|3_600_000" src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'`

Expected: only the three lines in `src/time.ts`.

- [ ] **Step 4: Run everything**

Run: `npm run format && npm test && npm run lint && npm run build`
Expected: 382 tests pass, lint clean, build clean.

- [ ] **Step 5: Commit**

```bash
git add src/time.ts src/data/nws.ts src/data/cache.ts src/data/astro.ts src/data/useSpotData.ts src/chart/readout.ts src/chart/PanelStack.tsx src/ui/weatherView.ts src/ui/WeatherPanels.tsx
git commit -m "Define the time constants once, in time.ts

MINUTE, HOUR and DAY were each defined in up to seven modules.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: `wholeBounds` is `steppedBounds` with a step of 1, in `src/chart/scales.ts`

**Files:**
- Modify: `src/chart/scales.ts`, `src/chart/scales.test.ts`, `src/ui/tideView.ts`

**Interfaces:**
- Consumes: `steppedBounds(values: number[], step: number): [number, number]` from `scales.ts`.
- Removes: `wholeBounds`. After this task nothing imports it.

- [ ] **Step 1: Move the tests**

In `src/chart/scales.test.ts`, delete the whole `describe('wholeBounds', …)` block and remove `wholeBounds` from the import list. Inside `describe('steppedBounds', …)`, after the test `'goes below zero for a frost, and never gives a negative zero'`, add:

```ts
  test('with a step of 1 it is whole numbers, as the tide uses', () => {
    expect(steppedBounds([0.189, 5.449, 3.1], 1)).toEqual([0, 6])
    expect(steppedBounds([-0.3, 4.2], 1)).toEqual([-1, 5])
    expect(steppedBounds([2, 2], 1)).toEqual([2, 3])
    expect(steppedBounds([], 1)).toEqual([0, 1])
  })
```

- [ ] **Step 2: Run the tests to see them pass already**

Run: `npx vitest run src/chart/scales.test.ts`
Expected: all pass. The new test only pins what `steppedBounds` already does.

- [ ] **Step 3: Remove `wholeBounds`**

In `src/chart/scales.ts`, delete the function `wholeBounds` and its doc comment (the block from `/** Whole-number bounds …` to its closing `}`).

In `src/ui/tideView.ts`, change `import { wholeBounds } from '../chart/scales.ts'` to `import { steppedBounds } from '../chart/scales.ts'`, and change the `bounds` computation to:

```ts
  const bounds = steppedBounds(
    [...(data.predictions.data ?? []), ...readings].map((point) => point.ft),
    1,
  )
```

- [ ] **Step 4: Run everything**

Run: `npm run format && npm test && npm run lint && npm run build`
Expected: 382 tests pass (one removed describe of four tests, one new test of four assertions, so the count is 379), lint clean, build clean. Report the count you see.

- [ ] **Step 5: Commit**

```bash
git add src/chart/scales.ts src/chart/scales.test.ts src/ui/tideView.ts
git commit -m "Drop wholeBounds: it is steppedBounds with a step of 1

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: A day's anchor and its highs and lows, defined once, in `src/ui/selection.ts`

**Files:**
- Modify: `src/ui/selection.ts`, `src/ui/selection.test.ts`, `src/ui/tideView.ts`, `src/ui/tideView.test.ts`, `src/ui/weatherView.ts`, `src/ui/weatherView.test.ts`, `src/ui/dayList.ts`

**Interfaces:**
- Produces, in `selection.ts`:
  - `Selected.anchor: number`, the instant the day is about: sunset, or the middle of the day where the sun does not set.
  - `onDay<T extends { t: number }>(items: T[], span: Span): T[]`, the items that fall on a day, where one at midnight belongs to the day it starts.
- Consumes: `HOUR` from `src/time.ts` (Task 1).

- [ ] **Step 1: Write the failing tests**

In `src/ui/selection.test.ts`, change the imports to:

```ts
import { describe, expect, test } from 'vitest'
import { dayMarkers, onDay, selectedDay } from './selection.ts'
import { frameFor } from '../data/useSpotData.ts'
import { CAMPUS_POINT } from '../spot.ts'
import { HOUR } from '../time.ts'
```

Inside `describe('selectedDay', …)`, after the last test, add:

```ts
  test('the day is about its sunset', () => {
    const selected = selectedDay(frame, '2026-10-11')
    expect(selected.anchor).toBe(selected.astro.sunset)
  })

  test('where the sun does not set, the day is about its middle', () => {
    const polar = {
      days: [{ ...frame.days[0], sunset: null }],
      spans: [frame.spans[0]],
    }
    const { start, end } = frame.spans[0]
    expect(selectedDay(polar, null).anchor).toBe((start + end) / 2)
  })
```

At the end of the file add:

```ts
describe('onDay', () => {
  test('a high or low at midnight belongs to the day it starts, not to both', () => {
    const { start, end } = frame.spans[0]
    const events = [
      { t: start - 2 * HOUR, ft: 5 },
      { t: start, ft: 0.2 },
      { t: start + 6 * HOUR, ft: 5.4 },
      { t: end, ft: 0.8 },
    ]
    expect(onDay(events, frame.spans[0]).map((event) => event.t)).toEqual([
      start,
      start + 6 * HOUR,
    ])
  })

  test('nothing on the day is an empty list', () => {
    expect(onDay([], frame.spans[0])).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/ui/selection.test.ts`
Expected: FAIL. `onDay` is not exported, and `anchor` is undefined.

- [ ] **Step 3: Add `anchor` and `onDay`**

In `src/ui/selection.ts`, change the `Selected` interface and `selectedDay` to:

```ts
export interface Selected {
  /** Its place in the 14 days. 0 is today. */
  index: number
  date: string
  span: Span
  astro: DayAstro
  isToday: boolean
  /**
   * The instant the day is about: sunset, the moment the rest of the screen
   * is about, or the middle of the day where the sun does not set. The
   * cursor rests here on a day other than today, and the forecast counts as
   * reaching the day if it reaches this hour.
   */
  anchor: number
}

/**
 * The day on screen. `picked` is the date of the row last tapped, if any. A
 * date that is not one of the 14, such as yesterday's on a phone left open
 * past midnight, means today.
 */
export function selectedDay(
  data: Pick<SpotData, 'days' | 'spans'>,
  picked: string | null,
): Selected {
  const found = data.days.findIndex((day) => day.date === picked)
  const index = found === -1 ? 0 : found
  const astro = data.days[index]
  const span = data.spans[index]
  return {
    index,
    date: astro.date,
    span,
    astro,
    isToday: index === 0,
    anchor: astro.sunset ?? (span.start + span.end) / 2,
  }
}

/**
 * The items that fall on a day, such as its highs and lows. One at midnight
 * belongs to the day it starts, not to both.
 */
export function onDay<T extends { t: number }>(items: T[], span: Span): T[] {
  return items.filter((item) => item.t >= span.start && item.t < span.end)
}
```

- [ ] **Step 4: Use them**

In `src/ui/tideView.ts`:
- Add `import { onDay } from './selection.ts'` before the `import type { Selected } from './selection.ts'` line.
- Replace the `events` computation and its comment with `const events = onDay(data.hilo.data ?? [], span)`.
- Replace the `anchor` line and the `rest` computation with:

```ts
  const rest = selected.isToday
    ? restingCursor(data.now, observed)
    : Math.floor(selected.anchor / STEP) * STEP
```

  and shorten the comment above it so it no longer describes the anchor: delete the sentence "Any other day it is sunset, the moment the rest of the screen is about, or the middle of the day where the sun does not set." and put "Any other day it is the day's anchor." in its place.

In `src/ui/weatherView.ts`, replace the two lines

```ts
    const anchor = selected.astro.sunset ?? (span.start + span.end) / 2
    const reaches = Math.floor(anchor / HOUR) * HOUR <= last
```

with

```ts
    const reaches = Math.floor(selected.anchor / HOUR) * HOUR <= last
```

In `src/ui/dayList.ts`:
- Change `import { selectedDay } from './selection.ts'` to `import { onDay, selectedDay } from './selection.ts'`.
- In `dayRows`, replace `const { start, end } = data.spans[i]` with `const span = data.spans[i]`, and replace the `tides` entry with:

```ts
      tides: onDay(events, span).map((event) => {
        const kind = event.type === 'H' ? 'High' : 'Low'
        return `${kind} ${time(event.t)} ${feet(event.ft)}`
      }),
```

- [ ] **Step 5: Give the hand-built `Selected` values in tests their anchor**

In `src/ui/tideView.test.ts`, in `function day(index, sunset)`, add after `isToday: index === 0,`:

```ts
    anchor: sunset ?? START + index * DAY + DAY / 2,
```

In `src/ui/weatherView.test.ts`, in `function day(index, sunset = SUNSET)`, add after `isToday: index === 0,`:

```ts
    anchor: sunset === null ? start + DAY / 2 : start + sunset,
```

- [ ] **Step 6: Run everything**

Run: `npm run format && npm test && npm run lint && npm run build`
Expected: all pass, 383 tests (379 + 4), lint clean, build clean.

- [ ] **Step 7: Commit**

```bash
git add src/ui/selection.ts src/ui/selection.test.ts src/ui/tideView.ts src/ui/tideView.test.ts src/ui/weatherView.ts src/ui/weatherView.test.ts src/ui/dayList.ts
git commit -m "Define a day's anchor and its highs and lows once, in selection.ts

The sunset-or-midday instant was worked out in tideView and again in
weatherView, and the midnight rule for highs and lows was written in
tideView and again in dayList.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: One odd NWS value is left out, not the whole forecast, in `src/data/nws.ts`

**Files:**
- Modify: `src/data/nws.ts`, `src/data/nws.test.ts`

**Interfaces:**
- Changes: `parseDurationHours(duration: string): number | null`. Null for anything it cannot read. Nothing outside `nws.ts` and its test calls it.

- [ ] **Step 1: Write the failing tests**

In `src/data/nws.test.ts`, replace the test `'anything else is an error, not a guess'` inside `describe('parseDurationHours', …)` with:

```ts
  test('anything else is null, not a guess and not an error', () => {
    expect(parseDurationHours('PT30M')).toBeNull()
    expect(parseDurationHours('P')).toBeNull()
    expect(parseDurationHours('')).toBeNull()
  })
```

Inside `describe('parseGridpoint with gaps in the data', …)`, after the last test, add:

```ts
  test('a value with a duration it cannot read is left out, and the rest of the forecast stands', () => {
    const body = sample()
    body.properties.windGust = {
      uom: 'wmoUnit:km_h-1',
      values: [
        { validTime: '2026-10-08T08:00:00+00:00/PT30M', value: 20 },
        { validTime: '2026-10-08T09:00:00+00:00/PT2H', value: 30 },
      ],
    }
    const { hours } = parseGridpoint(body)
    expect(hours.map((h) => h.gustMph && Math.round(h.gustMph))).toEqual([
      null,
      19,
      19,
    ])
    expect(hours[0].tempF).toBeCloseTo(68, 5)
  })

  test('a value whose start it cannot read is left out, never a NaN hour', () => {
    const body = sample()
    body.properties.windGust = {
      uom: 'wmoUnit:km_h-1',
      values: [{ validTime: 'soon/PT1H', value: 20 }],
    }
    const { hours } = parseGridpoint(body)
    expect(hours).toHaveLength(3)
    expect(hours.map((h) => h.gustMph)).toEqual([null, null, null])
    expect(hours.every((h) => Number.isFinite(h.t))).toBe(true)
  })
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/data/nws.test.ts`
Expected: FAIL. `parseDurationHours('PT30M')` throws, and `parseGridpoint` throws on the PT30M value.

- [ ] **Step 3: Return null and skip**

In `src/data/nws.ts`, replace `parseDurationHours` and its comment with:

```ts
/**
 * Hours in an ISO 8601 duration made of days and hours, such as 'P2DT4H'.
 * Null for anything else, such as one with minutes. NWS sends whole hours;
 * one odd value must not take the whole forecast down with it.
 */
export function parseDurationHours(duration: string): number | null {
  const match = /^P(?:(\d+)D)?(?:T(\d+)H)?$/.exec(duration)
  const hours = match ? Number(match[1] ?? 0) * 24 + Number(match[2] ?? 0) : 0
  return hours === 0 ? null : hours
}
```

In `parseGridpoint`, replace

```ts
      const [startText, duration] = validTime.split('/')
      const start = Date.parse(startText)
      const span = parseDurationHours(duration)
```

with

```ts
      const [startText, duration] = validTime.split('/')
      const start = Date.parse(startText)
      const span = parseDurationHours(duration ?? '')
      // A value that cannot be placed in time is left out. The rest stand.
      if (Number.isNaN(start) || span === null) continue
```

- [ ] **Step 4: Run everything**

Run: `npm run format && npm test && npm run lint && npm run build`
Expected: all pass, 385 tests, lint clean, build clean. If oxlint objects to `duration ?? ''` as unnecessary, drop the `?? ''`: `split` is typed as always giving a string, and a missing `/` gives `undefined` at run time, which the regex does not match.

- [ ] **Step 5: Commit**

```bash
git add src/data/nws.ts src/data/nws.test.ts
git commit -m "Leave out an NWS value that cannot be read instead of failing the forecast

A duration with minutes, or a start that does not parse, used to throw
from parseGridpoint and lose every value in the response. Closes the
second half of #24.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: A wholly passed forecast is no forecast in the list too, in `src/ui/weatherView.ts` and `src/ui/dayList.ts`

**Files:**
- Modify: `src/ui/weatherView.ts`, `src/ui/weatherView.test.ts`, `src/ui/dayList.ts`, `src/ui/dayList.test.ts`, `src/App.tsx`

**Interfaces:**
- Produces, in `weatherView.ts`: `forecastHours(forecast: Loaded<Forecast>, now: number): ForecastHour[]`, the saved forecast's hours, or none when every one of them has passed.
- Changes, in `dayList.ts`: `dayRows` reads `now` from its data, so its `Inputs` is `Pick<SpotData, 'now' | 'days' | 'spans' | 'hilo' | 'forecast'>`.
- Changes, in `dayList.ts`: `tonightWords(...).sunset` is `'No sunset today'` where the sun does not set.

- [ ] **Step 1: Write the failing tests**

In `src/ui/weatherView.test.ts`, change `import { weatherView } from './weatherView.ts'` to `import { forecastHours, weatherView } from './weatherView.ts'`, and at the end of the file add:

```ts
describe('forecastHours', () => {
  test('the hours of the forecast, while any of it is still to come', () => {
    expect(forecastHours(week, NOW)).toHaveLength(185)
  })

  test('none once its last hour is over, to the minute', () => {
    // The last record is for the 184th hour from 5 AM. It is over an hour on.
    const over = FIRST + 185 * HOUR
    expect(forecastHours(week, over)).toEqual([])
    expect(forecastHours(week, over - MINUTE)).toHaveLength(185)
  })

  test('none with nothing saved', () => {
    expect(forecastHours(loaded(null, 'loading'), NOW)).toEqual([])
  })
})
```

In `src/ui/dayList.test.ts`:
- Change the test at `expect(words.sunset).toBe('None today')` to `expect(words.sunset).toBe('No sunset today')`.
- In `describe('dayRows', …)`, change `const data = { ...frame, hilo: ready(events), forecast: ready(forecast) }` to `const data = { ...frame, now: NOW, hilo: ready(events), forecast: ready(forecast) }`.
- In the test `'with nothing loaded yet the rows still give the sun and the moon'`, change `{ ...frame, hilo: none(), forecast: none() }` to `{ ...frame, now: NOW, hilo: none(), forecast: none() }`.
- After the test `'past the end of the forecast, a row has no weather'`, add:

```ts
  test('a saved forecast whose every hour has passed gives no weather, as the panels give none', () => {
    // The forecast's last record is the hour after tomorrow's sunset. Two
    // hours on from that, all of it is over.
    const over = sunsetHour(1) + 2 * HOUR
    const stale = dayRows({ ...data, now: over }, null, ZONE)
    expect(stale[0].weather).toBeNull()
    expect(stale[1].weather).toBeNull()
  })

  test("today's sunset having passed does not take its weather away while the forecast runs on", () => {
    const evening = dayRows({ ...data, now: sunsetHour(1) }, null, ZONE)
    expect(evening[0].weather).not.toBeNull()
  })
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/ui/weatherView.test.ts src/ui/dayList.test.ts`
Expected: FAIL. `forecastHours` is not exported; the strip still says 'None today'; the stale rows still have weather.

- [ ] **Step 3: One rule for a wholly passed forecast**

In `src/ui/weatherView.ts`, add after the `WeatherView` interface:

```ts
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
```

In `weatherView`, replace the block from `const all = forecast.data?.hours ?? []` down to the end of the `if … else` that sets `notice` and `hours` with:

```ts
  const all = forecastHours(forecast, now)

  let notice: string | null = null
  let hours: ForecastHour[] = []
  if (all.length === 0) {
    // Nothing saved, or a saved forecast so old that all of it is in the
    // past and nothing has replaced it.
    notice =
      forecast.status === 'loading'
        ? 'Loading forecast'
        : 'Forecast unavailable'
  } else {
    // A day is inside the forecast if the forecast reaches the hour of its
    // anchor. Today is inside it for as long as the forecast has any of
    // today left, whatever the hour.
    const last = all[all.length - 1].t
    const reaches = Math.floor(selected.anchor / HOUR) * HOUR <= last
    hours = all.filter((hour) => hour.t >= span.start && hour.t < span.end)
    if (hours.length === 0 || !(reaches || selected.isToday)) {
      notice = 'No forecast this far out.'
      hours = []
    }
  }
```

- [ ] **Step 4: The list uses it, and the strip's wording**

In `src/ui/dayList.ts`:
- Add `import { forecastHours } from './weatherView.ts'` after the `selection.ts` import.
- Change `type Inputs = Pick<SpotData, 'days' | 'spans' | 'hilo' | 'forecast'>` to `type Inputs = Pick<SpotData, 'now' | 'days' | 'spans' | 'hilo' | 'forecast'>`.
- In `dayRows`, replace `const hours = data.forecast.data?.hours ?? []` with `const hours = forecastHours(data.forecast, data.now)`.
- In `tonightWords`, change `'None today'` to `'No sunset today'`.

In `src/App.tsx`, change the `rows` memo to:

```ts
  const rows = useMemo(
    () =>
      dayRows({ now: data.now, days, spans, hilo, forecast }, pickedDay, zone),
    [data.now, days, spans, hilo, forecast, pickedDay, zone],
  )
```

and change the comment above it to:

```ts
  // The rows do not depend on the cursor, so they are not worked out again,
  // and the list is not drawn again, each time it moves. They are worked out
  // again once a minute, with the clock.
```

- [ ] **Step 5: Run everything**

Run: `npm run format && npm test && npm run lint && npm run build`
Expected: all pass, 390 tests, lint clean, build clean.

- [ ] **Step 6: Commit**

```bash
git add src/ui/weatherView.ts src/ui/weatherView.test.ts src/ui/dayList.ts src/ui/dayList.test.ts src/App.tsx
git commit -m "A wholly passed forecast is no forecast in the list, as in the panels

On the evening of a saved forecast's last day, with no network, today's
row could read 'At sunset 65°F' while the panels said 'Forecast
unavailable'. The rule is now one function. Closes #23. The strip also
says 'No sunset today', to match its 'No moonrise today'.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: The tide panel's grid, dots and words, in `src/ui/tideView.ts`

**Files:**
- Modify: `src/chart/Panel.tsx`, `src/chart/readout.ts`, `src/chart/readout.test.ts`, `src/ui/tideView.ts`, `src/ui/tideView.test.ts`

**Interfaces:**
- Produces, in `Panel.tsx`: `export interface Rule { v: number; label: string }` and `export interface Dot { name: string; v: number }`. `Series` and `Marker` are already exported.
- Produces, in `readout.ts`: `cursorText(time: string, panels: string[]): string`.
- Produces, in `tideView.ts`, on `TideView`:
  - `title: string`, always `'Tide'`
  - `text: { predicted: string; observed: string | null }`, the readout in words
  - `words: string`, the panel's run of words for a screen reader
  - `rules: Rule[]`, `series: Series[]`, `dots: Dot[]`
- `App.tsx` is not touched here; it keeps working because the fields are additions. Task 8 switches it over.

- [ ] **Step 1: Write the failing tests**

In `src/chart/readout.test.ts`, add `cursorText,` to the import list from `./readout.ts` (keep the list alphabetical), and at the end of the file add:

```ts
describe('cursorText', () => {
  test('the time, then each panel, set apart by semicolons', () => {
    expect(
      cursorText('3:36 PM', ['Tide: 3.0 ft predicted', 'Wind: 9 mph, from W']),
    ).toBe('3:36 PM; Tide: 3.0 ft predicted; Wind: 9 mph, from W')
  })
})
```

In `src/ui/tideView.test.ts`, at the end of the file add:

```ts
describe('what the panel is given', () => {
  test('a rule every 2 ft across the range, each with its label', () => {
    const view = tideView(data(), TODAY, null)
    expect(view.bounds).toEqual([3, 7])
    expect(view.rules).toEqual([
      { v: 4, label: '4 ft' },
      { v: 6, label: '6 ft' },
    ])
  })

  test('below the datum the rules read minus, and zero is never minus zero', () => {
    const low = ready([...curve, { t: START + 8 * DAY, ft: -1.5 }])
    const view = tideView(data({ predictions: low }), TODAY, null)
    expect(view.bounds).toEqual([-2, 7])
    expect(view.rules.map((rule) => rule.label)).toEqual([
      '-2 ft',
      '0 ft',
      '2 ft',
      '4 ft',
      '6 ft',
    ])
  })

  test('the curve is filled, and the readings break at a gap longer than two steps', () => {
    const view = tideView(data(), TODAY, null)
    expect(view.series.map((series) => series.name)).toEqual([
      'predicted',
      'observed',
    ])
    expect(view.series[0].filled).toBe(true)
    expect(view.series[0].points).toHaveLength(view.predicted.length)
    expect(view.series[0].points[0]).toEqual({ t: START, v: 3 })
    expect(view.series[1].maxGap).toBe(13 * MINUTE)
    expect(view.series[1].points).toHaveLength(readings.length)
  })

  test('a dot for the prediction and one for the reading under the cursor', () => {
    expect(tideView(data(), TODAY, null).dots).toEqual([
      { name: 'predicted', v: 3 },
      { name: 'observed', v: 4 },
    ])
  })

  test('on another day there is no reading, so no dot for one', () => {
    expect(tideView(data(), TOMORROW, null).dots).toEqual([
      { name: 'predicted', v: 3 },
    ])
  })

  test('the panel is named, and its words for a screen reader start with its name', () => {
    const view = tideView(data(), TODAY, null)
    expect(view.title).toBe('Tide')
    expect(view.text).toEqual({
      predicted: '3.0 ft predicted',
      observed: '4.0 ft observed (+1.0)',
    })
    expect(view.words).toBe('Tide: 3.0 ft predicted, 4.0 ft observed (+1.0)')
    expect(tideView(data(), TOMORROW, null).words).toBe(
      'Tide: 3.0 ft predicted',
    )
  })

  test('with no curve, the words are the notice', () => {
    const view = tideView(data({ predictions: none('unavailable') }), TODAY, null)
    expect(view.words).toBe('Tide data unavailable')
    expect(view.rules).toEqual([])
    expect(view.dots).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/chart/readout.test.ts src/ui/tideView.test.ts`
Expected: FAIL. `cursorText` is not exported; `rules`, `series`, `dots`, `title`, `text` and `words` are undefined.

- [ ] **Step 3: Export the types and add `cursorText`**

In `src/chart/Panel.tsx`, after the `Marker` interface add:

```ts
/** A horizontal rule across the plot, and its label. */
export interface Rule {
  v: number
  label: string
}

/** A dot where the cursor meets a value. Its class is `dot-<name>`. */
export interface Dot {
  name: string
  v: number
}
```

and in `PanelProps` change `rules: { v: number; label: string }[]` to `rules: Rule[]` and `dots: { name: string; v: number }[]` to `dots: Dot[]`.

In `src/chart/readout.ts`, at the end of the file add:

```ts
/**
 * Everything under the cursor as one run of words, for a screen reader: the
 * time, then what each panel says. Panels are set apart by semicolons
 * because the words within one are already set apart by commas.
 */
export function cursorText(time: string, panels: string[]): string {
  return [time, ...panels].join('; ')
}
```

- [ ] **Step 4: Extend `tideView`**

Replace the whole of `src/ui/tideView.ts` with:

```ts
// What the tide part of the screen shows, worked out from what is loaded,
// which day is on screen and where the cursor was last put. A plain function,
// so the rules have tests and App.tsx only arranges the result.

import type { Dot, Rule, Series } from '../chart/Panel.tsx'
import {
  STEP,
  restingCursor,
  tideReadout,
  tideWords,
} from '../chart/readout.ts'
import type { TideReadout } from '../chart/readout.ts'
import { steppedBounds, wholeSteps } from '../chart/scales.ts'
import type { TideExtreme, TidePoint } from '../data/noaa.ts'
import type { SpotData } from '../data/useSpotData.ts'
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

export interface TideView {
  title: string
  /** The day's predicted curve, reaching both edges of the plot. */
  predicted: TidePoint[]
  /** The day's readings, in order. Only today has any. */
  observed: TidePoint[]
  /** The day's highs and lows. */
  events: TideExtreme[]
  cursor: number
  /** The plot's vertical range, in whole feet. */
  bounds: [number, number]
  readout: TideReadout
  /** The readout in words: the prediction, and the reading if there is one. */
  text: { predicted: string; observed: string | null }
  /** Everything the panel says at the cursor, as one run of words. */
  words: string
  rules: Rule[]
  /** The curve, filled, with the readings over it. */
  series: Series[]
  /** Where the cursor meets the curve, and the reading if there is one. */
  dots: Dot[]
  /** What to say where the plot would be, when there is no curve to draw. */
  notice: string | null
}

type Inputs = Pick<
  SpotData,
  'now' | 'shown' | 'day' | 'predictions' | 'hilo' | 'observed'
>

export function tideView(
  data: Inputs,
  selected: Selected,
  pick: CursorPick | null,
): TideView {
  const { span } = selected
  // Both ends are included, so the curve reaches the right edge of the plot
  // by using the first point of the next day.
  const within = (points: TidePoint[] | null, day: typeof span) =>
    (points ?? []).filter((point) => point.t >= day.start && point.t <= day.end)
  const predicted = within(data.predictions.data, span)
  const readings = within(data.observed.data, data.day)
  const observed = selected.isToday ? readings : []
  const events = onDay(data.hilo.data ?? [], span)

  // Where the cursor sits until someone moves it. Today that is the latest
  // reading, or the clock. Any other day it is the day's anchor. It is the
  // step that contains the anchor, never the one after: a sunset at 4:59 PM
  // must not tip the cursor into the 5 PM hour, or the weather under it
  // would not be the hour that the day's row in the list gives.
  const rest = selected.isToday
    ? restingCursor(data.now, observed)
    : Math.floor(selected.anchor / STEP) * STEP
  // A pick belongs to the day it was made on, and lasts until the page is put
  // away and brought back. After that the cursor goes back to rest, so
  // reopening the app shows the latest reading and not wherever the cursor
  // was left. Choosing a day from the list clears the pick, in App.tsx.
  const held =
    pick !== null && pick.day === selected.date && pick.shown === data.shown
  const cursor = held ? Math.min(Math.max(pick.t, span.start), span.end) : rest

  // One vertical range for all 14 days, so one day can be compared with
  // another, widened if needed to fit today's readings. Those count on every
  // day, so the scale does not jump when another day is chosen.
  const bounds = steppedBounds(
    [...(data.predictions.data ?? []), ...readings].map((point) => point.ft),
    1,
  )

  let notice: string | null = null
  if (predicted.length === 0) {
    notice =
      data.predictions.status === 'loading'
        ? 'Loading tides'
        : 'Tide data unavailable'
  }

  const readout = tideReadout(predicted, observed, cursor)
  const text = tideWords(readout)
  const dots: Dot[] = []
  if (readout.predictedFt !== null) {
    dots.push({ name: 'predicted', v: readout.predictedFt })
  }
  if (readout.observedFt !== null) {
    dots.push({ name: 'observed', v: readout.observedFt })
  }
  // For a screen reader. The panel is named, so the words are never left
  // hanging among the weather panels'. Without a curve there is no panel,
  // and the notice is said instead.
  const said = [text.predicted, text.observed].filter((part) => part !== null)
  const words = notice ?? `${TITLE}: ${said.join(', ')}`

  return {
    title: TITLE,
    predicted,
    observed,
    events,
    cursor,
    bounds,
    readout,
    text,
    words,
    rules:
      notice === null
        ? wholeSteps(bounds[0], bounds[1], RULE_EVERY).map((v) => ({
            v,
            label: `${v} ft`,
          }))
        : [],
    series: [
      {
        name: 'predicted',
        filled: true,
        points: predicted.map((p) => ({ t: p.t, v: p.ft })),
      },
      {
        name: 'observed',
        maxGap: OBSERVED_GAP,
        points: observed.map((p) => ({ t: p.t, v: p.ft })),
      },
    ],
    dots,
    notice,
  }
}
```

- [ ] **Step 5: Run everything**

Run: `npm run format && npm test && npm run lint && npm run build`
Expected: all pass, 398 tests, lint clean, build clean. `App.tsx` still compiles: it ignores the new fields until Task 8.

- [ ] **Step 6: Commit**

```bash
git add src/chart/Panel.tsx src/chart/readout.ts src/chart/readout.test.ts src/ui/tideView.ts src/ui/tideView.test.ts
git commit -m "Work out the tide panel's grid, dots and words in tideView

App.tsx still worked out the rules, the dots and the screen reader's
run of words. The run of words now names the panel. Part of #25 and
the first half of #24.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: The weather panels' titles, grid and step, in `src/ui/weatherView.ts`

**Files:**
- Modify: `src/ui/weatherView.ts`, `src/ui/weatherView.test.ts`

**Interfaces:**
- Produces, on `WeatherPanelView`: `title: string`, `rules: Rule[]`, and `series: Series[]` where every series carries `step: HOUR`.
- Changes: `WeatherView.words` names each panel: `'Wind: 9 mph, gusts 12, from W; Temperature: 65°F; Sky: 3% cloud, 0% rain'`. Where no panel has anything, `'No forecast here'` once, as before. A notice is still given as itself.
- `WeatherPanels.tsx` is not touched here; it keeps working because the fields are additions. Task 8 switches it over.

- [ ] **Step 1: Write the failing tests**

In `src/ui/weatherView.test.ts`, inside `describe('what is read out', …)`, replace the test `'says it all in one run of words, for a screen reader'` with:

```ts
  test('says it all in one run of words, naming each panel, for a screen reader', () => {
    expect(weatherView(week, day(0), NOW, NOW).words).toBe(
      'Wind: 9 mph, gusts 12, from W; Temperature: 65°F; Sky: 3% cloud, 0% rain',
    )
  })

  test('a panel with nothing to say is still named, so the words are not left hanging', () => {
    const patchy = loaded(
      hourly(FIRST, 185, (hour) => {
        hour.tempF = null
      }),
    )
    expect(weatherView(patchy, day(0), NOW, NOW).words).toBe(
      'Wind: 9 mph, gusts 12, from W; Temperature: No forecast here; Sky: 3% cloud, 0% rain',
    )
  })
```

Keep the test `'where no panel has anything to say, the run of words says so once'` as it is.

Inside `describe('what is drawn', …)`, after the last test, add:

```ts
  test('each panel is named, has a rule every so often with its unit, and draws staircases', () => {
    const view = weatherView(week, day(0), NOW, NOW)
    expect([view.wind.title, view.temp.title, view.sky.title]).toEqual([
      'Wind',
      'Temperature',
      'Sky',
    ])
    expect(view.sky.rules).toEqual([
      { v: 0, label: '0%' },
      { v: 50, label: '50%' },
      { v: 100, label: '100%' },
    ])
    expect(view.wind.rules).toEqual([
      { v: 0, label: '0 mph' },
      { v: 10, label: '10 mph' },
      { v: 20, label: '20 mph' },
    ])
    expect(view.temp.rules[0]).toEqual({ v: 50, label: '50°F' })
    const all = [...view.wind.series, ...view.temp.series, ...view.sky.series]
    expect(all.every((series) => series.step === HOUR)).toBe(true)
  })

  test('a panel that is not drawn still has its name and its rules, so the layout does not depend on data', () => {
    const view = weatherView(loaded(null, 'unavailable'), day(0), NOW, NOW)
    expect(view.temp.title).toBe('Temperature')
    expect(view.sky.rules).toHaveLength(3)
  })
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/ui/weatherView.test.ts`
Expected: FAIL. `title`, `rules` and `step` are undefined, and `words` has no panel names.

- [ ] **Step 3: Extend `weatherView`**

In `src/ui/weatherView.ts`:

Change the imports to:

```ts
import type { Dot, Rule, Series } from '../chart/Panel.tsx'
import {
  hourAt,
  partsText,
  skyParts,
  tempParts,
  windParts,
} from '../chart/readout.ts'
import type { ReadoutPart } from '../chart/readout.ts'
import { steppedBounds, wholeSteps } from '../chart/scales.ts'
import type { Loaded } from '../data/load.ts'
import type { Forecast, ForecastHour } from '../data/nws.ts'
import { HOUR } from '../time.ts'
import type { Selected } from './selection.ts'
```

(`Point` is no longer imported.)

Replace the `WeatherPanelView` interface with:

```ts
export interface WeatherPanelView {
  title: string
  /** The values under the cursor, in words, each with its series' key. */
  readout: ReadoutPart[]
  /** The plot's vertical range. */
  bounds: [number, number]
  rules: Rule[]
  /** One staircase per value, each point holding for an hour. */
  series: Series[]
  /** Where the cursor meets each value the hour under it has. */
  dots: Dot[]
}
```

Replace `type Field = …` and the `panel` function with:

```ts
type Field = Exclude<keyof ForecastHour, 't'>

interface PanelSpec {
  title: string
  /** The series, in the order drawn: each one's name and the field it draws. */
  fields: [name: string, field: Field][]
  /** How far apart the rules are, and the unit written on each label. */
  every: number
  unit: string
}

const WIND: PanelSpec = {
  title: 'Wind',
  fields: [
    ['wind', 'windMph'],
    ['gust', 'gustMph'],
  ],
  every: 10,
  unit: ' mph',
}
const TEMP: PanelSpec = {
  title: 'Temperature',
  fields: [['temp', 'tempF']],
  every: 10,
  unit: '°F',
}
const SKY: PanelSpec = {
  title: 'Sky',
  fields: [
    ['cloud', 'cloudPct'],
    ['rain', 'rainPct'],
  ],
  every: 50,
  unit: '%',
}

function panel(
  spec: PanelSpec,
  readout: ReadoutPart[],
  bounds: [number, number],
  hours: ForecastHour[],
  at: ForecastHour | null,
): WeatherPanelView {
  const dots: Dot[] = []
  for (const [name, field] of spec.fields) {
    const v = at ? at[field] : null
    if (v !== null) dots.push({ name, v })
  }
  return {
    title: spec.title,
    readout: readout.length > 0 ? readout : NOTHING_HERE,
    bounds,
    rules: wholeSteps(bounds[0], bounds[1], spec.every).map((v) => ({
      v,
      label: `${v}${spec.unit}`,
    })),
    series: spec.fields.map(([name, field]) => ({
      name,
      step: HOUR,
      // An hour with no value for this field leaves a break in its line.
      points: hours.flatMap((hour) => {
        const v = hour[field]
        return v === null ? [] : [{ t: hour.t, v }]
      }),
    })),
    dots,
  }
}
```

In `weatherView`, replace the three `panel(…)` calls and the `said`/`words` lines (from `const wind = panel(` to `const words = …`) with:

```ts
  const wind = panel(WIND, windParts(at), windBounds, hours, at)
  const temp = panel(TEMP, tempParts(at), tempBounds, hours, at)
  const sky = panel(SKY, skyParts(at), [0, 100], hours, at)
  // For a screen reader. Each panel is named, so "No forecast here" never
  // reads as if it were the temperature. Where none of them has anything to
  // say, that is said once, not three times.
  const panels = [wind, temp, sky]
  const nothing = panels.every((one) => one.readout === NOTHING_HERE)
  const words =
    notice ??
    (nothing
      ? partsText(NOTHING_HERE)
      : panels.map((one) => `${one.title}: ${partsText(one.readout)}`).join('; '))
```

- [ ] **Step 4: Run everything**

Run: `npm run format && npm test && npm run lint && npm run build`
Expected: all pass, 401 tests, lint clean, build clean.

- [ ] **Step 5: Commit**

```bash
git add src/ui/weatherView.ts src/ui/weatherView.test.ts
git commit -m "Work out the weather panels' titles, grid and step in weatherView

WeatherPanels.tsx still passed each panel's grid step, unit and the
hour each value holds for. The screen reader's run of words now names
each panel. Part of #25 and the first half of #24.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: The components only arrange, in `src/App.tsx` and `src/ui/WeatherPanels.tsx`

**Files:**
- Modify: `src/App.tsx`, `src/ui/WeatherPanels.tsx`

**Interfaces:**
- Consumes: everything Tasks 5, 6 and 7 produce. Nothing new is produced.

There are no unit tests for components in this project; they are checked in a browser. The type check, lint and build are this task's gate, and the owner drives the page afterwards.

- [ ] **Step 1: Rewrite `App.tsx`**

Replace the whole of `src/App.tsx` with:

```tsx
import { useCallback, useMemo, useRef, useState } from 'react'
import { Panel } from './chart/Panel.tsx'
import { PanelStack } from './chart/PanelStack.tsx'
import { cursorText } from './chart/readout.ts'
import { linearScale } from './chart/scales.ts'
import { useSpotData } from './data/useSpotData.ts'
import { CAMPUS_POINT } from './spot.ts'
import { formatDay, formatTime } from './time.ts'
import { tideCaption, weatherCaption } from './ui/captions.ts'
import { DayList } from './ui/DayList.tsx'
import { dayRows, tonightWords } from './ui/dayList.ts'
import { HiLoTable } from './ui/HiLoTable.tsx'
import { dayMarkers, selectedDay } from './ui/selection.ts'
import { tideView } from './ui/tideView.ts'
import type { CursorPick } from './ui/tideView.ts'
import { TonightStrip } from './ui/TonightStrip.tsx'
import { WeatherPanels } from './ui/WeatherPanels.tsx'
import { weatherView } from './ui/weatherView.ts'

const TIDE_HEIGHT = 168
/** Room above the highest tide for a rule's label. */
const HEADROOM = 14

export default function App() {
  const spot = CAMPUS_POINT
  const zone = spot.timeZone
  const data = useSpotData(spot)
  const { days, spans, hilo, forecast } = data

  const [pickedDay, setPickedDay] = useState<string | null>(null)
  const [pick, setPick] = useState<CursorPick | null>(null)
  const selected = selectedDay(data, pickedDay)
  const tide = tideView(data, selected, pick)
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
      dayRows({ now: data.now, days, spans, hilo, forecast }, pickedDay, zone),
    [data.now, days, spans, hilo, forecast, pickedDay, zone],
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

  return (
    <main>
      <h1>{spot.name}</h1>
      <TonightStrip words={tonight} />

      <section className="day" ref={dayTop}>
        <header className="day-head">
          <h2>{formatDay(selected.date)}</h2>
          <p className="day-cursor">at {cursorTime}</p>
        </header>

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
              {tide.notice !== null ? (
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
                          reading comes and goes. */}
                      <span
                        className={
                          tide.text.observed === null
                            ? undefined
                            : 'key key-observed'
                        }
                      >
                        {tide.text.observed}
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

        <p className="caption">
          {tideCaption(spot, {
            predictions: data.predictions,
            hilo,
            observed: data.observed,
            readings: tide.observed,
            today: data.today,
            isToday: selected.isToday,
          })}
        </p>
        <p className="caption">{weatherCaption(spot, forecast, data.today)}</p>
      </section>

      <DayList rows={rows} onSelect={selectDay} />
    </main>
  )
}
```

- [ ] **Step 2: Rewrite `WeatherPanels.tsx`**

Replace the whole of `src/ui/WeatherPanels.tsx` with:

```tsx
import { Panel } from '../chart/Panel.tsx'
import type { Marker } from '../chart/Panel.tsx'
import { linearScale } from '../chart/scales.ts'
import type { Scale } from '../chart/scales.ts'
import type { WeatherPanelView, WeatherView } from './weatherView.ts'

const HEIGHT = 84
/** Room above the highest value for a rule's label. */
const HEADROOM = 14

interface WeatherPanelsProps {
  view: WeatherView
  width: number
  x: Scale
  markers: Marker[]
  cursor: number
}

/** Wind, temperature and sky for one day, or a line saying why not. */
export function WeatherPanels({
  view,
  width,
  x,
  markers,
  cursor,
}: WeatherPanelsProps) {
  if (view.notice !== null) return <p className="notice">{view.notice}</p>

  const panel = (one: WeatherPanelView) => (
    <Panel
      title={one.title}
      readout={
        <span className="readout-row">
          {one.readout.map((part) => (
            <span
              key={part.text}
              className={part.key === null ? undefined : `key key-${part.key}`}
            >
              {part.text}
            </span>
          ))}
        </span>
      }
      width={width}
      height={HEIGHT}
      x={x}
      y={linearScale(one.bounds, [HEIGHT, HEADROOM])}
      rules={one.rules}
      series={one.series}
      markers={markers}
      cursor={cursor}
      dots={one.dots}
    />
  )

  return (
    <>
      {panel(view.wind)}
      {panel(view.temp)}
      {panel(view.sky)}
    </>
  )
}
```

- [ ] **Step 3: Check that the components hold nothing they should not**

Run: `grep -n "wholeSteps\|tideWords\|Math\.\| mph\|°F\|'%'\|HOUR" src/App.tsx src/ui/WeatherPanels.tsx`
Expected: no output.

- [ ] **Step 4: Run everything**

Run: `npm run format && npm test && npm run lint && npm run build`
Expected: all pass, 401 tests, lint clean, build clean.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/ui/WeatherPanels.tsx
git commit -m "Hand the panels what the views work out, and nothing else

App.tsx and WeatherPanels.tsx no longer hold the grid, the units, the
dots or the screen reader's words. Closes #25 and #24.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Open the pull request

**Files:**
- Modify: none. `CLAUDE.md` already lists the plain modules and says the components hold no arithmetic; nothing in it changes.

- [ ] **Step 1: Check the branch**

Run: `git log --oneline main..HEAD`
Expected: eight commits, Tasks 1 to 8 in order. If the plan file `docs/superpowers/plans/2026-10-09-stage-1-review-follow-ups.md` is not yet committed, commit it first:

```bash
git add docs/superpowers/plans/2026-10-09-stage-1-review-follow-ups.md
git commit -m "Add the plan for the Stage 1 review follow-ups

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 2: Push and open the pull request**

```bash
git push -u origin stage-1/review-follow-ups
gh pr create --title "Stage 1 review follow-ups: one rule each, nothing left in the components" --body "$(cat <<'EOF'
The three issues the final review of #22 left behind, and the duplication it did not reach. Plan: `docs/superpowers/plans/2026-10-09-stage-1-review-follow-ups.md`.

- A saved forecast whose every hour has passed is no forecast in the 14-day list, as it already was in the panels. Closes #23.
- An NWS value with a duration or a start that cannot be read is left out; the rest of the forecast stands. The screen reader's run of words names every panel: "3:36 PM; Tide: 3.0 ft predicted, 4.0 ft observed (+1.0); Wind: 9 mph, gusts 12, from W; Temperature: 65°F; Sky: 3% cloud, 0% rain". Closes #24.
- The tide panel's grid, dots and words are worked out in `tideView`; the weather panels' titles, grid and step in `weatherView`. `App.tsx` and `WeatherPanels.tsx` hand them to `Panel` and hold no arithmetic, rules or wording. The strip says "No sunset today", matching its "No moonrise today". Closes #25.
- Defined once instead of several times: the time constants (`time.ts`), a day's anchor instant and the midnight rule for highs and lows (`selection.ts`), and whole-number bounds (`steppedBounds` with a step of 1; `wholeBounds` is gone).

Nothing on screen changes except the screen reader's words and the strip's wording where there is no sunset.

## Checking it

In a browser at phone width against https://tideline.ibuild4you.com and the preview of this pull request, side by side:

1. The four panels, their rules and labels ("2 ft", "10 mph", "50°F", "50%"), the readouts and the dots look the same on both.
2. Dragging across any panel moves the cursor on both the same way, and tapping a row in the list puts that day up on both.
3. With a screen reader or the accessibility tree, the slider's value text reads "<time>; Tide: …; Wind: …; Temperature: …; Sky: …", each panel named.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Stop**

Report the pull request URL. Do not merge.

---

## After this plan

- The owner checks the page in a browser as the pull request says, and merges.
- Stage 2 waits for the first user's reaction to Stage 1 and the answers to the questions in `docs/superpowers/plans/2026-10-08-stage-1-weather-and-days.md`.
