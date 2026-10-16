# The Panels Across a Day, Three Days or a Week Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three buttons under the day's heading, "Day", "3 days" and "Week", draw the panels across a window of 1, 3 or 7 of the 14 days from the chosen day, with weekday labels under the stack, and keep the choice for a reload.

**Architecture:** A new plain module `src/ui/spanView.ts` holds the choice type, the window arithmetic, the labels under the stack, the heading's and cursor's words, and the union of the window's markers and bands over the per-day functions already in `src/ui/selection.ts`. `Selected` gains a `window`; `tideView` and `weatherView` slice what they draw by it and keep the chosen day's `span` for the highs and lows, the anchor and the forecast's reach. `PanelStack` takes its foot labels as a prop. A new `SpanControl` component renders the three buttons. `choices.ts` keeps the choice in `sessionStorage`.

**Tech Stack:** Vite, React 19, strict TypeScript, Vitest, plain CSS, hand-written SVG.

**Spec:** `docs/superpowers/specs/2026-10-15-span-control-design.md`. Read it first: it says what the user sees and lists the decisions the owner reviews on the pull request.

## Global Constraints

- Code style: no semicolons, single quotes, relative imports carry their `.ts`/`.tsx` extension, type-only imports use `import type`, no enums. `npm run lint` (oxlint then Prettier) must pass; run `npm run format` before committing.
- Tests run with `TZ=Asia/Tokyo`; nothing may depend on the viewer's time zone. Every local day or weekday is worked out with the spot's zone through `src/time.ts`, the only module that knows about zones.
- Components hold no arithmetic, no rules and no wording. Those go in `src/ui/spanView.ts`, `src/ui/selection.ts`, `src/ui/tideView.ts`, `src/ui/weatherView.ts`, `src/ui/choices.ts`, `src/time.ts`, each with tests.
- Words, exactly: the buttons `Day`, `3 days`, `Week`; the radiogroup's `aria-label` is `Days on the panels`; the heading `Thu Oct 15 to Wed Oct 21` (the chosen day as `formatDay` gives it, a space, `to`, a space, the window's last day), or the chosen day alone when the window is one day; the cursor `Fri 3:00 PM` (three-letter weekday, a space, the time as `formatTime` gives it) when the window is wider than a day, and the time alone when it is not; the corner `at Fri 3:00 PM`. Weekday labels under the stack are three letters (`Thu`); the noon label is `12p`; the one-day labels stay `12a`, `6a`, `12p`, `6p`.
- The window from chosen index `i` with `n` days is the days `i` through `min(i + n, spans.length) - 1`, instants from the first day's start to the last day's end. Days are the spot's local days, 23 or 25 hours on a clock change.
- The session key is `tideline:span`, in `sessionStorage`, never `localStorage`. Every storage access is wrapped in try/catch, as `choices.ts` already does.
- The type for the choice is `SpanChoice` (`'day' | 'days3' | 'week'`), not `Span`: `Span` is already `{ start, end }` in `src/data/cache.ts` and both are used in the same files. Note this for the owner on the pull request as a departure from the spec's naming.
- In every tracked file and commit message the first user is "the first user"; no names from `private/`.
- Commit messages are one imperative line, as the repo's are ("Add the spec for …"), with the trailer on every commit, regardless of the model doing the work:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- Node 24. In each shell, before any `npm` or `npx`: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH`. Do not `source` nvm.
- Work in `/Users/nico/src/tideline` on the branch `feat/span-control`, which is checked out there. No `git stash`, `git reset`, `git checkout` of other branches, or `git clean`.

## Review Focus

