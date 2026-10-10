# Month View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A second view of a spot, one calendar month at a time for this month and the next three, listing each day's sunset, moon, moonrise-near-sunset flag and NOAA's highs and lows, reached from the 14-day list and left with one button.

**Architecture:** The same as the rest of the app: thin React components over plain modules, with every rule, every piece of arithmetic and every word in a plain function that has tests. The highs-and-lows source the forecast already fetches is asked for a longer span, to the end of the last offered month, so the month view adds no source and no loader. Four calendar helpers join `src/time.ts`. A new plain module `src/ui/monthView.ts` says which months are offered, how to step between them and what each row says; the row wording it shares with the 14-day list moves to exported helpers in `src/ui/dayList.ts`. `SpotScreen` holds which view is on screen and draws `MonthView` in place of the forecast.

**Tech Stack:** React 19, TypeScript 6.0, Vite 8, Vitest 5, oxlint, Prettier. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-10-month-view-design.md`. Issue: https://github.com/nicolovejoy/tideline/issues/3.

**Scope:** One pull request on the branch `stage-2/month-view`, which already holds the spec and the fixture `src/data/__fixtures__/noaa-hilo-20261010-20270131.json`. Nothing from other issues: no URL for a view (#7), no curve for a month (#8), no saved spots (#4).

## Global Constraints

- **Node 24 for every `npm`, `npx` and `node` command.** In a fresh shell run `source ~/.nvm/nvm.sh && nvm use` first.
- **Public repo, no personal details.** Tracked files, commit messages and pull requests never name people. Write "the first user" and "the owner". Never copy anything out of `private/`.
- **Commit identity.** `git config user.email` must end in `users.noreply.github.com`.
- **Commit trailer.** End every commit message with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **Code style is the Vite template's:** no semicolons, single quotes, relative imports carry their `.ts` or `.tsx` extension, type-only imports use `import type`, no enums. Run `npm run format` before every commit.
- **Lint must print no problems.** `npm run lint` runs oxlint with warnings denied, then a Prettier check.
- **No new dependencies.**
- **Times:** every stored or computed time is a UTC instant in epoch milliseconds. Only `src/time.ts` converts to a zone. Nothing reads the viewer's zone. Tests run with the device in Tokyo (`TZ=Asia/Tokyo` in `vite.config.ts`).
- **Calendar strings:** a date is `'YYYY-MM-DD'`, a month is `'YYYY-MM'`. Arithmetic on them involves no zone.
- **Components hold no arithmetic, no rules and no wording.** Those live in plain modules with tests. A component may call a plain function inside `useMemo`.
- **Units:** feet above MLLW to one decimal, never "-0.0" (`feet` in `src/chart/readout.ts` already does this); 12-hour clock.
- **Data, not a verdict.** No scores, no go/no-go, no alerts.
- **Do not merge.** The last task opens the pull request and stops.
- **Every task ends green:** `npm test`, `npm run lint` and `npm run build` all pass before its commit.

## Review Focus

1. **A month that is no longer offered**, which happens on the first of a month to a phone left open on the month that just ended: the current month is shown, never an empty list or a crash. Pinned in Task 4 (`monthNav`, "a month not offered means this month" and `monthRows` the same).
2. **Highs and lows that stop short of the month**, as a saved 14-day entry does while the longer fetch is on its way, or when the request failed: rows past the data have no tide lines, and nothing else changes. Pinned in Task 4 (`monthRows` "rows past the saved highs and lows have no tide lines") and Task 5 (`monthCaption` for a stale source).
3. **The last offered month in a new year**: from 15 November 2026 the months run to February 2027, and the fetched span ends on 1 March 2027 at the spot's midnight. Pinned in Task 1 (`addMonths` across the year end) and Task 2 (`frameFor` on 15 November).
4. **The day the clocks go back, 1 November 2026, inside the span**: it is 25 hours long and every high and low in it lands on its row, none on the next. Pinned in Task 4 (`monthRows` for November 2026).
5. **A spot whose tide is hidden**: rows have no tide lines, the hidden line and "Show tides" stand where the caption would, and nothing tidal is fetched while hidden (which `useSpotData` already does). Pinned in Task 4 (`monthRows` with `tidesShown` false) and checked in the browser in Task 6.

## File Structure

Modified, plain modules:
- `src/time.ts`: `monthOf`, `addMonths`, `datesOfMonth`, `formatMonth`. Test: `src/time.test.ts`.
- `src/data/useSpotData.ts`: `MONTHS_AHEAD`; `frameFor` adds `ahead`; `hilo.needed` is `frame.ahead`; `SpotData.ahead`. Test: `src/data/useSpotData.test.ts`.
- `src/ui/dayList.ts`: exported `sunsetWords`, `moonWords`, `flagWords`, `tideLines`; `dayRows` uses them. Test: `src/ui/dayList.test.ts`.
- `src/ui/captions.ts`: `monthCaption`; the highs-and-lows sentences shared with `tideCaption`. Test: `src/ui/captions.test.ts`.

Created, plain module:
- `src/ui/monthView.ts`: `monthsOffered`, `monthNav`, `monthRows`. Test: `src/ui/monthView.test.ts`.

Created, component:
- `src/ui/MonthView.tsx`: the back button, the month head, the rows, the caption, the hidden line and the toggles.

Modified, components and styles:
- `src/ui/DayList.tsx`: the heading row with its "Months ahead" button.
- `src/ui/SpotScreen.tsx`: `view` and `month` state; draws `MonthView` or the forecast.
- `src/styles.css`: the heading row, the month head, the step buttons, the rows.

Then `CLAUDE.md`, `README.md` and the pull request.

---

### Task 1: Calendar helpers for months, in `src/time.ts`

**Files:**
- Modify: `src/time.ts`, `src/time.test.ts`

**Interfaces:**
- Consumes: `pad` and `parseDate`, private helpers already in `src/time.ts`.
- Produces:
  - `export function monthOf(date: string): string`: `'2026-10-10'` → `'2026-10'`.
  - `export function addMonths(month: string, months: number): string`: `'2026-11'` + 3 → `'2027-02'`. Negative counts work.
  - `export function datesOfMonth(month: string): string[]`: every date in the month, in order, `'2026-10-01'` to `'2026-10-31'`.
  - `export function formatMonth(month: string): string`: `'October 2026'`.

- [ ] **Step 1: Write the failing tests**

In `src/time.test.ts`, add `addMonths`, `datesOfMonth`, `formatMonth` and `monthOf` to the import from `'./time.ts'`, and add at the end of the file:

```ts
describe('monthOf', () => {
  test('is the year and month of a date', () => {
    expect(monthOf('2026-10-10')).toBe('2026-10')
    expect(monthOf('2027-01-31')).toBe('2027-01')
  })
})

