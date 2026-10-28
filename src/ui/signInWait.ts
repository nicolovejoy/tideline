// How long the home-screen app waits for a sign-in before it gives up. There
// Firebase opens Google's page by a click it makes on a link and keeps no
// handle on the window, so it never says that the page did not open or was
// closed, and without this the row would say "Signing in…" for good. The
// clock runs only while the app is in view and starts again when the app
// comes back, so the time spent on Google's page does not count.

export const GIVE_UP_MS = 10_000

export type SignInWait = {
  /** The app went out of view: stop the clock. */
  hidden(): void
  /** The app is back in view: start the clock again. */
  visible(): void
  /** The sign-in answered: never give up. */
  stop(): void
}

/** Starts the clock; `giveUp` is called at most once. */
export function signInWait(
  giveUp: () => void,
  ms: number = GIVE_UP_MS,
): SignInWait {
  let timer: ReturnType<typeof setTimeout> | null = null
  let over = false
  const clear = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  const start = () => {
    clear()
    if (over) return
    timer = setTimeout(() => {
      timer = null
      over = true
      giveUp()
    }, ms)
  }
  start()
  return {
    hidden: clear,
    visible: start,
    stop() {
      over = true
      clear()
    },
  }
}