1. A clock-change day inside the window (1 November 2026, 25 hours at Campus Point): the day's start label must sit at its own midnight and the noon label 13 hours after it, not 12. Pinned in Task 1 (`stackLabels` over a window from 31 October).
2. "Week" or "3 days" chosen on one of the last days: the window must be clipped to the days that exist, the heading must name the clipped last day, and nothing may index past the 14. Pinned in Task 1 (`windowFor` and `headingWords` at index 12 and 13).
3. A cursor put by hand on the third day, then "Day" chosen: the pick must be clamped to the day's end, not left off the plot. Pinned in Task 3 (`tideView` with a pick past the window).
4. A spot switch must start on "Day" while a reload keeps the choice, with one key doing both. Pinned in Task 4 (`writeSpot` forgets the span; `readSpan` after it is `'day'`).
5. The forecast reaching the chosen day but not the later days of the window: the weather panels must draw the hours that exist and stop, with no notice. Pinned in Task 3 (`weatherView` with "Week" from the sixth day).

---

### Task 1: The window, its labels and its words

**Files:**
- Create: `src/ui/spanView.ts`
- Create: `src/ui/spanView.test.ts`
- Modify: `src/time.ts` (add `formatWeekday` after `formatTime`)
- Modify: `src/time.test.ts` (add a `describe('formatWeekday')`)

**Interfaces:**
- Consumes: `hourMarks(start, end, timeZone, every)`, `formatTime(t, timeZone)`, `formatDay(date)` from `src/time.ts`; `Span` from `src/data/cache.ts`; `frameFor(spot, today)` from `src/data/useSpotData.ts` in tests.
- Produces, in `src/ui/spanView.ts`:
  - `export type SpanChoice = 'day' | 'days3' | 'week'`
  - `export const SPANS: { id: SpanChoice; days: number; words: string }[]` with `day` 1 `Day`, `days3` 3 `3 days`, `week` 7 `Week`, in that order.
  - `export interface Window extends Span { first: number; last: number }` (indices in the 14, both included).
  - `export function windowFor(spans: Span[], index: number, choice: SpanChoice): Window`
  - `export interface StackLabel { t: number; text: string }`
  - `export function stackLabels(window: Window, timeZone: string, choice: SpanChoice): StackLabel[]`
  - `export function headingWords(days: { date: string }[], window: Window): string`
  - `export function cursorWords(t: number, timeZone: string, window: Window): string`
  - In `src/time.ts`: `export function formatWeekday(t: number, timeZone: string): string`, the three-letter weekday of the instant in the zone, from a cached `Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' })`.

- [ ] **Step 1: Write the failing tests**

In `src/time.test.ts`, add `formatWeekday` to the import and:

```ts
describe('formatWeekday', () => {
  test('the weekday in the zone, three letters', () => {
    // 11 PM Thursday 8 October in Los Angeles is Friday in UTC and in Tokyo.
    expect(formatWeekday(Date.UTC(2026, 9, 9, 6), LA)).toBe('Thu')
    expect(formatWeekday(Date.UTC(2026, 9, 9, 7), LA)).toBe('Fri')
  })
})
```

