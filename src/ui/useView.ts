// The one view store for the page, tied to the browser. What it does is in
// `viewHistory.ts`, which is tested; this is the wiring, checked in a
// browser. It touches `window` as it loads, so no test imports it.

import { useSyncExternalStore } from 'react'
import { createViewStore } from './viewHistory.ts'
import type { View } from './viewHistory.ts'

const store = createViewStore(window.history)

window.addEventListener('popstate', (event) => store.arrived(event.state))

// A page brought back from the browser's back-forward cache comes back as
// it was left, and may never hear the popstate it was waiting for. It is
// told where it is instead. Telling it twice does no harm.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) store.arrived(window.history.state)
})

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
