# Stage 1, Part 1: Foundation and Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed placeholder page with CI, then a tested data layer for Campus Point: time handling, NOAA tides, the NWS forecast, sun and moon, and the on-device cache.

**Architecture:** A static Vite + React + TypeScript app with no server. This plan builds everything below the screen as plain TypeScript modules with no React, each tested against recorded real responses or US Naval Observatory reference values. Every time is a UTC instant; only `src/time.ts` knows about zones.

**Tech Stack:** Node 24, npm, Vite 8, React 19, TypeScript 6.0, Vitest 5, oxlint, Prettier, `astronomy-engine`. Hosting on Vercel, CI on GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-08-stage-1-campus-point-design.md`

**Scope:** This plan covers pull requests 1 and 2 of the four in the spec's Delivery section. Pull requests 3 and 4 (the screen) get their own plan after the data layer merges, when the data shapes are real and tested.

## Global Constraints

- **Node 24 for every `npm`, `npx` and `node` command.** In a fresh shell run `source ~/.nvm/nvm.sh && nvm use` first. Node 24.21.0 is already installed under nvm. Vitest 5 does not run on Node 20.
- **Public repo, no personal details.** Tracked files, commit messages and pull requests never name people. Write "the first user". Never copy anything out of `private/`.
- **Commit identity.** Before the first commit in a shell, check `git config user.email` ends in `users.noreply.github.com`. It is set in this clone; do not change it.
- **Commit trailer.** End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Code style is the Vite template's:** no semicolons, single quotes, relative imports carry their `.ts` or `.tsx` extension, type-only imports use `import type`, no enums. Run `npm run format` before every commit.
- **No unused locals or parameters.** The template's TypeScript settings make them build errors.
- **Times:** every stored or computed time is a UTC instant in epoch milliseconds. Only `src/time.ts` converts to a zone. Nothing reads the viewer's zone. Never derive a calendar day from `toISOString()`.
- **NOAA requests** always carry `station=9411340`, `datum=MLLW`, `units=english`, `time_zone=gmt`, `format=json`, `application=tideline`.
- **Units:** feet above MLLW, °F, mph, 12-hour clock.
- **Runtime dependencies allowed in this plan:** `react`, `react-dom`, `astronomy-engine`. Nothing else.
- **Data, not a verdict.** No scores, no go/no-go, no alerts.

## Review Focus

Inputs and conditions the spec implies but does not list as tests. Each one has a test in the task named.

1. **NOAA answers HTTP 200 with an error body** (it does this for a bad date range or a station outage). Expected: a thrown error with NOAA's message, so the caller keeps showing saved data. Not an empty series. Task 4.
2. **An NWS layer has `null` values or is missing altogether.** Expected: that field is `null` for those hours and the other fields still parse. No `NaN`. Task 5.
3. **A local day with no moonrise** (2 November 2026 at this spot), right after a 25-hour day whose moonrise is at 11:40 PM. Expected: `moonrise` is `null` on the 2nd and present on the 1st. Task 6.
4. **A saved cache entry is corrupt or has an old shape.** Expected: treated as nothing saved. No crash on open. Task 7.
5. **The viewer's device is in a different time zone from the spot.** Expected: identical dates and times. The whole test suite runs with the device zone set to Tokyo. Task 1.

## File Structure

Created in pull request 1:

- `.nvmrc`, `.prettierrc`, `.prettierignore`, `.oxlintrc.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `package.json`, `package-lock.json`, `index.html`
- `.github/workflows/ci.yml` — lint, build, test on every pull request and on `main`
- `src/main.tsx` — entry point
- `src/App.tsx` — placeholder page showing the spot name
- `src/styles.css` — base styles
- `src/spot.ts` — the fixed Campus Point configuration
- `src/test-env.test.ts` — proves the Tokyo time zone override reaches the tests

Created in pull request 2:

- `src/time.ts` — spot-zone day boundaries and clock formatting
- `src/data/noaa.ts` — fetch and parse the three NOAA responses
- `src/data/nws.ts` — fetch and parse the raw forecast grid
- `src/data/astro.ts` — sunset, moonrise, phase, moonrise flag
- `src/data/cache.ts` — `localStorage` wrapper and staleness rules
- `src/data/__fixtures__/` — recorded responses and reference values
- A `*.test.ts` beside each module

Modified: `.gitignore`, `CLAUDE.md`.

---

## Pull request 1: scaffold, tooling, CI, Vercel

Work on branch `stage-1/scaffold`, created from `main`.

### Task 1: Scaffold, tooling, placeholder page, CI

**Files:**
- Create: everything listed under "Created in pull request 1" above
- Modify: `.gitignore`, `CLAUDE.md`
- Test: `src/test-env.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Spot` and `CAMPUS_POINT` from `src/spot.ts`; npm scripts `dev`, `build`, `typecheck`, `lint`, `format`, `test`.

- [ ] **Step 1: Branch and Node version**

```bash
git switch main && git pull && git switch -c stage-1/scaffold
printf '24\n' > .nvmrc
source ~/.nvm/nvm.sh && nvm use
node -v
```

Expected: `v24.21.0` or later 24.x.

- [ ] **Step 2: Generate the official template in a temporary directory and copy its config in**

The repo directory is not empty, so the template is generated elsewhere and copied.

```bash
tmp=$(mktemp -d)
npx --yes create-vite@latest "$tmp/app" --template react-ts </dev/null
cp "$tmp/app/package.json" "$tmp/app/tsconfig.json" "$tmp/app/tsconfig.app.json" "$tmp/app/tsconfig.node.json" "$tmp/app/.oxlintrc.json" .
mkdir -p src
rm -rf "$tmp"
```

Not copied on purpose: the template's `README.md`, `public/`, `src/` demo files, `index.html`, `vite.config.ts` and `.gitignore`. The next steps write our own.

Check that `tsconfig.app.json` contains `"verbatimModuleSyntax": true` and `"erasableSyntaxOnly": true`, and that `package.json` pins `"typescript": "~6.0.x"`. If the template has moved to TypeScript 7, stop and report; do not guess.

- [ ] **Step 3: Set the package name, engine and scripts, and install**

```bash
npm pkg set name=tideline engines.node=">=22.12"
npm pkg set scripts.typecheck="tsc -b" scripts.lint="oxlint && prettier --check ." scripts.format="prettier --write ." scripts.test="vitest run"
npm install
npm install -D vitest prettier
```

Expected: both installs finish without errors. A notice about install scripts needing review is normal.

- [ ] **Step 4: Write the config files**

`.gitignore` (replace the whole file):

```
# Personal context about people. Never commit.
private/

node_modules
dist
*.local
.vercel
*.log
.DS_Store
```

`.prettierrc`:

```json
{ "semi": false, "singleQuote": true }
```

`.prettierignore`:

```
package-lock.json
*.md
src/data/__fixtures__
```

Markdown is ignored because `AGENTS.md` and part of `CLAUDE.md` are managed by an external sync script that must find them byte-for-byte unchanged.

`vite.config.ts`, without the `env` line for now (Step 6 adds it after watching the test fail):

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, viewport-fit=cover"
    />
    <title>Tideline</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Write the failing test for the time zone override**

`src/test-env.test.ts`:

```ts
import { expect, test } from 'vitest'

// vite.config.ts sets TZ for the test run. If this fails, the override is not
// reaching the tests and the rest of the suite proves less than it claims.
test('tests run with the device time zone set to Tokyo', () => {
  expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-540)
})
```

Run: `npm test`
Expected: FAIL. On a Pacific machine the received value is `480`.

- [ ] **Step 6: Set the override and watch it pass**

In `vite.config.ts`, replace the `test` block with:

```ts
  test: {
    include: ['src/**/*.test.ts'],
    // Run every test as if the device were in Tokyo. Nothing in this app may
    // depend on the viewer's time zone, only on the spot's.
    env: { TZ: 'Asia/Tokyo' },
  },
```

Run: `npm test`
Expected: PASS, 1 test.

- [ ] **Step 7: Write the spot, the placeholder page, and styles**

`src/spot.ts`:

```ts
export interface Spot {
  id: string
  name: string
  lat: number
  lon: number
  /** IANA zone. Every displayed time and calendar day uses it. */
  timeZone: string
  /** The 2.5 km NWS forecast cell containing the spot. */
  nws: { office: string; gridX: number; gridY: number }
  tideStation: {
    id: string
    name: string
    distanceMi: number
    direction: string
  }
}

export const CAMPUS_POINT: Spot = {
  id: 'campus-point',
  name: 'Campus Point',
  lat: 34.4046,
  lon: -119.844,
  timeZone: 'America/Los_Angeles',
  nws: { office: 'LOX', gridX: 100, gridY: 71 },
  tideStation: {
    id: '9411340',
    name: 'Santa Barbara',
    distanceMi: 8.6,
    direction: 'east',
  },
}
```

`src/App.tsx`:

```tsx
import { CAMPUS_POINT } from './spot.ts'

export default function App() {
  const { name, tideStation } = CAMPUS_POINT
  return (
    <main>
      <h1>{name}</h1>
      <p>
        Tide station: NOAA {tideStation.id} {tideStation.name},{' '}
        {tideStation.distanceMi} mi {tideStation.direction}
      </p>
      <p>Nothing else here yet.</p>
    </main>
  )
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`src/styles.css`:

```css
:root {
  color-scheme: light dark;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
  font-variant-numeric: tabular-nums;
}

body {
  margin: 0;
}