Create `src/ui/spanView.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import {
  SPANS,
  cursorWords,
  headingWords,
  stackLabels,
  windowFor,
} from './spanView.ts'
import { frameFor } from '../data/useSpotData.ts'
import { CAMPUS_POINT } from '../spot.ts'
import { HOUR, MINUTE } from '../time.ts'

const ZONE = CAMPUS_POINT.timeZone
// Thursday 8 October 2026 at the spot.
const frame = frameFor(CAMPUS_POINT, '2026-10-08')
const { spans, days } = frame

describe('SPANS', () => {
  test('three choices, in the order of the buttons', () => {
    expect(SPANS.map((s) => [s.id, s.days, s.words])).toEqual([
      ['day', 1, 'Day'],
      ['days3', 3, '3 days'],
      ['week', 7, 'Week'],
    ])
  })
})

describe('windowFor', () => {
  test('a day is the day itself', () => {
    expect(windowFor(spans, 3, 'day')).toEqual({ ...spans[3], first: 3, last: 3 })
  })

  test('a week from today runs to the end of the seventh day', () => {
    expect(windowFor(spans, 0, 'week')).toEqual({
      start: spans[0].start,
      end: spans[6].end,
      first: 0,
      last: 6,
    })
  })

  test('three days from the chosen day', () => {
    expect(windowFor(spans, 5, 'days3')).toEqual({
      start: spans[5].start,
      end: spans[7].end,
      first: 5,
      last: 7,
    })
  })

  test('a week from the thirteenth day is the two days that exist', () => {
    expect(windowFor(spans, 12, 'week')).toEqual({
      start: spans[12].start,
      end: spans[13].end,
      first: 12,
      last: 13,
    })
  })

  test('three days from the last day is that day', () => {
    expect(windowFor(spans, 13, 'days3')).toEqual({ ...spans[13], first: 13, last: 13 })
  })
})

describe('stackLabels', () => {
  test('one day keeps the hour marks, both midnights included', () => {
    const window = windowFor(spans, 0, 'day')
    expect(stackLabels(window, ZONE, 'day')).toEqual([
      { t: window.start, text: '12a' },
      { t: window.start + 6 * HOUR, text: '6a' },
      { t: window.start + 12 * HOUR, text: '12p' },
      { t: window.start + 18 * HOUR, text: '6p' },
      { t: window.end, text: '12a' },
    ])
  })

  test('three days label each day with its weekday and its noon, and not the end', () => {
    const window = windowFor(spans, 0, 'days3')
    expect(stackLabels(window, ZONE, 'days3')).toEqual([
      { t: spans[0].start, text: 'Thu' },
      { t: spans[0].start + 12 * HOUR, text: '12p' },
      { t: spans[1].start, text: 'Fri' },
      { t: spans[1].start + 12 * HOUR, text: '12p' },
      { t: spans[2].start, text: 'Sat' },
      { t: spans[2].start + 12 * HOUR, text: '12p' },
    ])
  })

  test('a week labels each day with its weekday only', () => {
    const window = windowFor(spans, 0, 'week')
    expect(stackLabels(window, ZONE, 'week')).toEqual(
      ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'].map((text, i) => ({
        t: spans[i].start,
        text,
      })),
    )
  })

  test('on the day the clocks go back, noon is 13 hours after midnight', () => {
    // 1 November 2026 is 25 hours long at the spot.
    const late = frameFor(CAMPUS_POINT, '2026-10-31')
    const window = windowFor(late.spans, 0, 'days3')
    const labels = stackLabels(window, ZONE, 'days3')
    expect(labels[2]).toEqual({ t: late.spans[1].start, text: 'Sun' })
    expect(labels[3]).toEqual({ t: late.spans[1].start + 13 * HOUR, text: '12p' })
    expect(labels[4]).toEqual({ t: late.spans[2].start, text: 'Mon' })
    expect(late.spans[2].start - late.spans[1].start).toBe(25 * HOUR)
  })
})

describe('headingWords', () => {
  test('one day is the day', () => {
    expect(headingWords(days, windowFor(spans, 0, 'day'))).toBe('Thu Oct 8')
  })

  test('a week names both ends', () => {
    expect(headingWords(days, windowFor(spans, 0, 'week'))).toBe(
      'Thu Oct 8 to Wed Oct 14',
    )
  })

  test('a clipped window names the last day that exists', () => {
    expect(headingWords(days, windowFor(spans, 12, 'week'))).toBe(
      'Tue Oct 20 to Wed Oct 21',
    )
  })
})

describe('cursorWords', () => {
  const t = spans[1].start + 15 * HOUR + 36 * MINUTE // Friday 3:36 PM

  test('one day is the time', () => {
    expect(cursorWords(t, ZONE, windowFor(spans, 1, 'day'))).toBe('3:36 PM')
  })

  test('a wider window puts the weekday before it', () => {
    expect(cursorWords(t, ZONE, windowFor(spans, 0, 'days3'))).toBe('Fri 3:36 PM')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/spanView.test.ts src/time.test.ts`
Expected: FAIL. `spanView.ts` does not exist; `formatWeekday` is not exported.

- [ ] **Step 3: Implement**

