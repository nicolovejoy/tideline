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
  /**
   * Puts the address back to `path`. Called after `close`, it cleans the
   * entry under the view being left as well; under a view that stays open
   * only the view's own entry is cleaned.
   */
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
  // What waits for the browser to arrive: an address to clear on the entry
  // underneath, and a view asked for in the meantime.
  let pathToClear: string | null = null
  let viewToOpen: View | null = null
  const listeners = new Set<() => void>()

  const show = (next: View | null) => {
    if (next === current) return
    current = next
    for (const listener of listeners) listener()
  }

  const open = (view: View) => {
    if (leaving) {
      viewToOpen = view
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
    // A view that was waiting to open is called off.
    viewToOpen = null
    if (current === null) return
    show(null)
    // Only a view's own entry is taken off. Any other entry on top is not
    // this store's to leave.
    if (viewOf(pages.state) === null) return
    leaving = true
    pages.back()
  }

  const clearAddress = (path: string) => {
    pages.replaceState(pages.state, '', path)
    // The entry under a view that is being left carries the address too.
    if (leaving) pathToClear = path
  }

  const arrived = (state: unknown) => {
    leaving = false
    const path = pathToClear
    const view = viewToOpen
    pathToClear = null
    viewToOpen = null
    show(viewOf(state))
    // The address first, so that a view opening next takes the clean one.
    if (path !== null) pages.replaceState(pages.state, '', path)
    if (view !== null) open(view)
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