main {
  max-width: 34rem;
  margin: 0 auto;
  padding: 1rem;
}
```

- [ ] **Step 8: Add the CI workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm test
```

`npm run build` runs `tsc -b` first, so it is also the type check.

- [ ] **Step 9: Update `CLAUDE.md`**

Replace the paragraph under `## Status` (keep the `Repo:` line) with:

```markdown
Stage 1 is in progress. The scaffold and tooling are in place; `docs/superpowers/plans/` says what is built and what is next.
```

Add this section directly after `## Status`:

```markdown
## Commands

Node 24 (`.nvmrc`). In a fresh shell: `source ~/.nvm/nvm.sh && nvm use`.

- `npm run dev`: dev server at http://localhost:5173
- `npm run build`: type-check, then build to `dist/`
- `npm run lint`: oxlint, then a Prettier check
- `npm run format`: rewrite files with Prettier
- `npm test`: run all tests once
- `npx vitest run src/time.test.ts`: one test file
- `npx vitest run -t "25 hours"`: tests whose name matches

Tests run with `TZ=Asia/Tokyo` (set in `vite.config.ts`), so code that leans on the viewer's time zone instead of the spot's fails.

Code style is the Vite template's: no semicolons, single quotes, relative imports carry their `.ts`/`.tsx` extension, type-only imports use `import type`, no enums.
```

- [ ] **Step 10: Format, then run every check**

```bash
npm run format
npm run lint
npm run build
npm test
```

Expected: lint prints no problems; build ends with `✓ built`; 1 test passes.

- [ ] **Step 11: Look at the page**

Run `npm run dev` and open http://localhost:5173.

Pass: the page shows the heading "Campus Point", the line "Tide station: NOAA 9411340 Santa Barbara, 8.6 mi east", and "Nothing else here yet." It follows the system light or dark setting.
Fail: a blank page, or an error in the browser console.

Stop the dev server.

- [ ] **Step 12: Commit**

```bash
git add -A
git status --short
```

Check the list contains no `private/` path and no `node_modules`. Then:

```bash
git commit -m "Scaffold the app, tooling and CI" -m "Vite, React and TypeScript from the official template, with Vitest, oxlint and Prettier. The page is a placeholder showing the fixed spot. Tests run with the device time zone set to Tokyo." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Connect Vercel and open pull request 1

**Files:**
- Modify: none in the repo. `vercel link` creates `.vercel/`, which is gitignored.

**Interfaces:**
- Consumes: the commit from Task 1.
- Produces: a Vercel project named `tideline` connected to the GitHub repo, so every pull request gets a preview URL and `main` deploys to production.

- [ ] **Step 1: Ask the owner before creating the Vercel project**

Creating a project is visible outside this machine. Ask: "OK to create the Vercel project `tideline` under your account and connect it to the GitHub repo?" Continue only on a yes.

- [ ] **Step 2: Create and connect the project**

```bash
vercel link --yes --project tideline
vercel git connect
```

Expected: `Linked to .../tideline` and a line confirming the GitHub repository is connected. `git status --short` shows nothing new, because `.vercel` is ignored.

- [ ] **Step 3: Push and open the pull request**

```bash
git push -u origin stage-1/scaffold
gh pr create --title "Stage 1 (1/4): scaffold, tooling, CI" --body "$(cat <<'EOF'
First of four pull requests for Stage 1. Spec: `docs/superpowers/specs/2026-10-08-stage-1-campus-point-design.md`.

- Vite + React + TypeScript from the official template, with Vitest, oxlint and Prettier
- A placeholder page showing the fixed spot and its tide station
- CI on pull requests and `main`: lint, build, test
- Tests run with the device time zone set to Tokyo, so nothing can depend on the viewer's zone

## Checking it

Open the Vercel preview link on this pull request, on an iPhone if possible.

Pass: the page shows "Campus Point" and "Tide station: NOAA 9411340 Santa Barbara, 8.6 mi east".
Fail: a blank page or a Vercel error page.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Confirm CI and the preview**

```bash
gh pr checks --watch
```

Expected: the `check` job passes and a Vercel deployment check appears with a preview URL. Open the preview URL and apply the pass/fail test from the pull request body. Report the pull request URL and the preview URL to the owner, then wait for review. Do not merge.

---

## Pull request 2: time and the data layer

Start after pull request 1 has merged. Work on branch `stage-1/data`, created from the updated `main`:

```bash
git switch main && git pull && git switch -c stage-1/data
source ~/.nvm/nvm.sh && nvm use
```

### Task 3: `src/time.ts`

**Files:**
- Create: `src/time.ts`
- Test: `src/time.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `localDate(t: number, timeZone: string): string` — the calendar date at an instant, `'YYYY-MM-DD'`
  - `localDayStart(date: string, timeZone: string): number` — the instant a calendar date begins
  - `addDays(date: string, days: number): string` — calendar arithmetic on `'YYYY-MM-DD'`
  - `formatTime(t: number, timeZone: string): string` — for example `'6:33 PM'`

- [ ] **Step 1: Write the failing tests**

`src/time.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { addDays, formatTime, localDate, localDayStart } from './time.ts'

const LA = 'America/Los_Angeles'
const HOUR = 3_600_000

describe('localDate', () => {
  test('the date changes at local midnight, not UTC midnight', () => {
    expect(localDate(Date.UTC(2026, 9, 9, 6, 59), LA)).toBe('2026-10-08')
    expect(localDate(Date.UTC(2026, 9, 9, 7, 0), LA)).toBe('2026-10-09')
  })

  test('an evening instant belongs to the local day, not the UTC day', () => {
    // 6:33 PM Pacific on 8 October is already 9 October in UTC.
    expect(localDate(Date.UTC(2026, 9, 9, 1, 33), LA)).toBe('2026-10-08')
  })
})

describe('localDayStart', () => {
  test('an ordinary day starts at local midnight', () => {
    expect(localDayStart('2026-10-08', LA)).toBe(Date.UTC(2026, 9, 8, 7))
  })

  test('the day the clocks go back is 25 hours long', () => {
    const start = localDayStart('2026-11-01', LA)
    const next = localDayStart('2026-11-02', LA)
    expect(start).toBe(Date.UTC(2026, 10, 1, 7))
    expect(next).toBe(Date.UTC(2026, 10, 2, 8))
    expect((next - start) / HOUR).toBe(25)
  })

  test('the day the clocks go forward is 23 hours long', () => {
    const start = localDayStart('2027-03-14', LA)
    const next = localDayStart('2027-03-15', LA)
    expect(start).toBe(Date.UTC(2027, 2, 14, 8))
    expect(next).toBe(Date.UTC(2027, 2, 15, 7))
    expect((next - start) / HOUR).toBe(23)
  })

  test('round-trips with localDate, including clock-change days', () => {
    for (const date of ['2026-10-08', '2026-11-01', '2026-11-02', '2027-03-14']) {
      expect(localDate(localDayStart(date, LA), LA)).toBe(date)
    }
  })

  test('uses the zone it is given, not a fixed one', () => {
    expect(localDayStart('2026-10-08', 'America/New_York')).toBe(
      Date.UTC(2026, 9, 8, 4),
    )
  })
})

describe('addDays', () => {
  test('crosses month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  test('adding zero returns the same date', () => {
    expect(addDays('2026-10-08', 0)).toBe('2026-10-08')
  })
})

describe('formatTime', () => {
  test('a 12-hour clock in the given zone', () => {
    expect(formatTime(Date.UTC(2026, 9, 9, 1, 33), LA)).toBe('6:33 PM')
    expect(formatTime(Date.UTC(2026, 9, 9, 1, 33), 'America/New_York')).toBe(
      '9:33 PM',
    )
  })

  test('midnight and noon', () => {
    expect(formatTime(Date.UTC(2026, 9, 8, 7, 0), LA)).toBe('12:00 AM')
    expect(formatTime(Date.UTC(2026, 9, 8, 19, 0), LA)).toBe('12:00 PM')
  })
})
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run src/time.test.ts`
Expected: FAIL, because `./time.ts` does not exist.

- [ ] **Step 3: Write the implementation**

`src/time.ts`:

```ts
// The only module that knows about time zones. Every other module works in
// UTC instants (epoch milliseconds) and asks this one for anything local.

const clockFormats = new Map<string, Intl.DateTimeFormat>()

function clockFormat(timeZone: string): Intl.DateTimeFormat {
  let format = clockFormats.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    clockFormats.set(timeZone, format)
  }
  return format
}

/** The wall-clock reading in a zone at instant t, as numbers. */
function wallClock(t: number, timeZone: string): Record<string, number> {
  const clock: Record<string, number> = {}
  for (const { type, value } of clockFormat(timeZone).formatToParts(t)) {
    if (type !== 'literal') clock[type] = Number(value)
  }
  return clock
}

/** How far a zone is from UTC at instant t, in ms. Negative west of Greenwich. */
function zoneOffset(t: number, timeZone: string): number {
  const c = wallClock(t, timeZone)
  const asUtc = Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second)
  return asUtc - Math.floor(t / 1000) * 1000
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function parseDate(date: string): [number, number, number] {
  const [year, month, day] = date.split('-').map(Number)
  return [year, month, day]
}

/** The calendar date in a zone at instant t, as 'YYYY-MM-DD'. */
export function localDate(t: number, timeZone: string): string {
  const c = wallClock(t, timeZone)
  return `${c.year}-${pad(c.month)}-${pad(c.day)}`
}

