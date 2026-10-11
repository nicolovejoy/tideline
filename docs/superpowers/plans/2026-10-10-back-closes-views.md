# Back Closes Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In a browser tab, going back from the month view or the add screen shows the forecast and does not leave the site.

**Architecture:** One plain module, `src/ui/viewHistory.ts`, holds which view is up (`'month'`, `'add'` or none) and keeps the browser's history in step; the browser is handed in, so it is tested with a stand-in. `src/ui/useView.ts` makes the one store for the page on `window.history`, listens for `popstate` and gives React a hook. `App.tsx` and `SpotScreen.tsx` read the view from the store where they kept it in their own state. No new dependency, no new address.

**Tech Stack:** Vite, React 19 (`useSyncExternalStore`), strict TypeScript, Vitest, the History API.

**Spec:** `docs/superpowers/specs/2026-10-10-back-closes-views-design.md`. Read it first; it says what the user sees and lists the decisions the owner reviews.

## Global Constraints

- Code style: no semicolons, single quotes, relative imports carry their `.ts`/`.tsx` extension, type-only imports use `import type`, no enums. `npm run lint` (oxlint then Prettier) must pass; run `npm run format` before committing.
- Tests run with `TZ=Asia/Tokyo`, in Node with no DOM: a test must not import anything that touches `window`. `src/ui/useView.ts` touches `window` as it loads, so no test imports it, and no tested module may import it.
- Components hold no arithmetic, no rules and no wording. Those live in plain modules with tests. Everything about history entries that can be decided without a browser is in `src/ui/viewHistory.ts`.
- A view's history entry carries exactly `{ tidelineView: 'month' }` or `{ tidelineView: 'add' }`, and is pushed at the address the page already has. No address changes because of a view.
- At most one view's entry is on top of the forecast's at any time.
- Commit trailer, on every commit, regardless of the model doing the work:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` then
  `Claude-Session: https://claude.ai/code/session_011uFB3EqJLYQ5h3p8Hc6jPq`
- In every tracked file and commit message the first user is "the first user"; no names from `private/`.
- Node 24. In each shell, before any `npm` or `npx`: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH`. Do not `source` nvm.
- Work only in this worktree, on the branch it is on. No `git stash`, `git reset`, `git checkout` of other branches, or `git clean`.

## Review Focus

1. A reload on a view's entry must open that view, and going back must still show the forecast. Pinned in Task 1 ("a reload") and in Task 2's browser check, part D.
2. A view left by its own button must leave no entry behind: the next back leaves the site. Pinned in Task 1 ("asks the browser to go back, once", "twice goes back once") and in Task 2's browser check, parts A and B.
3. Save or Close on a shared spot while its month view is up must leave the link in the address of neither history entry. Pinned in Task 1 ("as a view is left, cleans the entry underneath as well") and in Task 2's browser check, part F.
4. The add screen opened from the month view must not stack a second entry: back from it is the forecast. Pinned in Task 1 ("another view takes the first one's entry") and in Task 2's browser check, part C.
5. A view opened in the moment after another was closed, before the browser has gone back, must not be lost and must not push onto the entry that is on its way out. Pinned in Task 1 ("opening while the browser is still going back").

---

### Task 1: The view store

**Files:**
- Create: `src/ui/viewHistory.ts`
- Test: `src/ui/viewHistory.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type View = 'month' | 'add'
  export interface ViewEntry { tidelineView: View }
  export interface Pages {
    readonly state: unknown
    pushState(state: unknown, unused: string): void
    replaceState(state: unknown, unused: string, url?: string): void
    back(): void
  }
  export interface ViewStore {
    current(): View | null
    open(view: View): void
    close(): void
    clearAddress(path: string): void
    arrived(state: unknown): void
    subscribe(listener: () => void): () => void
  }
  export function entryFor(view: View): ViewEntry
  export function viewOf(state: unknown): View | null
  export function createViewStore(pages: Pages): ViewStore
  ```

- [ ] **Step 1: Write the failing test**

Create `src/ui/viewHistory.test.ts` with exactly this:

```ts
import { describe, expect, test, vi } from 'vitest'
import { createViewStore, entryFor, viewOf } from './viewHistory.ts'
import type { Pages } from './viewHistory.ts'