describe('addMonths', () => {
  test('steps forward within a year', () => {
    expect(addMonths('2026-10', 1)).toBe('2026-11')
    expect(addMonths('2026-10', 0)).toBe('2026-10')
  })

  test('crosses the end of the year', () => {
    expect(addMonths('2026-10', 3)).toBe('2027-01')
    expect(addMonths('2026-11', 3)).toBe('2027-02')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
  })

  test('steps back', () => {
    expect(addMonths('2027-01', -1)).toBe('2026-12')
  })
})

describe('datesOfMonth', () => {
  test('a 31-day month', () => {
    const dates = datesOfMonth('2026-10')
    expect(dates).toHaveLength(31)
    expect(dates[0]).toBe('2026-10-01')
    expect(dates[9]).toBe('2026-10-10')
    expect(dates[30]).toBe('2026-10-31')
  })

  test('a 30-day month', () => {
    expect(datesOfMonth('2026-11')).toHaveLength(30)
  })

  test('February in a leap year and in a common year', () => {
    expect(datesOfMonth('2028-02')).toHaveLength(29)
    expect(datesOfMonth('2027-02')).toHaveLength(28)
  })
})

describe('formatMonth', () => {
  test('names the month and the year', () => {
    expect(formatMonth('2026-10')).toBe('October 2026')
    expect(formatMonth('2027-01')).toBe('January 2027')
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/time.test.ts`
Expected: FAIL, the four names are not exported.

- [ ] **Step 3: Write the helpers**

In `src/time.ts`, after `addDays`, add:

```ts
/** The month a date is in, as 'YYYY-MM'. */
export function monthOf(date: string): string {
  return date.slice(0, 7)
}

function parseMonth(month: string): [number, number] {
  const [year, m] = month.split('-').map(Number)
  return [year, m]
}

/** Calendar arithmetic on a 'YYYY-MM' month. No zone is involved. */
export function addMonths(month: string, months: number): string {
  const [year, m] = parseMonth(month)
  const shifted = new Date(Date.UTC(year, m - 1 + months, 1))
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}`
}

/** Every date in a month, in order. */
export function datesOfMonth(month: string): string[] {
  const [year, m] = parseMonth(month)
  // Day 0 of the next month is the last day of this one.
  const count = new Date(Date.UTC(year, m, 0)).getUTCDate()
  return Array.from({ length: count }, (_, i) => `${month}-${pad(i + 1)}`)
}
```

And after `formatDay`, add:

```ts
const monthFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
})

/** A month for display, such as 'October 2026'. No zone is involved. */
export function formatMonth(month: string): string {
  const [year, m] = parseMonth(month)
  return monthFormat.format(Date.UTC(year, m - 1, 1, 12))
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/time.test.ts`
Expected: all pass, including the 9 new ones.

- [ ] **Step 5: Run everything**

Run: `npm run format && npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/time.ts src/time.test.ts
git commit -m "Calendar helpers for months

monthOf, addMonths, datesOfMonth and formatMonth, on 'YYYY-MM' strings
with no zone involved, like addDays.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Highs and lows fetched to the end of the last offered month, in `src/data/useSpotData.ts`

**Files:**
- Modify: `src/data/useSpotData.ts`, `src/data/useSpotData.test.ts`

**Interfaces:**
- Consumes: `addMonths`, `monthOf` (Task 1); `localDayStart` from `src/time.ts`.
- Produces:
  - `export const MONTHS_AHEAD = 3`: how many months past this one the month view offers.
  - `SpotData` gains `ahead: Span`: from today's midnight at the spot to the midnight that ends the month `MONTHS_AHEAD` after this one. `frameFor` returns it, and its return type is `Pick<SpotData, 'day' | 'window' | 'ahead' | 'days' | 'spans'>`.
  - `tideSpecs(spot, frame)` takes `Pick<SpotData, 'day' | 'window' | 'ahead'>` and gives `hilo` `needed: frame.ahead`. Nothing else about the specs changes.

- [ ] **Step 1: Write the failing tests**

In `src/data/useSpotData.test.ts`, inside `describe('frameFor', …)`, add after the test `'a window that spans the clock change still ends on a local midnight'`:

```ts
  test('the highs and lows run to the end of the third month after this one', () => {
    // From 8 October 2026: October, November, December, January. February
    // starts at 08:00 UTC, in standard time.
    const frame = frameFor(CAMPUS_POINT, '2026-10-08')
    expect(frame.ahead).toEqual({
      start: Date.UTC(2026, 9, 8, 7),
      end: Date.UTC(2027, 1, 1, 8),
    })
  })

  test('the span ahead crosses the end of the year', () => {
    const frame = frameFor(CAMPUS_POINT, '2026-11-15')
    expect(frame.ahead.start).toBe(Date.UTC(2026, 10, 15, 8))
    expect(frame.ahead.end).toBe(Date.UTC(2027, 2, 1, 8))
  })
```

Inside `describe('tideSpecs', …)`, replace the test `'predictions and highs and lows are needed for all 14 days'` with:

```ts
  test('predictions are needed for the 14 days, and highs and lows for the months ahead', () => {
    expect(specs.predictions.needed).toEqual(frame.window)
    expect(specs.hilo.needed).toEqual(frame.ahead)
  })

  test('the highs and lows are one request, to the last day of the last month', async () => {
    const fetchMock = vi.fn(
      async (_url: string) => new Response('{"predictions":[]}'),
    )
    vi.stubGlobal('fetch', fetchMock)
    await specs.hilo.fetch(frame.ahead)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain(
      'begin_date=20261008&end_date=20270131',
    )
  })
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/data/useSpotData.test.ts`
Expected: FAIL: `frame.ahead` is undefined, and `hilo.needed` equals the 14-day window.

- [ ] **Step 3: Lengthen the span**

In `src/data/useSpotData.ts`, change the import from `'../time.ts'` to:

```ts
import {
  MINUTE,
  addDays,
  addMonths,
  localDate,
  localDayStart,
  monthOf,
} from '../time.ts'
```

After `const DAYS = 14` add:

```ts
/** How many months past this one the month view offers. */
export const MONTHS_AHEAD = 3
```

In `SpotData`, after `window: Span`, add:

```ts
  /**
   * From today to the end of the last month the month view offers. The
   * highs and lows are fetched for all of it, in one request.
   */
  ahead: Span
```

Change `frameFor`'s return type to `Pick<SpotData, 'day' | 'window' | 'ahead' | 'days' | 'spans'>`, and in its body, before `return`, add:

```ts
  const lastMonth = addMonths(monthOf(today), MONTHS_AHEAD)
  const ahead = {
    start: midnights[0],
    end: localDayStart(`${addMonths(lastMonth, 1)}-01`, spot.timeZone),
  }
```

and add `ahead,` to the returned object after `window`.

In `tideSpecs`, change the `frame` parameter's type to `Pick<SpotData, 'day' | 'window' | 'ahead'>`, and in the `hilo` spec change `needed: frame.window,` to:

```ts
      // The month view lists highs and lows months ahead. They never change,
      // so one longer request a month costs less than a shorter one a week.
      needed: frame.ahead,
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/data/useSpotData.test.ts`
Expected: all pass.

- [ ] **Step 5: Run everything**

Run: `npm run format && npm test && npm run lint && npm run build`
Expected: all pass. (`src/ui/dayList.test.ts` builds its inputs from `frameFor` and does not look at `ahead`, so it is unchanged.)

- [ ] **Step 6: Commit**

```bash
git add src/data/useSpotData.ts src/data/useSpotData.test.ts
git commit -m "Fetch highs and lows to the end of the third month ahead

One request a month of about 22 KB, for the month view. The saved 14-day
entry is stale against the longer span and is fetched again once.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The row words shared with the month view, in `src/ui/dayList.ts`

**Files:**
- Modify: `src/ui/dayList.ts`, `src/ui/dayList.test.ts`

**Interfaces:**
- Consumes: `DayAstro`, `TideExtreme`, `Span`, `feet`, `formatTime`, `onDay`, all already imported there.
- Produces, exported from `src/ui/dayList.ts`:
  - `sunsetWords(day: DayAstro, timeZone: string): string`: `'Sunset 6:34 PM'` or `'No sunset'`.
  - `moonWords(day: DayAstro, withPhase: boolean): string`: `'Moon 3% lit'`, or with the phase `'Moon 3% lit, waning crescent'`.
  - `flagWords(day: DayAstro, timeZone: string): string | null`: `'Moonrise 5:12 PM'` where moonrise is within 2 hours of sunset, else null.
  - `tideLines(events: TideExtreme[], span: Span, timeZone: string): string[]`: the events on the day, in order, `'Low 2:35 AM 0.2 ft'`.
  - `dayRows` unchanged in signature and output.

- [ ] **Step 1: Write the failing tests**

In `src/ui/dayList.test.ts`, change the import from `'./dayList.ts'` to:

```ts
import {
  dayRows,
  flagWords,
  moonWords,
  sunsetWords,
  tideLines,
  tonightWords,
} from './dayList.ts'
```

Add `import type { Span } from '../data/cache.ts'` beside the other type imports. Then add at the end of the file:

```ts
describe('the words of a row', () => {
  const day: DayAstro = {
    date: '2026-10-08',
    sunset: Date.UTC(2026, 9, 9, 1, 34), // 6:34 PM
    moonrise: Date.UTC(2026, 9, 9, 0, 12), // 5:12 PM
    illumination: 0.0349,
    phase: 'Waning Crescent',
    moonriseNearSunset: Date.UTC(2026, 9, 9, 0, 12),
  }

  test('sunset', () => {
    expect(sunsetWords(day, ZONE)).toBe('Sunset 6:34 PM')
    expect(sunsetWords({ ...day, sunset: null }, ZONE)).toBe('No sunset')
  })

  test('the moon, with or without its phase', () => {
    expect(moonWords(day, false)).toBe('Moon 3% lit')
    expect(moonWords(day, true)).toBe('Moon 3% lit, waning crescent')
  })

  test('the moonrise flag', () => {
    expect(flagWords(day, ZONE)).toBe('Moonrise 5:12 PM')
    expect(flagWords({ ...day, moonriseNearSunset: null }, ZONE)).toBeNull()
  })

  test('the highs and lows on the day, and only those', () => {
    const span: Span = { start: START, end: START + 24 * HOUR }
    const events: TideExtreme[] = [
      { t: START - HOUR, ft: 4.1, type: 'H' },
      { t: START + 2 * HOUR + 35 * 60_000, ft: 0.24, type: 'L' },
      { t: START + 9 * HOUR, ft: 5.03, type: 'H' },
      { t: START + 24 * HOUR, ft: 0.9, type: 'L' },
    ]
    expect(tideLines(events, span, ZONE)).toEqual([
      'Low 2:35 AM 0.2 ft',
      'High 9:00 AM 5.0 ft',
    ])
    expect(tideLines([], span, ZONE)).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/ui/dayList.test.ts`
Expected: FAIL, the four names are not exported.

- [ ] **Step 3: Move the words into exported helpers**

In `src/ui/dayList.ts`, add `import type { Span } from '../data/cache.ts'` and `import type { TideExtreme } from '../data/noaa.ts'` beside the other type imports. Replace the private `lit` function and everything from `export interface DayRow` to the end of the file with:

```ts
/** 'Sunset 6:34 PM', or 'No sunset'. */
export function sunsetWords(day: DayAstro, timeZone: string): string {
  return day.sunset === null
    ? 'No sunset'
    : `Sunset ${formatTime(day.sunset, timeZone)}`
}

/** 'Moon 3% lit', and with the phase 'Moon 3% lit, waning crescent'. */
export function moonWords(day: DayAstro, withPhase: boolean): string {
  const words = `Moon ${lit(day)}`
  return withPhase ? `${words}, ${day.phase.toLowerCase()}` : words
}

/** 'Moonrise 5:12 PM' where moonrise is within 2 hours of sunset, else null. */
export function flagWords(day: DayAstro, timeZone: string): string | null {
  return day.moonriseNearSunset === null
    ? null
    : `Moonrise ${formatTime(day.moonriseNearSunset, timeZone)}`
}

/** The day's highs and lows in order, such as 'Low 2:35 AM 0.2 ft'. */
export function tideLines(
  events: TideExtreme[],
  span: Span,
  timeZone: string,
): string[] {
  return onDay(events, span).map((event) => {
    const kind = event.type === 'H' ? 'High' : 'Low'
    return `${kind} ${formatTime(event.t, timeZone)} ${feet(event.ft)}`
  })
}

export interface DayRow {
  date: string
  /** The weekday and date, such as 'Thu Oct 8'. */
  day: string
  selected: boolean
  sunset: string
  moon: string
  /** The moonrise within 2 hours of sunset, when there is one. */
  flag: string | null
  /** The day's highs and lows in order, such as 'Low 2:35 AM 0.2 ft'. */
  tides: string[]
  /**
   * The forecast for the hour of sunset: 'At sunset', then what each weather
   * panel would read. Null where the forecast does not reach that hour.
   */
  weather: string[] | null
}

type Inputs = Pick<SpotData, 'now' | 'days' | 'spans' | 'hilo' | 'forecast'>

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
  const selected = selectedDay(data, picked).index
  const events = tidesShown ? (data.hilo.data ?? []) : []
  const hours = forecastHours(data.forecast, data.now)

  return data.days.map((day, i) => {
    const span = data.spans[i]
    const hour = day.sunset === null ? null : hourAt(hours, day.sunset)
    // Only what the forecast has for that hour. Sunset on the last day it
    // reaches can have wind and cloud but no temperature.
    const weather = [tempParts(hour), windParts(hour), skyParts(hour)]
      .map(partsText)
      .filter((words) => words !== '')
    return {
      date: day.date,
      day: formatDay(day.date),
      selected: i === selected,
      sunset: sunsetWords(day, timeZone),
      moon: moonWords(day, false),
      flag: flagWords(day, timeZone),
      tides: tideLines(events, span, timeZone),
      weather: weather.length > 0 ? ['At sunset', ...weather] : null,
    }
  })
}
```

Keep `lit` where it is (above `tonightWords`), since `tonightWords` uses it too. The `lit` function and `tonightWords` do not change.

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/ui/dayList.test.ts`
Expected: all pass, the existing `dayRows` tests among them: the rows read exactly as before.

- [ ] **Step 5: Run everything**

Run: `npm run format && npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/dayList.ts src/ui/dayList.test.ts
git commit -m "Share a row's sunset, moon, flag and tide words

Exported from dayList so the month view says the same things the 14-day
list does. The rows themselves do not change.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Which months, how to step, and what each row says, in `src/ui/monthView.ts`

**Files:**
- Create: `src/ui/monthView.ts`, `src/ui/monthView.test.ts`

**Interfaces:**
- Consumes: `addMonths`, `datesOfMonth`, `formatMonth`, `monthOf` (Task 1); `MONTHS_AHEAD` (Task 2); `sunsetWords`, `moonWords`, `flagWords`, `tideLines` (Task 3); `dayAstro` from `src/data/astro.ts`; `addDays`, `formatDay`, `localDayStart` from `src/time.ts`; `parseHiLo` from `src/data/noaa.ts` in the tests.
- Produces:
  - `export function monthsOffered(today: string): string[]`: this month and the next `MONTHS_AHEAD`, as `'YYYY-MM'`.
  - `export interface MonthNav { month: string; title: string; prev: string | null; next: string | null }`.
  - `export function monthNav(month: string | null, today: string): MonthNav`: null, or a month not offered, means this month.
  - `export interface MonthRow { date: string; day: string; isToday: boolean; sunset: string; moon: string; flag: string | null; tides: string[] }`.
  - `export function monthRows(spot: Spot, month: string | null, data: { today: string; hilo: Loaded<TideExtreme[]> }, tidesShown: boolean): MonthRow[]`.

- [ ] **Step 1: Write the failing tests**

Create `src/ui/monthView.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { monthNav, monthRows, monthsOffered } from './monthView.ts'
import type { Loaded } from '../data/load.ts'
import { parseHiLo } from '../data/noaa.ts'
import type { TideExtreme } from '../data/noaa.ts'
import { CAMPUS_POINT, spotById } from '../spot.ts'
import hiloRaw from '../data/__fixtures__/noaa-hilo-20261010-20270131.json?raw'

const TODAY = '2026-10-10'
const FETCHED = Date.UTC(2026, 9, 10, 17)
const EVENTS = parseHiLo(JSON.parse(hiloRaw))

function loaded(
  data: TideExtreme[] | null,
  status: Loaded<TideExtreme[]>['status'] = 'ready',
): Loaded<TideExtreme[]> {
  return { data, fetchedAt: data ? FETCHED : null, span: null, status }
}

const HILO = loaded(EVENTS)

describe('monthsOffered', () => {
  test('this month and the next three', () => {
    expect(monthsOffered(TODAY)).toEqual([
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
    ])
  })

  test('crosses the end of the year', () => {
    expect(monthsOffered('2026-11-15')).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ])
  })
})

describe('monthNav', () => {
  test('this month has no previous month', () => {
    expect(monthNav('2026-10', TODAY)).toEqual({
      month: '2026-10',
      title: 'October 2026',
      prev: null,
      next: '2026-11',
    })
  })

  test('a month in the middle has both neighbours', () => {
    expect(monthNav('2026-12', TODAY)).toEqual({
      month: '2026-12',
      title: 'December 2026',
      prev: '2026-11',
      next: '2027-01',
    })
  })

  test('the last month has no next month', () => {
    expect(monthNav('2027-01', TODAY)).toEqual({
      month: '2027-01',
      title: 'January 2027',
      prev: '2026-12',
      next: null,
    })
  })

  test('no month, or a month not offered, means this month', () => {
    expect(monthNav(null, TODAY).month).toBe('2026-10')
    // The month that ended, on a phone left open into the first of the next.
    expect(monthNav('2026-10', '2026-11-01').month).toBe('2026-11')
    expect(monthNav('2027-06', TODAY).month).toBe('2026-10')
  })
})

describe('monthRows', () => {
  test('this month runs from today to its last day, with today marked', () => {
    const rows = monthRows(CAMPUS_POINT, '2026-10', { today: TODAY, hilo: HILO }, true)
    expect(rows).toHaveLength(22)
    expect(rows[0].date).toBe('2026-10-10')
    expect(rows[0].day).toBe('Sat Oct 10')
    expect(rows[0].isToday).toBe(true)
    expect(rows[1].isToday).toBe(false)
    expect(rows[21].date).toBe('2026-10-31')
  })

  test("today's highs and lows, in the spot's zone, as NOAA gives them", () => {
    const rows = monthRows(CAMPUS_POINT, '2026-10', { today: TODAY, hilo: HILO }, true)
    expect(rows[0].tides).toEqual([
      'Low 3:32 AM 1.0 ft',
      'High 9:45 AM 5.9 ft',
      'Low 4:20 PM 0.1 ft',
      'High 10:27 PM 4.6 ft',
    ])
  })

  test('sunset, the moon with its phase, and the flag', () => {
    const rows = monthRows(CAMPUS_POINT, '2026-10', { today: TODAY, hilo: HILO }, true)
    // The new moon is on the 10th and the full moon on the 25th.
    expect(rows[0].moon).toMatch(/^Moon \d+% lit, new moon$/)
    expect(rows[15].date).toBe('2026-10-25')
    expect(rows[15].moon).toMatch(/^Moon \d+% lit, full moon$/)
    expect(rows[0].sunset).toMatch(/^Sunset 6:\d\d PM$/)
    for (const row of rows) {
      expect(row.flag === null || /^Moonrise \d+:\d\d [AP]M$/.test(row.flag)).toBe(true)
    }
  })

  test('a later month holds every one of its days', () => {
    const rows = monthRows(CAMPUS_POINT, '2027-01', { today: TODAY, hilo: HILO }, true)
    expect(rows).toHaveLength(31)
    expect(rows[0].date).toBe('2027-01-01')
    expect(rows[30].date).toBe('2027-01-31')
    expect(rows.every((row) => !row.isToday)).toBe(true)
    // A low that rounds to nothing is 0.0, never -0.0.
    expect(rows[30].tides).toEqual(['High 4:52 AM 5.0 ft', 'Low 12:52 PM 0.0 ft'])
  })

  test('the day the clocks go back is 25 hours long and keeps all its highs and lows', () => {
    const rows = monthRows(CAMPUS_POINT, '2026-11', { today: TODAY, hilo: HILO }, true)
    expect(rows[0].date).toBe('2026-11-01')
    expect(rows[0].tides).toEqual([
      'High 4:19 AM 3.9 ft',
      'Low 8:22 AM 3.3 ft',
      'High 2:13 PM 5.1 ft',
      'Low 9:57 PM -0.1 ft',
    ])
    expect(rows[1].tides[0]).not.toBe('Low 9:57 PM -0.1 ft')
  })

  test('rows past the saved highs and lows have no tide lines', () => {
    // What is saved from before: the 14 days from the 10th.
    const short = loaded(EVENTS.filter((e) => e.t < Date.UTC(2026, 9, 24, 7)))
    const rows = monthRows(CAMPUS_POINT, '2026-10', { today: TODAY, hilo: short }, true)
    expect(rows[13].tides.length).toBeGreaterThan(0)
    expect(rows[14].tides).toEqual([])
    const november = monthRows(CAMPUS_POINT, '2026-11', { today: TODAY, hilo: short }, true)
    expect(november.every((row) => row.tides.length === 0)).toBe(true)
  })

  test('no highs and lows at all is rows with no tide lines', () => {
    const rows = monthRows(CAMPUS_POINT, '2026-10', { today: TODAY, hilo: loaded(null, 'loading') }, true)
    expect(rows).toHaveLength(22)
    expect(rows.every((row) => row.tides.length === 0)).toBe(true)
  })

  test('with the tide hidden the rows list no highs and lows', () => {
    const laCumbre = spotById('la-cumbre-peak')
    const rows = monthRows(laCumbre, '2026-10', { today: TODAY, hilo: HILO }, false)
    expect(rows).toHaveLength(22)
    expect(rows.every((row) => row.tides.length === 0)).toBe(true)
    expect(rows[0].sunset).toMatch(/^Sunset /)
  })

  test('a month not offered is read as this month', () => {
    const rows = monthRows(CAMPUS_POINT, '2027-06', { today: TODAY, hilo: HILO }, true)
    expect(rows[0].date).toBe('2026-10-10')
    expect(monthRows(CAMPUS_POINT, null, { today: TODAY, hilo: HILO }, true)[0].date).toBe('2026-10-10')
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/ui/monthView.test.ts`
Expected: FAIL, cannot find `./monthView.ts`.

- [ ] **Step 3: Write the module**

Create `src/ui/monthView.ts`:

```ts
// The month view: which months are offered, how to step between them, and
// one row per day with its sunset, moon and highs and lows. Plain functions.

import { dayAstro } from '../data/astro.ts'
import type { Loaded } from '../data/load.ts'
import type { TideExtreme } from '../data/noaa.ts'
import { MONTHS_AHEAD } from '../data/useSpotData.ts'
import type { Spot } from '../spot.ts'
import {
  addDays,
  addMonths,
  datesOfMonth,
  formatDay,
  formatMonth,
  localDayStart,
  monthOf,
} from '../time.ts'
import { flagWords, moonWords, sunsetWords, tideLines } from './dayList.ts'

/** This month and the next MONTHS_AHEAD, as 'YYYY-MM', in order. */
export function monthsOffered(today: string): string[] {
  const first = monthOf(today)
  return Array.from({ length: MONTHS_AHEAD + 1 }, (_, i) =>
    addMonths(first, i),
  )
}

export interface MonthNav {
  /** The month on screen, 'YYYY-MM'. */
  month: string
  /** 'October 2026' */
  title: string
  /** The offered months either side, or null at an end. */
  prev: string | null
  next: string | null
}

/**
 * Where a month stands among those offered. No month, or one that is not
 * offered, such as the month that ended on a phone left open into the
 * first of the next, means this month.
 */
export function monthNav(month: string | null, today: string): MonthNav {
  const offered = monthsOffered(today)
  const found = offered.indexOf(month ?? '')
  const index = found === -1 ? 0 : found
  return {
    month: offered[index],
    title: formatMonth(offered[index]),
    prev: index > 0 ? offered[index - 1] : null,
    next: index < offered.length - 1 ? offered[index + 1] : null,
  }
}

export interface MonthRow {
  date: string
  /** The weekday and date, such as 'Sat Oct 10'. */
  day: string
  isToday: boolean
  sunset: string
  /** With the phase: 'Moon 1% lit, new moon'. */
  moon: string
  /** The moonrise within 2 hours of sunset, when there is one. */
  flag: string | null
  /** The day's highs and lows in order, such as 'Low 2:35 AM 0.2 ft'. */
  tides: string[]
}

interface Inputs {
  /** Today's date at the spot. */
  today: string
  hilo: Loaded<TideExtreme[]>
}

/**
 * One row per day of the month, from today where the month is this one. The
 * month is read as monthNav reads it. With the tide hidden the rows list no
 * highs and lows; where the saved highs and lows stop short, the rows past
 * them have none either.
 */
export function monthRows(
  spot: Spot,
  month: string | null,
  data: Inputs,
  tidesShown: boolean,
): MonthRow[] {
  const zone = spot.timeZone
  const shown = monthNav(month, data.today).month
  const dates = datesOfMonth(shown).filter((date) => date >= data.today)
  const events = tidesShown ? (data.hilo.data ?? []) : []
  return dates.map((date) => {
    const day = dayAstro(spot, date)
    const span = {
      start: localDayStart(date, zone),
      end: localDayStart(addDays(date, 1), zone),
    }
    return {
      date,
      day: formatDay(date),
      isToday: date === data.today,
      sunset: sunsetWords(day, zone),
      moon: moonWords(day, true),
      flag: flagWords(day, zone),
      tides: tideLines(events, span, zone),
    }
  })
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/ui/monthView.test.ts`
Expected: all 15 pass. If the moon-phase assertions fail, print `rows.map((r) => [r.date, r.moon])` and check against the astronomy: the new moon is on 10 October 2026 and the full moon on 25 October 2026, Pacific time (computed with astronomy-engine's `SearchMoonQuarter` on 2026-10-10). A different date means a bug in the rows, not in the test.

- [ ] **Step 5: Run everything**

Run: `npm run format && npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/monthView.ts src/ui/monthView.test.ts
git commit -m "The month view's months, steps and rows

This month and the next three. A month not offered is read as this
month. Rows run from today in this month and list the day's sunset, moon
with its phase, moonrise flag and highs and lows, the same words as the
14-day list.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The month view's caption, in `src/ui/captions.ts`

**Files:**
- Modify: `src/ui/captions.ts`, `src/ui/captions.test.ts`

**Interfaces:**
- Consumes: `stationWords`, `when`, private helpers already in `src/ui/captions.ts`.
- Produces: `export function monthCaption(spot: Spot, hilo: Loaded<TideExtreme[]>, today: string): string`: the station sentence, then the highs-and-lows failure sentence if there is one. `tideCaption` unchanged in output.

- [ ] **Step 1: Write the failing tests**

In `src/ui/captions.test.ts`, add `monthCaption` to the import from `'./captions.ts'`, and add at the end of the file:

```ts
describe('monthCaption', () => {
  test('names the station and nothing else when the highs and lows are current', () => {
    expect(monthCaption(CAMPUS_POINT, HILO, TODAY)).toBe(STATION)
  })

  test('names the station alone while the first request is on its way', () => {
    const hilo: Loaded<TideExtreme[]> = {
      data: null,
      fetchedAt: null,
      span: null,
      status: 'loading',
    }
    expect(monthCaption(CAMPUS_POINT, hilo, TODAY)).toBe(STATION)
  })

  test('says so when there are no highs and lows to show', () => {
    const hilo: Loaded<TideExtreme[]> = {
      data: null,
      fetchedAt: null,
      span: null,
      status: 'unavailable',
    }
    expect(monthCaption(CAMPUS_POINT, hilo, TODAY)).toBe(
      `${STATION} High and low times unavailable.`,
    )
  })

  test('says when the highs and lows on screen are old ones', () => {
    const hilo: Loaded<TideExtreme[]> = { ...HILO, status: 'stale' }
    expect(monthCaption(CAMPUS_POINT, hilo, TODAY)).toBe(
      `${STATION} Couldn't refresh the high and low times. Showing those from 2:05 PM.`,
    )
    const old: Loaded<TideExtreme[]> = {
      ...HILO,
      fetchedAt: DAYS_AGO,
      status: 'stale',
    }
    expect(monthCaption(CAMPUS_POINT, old, TODAY)).toBe(
      `${STATION} Couldn't refresh the high and low times. Showing those from Mon Oct 5, 1:33 AM.`,
    )
  })

  test('at a spot with a gauge elsewhere, the station sentence has no "predictions only"', () => {
    expect(monthCaption(spotById('gaviota'), HILO, TODAY)).toBe(
      'Tide: NOAA 9411399 Gaviota State Park, 0.2 mi south.',
    )
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/ui/captions.test.ts`
Expected: FAIL, `monthCaption` is not exported.

- [ ] **Step 3: Write the caption, sharing the sentences**

In `src/ui/captions.ts`, after `feetHigh`, add:

```ts
/** What is wrong with the highs and lows, if anything. */
function hiloWords(
  hilo: Loaded<TideExtreme[]>,
  today: string,
  timeZone: string,
): string[] {
  // Without this the table of highs and lows is simply missing, or stops
  // short of the last days, with nothing to say why.
  if (hilo.status === 'unavailable') return ['High and low times unavailable.']
  if (hilo.status === 'stale' && hilo.fetchedAt !== null) {
    const saved = when(hilo.fetchedAt, today, timeZone)
    return [
      `Couldn't refresh the high and low times. Showing those from ${saved}.`,
    ]
  }
  return []
}
```

In `tideCaption`, replace the block from the comment `// Without this the table of highs and lows is simply missing` through the `else if (hilo.status === 'stale' …) { … }` with:

```ts
  parts.push(...hiloWords(hilo, today, zone))
```

Then, after `tideCaption`, add:

```ts
/**
 * The month view's caption: the station, and what is wrong with the highs
 * and lows if anything. Nothing about the curve or the gauge, since neither
 * is on that screen.
 */
export function monthCaption(
  spot: Spot,
  hilo: Loaded<TideExtreme[]>,
  today: string,
): string {
  return [
    `Tide: ${stationWords(spot.tideStation)}.`,
    ...hiloWords(hilo, today, spot.timeZone),
  ].join(' ')
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/ui/captions.test.ts`
Expected: all pass, the existing `tideCaption` tests among them.

- [ ] **Step 5: Run everything**

Run: `npm run format && npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/captions.ts src/ui/captions.test.ts
git commit -m "A caption for the month view

The station, and the highs-and-lows sentences the tide caption already
has, now shared.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: The month view on screen, in the components

**Files:**
- Create: `src/ui/MonthView.tsx`
- Modify: `src/ui/DayList.tsx`, `src/ui/SpotScreen.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `monthNav`, `monthRows`, `MonthNav`, `MonthRow` (Task 4); `monthCaption` (Task 5); `TidesHidden` from `src/ui/TidesHidden.tsx`; `tide.hidden` and `tide.canHide` from `tideView`, which `SpotScreen` already has.
- Produces: nothing later tasks use. This is the last code task.

There are no unit tests for components in this project; they are checked in a browser. The type check, lint and build are this task's gate, and then the browser check in Step 6.

- [ ] **Step 1: The heading row with its button, in `src/ui/DayList.tsx`**

Add `onMonths: () => void` to `DayListProps` with the comment `/** Called when the "Months ahead" button is tapped. */`, take it in the function's parameters, and replace `<h2>14 days</h2>` with:

```tsx
      <header className="days-head">
        <h2>14 days</h2>
        <button type="button" className="text-button" onClick={onMonths}>
          Months ahead
        </button>
      </header>
```

Update the component's doc comment to end: "Kept from drawing again while only the cursor moves. The heading's button opens the month view."

- [ ] **Step 2: The month view, `src/ui/MonthView.tsx`**

```tsx
import { useMemo } from 'react'
import type { Loaded } from '../data/load.ts'
import type { TideExtreme } from '../data/noaa.ts'
import type { Spot } from '../spot.ts'
import { monthCaption } from './captions.ts'
import { monthNav, monthRows } from './monthView.ts'
import { TidesHidden } from './TidesHidden.tsx'

interface MonthViewProps {
  spot: Spot
  /** Today's date at the spot. */
  today: string
  hilo: Loaded<TideExtreme[]>
  tidesShown: boolean
  /** The month asked for, or null for this month. */
  month: string | null
  /** The line that stands in for the tide when it is hidden; null when shown. */
  hidden: string | null
  /** Whether "Hide tides" is offered: the tide is shown at a spot that hides it by default. */
  canHide: boolean
  onMonth: (month: string) => void
  onBack: () => void
  onShowTides: (shown: boolean) => void
}

/**
 * One month at a time, this month and the next three: each day's sunset,
 * moon, moonrise flag and highs and lows. No weather, no curve, no cursor.
 */
export function MonthView({
  spot,
  today,
  hilo,
  tidesShown,
  month,
  hidden,
  canHide,
  onMonth,
  onBack,
  onShowTides,
}: MonthViewProps) {
  const nav = monthNav(month, today)
  // About thirty days of sun and moon, worked out once per month on screen
  // and again at midnight.
  const rows = useMemo(
    () => monthRows(spot, nav.month, { today, hilo }, tidesShown),
    [spot, nav.month, today, hilo, tidesShown],
  )

  return (
    <section className="month" aria-label={nav.title}>
      <button type="button" className="text-button month-back" onClick={onBack}>
        ‹ Back to forecast
      </button>
      <header className="month-head">
        <button
          type="button"
          className="month-step"
          aria-label="Previous month"
          disabled={nav.prev === null}
          onClick={() => nav.prev !== null && onMonth(nav.prev)}
        >
          ‹
        </button>
        <h2>{nav.title}</h2>
        <button
          type="button"
          className="month-step"
          aria-label="Next month"
          disabled={nav.next === null}
          onClick={() => nav.next !== null && onMonth(nav.next)}
        >
          ›
        </button>
      </header>

      <ol>
        {rows.map((row) => (
          <li
            key={row.date}
            className="month-row"
            aria-current={row.isToday ? 'date' : undefined}
          >
            <span className="day-row-head">
              <span className="day-row-date">{row.day}</span>
              <span>{row.sunset}</span>
              <span>{row.moon}</span>
              {row.flag !== null && (
                <span className="day-row-flag">{row.flag}</span>
              )}
            </span>
            {row.tides.length > 0 && (
              <span className="day-row-tides">
                {row.tides.map((tide) => (
                  <span key={tide}>{tide}</span>
                ))}
              </span>
            )}
          </li>
        ))}
      </ol>

      {hidden !== null ? (
        <TidesHidden words={hidden} onShow={() => onShowTides(true)} />
      ) : (
        <p className="caption">
          {monthCaption(spot, hilo, today)}
          {canHide && (
            <>
              {' '}
              <button
                type="button"
                className="tides-toggle"
                onClick={() => onShowTides(false)}
              >
                Hide tides
              </button>
            </>
          )}
        </p>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Which view, in `src/ui/SpotScreen.tsx`**

Add `import { MonthView } from './MonthView.tsx'` beside the other component imports. After the `pick` state, add:

```tsx
  // The forecast, or one month at a time. Opens on the forecast; nothing
  // about the view is remembered.
  const [view, setView] = useState<'forecast' | 'month'>('forecast')
  const [month, setMonth] = useState<string | null>(null)
```

After `selectDay`, add:

```tsx
  const openMonths = useCallback(() => {
    setView('month')
    window.scrollTo(0, 0)
  }, [])
  const backToForecast = () => {
    setView('forecast')
    setMonth(null)
    // Today on the panels, with the cursor at rest, as on a first open.
    setPickedDay(null)
    setPick(null)
    window.scrollTo(0, 0)
  }
```

Then, in the returned JSX, wrap it so the month view stands in for everything:

```tsx
  if (view === 'month') {
    return (
      <MonthView
        spot={spot}
        today={data.today}
        hilo={hilo}
        tidesShown={tidesShown}
        month={month}
        hidden={tide.hidden}
        canHide={tide.canHide}
        onMonth={setMonth}
        onBack={backToForecast}
        onShowTides={showTides}
      />
    )
  }

  return (
    <>
      <TonightStrip words={tonight} />
      …everything as it is…
      <DayList rows={rows} onSelect={selectDay} onMonths={openMonths} />
    </>
  )
```

Put the `if (view === 'month')` return after `showTides` is defined and before the existing `return`. Hooks all run before it, so their order never changes. Update the component's doc comment to say: "Everything for one spot: tonight, the day's panels, its highs and lows, the captions and the 14 days, or the month view in their place."

- [ ] **Step 4: Styles, in `src/styles.css`**

Change the `.tides-toggle` rule's selector to `.tides-toggle,\n.text-button` so the new buttons share it, and the `.tides-toggle:focus-visible` selector likewise to `.tides-toggle:focus-visible,\n.text-button:focus-visible`. Then, after the `.days h2` rule, add:

```css
.days-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
```

And at the end of the file:

```css
/* One month at a time. The rows are the 14-day rows without weather, and
   today's row carries the tint the chosen day has there. */
.month {
  margin-top: 1rem;
}
.month-back {
  padding-left: 0;
}
.month-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.month-head h2 {
  flex: 1;
  text-align: center;
  font-size: 1.1333rem;
  font-weight: 600;
}
.month-step {
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border: 1px solid var(--rule);
  border-radius: 999px;
  background: none;
  color: var(--ink);
  font: inherit;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.month-step:disabled {
  color: var(--rule);
  cursor: default;
}
.month-step:focus-visible {
  outline: 2px solid var(--sea);
  outline-offset: 2px;
}
.month ol {
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
}
.month-row {
  display: grid;
  row-gap: 0.2rem;
  margin: 0 -0.6rem;
  padding: 0.6rem;
  border-top: 1px solid var(--rule);
}
.month-row[aria-current='date'] {
  background: var(--sea-fill);
  box-shadow: inset 0.2rem 0 0 var(--sea);
}
```

- [ ] **Step 5: Run everything**

Run: `npm run format && npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 6: Check it in a browser**

Start the dev server on a port of its own: `npx vite --port 5199` in the background. Then, with Playwright (the `mcp__playwright__browser_run_code_unsafe` tool, or a script run with `npx playwright` if that is what is available), at a 390 px wide viewport against `http://localhost:5199/`, with the live APIs and a fresh origin (clear `localStorage` first):

1. **The entry.** On Campus Point, the 14-day list's heading reads "14 days" with "Months ahead" on its right. Record the network requests: exactly one NOAA request has `interval=hilo`, and its `begin_date` is today in UTC and its `end_date` the last day of the third month after this one (run in October 2026: `end_date=20270131`). Screenshot the heading.
2. **Tap "Months ahead".** The page is at the top. The tonight strip, panels, table and list are gone. "‹ Back to forecast" is on its own line, then "‹", the current month's name and year, "›". The previous button is disabled. The first row is today's date, tinted, with "Sunset …", "Moon …% lit, …" and its highs and lows; the rows run to the last day of the month. Compare today's row's highs and lows with https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=9411340 for today: same times and heights. Screenshot.
3. **Step forward three times.** Each tap changes the title to the next month and the rows to its full run of days, from the 1st. On the fourth month the next button is disabled. Find a row whose moon line ends in "full moon" and one in "new moon". Screenshot the last month. Step back once: the previous month is back.
4. **Back to forecast.** Tap it. The page is at the top with the tonight strip, today's panels and the list, as on a first open.
5. **La Cumbre Peak.** Switch spot, tap "Months ahead". Rows have no High/Low lines. Under the rows, "Tides hidden. Nearest station: NOAA 9411340 Santa Barbara, 6.3 mi south." with "Show tides". Tap it: the rows gain their highs and lows and the caption now ends with "Hide tides". Tap "Hide tides": the hidden line is back. Switch to Campus Point: the forecast view is on screen, not the month view.
6. **Midnight, with the fake clock.** On a fresh page with `page.clock.install({ time: '2026-10-31T23:58:00-07:00' })` (never `pauseAt`; see the note below), open the page, tap "Months ahead", step to November, then back to October, and `page.clock.runFor(3 * 60_000)`. The title becomes "November 2026" with the 1st at its top, marked today, and the previous button is disabled. Close the page and clear `localStorage` for the origin before anything else, since entries stamped in the future look fresh until real time catches up.
7. Dark scheme: one screenshot of a month with `prefers-color-scheme: dark` emulated, to see the tint, the step buttons and the disabled one hold.
8. Clear `localStorage` for the origin when done, and stop the dev server.

Note anything that looks wrong in the task report rather than fixing the plain modules here; they have tests and a fix belongs with its test. Playwright note: `page.clock.pauseAt` followed by a reload has hung the tool before; use `install` and `runFor` only, and wrap each step in a timeout so a hang names its step.

- [ ] **Step 7: Commit**

```bash
git add src/ui/MonthView.tsx src/ui/DayList.tsx src/ui/SpotScreen.tsx src/styles.css
git commit -m "The month view on screen

Months ahead, from the 14-day list's heading, replaces the forecast with
one month at a time: a back button, the month between its step buttons,
one row per day, and the caption or the hidden line. The components
arrange what the plain modules work out.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: CLAUDE.md, the README and the pull request

**Files:**
- Modify: `CLAUDE.md`, `README.md`

- [ ] **Step 1: Update the status in `CLAUDE.md`**

In `## Status`, change the first line "Stage 1 is built; its phone check is down to one item. Stage 2 has begun: three spots are on a pull request." to "Stage 1 is built; its phone check is down to one item. Stage 2 has begun: three spots are merged, and the month view is on a pull request." Change the "Built:" bullet to end "…and tides hidden by default at La Cumbre; then the month view (this month and the next three, sunset, moon and highs and lows per day)." Change "Not built: everything after the three spots." to "Not built: everything after the month view."

In `## Data sources`, under NOAA CO-OPS, change the bullet "Three months of high/low is one 18 KB request; one month at 6-minute resolution is 7,440 points." to "Highs and lows from today to the end of the third month ahead are one request of about 22 KB (432 events for Santa Barbara, 10 October 2026 to 31 January 2027); one month at 6-minute resolution is 7,440 points."

In `## Next Steps`, replace the bullet beginning "The three-spots pull request" with: "The month-view pull request (`stage-2/month-view`, issue #3) waits for the owner's phone check and review."

In `README.md`, change "More spots and the month view are next." to "Three spots can be switched between, and a month view lists sunset, moon and highs and lows for this month and the next three."

- [ ] **Step 2: Push and open the pull request**

```bash
npm run format && npm test && npm run lint && npm run build
git add CLAUDE.md README.md
git commit -m "Note the month view in CLAUDE.md and the README

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin stage-2/month-view
gh pr create --title "Month view: sunset, moon and highs and lows, this month and the next three" --body "$(cat <<'EOF'
Closes #3. Spec: `docs/superpowers/specs/2026-10-10-month-view-design.md`. Plan: `docs/superpowers/plans/2026-10-10-month-view.md`.

A second view of a spot for planning past the forecast. "Months ahead", in the 14-day list's heading, replaces the forecast with one calendar month at a time: this month from today, and the next three in full. Each row is a day's sunset, moon with its phase, moonrise-near-sunset flag and NOAA's highs and lows. No weather, no curve, no cursor. "Back to forecast" returns to tonight.

- **One longer fetch.** The highs and lows the forecast already fetched for 14 days are fetched to the end of the third month ahead instead: one 22 KB request a month rather than a 2 KB one every two weeks, and no new source, loader or cache entry.
- **Hidden tides** behave as on the forecast view: no tide lines, the hidden line with Show tides, Hide tides after the caption where the spot hides by default.
- **Midnight** moves the rows on; on the first of a month the month that ended drops off and the current one takes its place.

Decisions the issue left open are listed at the end of the spec. The three worth a look: a list rather than a calendar grid; no tide curve in the month view; and the month rows name the moon's phase while the 14-day rows do not.

## Checking it on a phone

Open the Vercel preview link on this pull request on an iPhone, signed in to Vercel.

Pass, all of:
1. Scroll to the 14-day list. Its heading reads "14 days" with "Months ahead" on the right.
2. Tap Months ahead. The page is at the top. A "Back to forecast" line, then this month's name between "‹" and "›", with "‹" greyed. The first row is today, tinted, with sunset, the moon's percent and phase, and today's highs and lows, which match the tide panel's table on the forecast.
3. Tap "›" three times. Each month's rows start at the 1st. On the fourth month "›" is greyed. Some row says "full moon" and some row says "new moon".
4. Tap Back to forecast. Tonight's strip and today's panels are on screen, at the top.
5. Switch to La Cumbre Peak and tap Months ahead. No High/Low lines; under the rows a line says tides are hidden, with Show tides. Tap it: the lines appear and the caption ends with Hide tides.

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
- Still open from Stage 1: item 7 of the phone check (a reopen with a connection draws at once from saved data and the captions update when the refresh lands).