/** The instant a calendar date begins (local midnight) in a zone. */
export function localDayStart(date: string, timeZone: string): number {
  const [year, month, day] = parseDate(date)
  const utcMidnight = Date.UTC(year, month - 1, day)
  // Two passes: on a clock-change day the offset at the first guess can differ
  // from the offset at the answer.
  const guess = utcMidnight - zoneOffset(utcMidnight, timeZone)
  return utcMidnight - zoneOffset(guess, timeZone)
}

/** Calendar arithmetic on a 'YYYY-MM-DD' date. No zone is involved. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = parseDate(date)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return [
    shifted.getUTCFullYear(),
    pad(shifted.getUTCMonth() + 1),
    pad(shifted.getUTCDate()),
  ].join('-')
}

/** A 12-hour clock time in a zone, such as '6:33 PM'. */
export function formatTime(t: number, timeZone: string): string {
  const text = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(t)
  // Some browsers put a narrow no-break space before AM/PM. Use a plain one.
  return text.replace(/\u202f/g, ' ')
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run src/time.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Format, check, commit**

```bash
npm run format && npm run lint && npm run build && npm test
git add src/time.ts src/time.test.ts
git commit -m "Add spot-zone time handling" -m "Local day boundaries, calendar arithmetic and 12-hour formatting, tested on the 25-hour and 23-hour clock-change days." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: `src/data/noaa.ts`

**Files:**
- Create: `src/data/noaa.ts`
- Create: `src/data/__fixtures__/noaa-hilo-20261008-20261022.json`, `src/data/__fixtures__/noaa-predictions-20261008-20261009.json`, `src/data/__fixtures__/noaa-water-level-20261008-20261009.json`, `src/data/__fixtures__/README.md`
- Test: `src/data/noaa.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface TidePoint { t: number; ft: number }`
  - `interface TideExtreme extends TidePoint { type: 'H' | 'L' }`
  - `noaaUrl(stationId: string, product: 'predictions' | 'water_level', start: number, end: number, interval?: '6' | 'hilo'): string`
  - `parsePredictions(json: unknown): TidePoint[]`
  - `parseHiLo(json: unknown): TideExtreme[]`
  - `parseWaterLevel(json: unknown): TidePoint[]`
  - `fetchPredictions(stationId: string, start: number, end: number): Promise<TidePoint[]>`
  - `fetchHiLo(stationId: string, start: number, end: number): Promise<TideExtreme[]>`
  - `fetchWaterLevel(stationId: string, start: number, end: number): Promise<TidePoint[]>`

  `start` and `end` are UTC instants. The fetch functions return only points with `start <= t < end`.

- [ ] **Step 1: Record the fixtures**

These use fixed dates, so the predictions come back identical whenever they are fetched.

```bash
mkdir -p src/data/__fixtures__
A='https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'
C='station=9411340&datum=MLLW&units=english&time_zone=gmt&format=json&application=tideline'
curl -sS "$A?product=predictions&interval=hilo&begin_date=20261008&end_date=20261022&$C" -o src/data/__fixtures__/noaa-hilo-20261008-20261022.json
curl -sS "$A?product=predictions&interval=6&begin_date=20261008&end_date=20261009&$C" -o src/data/__fixtures__/noaa-predictions-20261008-20261009.json
curl -sS "$A?product=water_level&begin_date=20261008&end_date=20261009&$C" -o src/data/__fixtures__/noaa-water-level-20261008-20261009.json
head -c 120 src/data/__fixtures__/noaa-hilo-20261008-20261022.json
```

Expected: the last command prints JSON beginning `{ "predictions" : [ {"t":"2026-10-08 03:09", "v":"5.449", "type":"H"}`.

`src/data/__fixtures__/README.md`:

```markdown
# Fixtures

Real responses, saved so the parsers are tested against what the services actually send.

- `noaa-hilo-20261008-20261022.json`: NOAA station 9411340, predicted highs and lows, 8 to 22 October 2026 UTC.
- `noaa-predictions-20261008-20261009.json`: the same station's predicted curve at 6-minute resolution, 8 and 9 October 2026 UTC.
- `noaa-water-level-20261008-20261009.json`: the same station's observed water level for those two days. On the morning of 8 October it ran about 1.1 ft above the prediction.
- `nws-gridpoint-LOX-100-71.json`: the NWS raw forecast grid for the cell containing Campus Point. A live forecast, so tests assert its structure, not its numbers.
- `usno-campus-point.ts`: sunset and moonrise from the US Naval Observatory API (`aa.usno.navy.mil/api/rstt/oneday`) for latitude 34.4046, longitude -119.8440.

The NOAA requests all used `datum=MLLW&units=english&time_zone=gmt&format=json`.
```

- [ ] **Step 2: Write the failing tests**

`src/data/noaa.test.ts`:

```ts
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  fetchHiLo,
  fetchPredictions,
  fetchWaterLevel,
  noaaUrl,
  parseHiLo,
  parsePredictions,
  parseWaterLevel,
} from './noaa.ts'
import hiloRaw from './__fixtures__/noaa-hilo-20261008-20261022.json?raw'
import curveRaw from './__fixtures__/noaa-predictions-20261008-20261009.json?raw'
import observedRaw from './__fixtures__/noaa-water-level-20261008-20261009.json?raw'

const hilo: unknown = JSON.parse(hiloRaw)
const curve: unknown = JSON.parse(curveRaw)
const observed: unknown = JSON.parse(observedRaw)

const MINUTE = 60_000
// Local midnight at the spot on 8 and 9 October 2026 (Pacific daylight time).
const OCT_8 = Date.UTC(2026, 9, 8, 7)
const OCT_9 = Date.UTC(2026, 9, 9, 7)

afterEach(() => vi.unstubAllGlobals())

describe('noaaUrl', () => {
  test('covers the UTC dates the window touches', () => {
    // A 14-day local window touches 15 UTC dates.
    expect(
      noaaUrl('9411340', 'predictions', OCT_8, Date.UTC(2026, 9, 22, 7), 'hilo'),
    ).toBe(
      'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter' +
        '?product=predictions&interval=hilo' +
        '&begin_date=20261008&end_date=20261022' +
        '&station=9411340&datum=MLLW&units=english&time_zone=gmt' +
        '&format=json&application=tideline',
    )
  })

  test('a window ending exactly at UTC midnight does not ask for the next date', () => {
    const url = noaaUrl(
      '9411340',
      'water_level',
      Date.UTC(2026, 9, 8),
      Date.UTC(2026, 9, 9),
    )
    expect(url).toContain('begin_date=20261008&end_date=20261008')
    expect(url).not.toContain('interval=')
  })
})

describe('parseHiLo', () => {
  test('reads NOAA highs and lows as UTC instants', () => {
    const events = parseHiLo(hilo)
    expect(events).toHaveLength(54)
    expect(events[0]).toEqual({
      t: Date.UTC(2026, 9, 8, 3, 9),
      ft: 5.449,
      type: 'H',
    })
    expect(events[1]).toEqual({
      t: Date.UTC(2026, 9, 8, 9, 35),
      ft: 0.189,
      type: 'L',
    })
    expect(events.at(-1)).toEqual({
      t: Date.UTC(2026, 9, 22, 21, 0),
      ft: 1.49,
      type: 'L',
    })
  })
})

describe('parsePredictions', () => {
  test('reads the curve at 6-minute spacing', () => {
    const points = parsePredictions(curve)
    expect(points).toHaveLength(480)
    expect(points[0]).toEqual({ t: Date.UTC(2026, 9, 8, 0, 0), ft: 3.149 })
    expect(points.at(-1)).toEqual({ t: Date.UTC(2026, 9, 9, 23, 54), ft: 0.852 })
    for (let i = 1; i < points.length; i++) {
      expect(points[i].t - points[i - 1].t).toBe(6 * MINUTE)
    }
  })

  test('NOAA reporting a problem with HTTP 200 is an error, not an empty curve', () => {
    const body = {
      error: { message: ' No Predictions data was found. ' },
    }
    expect(() => parsePredictions(body)).toThrow(
      'NOAA: No Predictions data was found.',
    )
  })

  test('a body that is not an object is an error', () => {
    expect(() => parsePredictions(null)).toThrow('NOAA: response is not an object')
    expect(() => parsePredictions('oops')).toThrow(
      'NOAA: response is not an object',
    )
  })

  test('a body without the expected list is an error', () => {
    expect(() => parsePredictions({ data: [] })).toThrow(
      'NOAA: response has no predictions',
    )
  })
})

describe('parseWaterLevel', () => {
  test('reads observed readings', () => {
    const reading = parseWaterLevel(observed).find(
      (p) => p.t === Date.UTC(2026, 9, 8, 17, 6),
    )
    // 10:06 AM Pacific. Preliminary data can be revised slightly.
    expect(reading?.ft).toBeCloseTo(6.119, 1)
  })

  test('drops rows with an empty value, which is how a gauge outage appears', () => {
    const body = {
      data: [
        { t: '2026-10-08 00:00', v: '4.275' },
        { t: '2026-10-08 00:06', v: '' },
        { t: '2026-10-08 00:12', v: '4.301' },
      ],
    }
    expect(parseWaterLevel(body)).toEqual([
      { t: Date.UTC(2026, 9, 8, 0, 0), ft: 4.275 },
      { t: Date.UTC(2026, 9, 8, 0, 12), ft: 4.301 },
    ])
  })

  test('the morning of 8 October 2026 ran about 1.1 ft above the prediction', () => {
    const predicted = new Map(parsePredictions(curve).map((p) => [p.t, p.ft]))
    const from = Date.UTC(2026, 9, 8, 14, 0) // 7:00 AM Pacific
    const to = Date.UTC(2026, 9, 8, 17, 6) // 10:06 AM Pacific
    const deviations = parseWaterLevel(observed)
      .filter((p) => p.t >= from && p.t <= to)
      .map((p) => p.ft - predicted.get(p.t)!)
    const mean = deviations.reduce((sum, d) => sum + d, 0) / deviations.length
    expect(deviations.length).toBeGreaterThanOrEqual(30)
    expect(mean).toBeGreaterThan(0.9)
    expect(mean).toBeLessThan(1.4)
  })
})

describe('fetching', () => {
  test('fetchPredictions asks for the covering UTC dates and trims to the window', async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response(curveRaw))
    vi.stubGlobal('fetch', fetchMock)

    const points = await fetchPredictions('9411340', OCT_8, OCT_9)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = fetchMock.mock.calls[0][0]
    expect(url).toContain('product=predictions&interval=6')
    expect(url).toContain('begin_date=20261008&end_date=20261009')
    expect(points).toHaveLength(240)
    expect(points[0].t).toBe(OCT_8)
    expect(points.at(-1)!.t).toBe(OCT_9 - 6 * MINUTE)
  })

  test('fetchHiLo trims to the window', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string) => new Response(hiloRaw)),
    )
    const events = await fetchHiLo('9411340', OCT_8, OCT_9)
    // Local 8 October: low 2:35 AM, high 8:52 AM, low 2:58 PM, high 8:58 PM.
    expect(events.map((e) => e.type)).toEqual(['L', 'H', 'L', 'H'])
    expect(events[0]).toEqual({
      t: Date.UTC(2026, 9, 8, 9, 35),
      ft: 0.189,
      type: 'L',
    })
  })

  test('fetchWaterLevel trims to the window', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string) => new Response(observedRaw)),
    )
    const points = await fetchWaterLevel('9411340', OCT_8, OCT_9)
    expect(points.length).toBeGreaterThan(0)
    expect(points.every((p) => p.t >= OCT_8 && p.t < OCT_9)).toBe(true)
  })

  test('an HTTP failure is an error that names the status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string) => new Response('down', { status: 503 })),
    )
    await expect(fetchPredictions('9411340', OCT_8, OCT_9)).rejects.toThrow(
      'NOAA: HTTP 503',
    )
  })
})
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `npx vitest run src/data/noaa.test.ts`
Expected: FAIL, because `./noaa.ts` does not exist.