`formatWeekday` in `src/time.ts`, with the formatter cached in a `Map` keyed by zone as `timeFormat` is.

`src/ui/spanView.ts` with the interfaces above. `stackLabels` is one call to `hourMarks`: `every` 6 for `day` with the `HOUR_LABELS` table moved here from `PanelStack.tsx` (`0: '12a', 6: '6a', 12: '12p', 18: '6p'`); 12 for `days3` and 24 for `week`, where a mark at hour 0 is labelled `formatWeekday(t, timeZone)` and one at hour 12 is `12p`, and the mark at `window.end` is dropped for both. A file comment says the labels under the stack and the words for the window live here.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/ui/spanView.test.ts src/time.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
npm run format && npm run lint
git add src/ui/spanView.ts src/ui/spanView.test.ts src/time.ts src/time.test.ts
git commit -m "Add the window of days the panels can draw, its labels and its words" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The chosen day carries its window, and the window its markers and bands

**Files:**
- Modify: `src/ui/selection.ts`
- Modify: `src/ui/selection.test.ts`
- Modify: `src/ui/spanView.ts` (add `windowMarkers`, `windowBands`)
- Modify: `src/ui/spanView.test.ts`

**Interfaces:**
- Consumes: `windowFor`, `Window`, `SpanChoice` from Task 1; `Marker`, `Band` from `src/chart/Panel.tsx`; `DayAstro` from `src/data/astro.ts`.
- Produces:
  - `Selected` gains `window: Window`. `selectedDay(data, picked, choice: SpanChoice = 'day'): Selected` sets it from `windowFor(data.spans, index, choice)`. `span`, `anchor`, `isToday` stay the chosen day's.
  - `dayMarkers(selected: Pick<Selected, 'astro' | 'isToday'>, now: number): Marker[]` and `dayBands(selected: Pick<Selected, 'astro'>): Band[]`: the same functions with their parameter types widened, so one can be built for any day. Their tests stay as they are.
  - In `src/ui/spanView.ts`: `export function windowMarkers(days: DayAstro[], window: Window, now: number): Marker[]`, the markers of each day in the window in day order, through `dayMarkers` with `isToday` true for index 0 only, and through `unlabelled` when `window.last > window.first`. `export function windowBands(days: DayAstro[], window: Window): Band[]`, the days' `dayBands` concatenated.

- [ ] **Step 1: Write the failing tests**

In `src/ui/selection.test.ts`, inside `describe('selectedDay')`:

```ts
  test('without a choice the window is the day', () => {
    const selected = selectedDay(frame, '2026-10-11')
    expect(selected.window).toEqual({ ...frame.spans[3], first: 3, last: 3 })
  })

  test('a week from the chosen day is its window; the day itself is unchanged', () => {
    const selected = selectedDay(frame, '2026-10-11', 'week')
    expect(selected.window).toEqual({
      start: frame.spans[3].start,
      end: frame.spans[9].end,
      first: 3,
      last: 9,
    })
    expect(selected.span).toEqual(frame.spans[3])
    expect(selected.anchor).toBe(frame.days[3].sunset)
  })
```

In `src/ui/spanView.test.ts`, add `windowBands`, `windowMarkers` to the import, and `dayBands`, `dayMarkers`, `unlabelled` from `./selection.ts`, plus:

```ts
const NOW = Date.UTC(2026, 9, 8, 22, 36) // 3:36 PM today

describe('windowMarkers', () => {
  test('one day is the day\'s markers, names and all', () => {
    const window = windowFor(spans, 0, 'day')
    expect(windowMarkers(days, window, NOW)).toEqual(
      dayMarkers({ astro: days[0], isToday: true }, NOW),
    )
  })

  test('a week has each day\'s sunset and moonrise without names, and the current time once', () => {
    const window = windowFor(spans, 0, 'week')
    const markers = windowMarkers(days, window, NOW)
    expect(markers.filter((m) => m.name === 'now')).toEqual([{ name: 'now', t: NOW }])
    expect(markers.filter((m) => m.name === 'sunset').map((m) => m.t)).toEqual(
      days.slice(0, 7).map((d) => d.sunset),
    )
    expect(markers.every((m) => !('label' in m))).toBe(true)
    expect(markers).toEqual(
      days.slice(0, 7).flatMap((astro, i) =>
        unlabelled(dayMarkers({ astro, isToday: i === 0 }, NOW)),
      ),
    )
  })

  test('a window that does not start today has no current time', () => {
    const window = windowFor(spans, 2, 'days3')
    expect(windowMarkers(days, window, NOW).some((m) => m.name === 'now')).toBe(false)
  })
})

describe('windowBands', () => {
  test('the nights of every day in the window, in order', () => {
    const window = windowFor(spans, 1, 'days3')
    expect(windowBands(days, window)).toEqual(
      days.slice(1, 4).flatMap((astro) => dayBands({ astro })),
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/selection.test.ts src/ui/spanView.test.ts`
Expected: FAIL on `window`, `windowMarkers`, `windowBands`.

- [ ] **Step 3: Implement**

In `src/ui/selection.ts`: the `window` field and the `choice` parameter on `selectedDay`; the widened parameter types on `dayMarkers` and `dayBands`; the file comment extended to say the window. In `src/ui/spanView.ts`: `windowMarkers` and `windowBands` as described. Do not duplicate the per-day rules.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/ui/`
Expected: PASS, every file. `tideView.test.ts` and `weatherView.test.ts` build `Selected` literals; if the compiler now wants `window` there, add `window: { ...span, first: index, last: index }` to those builders in this task so the suite stays green. `npm run build` must pass too.

- [ ] **Step 5: Lint and commit**

```bash
npm run format && npm run lint && npm run build
git add src/ui/selection.ts src/ui/selection.test.ts src/ui/spanView.ts src/ui/spanView.test.ts src/ui/tideView.test.ts src/ui/weatherView.test.ts
git commit -m "Give the chosen day its window, with the markers and night bands of every day in it" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The tide and the weather draw the window

**Files:**
- Modify: `src/ui/tideView.ts`
- Modify: `src/ui/tideView.test.ts`
- Modify: `src/ui/weatherView.ts`
- Modify: `src/ui/weatherView.test.ts`

**Interfaces:**
- Consumes: `Selected.window` from Task 2.
- Produces: no new names. `tideView`: `predicted` is the points within `selected.window` (both ends included); the cursor clamp is to `window.start`..`window.end`; `events`, `readings`, `observed`, `rest` and the bounds are unchanged. `weatherView`: `hours` is `onDay(all, selected.window)`; `cursorT` is `Math.min(cursor, selected.window.end - 1)`; the rows, `reaches`, the notice and the bounds are unchanged.

- [ ] **Step 1: Write the failing tests**

In `src/ui/tideView.test.ts`, find the helper that builds a `Selected` for a day (it sets `span`, `astro`, `anchor`, `isToday`) and add beside it:

```ts
/** The same day with a window of `days` days from it. */
function wide(selected: Selected, days: number): Selected {
  return {
    ...selected,
    window: {
      start: selected.span.start,
      end: selected.span.start + days * DAY,
      first: selected.index,
      last: selected.index + days - 1,
    },
  }
}
```

Then a `describe('the window')`:

```ts
describe('the window', () => {
  test('three days draw the curve to the end of the third day, and the table stays the day\'s', () => {
    const view = own(data(), wide(today(), 3), null)
    expect(view.predicted[0].t).toBe(START)
    expect(view.predicted[view.predicted.length - 1].t).toBe(START + 2 * DAY + HOUR)
    expect(view.events.map((e) => e.t)).toEqual([START, START + 6 * HOUR])
  })

  test('a pick on the third day holds in a three-day window', () => {
    const pick = { t: START + 2 * DAY + 6 * HOUR, day: '2026-10-08', shown: 0 }
    expect(own(data(), wide(today(), 3), pick).cursor).toBe(pick.t)
  })

  test('the same pick is clamped to the day\'s end when the window is the day', () => {
    const pick = { t: START + 2 * DAY + 6 * HOUR, day: '2026-10-08', shown: 0 }
    expect(own(data(), today(), pick).cursor).toBe(END)
  })
})
```