interface Entry {
  state: unknown
  url: string
}

/**
 * A stand-in for the browser's history: a list of entries and a place in
 * it. As in a browser, `back()` only asks. `land()` is the browser getting
 * there, and gives the state it lands on, which `popstate` would carry.
 */
function fakeBrowser(entries: Entry[] = [{ state: null, url: '/' }]) {
  let at = entries.length - 1
  let backs = 0
  const pages: Pages = {
    get state() {
      return entries[at].state
    },
    pushState(state) {
      entries.splice(at + 1, Infinity, { state, url: entries[at].url })
      at += 1
    },
    replaceState(state, _unused, url) {
      entries[at] = { state, url: url ?? entries[at].url }
    },
    back() {
      backs += 1
    },
  }
  return {
    pages,
    entries,
    backs: () => backs,
    land(): unknown {
      at -= 1
      return entries[at].state
    },
    forward(): unknown {
      at += 1
      return entries[at].state
    },
  }
}

describe('viewOf', () => {
  test("a view's entry", () => {
    expect(viewOf(entryFor('month'))).toBe('month')
    expect(viewOf(entryFor('add'))).toBe('add')
    expect(viewOf({ tidelineView: 'month', other: 1 })).toBe('month')
  })

  test.each([
    [null],
    [undefined],
    ['month'],
    [7],
    [[]],
    [{}],
    [{ tidelineView: 'week' }],
    [{ tidelineView: null }],
    [{ view: 'month' }],
  ])('%j is the forecast', (state) => {
    expect(viewOf(state)).toBeNull()
  })
})