- [ ] **Step 4: Write the implementation**

`src/data/noaa.ts`:

```ts
// NOAA CO-OPS tide data: the predicted curve, predicted highs and lows, and
// the observed water level. Times are requested in GMT, because station-local
// timestamps carry no offset and are ambiguous when the clocks go back.

export interface TidePoint {
  /** UTC instant, epoch ms. */
  t: number
  /** Feet above MLLW. */
  ft: number
}

export interface TideExtreme extends TidePoint {
  type: 'H' | 'L'
}

interface NoaaRow {
  t: string
  v: string
  type?: string
}

const BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'

function utcYmd(t: number): string {
  const d = new Date(t)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
}

/**
 * The request URL for the UTC dates that cover the instants from start up to,
 * but not including, end.
 */
export function noaaUrl(
  stationId: string,
  product: 'predictions' | 'water_level',
  start: number,
  end: number,
  interval?: '6' | 'hilo',
): string {
  const params = new URLSearchParams({ product })
  if (interval) params.set('interval', interval)
  params.set('begin_date', utcYmd(start))
  params.set('end_date', utcYmd(end - 1))
  params.set('station', stationId)
  params.set('datum', 'MLLW')
  params.set('units', 'english')
  params.set('time_zone', 'gmt')
  params.set('format', 'json')
  params.set('application', 'tideline')
  return `${BASE}?${params.toString()}`
}

function rows(json: unknown, key: 'predictions' | 'data'): NoaaRow[] {
  if (typeof json !== 'object' || json === null) {
    throw new Error('NOAA: response is not an object')
  }
  const body = json as Record<string, unknown> & {
    error?: { message?: string }
  }
  // NOAA reports problems as HTTP 200 with an error body.
  if (body.error) {
    throw new Error(`NOAA: ${(body.error.message ?? 'unknown error').trim()}`)
  }
  const list = body[key]
  if (!Array.isArray(list)) throw new Error(`NOAA: response has no ${key}`)
  return list as NoaaRow[]
}

/** 'YYYY-MM-DD HH:MM' in GMT, as a UTC instant. */
function instant(gmt: string): number {
  const [date, time] = gmt.split(' ')
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  return Date.UTC(year, month - 1, day, hour, minute)
}

function points(list: NoaaRow[]): TidePoint[] {
  // A gauge outage shows up as rows with an empty value.
  return list
    .filter((row) => row.v !== '')
    .map((row) => ({ t: instant(row.t), ft: Number(row.v) }))
}

export function parsePredictions(json: unknown): TidePoint[] {
  return points(rows(json, 'predictions'))
}

export function parseHiLo(json: unknown): TideExtreme[] {
  return rows(json, 'predictions')
    .filter((row) => row.v !== '')
    .map(
      (row): TideExtreme => ({
        t: instant(row.t),
        ft: Number(row.v),
        type: row.type === 'H' ? 'H' : 'L',
      }),
    )
}

export function parseWaterLevel(json: unknown): TidePoint[] {
  return points(rows(json, 'data'))
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`NOAA: HTTP ${response.status}`)
  return response.json()
}

function within<T extends TidePoint>(list: T[], start: number, end: number): T[] {
  return list.filter((p) => p.t >= start && p.t < end)
}

export async function fetchPredictions(
  stationId: string,
  start: number,
  end: number,
): Promise<TidePoint[]> {
  const json = await getJson(noaaUrl(stationId, 'predictions', start, end, '6'))
  return within(parsePredictions(json), start, end)
}

export async function fetchHiLo(
  stationId: string,
  start: number,
  end: number,
): Promise<TideExtreme[]> {
  const json = await getJson(
    noaaUrl(stationId, 'predictions', start, end, 'hilo'),
  )
  return within(parseHiLo(json), start, end)
}

export async function fetchWaterLevel(
  stationId: string,
  start: number,
  end: number,
): Promise<TidePoint[]> {
  const json = await getJson(noaaUrl(stationId, 'water_level', start, end))
  return within(parseWaterLevel(json), start, end)
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx vitest run src/data/noaa.test.ts`
Expected: PASS, 14 tests.

If only "reads observed readings" fails with a value near but not equal to 6.119, NOAA has revised its preliminary data since 8 October. Change the expected number to the fixture's value and say so in the commit message.

- [ ] **Step 6: Format, check, commit**

```bash
npm run format && npm run lint && npm run build && npm test
git add src/data/noaa.ts src/data/noaa.test.ts src/data/__fixtures__
git commit -m "Add NOAA tide data: curve, highs and lows, observed level" -m "Requests are in GMT and trimmed to the caller's window. An error body returned with HTTP 200 is treated as a failure." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: `src/data/nws.ts`

**Files:**
- Create: `src/data/nws.ts`
- Create: `src/data/__fixtures__/nws-gridpoint-LOX-100-71.json`
- Test: `src/data/nws.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface ForecastHour { t: number; tempF: number | null; windMph: number | null; gustMph: number | null; windDeg: number | null; cloudPct: number | null; rainPct: number | null }`
  - `interface Forecast { updatedAt: number; hours: ForecastHour[] }` — `hours` is sorted by `t`, one entry per hour
  - `nwsUrl(office: string, gridX: number, gridY: number): string`
  - `parseDurationHours(duration: string): number`
  - `parseGridpoint(json: unknown): Forecast`
  - `fetchForecast(office: string, gridX: number, gridY: number): Promise<Forecast>`
  - `compassPoint(degrees: number): string` — 16-point name such as `'WSW'`

- [ ] **Step 1: Record the fixture**

```bash
curl -sS -H 'Accept: application/geo+json' 'https://api.weather.gov/gridpoints/LOX/100,71' -o src/data/__fixtures__/nws-gridpoint-LOX-100-71.json
head -c 80 src/data/__fixtures__/nws-gridpoint-LOX-100-71.json
```

Expected: JSON beginning with `{` and an `@context` key. If the response is an error (NWS has occasional outages), wait a minute and retry.

- [ ] **Step 2: Write the failing tests**

`src/data/nws.test.ts`:

```ts
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  compassPoint,
  fetchForecast,
  nwsUrl,
  parseDurationHours,
  parseGridpoint,
} from './nws.ts'
import realRaw from './__fixtures__/nws-gridpoint-LOX-100-71.json?raw'

const HOUR = 3_600_000
const EIGHT = Date.UTC(2026, 9, 8, 8)

function sample() {
  return {
    properties: {
      updateTime: '2026-10-08T14:26:58+00:00',
      temperature: {
        uom: 'wmoUnit:degC',
        values: [
          { validTime: '2026-10-08T08:00:00+00:00/PT2H', value: 20 },
          { validTime: '2026-10-08T10:00:00+00:00/PT1H', value: 25 },
        ],
      },
      windSpeed: {
        uom: 'wmoUnit:km_h-1',
        values: [{ validTime: '2026-10-08T08:00:00+00:00/PT3H', value: 16.0934 }],
      },
      windGust: {
        uom: 'wmoUnit:km_h-1',
        values: [{ validTime: '2026-10-08T08:00:00+00:00/PT1H', value: 32.1868 }],
      },
      windDirection: {
        uom: 'wmoUnit:degree_(angle)',
        values: [{ validTime: '2026-10-08T08:00:00+00:00/PT3H', value: 260 }],
      },
      skyCover: {
        uom: 'wmoUnit:percent',
        values: [{ validTime: '2026-10-08T08:00:00+00:00/PT3H', value: 3 }],
      },
      probabilityOfPrecipitation: {
        uom: 'wmoUnit:percent',
        values: [
          { validTime: '2026-10-08T08:00:00+00:00/PT3H', value: null },
        ],
      },
    } as Record<string, unknown>,
  }
}

