# Pinch and pan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two fingers on the panels zoom and pan the time window, with a trackpad and keyboard equivalent, inside the 14 days, from 3 hours to 7 days.

**Architecture:** The arithmetic is a new plain module `src/chart/zoom.ts`. A zoomed window is a `Span` held in `SpotScreen` state; `selectedDay` turns it into a `DayWindow`, so every view that already reads `selected.window` follows it. `PanelStack` turns pointer, wheel, Safari gesture and key events into a new window through `onWindow`.

**Tech Stack:** React 19, strict TypeScript, Vitest, hand-written SVG. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-29-pinch-and-pan-design.md`

## Global Constraints

- Code style: no semicolons, single quotes, relative imports carry `.ts`/`.tsx`, `import type` for type-only imports, no enums. Comments in the house register: full sentences, plain words, saying why.
- Components hold no arithmetic, no rules and no wording; those go in plain tested modules.
- Tests run with `TZ=Asia/Tokyo`; never lean on the viewer's zone. Times in the spot's zone via `src/time.ts`.
- Limits: `MIN_WINDOW = 3 * HOUR`, `MAX_WINDOW = 7 * DAY`; bounds are the 14 days, `{ start: spans[0].start, end: spans[spans.length - 1].end }`.
- Verification for every task: `npm test`, `npm run lint`, `npm run build` all pass.
- Commit messages: one plain sentence saying what changed, in the repo's style (see `git log --oneline -10`), ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A pinch that begins while one finger is dragging the cursor: the cursor goes back where it was (the existing `abandon`), then the pinch runs. Covered in Task 3's tests.
2. Fingers that come together or cross: no division by a tiny or negative distance; it pans by the midpoint instead. Task 1.
3. A window at either end of the 14 days, or the 14 days shorter than a week near the end: never outside the bounds, never longer than the bounds. Task 1.
4. A zoomed window that crosses midnight but is under a day: the sunset and moonrise lines keep their names, the cursor's words carry the weekday. Task 2.
5. A day that is 23 or 25 hours long (clock change): a plain Day window keeps its four labels and its marker names. Task 2.

---

### Task 1: The window arithmetic

**Files:**
- Create: `src/chart/zoom.ts`
- Test: `src/chart/zoom.test.ts`

**Interfaces:**
- Consumes: `Span` from `src/data/cache.ts` (`{ start: number; end: number }`), `HOUR`, `DAY` from `src/time.ts`, `SLOP` from `src/chart/gesture.ts`.
- Produces:
  - `MIN_WINDOW: number`, `MAX_WINDOW: number`
  - `held(window: Span, bounds: Span, about: number): Span`: the length clamped to `[MIN_WINDOW, min(MAX_WINDOW, bounds length)]`, keeping `about` at the same fraction of the window, then shifted (length kept) to lie inside `bounds`.
  - `zoomAbout(window: Span, about: number, factor: number, bounds: Span): Span`: the length divided by `factor` (above 1 zooms in), `about` kept at its fraction, then `held`.
  - `panBy(window: Span, dt: number, bounds: Span): Span`: shifted by `dt`, length kept, held inside `bounds`.
  - `pinchWindow(begun: Span, width: number, from: [number, number], to: [number, number], bounds: Span): Span`: `from` and `to` are the two fingers' x in pixels from the stack's left, at the pinch's start and now. The instants under `from` on `begun`'s scale are put under `to`. Where either pair is less than `SLOP` apart or the fingers have crossed (the sign of `to[1] - to[0]` differs from `from[1] - from[0]`), it pans by the midpoints' difference instead. The result is `held` about the instant under `to`'s midpoint.

- [ ] **Step 1: Write the failing tests** in `src/chart/zoom.test.ts`, with `const T0 = Date.UTC(2026, 9, 29, 7)` and `const BOUNDS = { start: T0, end: T0 + 14 * DAY }`, `const DAY1 = { start: T0, end: T0 + DAY }`:

```ts
test('zooming in by 2 about noon halves the day about noon', () => {
  expect(zoomAbout(DAY1, T0 + 12 * HOUR, 2, BOUNDS)).toEqual({ start: T0 + 6 * HOUR, end: T0 + 18 * HOUR })
})
test('the instant zoomed about keeps its place in the window', () => {
  expect(zoomAbout(DAY1, T0 + 6 * HOUR, 2, BOUNDS)).toEqual({ start: T0 + 3 * HOUR, end: T0 + 15 * HOUR })
})
test('no shorter than 3 hours', () => {
  expect(zoomAbout(DAY1, T0 + 12 * HOUR, 100, BOUNDS)).toEqual({ start: T0 + 10.5 * HOUR, end: T0 + 13.5 * HOUR })
})
test('no longer than a week', () => {
  const week = { start: T0, end: T0 + 7 * DAY }
  expect(zoomAbout(week, T0, 0.5, BOUNDS)).toEqual(week)
})
test('zooming out at the start of the 14 days stays inside them', () => {
  expect(zoomAbout(DAY1, T0, 0.5, BOUNDS)).toEqual({ start: T0, end: T0 + 2 * DAY })
})
test('never longer than the bounds', () => {
  const short = { start: T0, end: T0 + 2 * DAY }
  expect(zoomAbout(DAY1, T0, 0.1, short)).toEqual(short)
})
test('panning back a day', () => {
  expect(panBy({ start: T0 + 2 * DAY, end: T0 + 3 * DAY }, -DAY, BOUNDS)).toEqual({ start: T0 + DAY, end: T0 + 2 * DAY })
})
test('panning stops at either end', () => {
  expect(panBy(DAY1, -DAY, BOUNDS)).toEqual(DAY1)
  const last = { start: T0 + 13 * DAY, end: T0 + 14 * DAY }
  expect(panBy(last, DAY, BOUNDS)).toEqual(last)
})
// 240 px for a day: 10 px an hour.
test('spreading two fingers puts the hours under them under them still', () => {
  expect(pinchWindow(DAY1, 240, [60, 120], [0, 240], BOUNDS)).toEqual({ start: T0 + 6 * HOUR, end: T0 + 12 * HOUR })
})
test('moving both fingers sideways pans', () => {
  const day2 = { start: T0 + DAY, end: T0 + 2 * DAY }
  expect(pinchWindow(day2, 240, [60, 120], [80, 140], BOUNDS)).toEqual({ start: T0 + DAY - 2 * HOUR, end: T0 + 2 * DAY - 2 * HOUR })
})
test('fingers that come together only pan, by their midpoint', () => {
  const day2 = { start: T0 + DAY, end: T0 + 2 * DAY }
  // From a midpoint of 90 px to 101 px: 1.1 hours earlier.
  expect(pinchWindow(day2, 240, [60, 120], [100, 102], BOUNDS)).toEqual({ start: T0 + DAY - 1.1 * HOUR, end: T0 + 2 * DAY - 1.1 * HOUR })
})
test('fingers that cross only pan', () => {
  const day2 = { start: T0 + DAY, end: T0 + 2 * DAY }
  expect(pinchWindow(day2, 240, [60, 120], [130, 70], BOUNDS)).toEqual({ start: T0 + DAY - 1 * HOUR, end: T0 + 2 * DAY - 1 * HOUR })
})
```

(Floating-point: where an expectation is not exact, compare with `toBeCloseTo` per field rather than change the values.)

- [ ] **Step 2:** `npx vitest run src/chart/zoom.test.ts` fails (module missing).
- [ ] **Step 3:** Implement `src/chart/zoom.ts` with the four functions and two constants above. A header comment in the style of `src/chart/gesture.ts`.
- [ ] **Step 4:** `npx vitest run src/chart/zoom.test.ts` passes; `npm run lint` passes.
- [ ] **Step 5:** Commit.

---

### Task 2: A window of any length

**Files:**
- Modify: `src/ui/spanView.ts`, `src/ui/selection.ts`
- Test: `src/ui/spanView.test.ts`, `src/ui/selection.test.ts`
- Modify (callers only): `src/ui/SpotScreen.tsx` (the `stackLabels` call loses its third argument)

**Interfaces:**
- Consumes: `Span` from `src/data/cache.ts`, `DAY`, `HOUR`, `hourMarks` from `src/time.ts`.
- Produces:
  - `zoomWindow(spans: Span[], zoom: Span): DayWindow` in `spanView.ts`: `start`/`end` are the zoom's; `first` is the index of the day containing `zoom.start`, `last` the index of the day containing `zoom.end - 1`.
  - `stackLabels(window: DayWindow, timeZone: string): StackLabel[]`, the `choice` parameter removed. The step by window length (`end - start`): up to 6 h every 1 h, up to 12 h every 3, up to 36 h every 6, up to 4 days every 12, beyond every 24. A mark's text is its hour as `12a`, `3a`, `6a`, `9p` (`h % 12 || 12` then `a` or `p`); a midnight's text is its weekday (`formatWeekday`) where `last > first`. The window's end is labelled only where `last === first`.
  - `windowMarkers(days, window, now)`: names dropped only where `last > first` and the window is longer than `DAY`.
  - `selectedDay(data, picked, choice = 'day', zoom: Span | null = null)` in `selection.ts`: `window` is `zoomWindow(data.spans, zoom)` when `zoom` is not null, else `windowFor(...)` as now. Nothing else in `Selected` changes.

- [ ] **Step 1: Write the failing tests.** The existing `stackLabels` tests keep their expectations with the third argument dropped (a day: `12a 6a 12p 6p 12a`, both midnights; three days: weekday at each midnight and `12p` at noon, end unlabelled; a week: weekdays; three days or a week from the last day: a day's labels). Add, using the file's `spans`/`days`/`ZONE`:

```ts
test('a zoom of 5 hours has a label every hour, both ends where on the hour', () => {
  const w = zoomWindow(spans, { start: spans[3].start + 13 * HOUR, end: spans[3].start + 18 * HOUR })
  expect(stackLabels(w, ZONE).map((l) => l.text)).toEqual(['1p', '2p', '3p', '4p', '5p', '6p'])
})
test('a zoom of 10 hours has a label every 3 hours', () => {
  const w = zoomWindow(spans, { start: spans[3].start + 8 * HOUR, end: spans[3].start + 18 * HOUR })
  expect(stackLabels(w, ZONE).map((l) => l.text)).toEqual(['9a', '12p', '3p', '6p'])
})
test('a zoom across midnight names the midnight by its weekday and leaves the end unlabelled', () => {
  const w = zoomWindow(spans, { start: spans[3].start + 18 * HOUR, end: spans[4].start + 6 * HOUR })
  expect([w.first, w.last]).toEqual([3, 4])
  expect(stackLabels(w, ZONE).map((l) => l.text)).toEqual(['6p', '9p', 'Mon', '3a'])
})
test('zoomWindow: a zoom ending at midnight ends on the day before', () => {
  const w = zoomWindow(spans, { start: spans[3].start + 12 * HOUR, end: spans[4].start })
  expect([w.first, w.last]).toEqual([3, 3])
})
test('a zoom across midnight under a day keeps the marker names', () => {
  const w = zoomWindow(spans, { start: spans[3].start + 12 * HOUR, end: spans[4].start + 6 * HOUR })
  expect(windowMarkers(days, w, frame.now).some((m) => m.label !== undefined)).toBe(true)
})
test('a zoom of two days drops the marker names', () => {
  const w = zoomWindow(spans, { start: spans[3].start, end: spans[5].start })
  expect(windowMarkers(days, w, frame.now).every((m) => m.label === undefined)).toBe(true)
})
```

(The weekday for `spans[4]` is whatever `formatWeekday` gives for that day in the fixture, 8 October 2026 being a Thursday, so `spans[4]` is Monday 12 October; check against the fixture and correct the literal if the file's frame differs. `frame.now` may be named differently in the fixture; use what the file uses for `now`.) In `selection.test.ts`: `selectedDay(data, picked, 'day', zoom)` has `window` equal to `zoomWindow(data.spans, zoom)` and the same `index`, `date` and `isToday` as without the zoom. Add one clock-change case if `selection.test.ts` or `spanView.test.ts` already has a frame across a change (search for `11-01` or `03-08`); if not, add `frameFor(CAMPUS_POINT, '2026-10-31')` and assert the Day window for 1 November (25 hours) has labels `12a 6a 12p 6p 12a` and that its sunset marker keeps its name.

- [ ] **Step 2:** The new tests fail.
- [ ] **Step 3:** Implement. Update `SpotScreen.tsx`'s `stackLabels` call only.
- [ ] **Step 4:** `npm test`, `npm run lint`, `npm run build` pass.
- [ ] **Step 5:** Commit.

---

### Task 3: Two fingers, a trackpad and the keys on the stack

**Files:**
- Modify: `src/chart/gesture.ts`, `src/chart/PanelStack.tsx`, `src/styles.css` (`.stack`)
- Test: `src/chart/gesture.test.ts`

**Interfaces:**
- Consumes: Task 1's `pinchWindow`, `zoomAbout`, `panBy`; `Span`.
- Produces:
  - In `gesture.ts`: `interface Pinch { ids: [number, number]; from: [number, number]; to: [number, number]; window: Span }`, `pinchBegin(a: Pointer, b: Pointer, window: Span): Pinch` (`from` and `to` both the two x's, in the order of `ids`), `pinchMove(pinch: Pinch, at: Pointer): Pinch` (updates the matching id's `to`, returns the same object for any other id), `pinchEnds(pinch: Pinch, id: number): boolean`.
  - `PanelStack` gains props `bounds: Span` and `onWindow: (window: Span) => void`.

Behaviour in `PanelStack` (component code, checked in a browser, not unit-tested):
- It keeps a map of the touch pointers that are down, with their current x relative to the stack's left (`clientX - rect.left`). A second touch pointer going down applies `pressDown` as now (which abandons the one-finger press and restores the cursor), then begins a pinch from the two pointers with the window as it is (`{ start, end }`). Pointer capture is set for both.
- While a pinch is on, each move of either of its pointers calls `onWindow(pinchWindow(pinch.window, width, pinch.from, pinch.to, bounds))`. The cursor is not moved.
- When either pinch pointer lifts or is cancelled, the pinch ends; the other finger does nothing until it lifts.
- A native `wheel` listener on the stack (added in an effect with `{ passive: false }`, since React's is passive): with `ctrlKey` (a trackpad pinch in Chrome, Edge and Firefox), `preventDefault` and `onWindow(zoomAbout(window, instantUnderPointer, Math.exp(-event.deltaY * 0.01), bounds))`; without `ctrlKey` and with `|deltaX| > |deltaY|`, `preventDefault` and `onWindow(panBy(window, deltaX / width * (end - start), bounds))`; otherwise nothing, so the page scrolls. `deltaMode` other than pixels: multiply by 16 for lines.
- Safari's `gesturestart` and `gesturechange` (native listeners, `preventDefault` on both; the events are not in TypeScript's DOM types, so type the event locally as `Event & { scale: number; clientX: number }`): at the start remember the window and the instant under `clientX`; on each change `onWindow(zoomAbout(remembered, instant, event.scale, bounds))`.
- Keys: `+` and `=` call `onWindow(zoomAbout(window, cursor, 2, bounds))`, `-` with factor `0.5`, each with `preventDefault`.
- The effects read the current window, width and `onWindow` through refs so the listeners are added once.
- `.stack` in `src/styles.css`: `touch-action: pan-y;`, with its comment rewritten to say the stack takes a pinch, and the browser still scrolls the page for an up-and-down drag.

- [ ] **Step 1: Write the failing tests** in `gesture.test.ts`:

```ts
test('a pinch begins from the two fingers, in order', () => {
  const p = pinchBegin({ id: 1, x: 60, y: 0 }, { id: 2, x: 120, y: 5 }, { start: 0, end: 10 })
  expect(p).toEqual({ ids: [1, 2], from: [60, 120], to: [60, 120], window: { start: 0, end: 10 } })
})
test('moving one finger of a pinch moves its end only', () => {
  const p = pinchBegin({ id: 1, x: 60, y: 0 }, { id: 2, x: 120, y: 0 }, { start: 0, end: 10 })
  expect(pinchMove(p, { id: 2, x: 200, y: 0 }).to).toEqual([60, 200])
  expect(pinchMove(p, { id: 1, x: 10, y: 0 }).to).toEqual([10, 120])
})
test('a pointer not in the pinch changes nothing', () => {
  const p = pinchBegin({ id: 1, x: 60, y: 0 }, { id: 2, x: 120, y: 0 }, { start: 0, end: 10 })
  expect(pinchMove(p, { id: 3, x: 0, y: 0 })).toBe(p)
})
test('a pinch ends when either of its fingers lifts', () => {
  const p = pinchBegin({ id: 1, x: 60, y: 0 }, { id: 2, x: 120, y: 0 }, { start: 0, end: 10 })
  expect([pinchEnds(p, 1), pinchEnds(p, 2), pinchEnds(p, 3)]).toEqual([true, true, false])
})
```

The existing test that a second finger restores a dragging press stays as it is.

- [ ] **Step 2:** The new tests fail.
- [ ] **Step 3:** Implement the three functions, then `PanelStack` and the CSS. Update the `PanelStack` doc comment to name the pinch, the trackpad and the keys.
- [ ] **Step 4:** `npm test`, `npm run lint`, `npm run build` pass. (`SpotScreen` will not compile until it passes the two new props; give them in this task as `bounds={{ start: spans[0].start, end: spans[spans.length - 1].end }}` and `onWindow={() => {}}`, which Task 4 replaces.)
- [ ] **Step 5:** Commit.

---

### Task 4: The zoom on the screen

**Files:**
- Modify: `src/ui/SpotScreen.tsx`, `src/ui/SpanControl.tsx`, `src/ui/helpText.ts`
- Test: `src/ui/helpText.test.ts`

**Interfaces:**
- Consumes: Task 2's `selectedDay(data, picked, choice, zoom)`, Task 3's `PanelStack` props.
- Produces: `SpanControl` gains `zoomed: boolean`.

- `SpotScreen`: `const [zoom, setZoom] = useState<Span | null>(null)`. `selectedDay(data, pickedDay, span, zoom)`. `PanelStack` gets `onWindow={setZoom}` and the bounds. `chooseSpan` also sets the zoom to null, and so do `selectDay` and the month view's way in (beside `setPick(null)` there). A spot change already remounts the screen (`key={spot.id}` in `App.tsx`). The zoom is not written to storage.
- `SpanControl`: `aria-checked={!zoomed && entry.id === span}`; `tabIndex` stays keyed on `span`, so Tab still reaches a button while zoomed; a click on the current span calls `onSpan` as any click does (which clears the zoom). Arrow keys unchanged.
- `helpText.ts`: in the section headed "The panels", after the sentence about "Day", "3 days" and "Week", add: `Pinch the panels to see more or less time, and move two fingers sideways to slide along. The Day, 3 days and Week buttons put it back.`
- `helpText.test.ts`: one test that the panels section says "Pinch".

- [ ] **Step 1:** Write the help test; it fails.
- [ ] **Step 2:** Implement the three files.
- [ ] **Step 3:** `npm test`, `npm run lint`, `npm run build` pass.
- [ ] **Step 4:** Commit.

---

### After the tasks (controller)

A headless browser check with Playwright on Edge against `npm run dev` at http://localhost:5173: a `ctrlKey` wheel over the tide panel shortens the window (the labels change and no span button is checked), a horizontal wheel pans, `+` and `-` on the focused stack zoom, "Day" puts it back; and two touch pointers through CDP `Input.dispatchTouchEvent` on a phone-sized page spread to zoom in. Screenshots under `.playwright-mcp/`. Then the owner's checks from the spec go in the pull request body, plus one for Safari on the Mac (trackpad pinch on the panels zooms them, not the page).