Use the file's own name for the today builder in place of `today()` if it differs; `data()`, `own`, `START`, `END`, `DAY`, `HOUR` are already there.

In `src/ui/weatherView.test.ts`, the `day(index, sunset)` builder gets `window: { start, end: start + DAY, first: index, last: index }` (if Task 2 did not already add it), and beside it the same `wide(selected, days)` helper. Then:

```ts
describe('the window', () => {
  test('three days draw every forecast hour from 5 AM today to the end of the third day', () => {
    const view = weatherView(loaded(week), wide(day(0), 3), NOW, NOW)
    expect(view.notice).toBeNull()
    const temp = view.temp.series.find((s) => s.name === 'temp')!
    expect(temp.points.length).toBe(3 * 24 - 5)
    expect(temp.points[temp.points.length - 1].t).toBe(START + 3 * DAY - HOUR)
    expect(view.wind.arrows.length).toBe(3 * 24 - 5)
  })

  test('where the forecast reaches the chosen day but not the week after, the hours that exist are drawn and nothing after', () => {
    const view = weatherView(loaded(week), wide(day(6), 7), NOW, NOW)
    expect(view.notice).toBeNull()
    const temp = view.temp.series.find((s) => s.name === 'temp')!
    expect(temp.points[0].t).toBe(START + 6 * DAY)
    expect(temp.points[temp.points.length - 1].t).toBe(START + 7 * DAY + 21 * HOUR)
  })

  test('at the right-hand edge of a wide window the cursor reads the last hour drawn', () => {
    // The last hour of the third day is marked, so the readout tells it apart
    // from the last hour of the first day, which the day's clamp would give.
    const marked = hourly(START + 5 * HOUR, 3 * 24 - 5, (hour) => {
      if (hour.t === START + 3 * DAY - HOUR) hour.tempF = 99
    })
    const view = weatherView(loaded(marked), wide(day(0), 3), START + 3 * DAY, NOW)
    expect(partsText(view.temp.readout)).toContain('99')
  })
})
```

`week` is the file's fixture of 7 days and 17 hours from 5 AM today (its last record is 9 PM on 15 October); use its actual name.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/tideView.test.ts src/ui/weatherView.test.ts`
Expected: FAIL. The curve stops at the day's end; the pick is clamped to the day; the weather has 19 hours and the cursor reads the day's last hour.

- [ ] **Step 3: Implement**

The four substitutions named under Interfaces, each with its comment updated to say the window. Nothing else moves: the highs and lows, the readings, the rest, the bounds and the observed rows stay on `span` and `data.day`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run`
Expected: PASS, every file.

- [ ] **Step 5: Lint and commit**

```bash
npm run format && npm run lint
git add src/ui/tideView.ts src/ui/tideView.test.ts src/ui/weatherView.ts src/ui/weatherView.test.ts
git commit -m "Draw the tide and the weather across the window, with the cursor clamped to it" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The choice is kept for a reload and forgotten with the spot

**Files:**
- Modify: `src/ui/choices.ts`
- Modify: `src/ui/choices.test.ts`