afterEach(() => vi.unstubAllGlobals())

test('nwsUrl points at the raw grid endpoint', () => {
  expect(nwsUrl('LOX', 100, 71)).toBe(
    'https://api.weather.gov/gridpoints/LOX/100,71',
  )
})

describe('parseDurationHours', () => {
  test('hours, days, and both', () => {
    expect(parseDurationHours('PT1H')).toBe(1)
    expect(parseDurationHours('PT12H')).toBe(12)
    expect(parseDurationHours('P1D')).toBe(24)
    expect(parseDurationHours('P2DT4H')).toBe(52)
  })

  test('anything else is an error, not a guess', () => {
    expect(() => parseDurationHours('PT30M')).toThrow(
      'NWS: unsupported duration PT30M',
    )
    expect(() => parseDurationHours('P')).toThrow('NWS: unsupported duration P')
  })
})

describe('parseGridpoint', () => {
  test('expands multi-hour intervals into one record per hour', () => {
    const { hours } = parseGridpoint(sample())
    expect(hours.map((h) => h.t)).toEqual([EIGHT, EIGHT + HOUR, EIGHT + 2 * HOUR])
  })

  test('converts to °F and mph and keeps percent and degrees', () => {
    const { hours, updatedAt } = parseGridpoint(sample())
    expect(updatedAt).toBe(Date.UTC(2026, 9, 8, 14, 26, 58))
    expect(hours[0].tempF).toBeCloseTo(68, 5)
    expect(hours[0].windMph).toBeCloseTo(10, 3)
    expect(hours[0].gustMph).toBeCloseTo(20, 3)
    expect(hours[0].windDeg).toBe(260)
    expect(hours[0].cloudPct).toBe(3)
    expect(hours[1].tempF).toBeCloseTo(68, 5)
    expect(hours[2].tempF).toBeCloseTo(77, 5)
  })

  test('an hour a layer does not cover is null for that field', () => {
    const { hours } = parseGridpoint(sample())
    // Gusts were given for the first hour only.
    expect(hours[1].gustMph).toBeNull()
    expect(hours[2].gustMph).toBeNull()
  })

  test('a null value in a layer is null, never NaN', () => {
    const { hours } = parseGridpoint(sample())
    expect(hours.map((h) => h.rainPct)).toEqual([null, null, null])
  })

  test('a layer missing altogether leaves its field null and the rest intact', () => {
    const body = sample()
    delete body.properties.skyCover
    const { hours } = parseGridpoint(body)
    expect(hours.map((h) => h.cloudPct)).toEqual([null, null, null])
    expect(hours[0].tempF).toBeCloseTo(68, 5)
  })

  test('a layer in an unexpected unit is an error, not a wrong number', () => {
    const body = sample()
    body.properties.temperature = {
      uom: 'wmoUnit:degF',
      values: [{ validTime: '2026-10-08T08:00:00+00:00/PT1H', value: 68 }],
    }
    expect(() => parseGridpoint(body)).toThrow(
      'NWS: temperature is in wmoUnit:degF, expected wmoUnit:degC',
    )
  })

  test('a body without properties or an update time is an error', () => {
    expect(() => parseGridpoint(null)).toThrow('NWS: response has no properties')
    expect(() => parseGridpoint({ properties: {} })).toThrow(
      'NWS: response has no updateTime',
    )
  })

  test('a real response parses into consecutive hours with plausible values', () => {
    const forecast = parseGridpoint(JSON.parse(realRaw))
    expect(Number.isFinite(forecast.updatedAt)).toBe(true)
    // The forecast runs about 7 days 17 hours.
    expect(forecast.hours.length).toBeGreaterThan(150)
    for (let i = 1; i < forecast.hours.length; i++) {
      expect(forecast.hours[i].t - forecast.hours[i - 1].t).toBe(HOUR)
    }
    const temps = forecast.hours
      .map((h) => h.tempF)
      .filter((v): v is number => v !== null)
    expect(temps.length).toBeGreaterThan(150)
    expect(Math.min(...temps)).toBeGreaterThan(20)
    expect(Math.max(...temps)).toBeLessThan(120)
    const gusts = forecast.hours
      .map((h) => h.gustMph)
      .filter((v): v is number => v !== null)
    expect(gusts.length).toBeGreaterThan(150)
    expect(Math.min(...gusts)).toBeGreaterThanOrEqual(0)
  })
})

describe('fetchForecast', () => {
  test('requests the cell and parses the body', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify(sample())),
    )
    vi.stubGlobal('fetch', fetchMock)
    const forecast = await fetchForecast('LOX', 100, 71)
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.weather.gov/gridpoints/LOX/100,71',
    )
    expect(forecast.hours).toHaveLength(3)
  })

  test('an HTTP failure is an error that names the status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string) => new Response('down', { status: 503 })),
    )
    await expect(fetchForecast('LOX', 100, 71)).rejects.toThrow('NWS: HTTP 503')
  })
})

describe('compassPoint', () => {
  test('the cardinal and intermediate points', () => {
    expect(compassPoint(0)).toBe('N')
    expect(compassPoint(90)).toBe('E')
    expect(compassPoint(225)).toBe('SW')
    expect(compassPoint(260)).toBe('W')
  })

  test('boundaries and wrap-around', () => {
    expect(compassPoint(11.24)).toBe('N')
    expect(compassPoint(11.25)).toBe('NNE')
    expect(compassPoint(348.75)).toBe('N')
    expect(compassPoint(360)).toBe('N')
    expect(compassPoint(-90)).toBe('W')
  })
})
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `npx vitest run src/data/nws.test.ts`
Expected: FAIL, because `./nws.ts` does not exist.

- [ ] **Step 4: Write the implementation**

`src/data/nws.ts`:

```ts
// The NWS forecast for one 2.5 km grid cell, from the raw gridpoint endpoint.
// That endpoint is used because /forecast/hourly has no gusts or cloud cover.

export interface ForecastHour {
  /** Start of the hour, UTC instant in epoch ms. */
  t: number
  tempF: number | null
  windMph: number | null
  gustMph: number | null
  /** The direction the wind blows from, in degrees. */
  windDeg: number | null
  cloudPct: number | null
  rainPct: number | null
}

export interface Forecast {
  /** When NWS last updated this cell's forecast. */
  updatedAt: number
  hours: ForecastHour[]
}

type Field = Exclude<keyof ForecastHour, 't'>

interface LayerSpec {
  /** The layer's name in the NWS response. */
  layer: string
  /** The unit NWS is expected to send it in. */
  unit: string
  convert: (value: number) => number
}

interface GridLayer {
  uom?: string
  values: { validTime: string; value: number | null }[]
}

const HOUR = 3_600_000
const KMH_TO_MPH = 0.621371
const asIs = (value: number) => value

const LAYERS: Record<Field, LayerSpec> = {
  tempF: {
    layer: 'temperature',
    unit: 'wmoUnit:degC',
    convert: (celsius) => (celsius * 9) / 5 + 32,
  },
  windMph: {
    layer: 'windSpeed',
    unit: 'wmoUnit:km_h-1',
    convert: (kmh) => kmh * KMH_TO_MPH,
  },
  gustMph: {
    layer: 'windGust',
    unit: 'wmoUnit:km_h-1',
    convert: (kmh) => kmh * KMH_TO_MPH,
  },
  windDeg: {
    layer: 'windDirection',
    unit: 'wmoUnit:degree_(angle)',
    convert: asIs,
  },
  cloudPct: { layer: 'skyCover', unit: 'wmoUnit:percent', convert: asIs },
  rainPct: {
    layer: 'probabilityOfPrecipitation',
    unit: 'wmoUnit:percent',
    convert: asIs,
  },
}

export function nwsUrl(office: string, gridX: number, gridY: number): string {
  return `https://api.weather.gov/gridpoints/${office}/${gridX},${gridY}`
}

/** Hours in an ISO 8601 duration made of days and hours, such as 'P2DT4H'. */
export function parseDurationHours(duration: string): number {
  const match = /^P(?:(\d+)D)?(?:T(\d+)H)?$/.exec(duration)
  const hours = match ? Number(match[1] ?? 0) * 24 + Number(match[2] ?? 0) : 0
  if (hours === 0) throw new Error(`NWS: unsupported duration ${duration}`)
  return hours
}

function emptyHour(t: number): ForecastHour {
  return {
    t,
    tempF: null,
    windMph: null,
    gustMph: null,
    windDeg: null,
    cloudPct: null,
    rainPct: null,
  }
}