describe('opening a view', () => {
  test('starts on the forecast', () => {
    const { pages } = fakeBrowser()
    expect(createViewStore(pages).current()).toBeNull()
  })

  test('adds one entry, at the address the page has, and shows the view', () => {
    const browser = fakeBrowser([{ state: null, url: '/?name=A&at=1,2' }])
    const store = createViewStore(browser.pages)
    const listener = vi.fn()
    store.subscribe(listener)

    store.open('month')

    expect(store.current()).toBe('month')
    expect(browser.entries).toEqual([
      { state: null, url: '/?name=A&at=1,2' },
      { state: { tidelineView: 'month' }, url: '/?name=A&at=1,2' },
    ])
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('the view already up adds nothing', () => {
    const browser = fakeBrowser()
    const store = createViewStore(browser.pages)
    store.open('month')
    const listener = vi.fn()
    store.subscribe(listener)

    store.open('month')

    expect(browser.entries).toHaveLength(2)
    expect(listener).not.toHaveBeenCalled()
  })

  test("another view takes the first one's entry", () => {
    const browser = fakeBrowser()
    const store = createViewStore(browser.pages)
    store.open('month')

    store.open('add')

    expect(store.current()).toBe('add')
    expect(browser.entries).toEqual([
      { state: null, url: '/' },
      { state: { tidelineView: 'add' }, url: '/' },
    ])
  })
})

describe('closing a view', () => {
  test('shows the forecast at once and asks the browser to go back, once', () => {
    const browser = fakeBrowser()
    const store = createViewStore(browser.pages)
    store.open('month')
    const listener = vi.fn()
    store.subscribe(listener)

    store.close()

    // Before the browser has gone anywhere.
    expect(store.current()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(browser.backs()).toBe(1)

    store.arrived(browser.land())

    expect(store.current()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(browser.pages.state).toBeNull()
  })

  test('with nothing open does not go back', () => {
    const browser = fakeBrowser()
    const store = createViewStore(browser.pages)
    store.close()
    expect(browser.backs()).toBe(0)
  })

  test('twice goes back once', () => {
    const browser = fakeBrowser()
    const store = createViewStore(browser.pages)
    store.open('add')
    store.close()
    store.close()
    expect(browser.backs()).toBe(1)
  })

  test("does not go back from an entry that is not a view's", () => {
    const browser = fakeBrowser()
    const store = createViewStore(browser.pages)
    store.open('month')
    // Something else has rewritten the entry on top.
    browser.pages.replaceState(null, '')

    store.close()

    expect(store.current()).toBeNull()
    expect(browser.backs()).toBe(0)
  })
})

describe('the browser going back and forward', () => {
  test('back from a view shows the forecast', () => {
    const browser = fakeBrowser()
    const store = createViewStore(browser.pages)
    store.open('month')
    const listener = vi.fn()
    store.subscribe(listener)

    store.arrived(browser.land())

    expect(store.current()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)
    // The browser went back by itself. The store asks for nothing more.
    expect(browser.backs()).toBe(0)
  })

  test('forward opens the view again', () => {
    const browser = fakeBrowser()
    const store = createViewStore(browser.pages)
    store.open('month')
    store.close()
    store.arrived(browser.land())

    store.arrived(browser.forward())

    expect(store.current()).toBe('month')
  })

  test('a listener that has stopped is not called', () => {
    const browser = fakeBrowser()
    const store = createViewStore(browser.pages)
    const listener = vi.fn()
    const stop = store.subscribe(listener)
    stop()
    store.open('month')
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('a reload', () => {
  test("on a view's entry opens that view, and back still shows the forecast", () => {
    const browser = fakeBrowser([
      { state: null, url: '/' },
      { state: entryFor('month'), url: '/' },
    ])
    const store = createViewStore(browser.pages)
    expect(store.current()).toBe('month')

    store.close()
    expect(browser.backs()).toBe(1)
    store.arrived(browser.land())

    expect(store.current()).toBeNull()
    expect(browser.pages.state).toBeNull()
  })
})

describe('opening while the browser is still going back', () => {
  test('waits for it to arrive, then adds its one entry', () => {
    const browser = fakeBrowser()
    const store = createViewStore(browser.pages)
    store.open('month')
    store.close()

    store.open('add')

    // Not yet: the entry on top is still the month view's, on its way out.
    expect(store.current()).toBeNull()
    expect(browser.entries).toHaveLength(2)

    store.arrived(browser.land())

    expect(store.current()).toBe('add')
    expect(browser.entries).toEqual([
      { state: null, url: '/' },
      { state: { tidelineView: 'add' }, url: '/' },
    ])
  })
})

describe('clearing the address', () => {
  test('on the forecast, rewrites the entry and keeps its state', () => {
    const browser = fakeBrowser([{ state: null, url: '/?name=A&at=1,2' }])
    const store = createViewStore(browser.pages)

    store.clearAddress('/')

    expect(browser.entries).toEqual([{ state: null, url: '/' }])
  })

  test('as a view is left, cleans the entry underneath as well', () => {
    const browser = fakeBrowser([{ state: null, url: '/?name=A&at=1,2' }])
    const store = createViewStore(browser.pages)
    store.open('month')
    store.close()

    store.clearAddress('/')

    // The view's entry, still on top until the browser has gone back.
    expect(browser.entries[1]).toEqual({
      state: { tidelineView: 'month' },
      url: '/',
    })
    expect(browser.entries[0].url).toBe('/?name=A&at=1,2')

    store.arrived(browser.land())

    expect(browser.entries[0]).toEqual({ state: null, url: '/' })
    expect(store.current()).toBeNull()
  })

  test('cleans the entry underneath once only', () => {
    const browser = fakeBrowser([{ state: null, url: '/?name=A&at=1,2' }])
    const store = createViewStore(browser.pages)
    store.open('month')
    store.close()
    store.clearAddress('/')
    store.arrived(browser.land())

    // A later address is left alone when the browser next goes anywhere.
    browser.pages.replaceState(null, '', '/?name=B&at=3,4')
    store.arrived(browser.forward())
    store.arrived(browser.land())

    expect(browser.entries[0].url).toBe('/?name=B&at=3,4')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/viewHistory.test.ts`
Expected: FAIL. The file cannot be loaded because `./viewHistory.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/ui/viewHistory.ts` with exactly this:

```ts
// Which view is up over the forecast, the month view or the add screen, and
// the browser history that lets going back close it. A view puts one entry
// in the history, at the address the page already has, so going back lands
// on the forecast and not on whatever came before the site. The browser is
// handed in, so all of this is tested with a stand-in.

export type View = 'month' | 'add'

const VIEWS: readonly View[] = ['month', 'add']

/** What a view's history entry carries. */
export interface ViewEntry {
  tidelineView: View
}

/** The part of the browser's history the store uses. `window.history` fits. */
export interface Pages {
  readonly state: unknown
  pushState(state: unknown, unused: string): void
  replaceState(state: unknown, unused: string, url?: string): void
  back(): void
}

export interface ViewStore {
  /** The view on screen, or null for the forecast. */
  current(): View | null
  /** Shows a view, with one history entry for it however it was reached. */
  open(view: View): void
  /** Back to the forecast, and the view's entry taken off the history. */
  close(): void
  /** Puts the address back to `path`, on the entry under a view being left as well. */
  clearAddress(path: string): void
  /** The browser has gone back or forward, to an entry with this state. */
  arrived(state: unknown): void
  /** Calls `listener` each time the view changes. Returns the way to stop. */
  subscribe(listener: () => void): () => void
}

export function entryFor(view: View): ViewEntry {
  return { tidelineView: view }
}

/** The view a history entry's state stands for, or null for any other state. */
export function viewOf(state: unknown): View | null {
  if (typeof state !== 'object' || state === null) return null
  const view = (state as { tidelineView?: unknown }).tidelineView
  return VIEWS.find((each) => each === view) ?? null
}

export function createViewStore(pages: Pages): ViewStore {
  // A reload keeps the entry's state, so the page opens on the view it was on.
  let current = viewOf(pages.state)
  // From asking the browser to go back until it has. It answers a moment
  // later, and until then the entry on top is still the view's.
  let leaving = false
  let onArrival: (() => void)[] = []
  const listeners = new Set<() => void>()

  const show = (next: View | null) => {
    if (next === current) return
    current = next
    for (const listener of listeners) listener()
  }

  const open = (view: View) => {
    if (leaving) {
      onArrival.push(() => open(view))
      return
    }
    if (view === current) return
    // One entry for whichever view is up. The add screen opened from the
    // month view takes the month view's entry, so going back from it is the
    // forecast, as Cancel is.
    if (viewOf(pages.state) === null) pages.pushState(entryFor(view), '')
    else pages.replaceState(entryFor(view), '')
    show(view)
  }

  const close = () => {
    if (current === null) return
    show(null)
    // Only a view's own entry is taken off. Any other entry on top is not
    // this store's to leave.
    if (viewOf(pages.state) === null) return
    leaving = true
    pages.back()
  }

  const clearAddress = (path: string) => {
    const clear = () => pages.replaceState(pages.state, '', path)
    clear()
    // The entry under a view that is being left carries the address too.
    if (leaving) onArrival.push(clear)
  }

  const arrived = (state: unknown) => {
    leaving = false
    const waiting = onArrival
    onArrival = []
    show(viewOf(state))
    for (const each of waiting) each()
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  return {
    current: () => current,
    open,
    close,
    clearAddress,
    arrived,
    subscribe,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/ui/viewHistory.test.ts`
Expected: PASS, 26 tests (the `test.each` counts as 9).

- [ ] **Step 5: Format, lint, type-check, run everything**

Run: `npm run format && npm run lint && npm run typecheck && npm test`
Expected: all pass; 32 test files, 730 tests. If Prettier rewrites either new file, that is fine: keep its version.

- [ ] **Step 6: Commit**

```bash
git add src/ui/viewHistory.ts src/ui/viewHistory.test.ts
git commit -m "A store for the view on screen and its history entry

Holds which of the month view and the add screen is up, and keeps the
browser's history in step, so that going back can close a view. The
browser is handed in; nothing uses it yet.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011uFB3EqJLYQ5h3p8Hc6jPq"
```

---

### Task 2: Wire the store to the page, check it in a browser, record it

**Files:**
- Create: `src/ui/useView.ts`
- Modify: `src/App.tsx`
- Modify: `src/ui/SpotScreen.tsx`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes, from Task 1 (`src/ui/viewHistory.ts`):
  ```ts
  export type View = 'month' | 'add'
  export function createViewStore(pages: Pages): ViewStore
  // ViewStore: current(), open(view), close(), clearAddress(path), arrived(state), subscribe(listener)
  ```
- Produces (`src/ui/useView.ts`):
  ```ts
  export function useView(): View | null
  export const openView: (view: View) => void
  export const closeView: () => void
  export function clearAddress(): void
  ```

There is no unit test in this task: the tests run in Node with no DOM, and this is the wiring to `window`. Its test is the browser check in Step 5, which is required.

- [ ] **Step 1: Create `src/ui/useView.ts`**

```ts
// The one view store for the page, tied to the browser. What it does is in
// `viewHistory.ts`, which is tested; this is the wiring, checked in a
// browser. It touches `window` as it loads, so no test imports it.

import { useSyncExternalStore } from 'react'
import { createViewStore } from './viewHistory.ts'
import type { View } from './viewHistory.ts'

const store = createViewStore(window.history)

window.addEventListener('popstate', (event) => store.arrived(event.state))

// Where the page is scrolled to after going back is the app's to say, as it
// is after "Back to forecast". Left to the browser it differs from one
// browser to the next.
window.history.scrollRestoration = 'manual'

/** The view on screen, or null for the forecast. Draws again when it changes. */
export function useView(): View | null {
  return useSyncExternalStore(store.subscribe, store.current)
}

export const openView = store.open
export const closeView = store.close

/** Puts the address back to `/`, so a reload does not open a link again. */
export function clearAddress(): void {
  store.clearAddress(window.location.pathname)
}
```

- [ ] **Step 2: Edit `src/App.tsx`**

Six edits. Nothing else in the file changes.

(a) Add this import after the `SpotSwitcher` import, as the last import:

```ts
import { clearAddress, closeView, openView, useView } from './ui/useView.ts'
```

(b) Delete the local `clearAddress` function and its comment, all four lines:

```ts
/** Puts the address back to `/`, so a reload does not open the link again. */
function clearAddress() {
  window.history.replaceState(null, '', window.location.pathname)
}
```

(c) Replace

```ts
  const [adding, setAdding] = useState(false)
```

with

```ts
  // The add screen has an entry in the browser's history, so going back
  // closes it.
  const adding = useView() === 'add'
```

(d) Replace `selectSpot` and `saveSpot`:

```ts
  const selectSpot = (next: Spot) => {
    writeSpot(next)
    setSpot(next)
  }
  const saveSpot = (next: Spot) => {
    setNotKept(addSpot(next) ? null : next.id)
    setSaved([...saved, next])
    selectSpot(next)
    setAdding(false)
    window.scrollTo(0, 0)
  }
```

with

```ts
  const selectSpot = (next: Spot) => {
    writeSpot(next)
    setSpot(next)
    // A spot opens on its forecast, whichever view was up.
    closeView()
  }
  const saveSpot = (next: Spot) => {
    setNotKept(addSpot(next) ? null : next.id)
    setSaved([...saved, next])
    selectSpot(next)
    window.scrollTo(0, 0)
  }
```

(e) In `closeShared`, add `closeView()` before `clearAddress()`, so the function reads:

```ts
  const closeShared = (point: SharedPoint) => {
    // What was fetched for a spot that was not kept does not stay.
    forgetSpot(sharedSpotId(point))
    setShared(null)
    // Before the address is cleared, so the entry under the view is too.
    closeView()
    clearAddress()
    window.scrollTo(0, 0)
  }
```

`saveShared` stays as it is: `saveSpot` closes the view through `selectSpot` before `clearAddress()` runs.

(f) In the JSX, replace `onCancel={() => setAdding(false)}` with `onCancel={closeView}`, and replace `onAdd={() => setAdding(true)}` with `onAdd={() => openView('add')}`.

`useState` is still imported and still used. `useEffect`, `Suspense` and `lazy` are too.

- [ ] **Step 3: Edit `src/ui/SpotScreen.tsx`**

(a) Replace the first two import lines

```ts
import { useCallback, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
```

with

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
```

(b) Add this import after the `TonightStrip` import:

```ts
import { closeView, openView, useView } from './useView.ts'
```

(c) Replace

```ts
  // The forecast, or one month at a time. Opens on the forecast; nothing
  // about the view is remembered.
  const [view, setView] = useState<'forecast' | 'month'>('forecast')
  const [month, setMonth] = useState<string | null>(null)
```

with

```ts
  // The forecast, or one month at a time. The month view has an entry in
  // the browser's history, so going back closes it. Which month was on
  // screen is not remembered.
  const monthOpen = useView() === 'month'
  const [month, setMonth] = useState<string | null>(null)
```

(d) Replace everything from `const openMonths = useCallback(() => {` down to and including the line `if (view === 'month') {`, that is:

```ts
  const openMonths = useCallback(() => {
    setView('month')
    window.scrollTo(0, 0)
  }, [])
  const backToForecast = () => {
    flushSync(() => {
      setView('forecast')
      setMonth(null)
      // Today on the panels, with the cursor at rest, as on a first open.
      setPickedDay(null)
      setPick(null)
    })
    // The button pressed has gone with the month view; focus goes to the
    // day's heading, not to the page.
    dayHeading.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }

  if (view === 'month') {
```

with

```ts
  const openMonths = useCallback(() => {
    // Today on the panels, with the cursor at rest, as on a first open. Set
    // on the way in, so that every way back finds the forecast the same:
    // the month view's own button, or the browser going back.
    setPickedDay(null)
    setPick(null)
    setMonth(null)
    openView('month')
    window.scrollTo(0, 0)
  }, [])
  // When the month view has gone, however it went. The button pressed has
  // gone with it; focus goes to the day's heading, not to the page.
  const wasMonth = useRef(monthOpen)
  useEffect(() => {
    if (wasMonth.current && !monthOpen) {
      dayHeading.current?.focus({ preventScroll: true })
      window.scrollTo(0, 0)
    }
    wasMonth.current = monthOpen
  }, [monthOpen])

  if (monthOpen) {
```

(e) In the `<MonthView … />` just below, replace `onBack={backToForecast}` with `onBack={closeView}`.

No other line of the file changes. `view`, `setView`, `backToForecast` and `flushSync` must no longer appear in it.

- [ ] **Step 4: Type-check, lint, run the tests**

Run: `npm run format && npm run lint && npm run build && npm test`
Expected: all pass; 32 test files, 730 tests; the build finishes.

- [ ] **Step 5: Check it in a browser**

Start the dev server on its own port, in the background: `npm run dev -- --port 5183 --strictPort`. Use the Playwright browser tools (`mcp__playwright__*`; load them with ToolSearch if they are not loaded). Set the window to 390 px wide. The lookups in parts F and G use the live NWS, USGS and NOAA services.

In Playwright the page before the site is `about:blank`, so "leaves the site" below means the address becomes `about:blank`. To go back use the browser's back (`browser_navigate_back`). To go forward, evaluate `history.forward()`. To reload, evaluate `location.reload()`; navigating to the same address again is not a reload.

Record pass or fail for every numbered step in your report, with what you saw.

**A. The month view**
1. Open `http://localhost:5183/`. The forecast for Campus Point draws. Note `history.length`.
2. Click "Months ahead". Pass: the month view (a "Back to forecast" button), and `history.length` is one more.
3. Go back. Pass: the address is still `http://localhost:5183/`, the forecast is on screen ("14 days" is there), `window.scrollY` is 0, and `document.activeElement` is the day's heading (the `h2` inside `.day-head`).
4. Evaluate `history.forward()`. Pass: the month view again.
5. Click "Back to forecast". Pass: the forecast, focus on the day's heading. Then go back once. Pass: `about:blank`. (No entry was left behind.)

**B. The add screen**
6. Open `http://localhost:5183/` again. Click "Add a spot". Pass: the "New spot" screen.
7. Go back. Pass: the forecast, still on the site.
8. Click "Add a spot", then "Cancel". Pass: the forecast. Go back once. Pass: `about:blank`.

**C. The add screen from the month view**
9. Open `http://localhost:5183/`. Click "Months ahead", note `history.length`, then click "Add a spot" in the row above the months. Pass: the "New spot" screen and `history.length` unchanged. Go back. Pass: the forecast, not the month view.

**D. A reload**
10. Open `http://localhost:5183/`. Click "Months ahead". Evaluate `location.reload()`. Pass: the month view after the reload. Go back. Pass: the forecast, still on the site.

**E. Choosing a spot**
11. Open `http://localhost:5183/`. Click "Months ahead", then "Gaviota State Park" in the row. Pass: Gaviota's forecast, not its month view. Go back once. Pass: `about:blank`.

**F. A shared spot**
12. Open `http://localhost:5183/?name=Hendry%27s+Beach&at=34.4026%2C-119.7437`. Wait for the spot's screen under "Shared with you. Not saved on this device.". Click "Months ahead", then go back. Pass: the shared spot's forecast, and `location.search` still holds the link.
13. Click "Months ahead" again, then "Close". Pass: the last spot's forecast and `location.href` is `http://localhost:5183/`. Evaluate `location.reload()`. Pass: the same spot, not "Shared with you". Go back once. Pass: `about:blank`.

**G. Saving a spot**
14. Open `http://localhost:5183/`. Click "Add a spot". Click a point on the map on the coast, wait for the facts under the map, type the name "Browser check", click "Save". Pass: "Browser check" is the heading with its forecast. Go back once. Pass: `about:blank`.
15. Open `http://localhost:5183/` again, choose "Browser check", click "Remove this spot", then confirm. Pass: it is gone from the row.

If a live service does not answer in part F or G, say so and mark those steps "not run", with what the page said. Parts A to E need no network beyond the first load and must all be run.

Afterwards: evaluate `localStorage.clear()` on `http://localhost:5183`, close the browser page, and stop the dev server.

If any step fails, find out why before changing anything, fix it within this task's files, and run Step 4 and the failed part again.

- [ ] **Step 6: Commit the code**

```bash
git add src/ui/useView.ts src/App.tsx src/ui/SpotScreen.tsx
git commit -m "Going back closes the month view and the add screen

Each puts one entry in the browser's history, at the address the page
already has, so a back swipe in a browser tab shows the forecast and
does not leave the site. The view's own button takes its entry off
again. A reload on a view opens that view.

Fixes #46.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011uFB3EqJLYQ5h3p8Hc6jPq"
```

- [ ] **Step 7: Record it in `CLAUDE.md`**

Three edits.

(a) In the Stack section, in the bullet that begins "- Components hold no arithmetic, no rules and no wording.", the list of modules ends `` `src/ui/buildStamp.ts`, `src/ui/shareView.ts`), and the components are checked in a browser. `` Change that ending to:

```
`src/ui/buildStamp.ts`, `src/ui/shareView.ts`, `src/ui/viewHistory.ts`), and the components are checked in a browser.
```

(b) In the Stack section, after the last bullet (it begins "- The foot of the page says when the running build was made" and ends "On the dev server the time is when the server started."), add this bullet:

```
- The month view and the add screen each put one entry in the browser's history, at the address the page already has, so that going back closes them and does not leave the site (issue 46). `src/ui/viewHistory.ts` holds which view is up and keeps the history in step, and is tested with a stand-in for the browser; `src/ui/useView.ts` ties it to `window.history` and `popstate`. The view's own button asks the browser to go back, so no entry is left behind; a reload on a view opens that view; and the app says where the page is scrolled to (`history.scrollRestoration` is `manual`). Views have no addresses of their own (issue 48).
```

(c) In Next Steps, the bullet that begins "- Share by link (issue #7) is built and waiting for the owner's phone check." ends "and views still have no addresses (issue #46)." Change that ending to "and views still have no addresses (issue #48)." Then add this bullet directly after it:

```
- Going back closes the month view and the add screen (issue #46), by history entries only. Waiting for the owner's phone check in a Safari tab.
```

Prettier does not check Markdown here (`*.md` is in `.prettierignore`), so read the three edits back once in the diff of `CLAUDE.md` and make sure nothing else moved.

- [ ] **Step 8: Commit the record**

```bash
git add CLAUDE.md
git commit -m "Record that going back closes views in CLAUDE.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011uFB3EqJLYQ5h3p8Hc6jPq"
```
