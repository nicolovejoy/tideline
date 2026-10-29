# Forecast history, part 1: the recorder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An hourly job that saves, for every recorded place, each NWS forecast as issued and the station's observed hours, into a public, client-read-only part of Firestore.

**Architecture:** The arithmetic and the run's logic are plain, framework-free modules under `src/data/` with Vitest tests and injected stores and fetchers. A thin Node entry under `recorder/` (its own package, like `rules-tests/`) wires them to `firebase-admin` and real `fetch`, and a scheduled GitHub Actions workflow runs it with Node 24's TypeScript type stripping. The screens that read the record are part 2, a later plan, once data has built up.

**Tech Stack:** TypeScript (strict, erasable syntax only), Vitest, `firebase-admin` (recorder only), Firestore rules tested in the emulator, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-29-forecast-history-design.md`

## Global Constraints

- Code style is the Vite template's: no semicolons, single quotes, relative imports carry their `.ts` extension, `import type` for type-only imports, no enums.
- Tests run with `TZ=Asia/Tokyo`; never derive a day from a UTC string. Days are the spot's own zone via `localDate`/`localDayStart` in `src/time.ts`.
- A station serves a spot by `chooseStation` in `src/data/weatherRule.ts` with the height `spot.elevationFt ?? spot.nws.elevationFt` (as `stationSpec` in `src/data/useSpotData.ts`).
- Nothing under `history/**` names a uid, a spot name or a spot's coordinates.
- Clients may read `history/**`; no client may write it.
- Never read the service-account key into the session. It lives in 1Password and reaches GitHub only by `op read … | gh secret set …`.
- Root `npm test` must not need the emulator or `firebase-admin`.

## Review Focus

1. A run where NWS fails for one place (HTTP 500, timeout) must still record every other place; the run exits non-zero only when every place failed.
2. An issuance seen on a second run (NWS has not updated) must not be written again.
3. The hour in progress, and any hour after `now`, must never be written as observed; a past day's document is rewritten whole each run, so a late report fills it in.
4. A spot whose `elevationFt` is null falls back to the cell's height, and a spot with no serving station yields no place.
5. Two spots (in different accounts) in the same cell with the same station make one place, and a place not needed for 30 days is no longer fetched but its documents stay.

---

### Task 1: The record's shapes and pure arithmetic

**Files:**
- Create: `src/data/history.ts`
- Test: `src/data/history.test.ts`

**Interfaces:**
- Consumes: `Forecast`, `ForecastHour` (`src/data/nws.ts`), `ObservedHour` (`src/data/observed.ts`), `Spot` (`src/spot.ts`), `WeatherStation`, `chooseStation` (`src/data/weatherRule.ts`), `HOUR`, `DAY`, `localDate` (`src/time.ts`).
- Produces:
  - `interface PlaceKey { office: string; gridX: number; gridY: number; stationId: string }`
  - `interface Place extends PlaceKey { stationName: string; timeZone: string }`
  - `interface PlaceDoc extends Place { firstWrite: number; lastWrite: number; lastIssued: number | null; lastNeeded: number }`
  - `interface IssuedDoc { issuedAt: number; hours: ForecastHour[] }`
  - `interface ObservedDoc { date: string; hours: ObservedHour[] }`
  - `const KEEP_UNNEEDED = 30 * DAY`
  - `placeId(key: PlaceKey): string` → `` `${office}-${gridX}-${gridY}-${stationId}` ``
  - `placeOf(spot: Spot, stations: WeatherStation[]): Place | null`
  - `uniquePlaces(places: Place[]): Place[]` (by `placeId`, first wins)
  - `trimIssued(forecast: Forecast): IssuedDoc` — hours with `t >= forecast.updatedAt - HOUR` only (the grid starts ~6½ h before issue; those hours are not a forecast)
  - `endedHours(hours: ObservedHour[], now: number): ObservedHour[]` — rows with `t + HOUR <= now`
  - `stillRecorded(doc: PlaceDoc, now: number): boolean` → `now - doc.lastNeeded <= KEEP_UNNEEDED`

- [ ] **Step 1: Write the failing tests** in `src/data/history.test.ts`:
  - `placeId` of `{office:'LOX',gridX:100,gridY:71,stationId:'KSBA'}` is `'LOX-100-71-KSBA'`.
  - `placeOf(CAMPUS_POINT, [KSBA at 34.43,-119.84, 10 ft])` returns `{office:'LOX',gridX:100,gridY:71,stationId:'KSBA',stationName:…,timeZone:'America/Los_Angeles'}`; with a station 20 mi away returns `null`; with `elevationFt: null` and a cell height of 3 ft, a station at 10 ft still serves.
  - `uniquePlaces` of two equal-key places returns one.
  - `trimIssued` drops an hour 2 h before `updatedAt`, keeps one 30 min before and all after; `issuedAt` equals `updatedAt`.
  - `endedHours` at `now = 10:30` keeps 9:00, drops 10:00 and 11:00.
  - `stillRecorded` true at 30 days since `lastNeeded`, false at 30 days + 1 ms.
- [ ] **Step 2: Run** `npx vitest run src/data/history.test.ts` — expect FAIL (module not found).
- [ ] **Step 3: Implement** the interfaces above in `src/data/history.ts`, with a header comment in the house style (what it is, that it is framework-free).
- [ ] **Step 4: Run** the same command — expect PASS; then `npm run lint`.
- [ ] **Step 5: Commit** `src/data/history.ts src/data/history.test.ts`.

### Task 2: Rules for the record

**Files:**
- Modify: `firestore.rules`
- Test: `rules-tests/history.rules.test.ts` (new, same setup as `rules-tests/spots.rules.test.ts`)

**Interfaces:** Produces the rule `match /history/{document=**} { allow read: if true; allow write: if false; }` inside `match /databases/{database}/documents`.

- [ ] **Step 1: Write failing tests:** with rules disabled seed `history/LOX-100-71-KSBA` and `history/LOX-100-71-KSBA/issued/1`; then `an unauthenticated reader can read a place and an issuance` (`assertSucceeds(getDoc)` ×2), `a signed-in user cannot write a place` (`assertFails(setDoc)`), `a signed-out user cannot write an issuance` (`assertFails`), and `the users rule is unchanged` (alice still reads her own `users/alice`, bob still cannot).
- [ ] **Step 2: Run** `cd rules-tests && npm test` — expect the read tests to FAIL.
- [ ] **Step 3: Add** the rule.
- [ ] **Step 4: Run** `cd rules-tests && npm test` — expect all PASS (8 existing + new).
- [ ] **Step 5: Commit** `firestore.rules rules-tests/history.rules.test.ts`. The PR body must say the owner pastes `firestore.rules` into the console and Publishes before merging.

### Task 3: One run of the recorder, with injected store and fetchers

**Files:**
- Create: `src/data/recorder.ts`
- Test: `src/data/recorder.test.ts`

**Interfaces:**
- Consumes: Task 1's exports; `isSpot` (`src/data/savedSpots.ts`, pure); `toList` (`src/data/accountDoc.ts`); `observedHours` (`src/data/observed.ts`); `SPOTS` (`src/spot.ts`); `Report` (`src/data/nwsObservations.ts`); `localDayStart`, `addDays` (`src/time.ts`).
- Produces:
  ```ts
  interface RecorderStore {
    accountDocs(): Promise<unknown[]>          // every users/{uid} document's data
    places(): Promise<PlaceDoc[]>
    writePlace(id: string, doc: PlaceDoc): Promise<void>
    writeIssued(id: string, doc: IssuedDoc): Promise<void>
    writeObserved(id: string, doc: ObservedDoc): Promise<void>
  }
  interface RecorderFetch {
    stations(office: string, gridX: number, gridY: number): Promise<WeatherStation[]>
    forecast(office: string, gridX: number, gridY: number): Promise<Forecast>
    observations(stationId: string, start: number): Promise<Report[]>
  }
  interface RunResult { recorded: string[]; failed: { id: string; error: string }[] }
  function recordOnce(store: RecorderStore, net: RecorderFetch, now: number): Promise<RunResult>
  ```

Behaviour of `recordOnce`, in order:
1. Spots = `SPOTS` plus every spot from `toList` of each account document (non-lists ignored). For each distinct cell, fetch stations once; places = `uniquePlaces(spots.map(placeOf))`. A cell whose station list fails is reported in `failed` under the cell and skipped.
2. Places to record = needed now (their `lastNeeded` becomes `now`) ∪ stored places with `stillRecorded`.
3. Per place, independently (one failure does not stop the others): fetch the forecast; if `updatedAt !== lastIssued`, `writeIssued(id, trimIssued(f))`. Fetch observations from the start of yesterday in the place's zone; for yesterday and today write `{ date, hours: endedHours(observedHours(reports, span, now), now) }` when it has rows. Then `writePlace` with `firstWrite` kept (or `now` if new), `lastWrite = now`, `lastIssued` updated.

- [ ] **Step 1: Write failing tests** with an in-memory fake store and fake fetch (fixtures may reuse `src/data/__fixtures__/` recorded responses through the parsers):
  - `records Campus Point's place from the starting spots alone` → `recorded` is `['LOX-100-71-KSBA']`, one issued, observed written for today.
  - `the same issuance is not written twice` → two runs with the same `updatedAt`, one `writeIssued`.
  - `a place in two accounts is recorded once`.
  - `a forecast failure for one place leaves the others recorded` → `failed` has that id, others in `recorded`.
  - `the hour in progress is not written` → at 10:30 today's doc has no 10:00 row.
  - `a place not needed for 31 days is not fetched; at 29 days it is`, and its stored doc is not deleted.
  - `an account document that is not a list is ignored`.
- [ ] **Step 2: Run** `npx vitest run src/data/recorder.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** `recordOnce` in `src/data/recorder.ts`; no `firebase` import, no DOM.
- [ ] **Step 4: Run** the tests — PASS; `npm test`, `npm run lint`, `npm run build` — all pass.
- [ ] **Step 5: Commit**.

### Task 4: The Node entry and the scheduled workflow

**Files:**
- Create: `recorder/package.json` (`"type": "module"`, dependency `firebase-admin`, script `"record": "node main.ts"`), `recorder/package-lock.json`, `recorder/main.ts`, `.github/workflows/record.yml`
- Modify: `.gitignore` if needed for `recorder/node_modules`; `tsconfig.node.json` only if `recorder/` must be type-checked (designer's call: add it so `npm run build` checks it, with `firebase-admin` types resolved from `recorder/node_modules` — if that fails, check it with `npx tsc --noEmit -p recorder` in the workflow instead).

**Interfaces:** Consumes `recordOnce`, `RecorderStore`, `RecorderFetch` (Task 3); `fetchStations`, `fetchForecast`, `fetchObservations`.

`main.ts`:
- Reads the key from env `FIREBASE_SERVICE_ACCOUNT` (JSON), `initializeApp({ credential: cert(JSON.parse(…)) })`, project `tideline-ibuild4you`.
- Wraps `globalThis.fetch` so every request carries `User-Agent: tideline (https://tideline.ibuild4you.com)`.
- Implements `RecorderStore` on `firebase-admin/firestore`: `accountDocs` = all docs of `users`; `places` = all docs of `history`; writes are `set` to `history/{id}`, `history/{id}/issued/{issuedAt}`, `history/{id}/observed/{date}`.
- Prints one line per recorded place and per failure (ids only, nothing from users' documents), exits 1 only when `recorded` is empty and `failed` is not.

`record.yml`: `on: schedule: - cron: '17 * * * *'` and `workflow_dispatch`; Node from `.nvmrc`; `npm ci` in `recorder/`; `npm run record` with `FIREBASE_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}`; `concurrency: record` so runs never overlap; `timeout-minutes: 10`.

- [ ] **Step 1:** Write `recorder/main.ts`, `recorder/package.json`, install, commit the lock file.
- [ ] **Step 2:** Locally, without a key: `cd recorder && node main.ts` — expect it to exit 1 with "FIREBASE_SERVICE_ACCOUNT is not set" and nothing else (no key is ever used locally by the agent).
- [ ] **Step 3:** Write `.github/workflows/record.yml`; check that `ci.yml` still passes (`npm test`, `npm run lint`, `npm run build`).
- [ ] **Step 4: Commit**, push, open the PR with the owner's steps below in its body.

### Task 5: The owner's steps, after review and before the first run

Written into the PR body for the owner, not done by the agent:

1. Firebase console, Project settings, Service accounts, Generate new private key. Save it in 1Password as a document item named `tideline recorder service account` (do not open it).
2. In a terminal, put it into the repo's secret without showing it (the agent gives the exact one-line `op read "op://…" | gh secret set FIREBASE_SERVICE_ACCOUNT --repo nicolovejoy/tideline` with the item's real path).
3. Paste `firestore.rules` into https://console.firebase.google.com/project/tideline-ibuild4you/firestore/rules and Publish.
4. Merge; then run the workflow once by hand: https://github.com/nicolovejoy/tideline/actions/workflows/record.yml, Run workflow. Pass: green, a log line `recorded LOX-100-71-KSBA`, and in https://console.firebase.google.com/project/tideline-ibuild4you/firestore/data a `history` collection with that document, an `issued` and an `observed` subcollection.
5. An hour later: a second scheduled run is green, and `observed` has today's new hour.

Then CLAUDE.md's Status and Next Steps get the recorder, and part 2 (the screens) is planned once a week or more of record exists.