export function parseGridpoint(json: unknown): Forecast {
  const properties = (
    json as { properties?: Record<string, unknown> } | null
  )?.properties
  if (!properties) throw new Error('NWS: response has no properties')

  const updatedAt = Date.parse(String(properties.updateTime))
  if (Number.isNaN(updatedAt)) {
    throw new Error('NWS: response has no updateTime')
  }

  const byHour = new Map<number, ForecastHour>()
  for (const field of Object.keys(LAYERS) as Field[]) {
    const spec = LAYERS[field]
    const layer = properties[spec.layer] as GridLayer | undefined
    if (!layer) continue
    if (layer.uom !== spec.unit) {
      throw new Error(
        `NWS: ${spec.layer} is in ${layer.uom}, expected ${spec.unit}`,
      )
    }
    for (const { validTime, value } of layer.values) {
      if (value === null) continue
      // validTime is a start and a duration: '2026-10-08T08:00:00+00:00/PT3H'
      const [startText, duration] = validTime.split('/')
      const start = Date.parse(startText)
      const span = parseDurationHours(duration)
      for (let i = 0; i < span; i++) {
        const t = start + i * HOUR
        let hour = byHour.get(t)
        if (!hour) {
          hour = emptyHour(t)
          byHour.set(t, hour)
        }
        hour[field] = spec.convert(value)
      }
    }
  }

  const hours = [...byHour.values()].sort((a, b) => a.t - b.t)
  return { updatedAt, hours }
}

export async function fetchForecast(
  office: string,
  gridX: number,
  gridY: number,
): Promise<Forecast> {
  const response = await fetch(nwsUrl(office, gridX, gridY), {
    headers: { Accept: 'application/geo+json' },
  })
  if (!response.ok) throw new Error(`NWS: HTTP ${response.status}`)
  return parseGridpoint(await response.json())
}

const COMPASS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
]

/** The 16-point compass name for a direction in degrees. */
export function compassPoint(degrees: number): string {
  const turn = ((degrees % 360) + 360) % 360
  return COMPASS[Math.round(turn / 22.5) % 16]
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx vitest run src/data/nws.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 6: Format, check, commit**

```bash
npm run format && npm run lint && npm run build && npm test
git add src/data/nws.ts src/data/nws.test.ts src/data/__fixtures__/nws-gridpoint-LOX-100-71.json
git commit -m "Add the NWS forecast from the raw grid endpoint" -m "Expands multi-hour intervals to hourly records and converts to °F and mph. Missing or null layers become null fields; an unexpected unit is an error." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: `src/data/astro.ts`

**Files:**
- Create: `src/data/astro.ts`
- Create: `src/data/__fixtures__/usno-campus-point.ts`
- Modify: `package.json`, `package-lock.json` (adds `astronomy-engine`)
- Test: `src/data/astro.test.ts`

**Interfaces:**
- Consumes: `Spot`, `CAMPUS_POINT` from `src/spot.ts`; `addDays`, `localDayStart` from `src/time.ts`.
- Produces:
  - `type PhaseName = 'New Moon' | 'Waxing Crescent' | 'First Quarter' | 'Waxing Gibbous' | 'Full Moon' | 'Waning Gibbous' | 'Last Quarter' | 'Waning Crescent'`
  - `interface DayAstro { date: string; sunset: number | null; moonrise: number | null; illumination: number; phase: PhaseName; moonriseNearSunset: number | null }`
    - `moonrise` is the moonrise inside that local day, if there is one.
    - `illumination` is the lit fraction, 0 to 1, at sunset.
    - `moonriseNearSunset` is the moonrise within 2 hours either side of sunset, if there is one.
  - `dayAstro(spot: Pick<Spot, 'lat' | 'lon' | 'timeZone'>, date: string): DayAstro`
  - `astroForDays(spot: Pick<Spot, 'lat' | 'lon' | 'timeZone'>, startDate: string, days: number): DayAstro[]`

- [ ] **Step 1: Install the library**

```bash
npm install astronomy-engine
```

Expected: `astronomy-engine` at `^2.1.19` in `dependencies`.

- [ ] **Step 2: Write the reference fixture**

`src/data/__fixtures__/usno-campus-point.ts`:

```ts
// Sunset and moonrise from the US Naval Observatory for Campus Point
// (latitude 34.4046, longitude -119.8440), recorded on 2026-10-08 from
// https://aa.usno.navy.mil/api/rstt/oneday. Local clock times, rounded to the
// minute by the Observatory. utcOffset is hours from UTC for those times.

export interface UsnoRow {
  date: string
  utcOffset: number
  sunset: string
  moonrise: string | null
}

export const USNO_CAMPUS_POINT: UsnoRow[] = [
  { date: '2026-10-08', utcOffset: -7, sunset: '18:34', moonrise: '05:00' },
  { date: '2026-10-09', utcOffset: -7, sunset: '18:32', moonrise: '06:03' },
  { date: '2026-10-10', utcOffset: -7, sunset: '18:31', moonrise: '07:05' },
  { date: '2026-10-11', utcOffset: -7, sunset: '18:30', moonrise: '08:08' },
  { date: '2026-10-12', utcOffset: -7, sunset: '18:28', moonrise: '09:10' },
  { date: '2026-10-13', utcOffset: -7, sunset: '18:27', moonrise: '10:12' },
  { date: '2026-10-14', utcOffset: -7, sunset: '18:26', moonrise: '11:12' },
  { date: '2026-10-15', utcOffset: -7, sunset: '18:25', moonrise: '12:08' },
  { date: '2026-10-16', utcOffset: -7, sunset: '18:23', moonrise: '12:58' },
  { date: '2026-10-17', utcOffset: -7, sunset: '18:22', moonrise: '13:42' },
  { date: '2026-10-18', utcOffset: -7, sunset: '18:21', moonrise: '14:20' },
  { date: '2026-10-19', utcOffset: -7, sunset: '18:20', moonrise: '14:54' },
  { date: '2026-10-20', utcOffset: -7, sunset: '18:19', moonrise: '15:23' },
  { date: '2026-10-21', utcOffset: -7, sunset: '18:17', moonrise: '15:51' },
  { date: '2026-10-22', utcOffset: -7, sunset: '18:16', moonrise: '16:17' },
  { date: '2026-10-23', utcOffset: -7, sunset: '18:15', moonrise: '16:44' },
  { date: '2026-10-24', utcOffset: -7, sunset: '18:14', moonrise: '17:13' },
  { date: '2026-10-25', utcOffset: -7, sunset: '18:13', moonrise: '17:45' },
  { date: '2026-10-26', utcOffset: -7, sunset: '18:12', moonrise: '18:23' },
  { date: '2026-10-27', utcOffset: -7, sunset: '18:11', moonrise: '19:09' },
  { date: '2026-10-28', utcOffset: -7, sunset: '18:10', moonrise: '20:04' },
  { date: '2026-10-29', utcOffset: -7, sunset: '18:09', moonrise: '21:08' },
  { date: '2026-10-30', utcOffset: -7, sunset: '18:08', moonrise: '22:18' },
  { date: '2026-10-31', utcOffset: -7, sunset: '18:07', moonrise: '23:30' },
  // The clocks go back at 2 AM on 1 November, so that day is 25 hours long
  // and these times are Pacific standard time.
  { date: '2026-11-01', utcOffset: -8, sunset: '17:06', moonrise: '23:40' },
  // No moonrise on this local day.
  { date: '2026-11-02', utcOffset: -8, sunset: '17:05', moonrise: null },
  { date: '2026-11-03', utcOffset: -8, sunset: '17:04', moonrise: '00:47' },
]
```

- [ ] **Step 3: Write the failing tests**

`src/data/astro.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { astroForDays, dayAstro } from './astro.ts'
import { USNO_CAMPUS_POINT } from './__fixtures__/usno-campus-point.ts'
import { CAMPUS_POINT } from '../spot.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
// The Observatory rounds to the minute, so a perfect answer can be 30 s away.
const TOLERANCE = 90_000

/** A Naval Observatory local clock time as a UTC instant. */
function usnoInstant(date: string, clock: string, utcOffset: number): number {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = clock.split(':').map(Number)
  return Date.UTC(year, month - 1, day, hour - utcOffset, minute)
}

describe('against the US Naval Observatory', () => {
  test.each(USNO_CAMPUS_POINT)(
    '$date: sunset and moonrise agree within 90 seconds',
    (row) => {
      const day = dayAstro(CAMPUS_POINT, row.date)

      const sunset = usnoInstant(row.date, row.sunset, row.utcOffset)
      expect(day.sunset).not.toBeNull()
      expect(Math.abs(day.sunset! - sunset)).toBeLessThanOrEqual(TOLERANCE)

      if (row.moonrise === null) {
        expect(day.moonrise).toBeNull()
      } else {
        const moonrise = usnoInstant(row.date, row.moonrise, row.utcOffset)
        expect(day.moonrise).not.toBeNull()
        expect(Math.abs(day.moonrise! - moonrise)).toBeLessThanOrEqual(TOLERANCE)
      }
    },
  )
})

describe('days that are not 24 hours, and days without a moonrise', () => {
  test('1 November 2026: the 11:40 PM moonrise is found in the 25-hour day', () => {
    const day = dayAstro(CAMPUS_POINT, '2026-11-01')
    // A search of only 24 hours from local midnight would stop at 11 PM.
    expect(day.moonrise).not.toBeNull()
  })

  test('2 November 2026 has no moonrise', () => {
    const day = dayAstro(CAMPUS_POINT, '2026-11-02')
    expect(day.moonrise).toBeNull()
    expect(day.sunset).not.toBeNull()
    expect(day.moonriseNearSunset).toBeNull()
  })
})

describe('moonrise near sunset', () => {
  test.each([
    '2026-10-23',
    '2026-10-24',
    '2026-10-25',
    '2026-10-26',
    '2026-10-27',
    '2026-10-28',
  ])('%s: flagged', (date) => {
    const day = dayAstro(CAMPUS_POINT, date)
    expect(day.moonriseNearSunset).not.toBeNull()
    expect(
      Math.abs(day.moonriseNearSunset! - day.sunset!),
    ).toBeLessThanOrEqual(2 * HOUR)
  })

  // 22 October is within about a minute of the 2-hour limit, so it is left out.
  test.each(['2026-10-20', '2026-10-21', '2026-10-29', '2026-10-30'])(
    '%s: not flagged',
    (date) => {
      expect(dayAstro(CAMPUS_POINT, date).moonriseNearSunset).toBeNull()
    },
  )

  test('the flagged moonrise can come after sunset', () => {
    // 26 October: sunset 6:12 PM, moonrise 6:23 PM.
    const day = dayAstro(CAMPUS_POINT, '2026-10-26')
    const minutesAfter = (day.moonriseNearSunset! - day.sunset!) / MINUTE
    expect(minutesAfter).toBeGreaterThan(10)
    expect(minutesAfter).toBeLessThan(13)
  })

  test("the flagged moonrise is the day's own moonrise", () => {
    const day = dayAstro(CAMPUS_POINT, '2026-10-25')
    expect(Math.abs(day.moonriseNearSunset! - day.moonrise!)).toBeLessThan(1000)
  })
})

describe('moon phase', () => {
  test.each([
    ['2026-10-08', 'Waning Crescent'],
    ['2026-10-10', 'New Moon'],
    ['2026-10-12', 'Waxing Crescent'],
    ['2026-10-18', 'First Quarter'],
    ['2026-10-21', 'Waxing Gibbous'],
    // Full moon is at 9:12 PM Pacific on the 25th, which is the 26th in UTC.
    ['2026-10-25', 'Full Moon'],
    ['2026-10-28', 'Waning Gibbous'],
    ['2026-11-01', 'Last Quarter'],
    ['2026-11-02', 'Waning Crescent'],
  ])('%s is %s', (date, phase) => {
    expect(dayAstro(CAMPUS_POINT, date).phase).toBe(phase)
  })

  test('illumination is a fraction between 0 and 1, evaluated at sunset', () => {
    expect(dayAstro(CAMPUS_POINT, '2026-10-10').illumination).toBeLessThan(0.01)
    expect(dayAstro(CAMPUS_POINT, '2026-10-25').illumination).toBeGreaterThan(
      0.99,
    )
    const oct8 = dayAstro(CAMPUS_POINT, '2026-10-08').illumination
    expect(oct8).toBeGreaterThan(0.02)
    expect(oct8).toBeLessThan(0.04)
  })
})

describe('astroForDays', () => {
  test('one entry per consecutive local date', () => {
    const days = astroForDays(CAMPUS_POINT, '2026-10-30', 4)
    expect(days.map((d) => d.date)).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ])
  })
})
```

- [ ] **Step 4: Run the tests and watch them fail**

Run: `npx vitest run src/data/astro.test.ts`
Expected: FAIL, because `./astro.ts` does not exist.

- [ ] **Step 5: Write the implementation**

`src/data/astro.ts`:

```ts
// Sunset, moonrise and moon phase, computed on the device. Times are for a
// flat sea-level horizon, which is what most weather sites show.