**Interfaces:**
- Consumes: `SpanChoice`, `SPANS` from Task 1.
- Produces: `export function readSpan(): SpanChoice` (the session's choice, or `'day'` when there is none, the value is not one of `SPANS`, or storage fails); `export function writeSpan(choice: SpanChoice): void`; `writeSpot` additionally removes the span key, so a spot chosen starts on "Day". Key `tideline:span` in `sessionStorage`, through wrapped `sessionRead`/`sessionWrite`/`sessionRemove` helpers beside the `localStorage` ones.

- [ ] **Step 1: Write the failing tests**

In `src/ui/choices.test.ts`, add `readSpan`, `writeSpan` to the import and:

```ts
describe('the span', () => {
  test('is a day until one is chosen', () => {
    vi.stubGlobal('sessionStorage', fakeStorage())
    expect(readSpan()).toBe('day')
  })

  test('is kept for the session, not on the device', () => {
    const session = fakeStorage()
    const device = fakeStorage()
    vi.stubGlobal('sessionStorage', session)
    vi.stubGlobal('localStorage', device)
    writeSpan('week')
    expect(readSpan()).toBe('week')
    expect(session.getItem('tideline:span')).toBe('week')
    expect(device.getItem('tideline:span')).toBeNull()
  })

  test('a value that is not a choice is a day', () => {
    vi.stubGlobal('sessionStorage', fakeStorage({ 'tideline:span': 'month' }))
    expect(readSpan()).toBe('day')
  })

  test('is a day with storage disabled, and writing does not throw', () => {
    vi.stubGlobal('sessionStorage', brokenStorage())
    expect(readSpan()).toBe('day')
    expect(() => writeSpan('days3')).not.toThrow()
  })

  test('choosing a spot starts it on a day', () => {
    vi.stubGlobal('sessionStorage', fakeStorage({ 'tideline:span': 'week' }))
    vi.stubGlobal('localStorage', fakeStorage())
    writeSpot(GAVIOTA)
    expect(readSpan()).toBe('day')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/choices.test.ts`
Expected: FAIL. `readSpan` is not exported.

- [ ] **Step 3: Implement**

As under Interfaces. The file comment gains the span and why it is a session choice (the spec's decision 4: a reload keeps it, the next open does not).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/ui/choices.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
npm run format && npm run lint
git add src/ui/choices.ts src/ui/choices.test.ts
git commit -m "Keep the span for a reload and forget it when a spot is chosen" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The buttons, the labels under the stack and the screen

**Files:**
- Create: `src/ui/SpanControl.tsx`
- Modify: `src/chart/PanelStack.tsx`
- Modify: `src/ui/SpotScreen.tsx`
- Modify: `src/styles.css` (after `.day-cursor`, and the `.hours` rules)

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `PanelStack` loses `timeZone` and gains `labels: StackLabel[]`, drawn in the `.hours` foot where the hour marks were, each `span` with `data-edge="start"` where `t === start`, `data-edge="end"` where `t === end`, and no attribute otherwise. `HOUR_LABELS` and the `hourMarks` import leave this file. The doc comment says "for a day or more".
  - `SpanControl({ span, onSpan }: { span: SpanChoice; onSpan: (choice: SpanChoice) => void })`: a `div.span-row` with `role="radiogroup"` and `aria-label="Days on the panels"`, one `button` per entry of `SPANS` with `type="button"`, `role="radio"`, `aria-checked={entry.id === span}`, `className="text-button span-choice"`, `onClick={() => onSpan(entry.id)}` and `entry.words` as its text. No arithmetic, no words of its own.
  - CSS: `.span-row { display: flex; gap: 0.5rem; margin-top: 0.5rem; }`; `.span-choice` with `.month-open`'s four declarations (`min-height: 44px; padding: 0.3rem 0.8rem; border: 1px solid var(--sea); border-radius: 999px;`); `.span-choice[aria-checked='true'] { background: var(--sea); color: var(--ground); }`. In `.hours`, the `:first-child` and `:last-child` rules become `[data-edge='start']` and `[data-edge='end']`.
  - `SpotScreen`: `const [span, setSpan] = useState<SpanChoice>(readSpan)`; `const chooseSpan = useCallback((choice) => { setSpan(choice); writeSpan(choice) }, [])`; `selectedDay(data, pickedDay, span)`; `markers = windowMarkers(days, selected.window, data.now)`; `bands = windowBands(days, selected.window)`; `labels = useMemo(() => stackLabels(selected.window, zone, span), [selected.window, zone, span])`; the heading `headingWords(days, selected.window)`; `cursorTime = cursorWords(tide.cursor, zone, selected.window)` (used by the corner and by `cursorText`); `<SpanControl span={span} onSpan={chooseSpan} />` between the `header` and the `PanelStack`; `PanelStack` gets `start={selected.window.start}`, `end={selected.window.end}`, `labels={labels}` and no `timeZone`; `WeatherPanels` gets `start={selected.window.start}`. The `dayMarkers`, `dayBands`, `formatDay` and `formatTime` imports go if nothing else in the file uses them. Choosing a day still clears the pick and scrolls; the month view's reset leaves the span alone.

- [ ] **Step 1: Make the changes**

In the order listed under Interfaces. There is no unit test for components; the build and the browser check are the test.

- [ ] **Step 2: Build and lint**

Run: `npm run format && npm run lint && npm run build && npx vitest run`
Expected: all pass, no type errors.

- [ ] **Step 3: Check in a browser**

Start `npm run dev` in the background and open http://localhost:5173 in a Playwright browser (the `mcp__playwright__*` tools), at 450 px wide. Check, with a screenshot for each:

1. Under "Thu Oct 16" (today's date) three pill buttons "Day", "3 days", "Week", "Day" filled. The panels and the foot labels (12a, 6a, 12p, 6p, 12a) as before the branch.
2. Tap "Week": the heading reads today "to" the date six days on; the tide curve runs across seven days; seven weekday labels under the stack, the first flush left; the night shaded seven times; a sunset line per day with no names on the lines; the arrows thinned; the "now" line on the first day; the corner reads "at Thu 3:36 PM" (the weekday and the time at rest).
3. Tap "3 days": weekday and "12p" labels alternate; the heading names a two-day range; the readout at the cursor still gives the day's values.
4. Tap the stack on the third day: the corner carries that day's weekday. Tap "Day": the cursor is at the right edge of the chosen day, the heading is the one day, the lines are named "Sunset" and "Moonrise" again.
5. Tap the second-to-last row of the 14 days, then "Week": two days drawn, the heading names both, the weather panels show "No forecast this far out." (the chosen day is past the forecast).
6. Reload with "Week" chosen: "Week" is still filled. Switch to Gaviota State Park: "Day" is filled.
7. At 1,024 px wide, "Week" chosen: the 14 days beside the panels and nothing overlapping.

Record what passed and what did not in the task's report. A failure is fixed before the commit.

- [ ] **Step 4: Commit**

```bash
git add src/ui/SpanControl.tsx src/chart/PanelStack.tsx src/ui/SpotScreen.tsx src/styles.css
git commit -m "Add the Day, 3 days and Week buttons and draw the panels across the window" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: The record

**Files:**
- Modify: `CLAUDE.md` (the "Built:" status line, the "Charts are hand-written SVG" bullet under Stack, the Next Steps list)

- [ ] **Step 1: Edit `CLAUDE.md`**

- The status line: after the sentence ending `labelSide` in `src/chart/scales.ts`), add: "Then the panels across a day, three days or a week (issue 8's first bullet, 2026-10-16): "Day", "3 days" and "Week" buttons under the day's heading (`src/ui/SpanControl.tsx`), the window from the chosen day worked out in `src/ui/spanView.ts` with weekday labels under the stack and the weekday in the cursor's words, the choice kept for a reload in `sessionStorage` and forgotten when a spot is chosen."
- The Stack bullet on charts: after "one shared cursor", add "The axis is one day, three or seven from the chosen day, by the user's choice; `src/ui/spanView.ts` has the window and its labels, and the sunset and moonrise lines carry their names only at one day."
- Next Steps, item 4 of the phases: issue 8's first bullet is built on `feat/span-control`, pull request to come, with the owner's check on production; the rest of issue 8 (more NWS values) stays in the issue, as does pinch and two-finger drag.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "Record the span control in CLAUDE.md" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