import {
  Body,
  Illumination,
  MoonPhase,
  Observer,
  SearchMoonQuarter,
  SearchRiseSet,
} from 'astronomy-engine'
import type { Spot } from '../spot.ts'
import { addDays, localDayStart } from '../time.ts'

export type PhaseName =
  | 'New Moon'
  | 'Waxing Crescent'
  | 'First Quarter'
  | 'Waxing Gibbous'
  | 'Full Moon'
  | 'Waning Gibbous'
  | 'Last Quarter'
  | 'Waning Crescent'

export interface DayAstro {
  /** Local calendar date, 'YYYY-MM-DD'. */
  date: string
  sunset: number | null
  /** The moonrise inside this local day, if there is one. */
  moonrise: number | null
  /** Lit fraction of the moon, 0 to 1, at sunset. */
  illumination: number
  phase: PhaseName
  /** The moonrise within 2 hours either side of sunset, if there is one. */
  moonriseNearSunset: number | null
}

type Place = Pick<Spot, 'lat' | 'lon' | 'timeZone'>

const HOUR = 3_600_000
const DAY = 24 * HOUR
const RISE = 1
const SET = -1
const QUARTERS: PhaseName[] = [
  'New Moon',
  'First Quarter',
  'Full Moon',
  'Last Quarter',
]

/** The first rise or set at or after `from`, within `spanMs`, or null. */
function riseOrSet(
  body: Body,
  observer: Observer,
  direction: number,
  from: number,
  spanMs: number,
): number | null {
  const found = SearchRiseSet(
    body,
    observer,
    direction,
    new Date(from),
    spanMs / DAY,
  )
  return found ? found.date.getTime() : null
}

function phaseName(dayStart: number, dayEnd: number, at: number): PhaseName {
  // A principal phase is named on the local day it happens.
  const next = SearchMoonQuarter(new Date(dayStart))
  if (next.time.date.getTime() < dayEnd) return QUARTERS[next.quarter]

  const angle = MoonPhase(new Date(at))
  if (angle < 90) return 'Waxing Crescent'
  if (angle < 180) return 'Waxing Gibbous'
  if (angle < 270) return 'Waning Gibbous'
  return 'Waning Crescent'
}

export function dayAstro(spot: Place, date: string): DayAstro {
  const observer = new Observer(spot.lat, spot.lon, 0)
  // The local day is 23 or 25 hours long when the clocks change.
  const start = localDayStart(date, spot.timeZone)
  const end = localDayStart(addDays(date, 1), spot.timeZone)

  const sunset = riseOrSet(Body.Sun, observer, SET, start, end - start)
  const moonrise = riseOrSet(Body.Moon, observer, RISE, start, end - start)
  const moonriseNearSunset =
    sunset === null
      ? null
      : riseOrSet(Body.Moon, observer, RISE, sunset - 2 * HOUR, 4 * HOUR)

  // Where there is no sunset (far north in summer), describe the moon at
  // local midday instead.
  const at = sunset ?? start + (end - start) / 2

  return {
    date,
    sunset,
    moonrise,
    illumination: Illumination(Body.Moon, new Date(at)).phase_fraction,
    phase: phaseName(start, end, at),
    moonriseNearSunset,
  }
}

export function astroForDays(
  spot: Place,
  startDate: string,
  days: number,
): DayAstro[] {
  return Array.from({ length: days }, (_, i) =>
    dayAstro(spot, addDays(startDate, i)),
  )
}
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `npx vitest run src/data/astro.test.ts`
Expected: PASS, 52 tests (27 Observatory rows, 2, 12, 10, 1).

These exact expectations were checked against `astronomy-engine` 2.1.19 on 2026-10-08: the largest difference from the Observatory was 29 seconds.

- [ ] **Step 7: Format, check, commit**

```bash
npm run format && npm run lint && npm run build && npm test
git add package.json package-lock.json src/data/astro.ts src/data/astro.test.ts src/data/__fixtures__/usno-campus-point.ts
git commit -m "Add sunset, moonrise, moon phase and the moonrise flag" -m "Computed with astronomy-engine and checked against US Naval Observatory times for 27 days, including the 25-hour day and a day with no moonrise." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: `src/data/cache.ts`, then open pull request 2

**Files:**
- Create: `src/data/cache.ts`
- Test: `src/data/cache.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Source = 'predictions' | 'hilo' | 'observed' | 'forecast'`
  - `interface Span { start: number; end: number }`
  - `interface CacheEntry<T> { fetchedAt: number; span: Span | null; data: T }` — `span` is the window the data was requested for; `null` for sources fetched without one
  - `readCache<T>(spotId: string, source: Source): CacheEntry<T> | null`
  - `writeCache<T>(spotId: string, source: Source, entry: CacheEntry<T>): void`
  - `isStale(source: Source, entry: CacheEntry<unknown> | null, now: number, needed: Span): boolean` — `needed` is the window the screen needs now

- [ ] **Step 1: Write the failing tests**

`src/data/cache.test.ts`:

```ts
import { afterEach, describe, expect, test, vi } from 'vitest'
import { isStale, readCache, writeCache } from './cache.ts'
import type { CacheEntry } from './cache.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const NOW = Date.UTC(2026, 9, 8, 17)
const WINDOW = { start: Date.UTC(2026, 9, 8, 7), end: Date.UTC(2026, 9, 22, 7) }

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

describe('readCache and writeCache', () => {
  test('what is written can be read back', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    const entry: CacheEntry<number[]> = {
      fetchedAt: NOW,
      span: WINDOW,
      data: [1, 2, 3],
    }
    writeCache('campus-point', 'predictions', entry)
    expect(readCache<number[]>('campus-point', 'predictions')).toEqual(entry)
  })

  test('sources and spots do not overwrite each other', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    writeCache('campus-point', 'forecast', { fetchedAt: NOW, span: null, data: 'a' })
    writeCache('campus-point', 'observed', { fetchedAt: NOW, span: null, data: 'b' })
    writeCache('elsewhere', 'forecast', { fetchedAt: NOW, span: null, data: 'c' })
    expect(readCache<string>('campus-point', 'forecast')?.data).toBe('a')
    expect(readCache<string>('campus-point', 'observed')?.data).toBe('b')
    expect(readCache<string>('elsewhere', 'forecast')?.data).toBe('c')
  })

  test('nothing saved reads as null', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    expect(readCache('campus-point', 'forecast')).toBeNull()
  })

  test('a corrupt entry reads as null', () => {
    vi.stubGlobal(
      'localStorage',
      fakeStorage({ 'tideline:v1:campus-point:forecast': '{not json' }),
    )
    expect(readCache('campus-point', 'forecast')).toBeNull()
  })

  test.each(['{"foo":1}', '{"fetchedAt":"yesterday","span":null,"data":1}', '5', 'null', '"text"'])(
    'an entry with the wrong shape reads as null: %s',
    (saved) => {
      vi.stubGlobal(
        'localStorage',
        fakeStorage({ 'tideline:v1:campus-point:forecast': saved }),
      )
      expect(readCache('campus-point', 'forecast')).toBeNull()
    },
  )

  test('with storage disabled, reading gives null and writing does nothing', () => {
    vi.stubGlobal('localStorage', brokenStorage())
    expect(readCache('campus-point', 'forecast')).toBeNull()
    expect(() =>
      writeCache('campus-point', 'forecast', {
        fetchedAt: NOW,
        span: null,
        data: 1,
      }),
    ).not.toThrow()
  })

  test('with no localStorage at all, reading gives null and writing does nothing', () => {
    // The test environment has no localStorage unless one is stubbed.
    expect(readCache('campus-point', 'forecast')).toBeNull()
    expect(() =>
      writeCache('campus-point', 'forecast', {
        fetchedAt: NOW,
        span: null,
        data: 1,
      }),
    ).not.toThrow()
  })
})

describe('isStale', () => {
  const at = (fetchedAt: number): CacheEntry<unknown> => ({
    fetchedAt,
    span: null,
    data: null,
  })

  test('nothing saved is always stale', () => {
    expect(isStale('forecast', null, NOW, WINDOW)).toBe(true)
    expect(isStale('predictions', null, NOW, WINDOW)).toBe(true)
  })

  test('the forecast is stale after an hour', () => {
    expect(isStale('forecast', at(NOW - 59 * MINUTE), NOW, WINDOW)).toBe(false)
    expect(isStale('forecast', at(NOW - 61 * MINUTE), NOW, WINDOW)).toBe(true)
  })

  test('the observed level is stale after six minutes', () => {
    expect(isStale('observed', at(NOW - 5 * MINUTE), NOW, WINDOW)).toBe(false)
    expect(isStale('observed', at(NOW - 7 * MINUTE), NOW, WINDOW)).toBe(true)
  })

  test.each(['predictions', 'hilo'] as const)(
    '%s stay fresh while they cover the window, however old',
    (source) => {
      const entry = { fetchedAt: NOW - 5 * DAY, span: WINDOW, data: null }
      expect(isStale(source, entry, NOW, WINDOW)).toBe(false)
    },
  )

  test.each(['predictions', 'hilo'] as const)(
    '%s are stale once the window moves past what was fetched',
    (source) => {
      const entry = { fetchedAt: NOW, span: WINDOW, data: null }
      const tomorrow = { start: WINDOW.start + DAY, end: WINDOW.end + DAY }
      expect(isStale(source, entry, NOW, tomorrow)).toBe(true)
    },
  )

  test('predictions saved without a span are stale', () => {
    expect(isStale('predictions', at(NOW), NOW, WINDOW)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run src/data/cache.test.ts`
Expected: FAIL, because `./cache.ts` does not exist.

- [ ] **Step 3: Write the implementation**

`src/data/cache.ts`:

```ts
// Saved data in the browser, so a repeat open can draw before any request
// returns. Every access is wrapped: with storage disabled the app still
// works, just without a cache.

export type Source = 'predictions' | 'hilo' | 'observed' | 'forecast'

export interface Span {
  start: number
  end: number
}

export interface CacheEntry<T> {
  /** When the data was fetched, UTC instant in epoch ms. */
  fetchedAt: number
  /** The window the data was requested for; null for sources without one. */
  span: Span | null
  data: T
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE

// Bump the version when the shape of any saved data changes, so old entries
// are ignored instead of misread.
function storageKey(spotId: string, source: Source): string {
  return `tideline:v1:${spotId}:${source}`
}

export function readCache<T>(
  spotId: string,
  source: Source,
): CacheEntry<T> | null {
  try {
    const text = localStorage.getItem(storageKey(spotId, source))
    if (text === null) return null
    const entry: unknown = JSON.parse(text)
    if (
      typeof entry !== 'object' ||
      entry === null ||
      !('fetchedAt' in entry) ||
      typeof entry.fetchedAt !== 'number' ||
      !('span' in entry) ||
      !('data' in entry)
    ) {
      return null
    }
    return entry as CacheEntry<T>
  } catch {
    // Storage is disabled, or the entry is not valid JSON.
    return null
  }
}

export function writeCache<T>(
  spotId: string,
  source: Source,
  entry: CacheEntry<T>,
): void {
  try {
    localStorage.setItem(storageKey(spotId, source), JSON.stringify(entry))
  } catch {
    // Storage is full or disabled. Carry on without a cache.
  }
}

/**
 * Whether a source needs fetching again. `needed` is the window of time the
 * screen needs right now.
 */
export function isStale(
  source: Source,
  entry: CacheEntry<unknown> | null,
  now: number,
  needed: Span,
): boolean {
  if (!entry) return true
  switch (source) {
    // Predictions for a date do not change, so they are good for as long as
    // they cover the window.
    case 'predictions':
    case 'hilo':
      return (
        !entry.span ||
        entry.span.start > needed.start ||
        entry.span.end < needed.end
      )
    case 'forecast':
      return now - entry.fetchedAt > HOUR
    case 'observed':
      return now - entry.fetchedAt > 6 * MINUTE
  }
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run src/data/cache.test.ts`
Expected: PASS, 19 tests.

- [ ] **Step 5: Format, check, commit**

```bash
npm run format && npm run lint && npm run build && npm test
git add src/data/cache.ts src/data/cache.test.ts
git commit -m "Add the on-device cache and its staleness rules" -m "Corrupt entries, old shapes and disabled storage all read as nothing saved." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected from `npm test`: every test in the repo passes, across 6 test files.

- [ ] **Step 6: Push and open the pull request**

```bash
git push -u origin stage-1/data
gh pr create --title "Stage 1 (2/4): time handling and the data layer" --body "$(cat <<'EOF'
Second of four pull requests for Stage 1. Spec: `docs/superpowers/specs/2026-10-08-stage-1-campus-point-design.md`.

No screen changes. This is everything below the screen, as plain TypeScript with no React:

- `src/time.ts`: local day boundaries and 12-hour formatting in the spot's zone
- `src/data/noaa.ts`: predicted curve, highs and lows, observed water level
- `src/data/nws.ts`: hourly forecast from the raw grid endpoint
- `src/data/astro.ts`: sunset, moonrise, moon phase, and the moonrise-near-sunset flag
- `src/data/cache.ts`: on-device cache and staleness rules

## What the tests pin down

- Sunset and moonrise within 90 seconds of the US Naval Observatory on 27 days
- The 25-hour and 23-hour clock-change days, and a day with no moonrise
- The morning of 8 October 2026, when the observed tide ran about 1.1 ft above the prediction
- NOAA returning an error body with HTTP 200, and NWS layers that are null or missing
- A corrupt cache entry, and a browser with storage disabled
- The whole suite runs with the device zone set to Tokyo

## Checking it

Run `npm test`. Pass: every test passes. The Vercel preview is unchanged from the previous pull request.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr checks --watch
```

Expected: the `check` job passes. Report the pull request URL to the owner and wait for review. Do not merge.

---

## After this plan

Pull requests 3 and 4 build the screen on these modules: the loading hook, the tonight strip, the panels with their shared cursor, the high/low table, the day list, failure states, and the manifest and icons. They get their own plan, written against the merged data layer.

### What changed after this plan was executed

An independent review of the finished branch led to four changes, so the code blocks above for `nws.ts`, `astro.ts`, `cache.ts` and `formatTime` are not the final code. The repository is.

- `parseGridpoint` skips a layer that arrives empty and an entry with no value.
- `dayAstro` rounds sunset and moonrise to the nearest minute, and the flagged moonrise reuses the day's own moonrise.
- `readCache` takes a third argument, the caller's check for its data, and validates the span.
- `formatTime` is assembled from parts and no longer contains an invisible character.

### Carried into the screen plan

Found during execution and review. None is handled yet.

- `time.ts` has no date or weekday formatter, and it is the only module allowed to know zones. The day list needs one.
- The loading hook must supply `readCache` with a check for each source's data shape.
- The hook should not save an empty prediction result: with a covering span it would look fresh until the next day.
- Nothing refreshes while the page stays open and visible. The spec only checks staleness on open and on becoming visible.
- The fetch functions take no `AbortSignal` and have no timeout, so a hung request on a weak connection cannot be cancelled.
- A forecast hour can be partly filled. On the last day inside the horizon the sunset-hour record had no temperature but did have wind, cloud and rain, so every readout must render a missing field.
- The forecast grid's first hour is partway through the day it was issued, so today's weather panels start partway across.
- Split points into days with `localDayStart` boundaries, not by calling `localDate` on every point.
- The predicted curve for a day ends at 11:54 PM, six minutes short of the right edge of the axis.
- NOAA's quality flags on observed readings are ignored. The spec asks only for a "preliminary" caption.
- `vite.config.ts` includes only `*.test.ts`. A `*.test.tsx` file would be skipped without any warning.
- The plan and its execution came from one session, and every review finding traced back to the plan's own code. Before executing the next plan, have its code blocks reviewed, and check that each test for a named failure mode fails when its guard is removed.
