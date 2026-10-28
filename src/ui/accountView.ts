// Every word of the account row, the states it can be in, and the flag that
// says this device has signed in before. The component only arranges them.
// The flag is why the sign-in code loads at start-up on a device that has
// used it and waits for a tap on one that has not.

import { SdkUnavailable } from '../data/firebase.ts'

/** What the row needs to know about the signed-in user. */
export type AccountUser = { email: string | null }

export type Account =
  | { kind: 'out' }
  /** `tapped` is true when a tap started the load, false at start-up. */
  | { kind: 'loading'; tapped: boolean }
  | { kind: 'in'; email: string | null }
  | { kind: 'failed'; words: string }

export const WORDS = {
  signIn: 'Sign in with Google',
  signingIn: 'Signing in…',
  signOut: 'Sign out',
  loading: '…',
  noEmail: 'Signed in',
  spotsStay: 'Your spots stay on this device for now.',
} as const

export const NOT_SET_UP = 'Sign-in is not set up in this build.'

export function emailWords(email: string | null): string {
  return email ?? WORDS.noEmail
}

export function loadingWords(tapped: boolean): string {
  return tapped ? WORDS.signingIn : WORDS.loading
}

const FAILURES: Record<string, string | null> = {
  // The user closed the window or tapped again: nothing went wrong.
  'auth/popup-closed-by-user': null,
  'auth/cancelled-popup-request': null,
  'auth/popup-blocked':
    'The sign-in window was blocked. Allow pop-ups for this site and try again.',
  'auth/network-request-failed':
    'Could not reach Google. Check the connection and try again.',
  'auth/unauthorized-domain': 'This address is not set up for sign-in.',
}

const DID_NOT_FINISH = 'Sign-in did not finish. Try again.'

// The sign-in code's chunk did not load. The browser will not fetch it again
// until the page reloads, so trying again is not enough.
export const SDK_UNAVAILABLE =
  'Sign-in could not load. Reload the page and try again.'

/** The sentence for a failed sign-in, or null where nothing is to be said. */
export function failureWords(error: unknown): string | null {
  if (error instanceof SdkUnavailable) return SDK_UNAVAILABLE
  const code = (error as { code?: unknown } | null | undefined)?.code
  if (typeof code !== 'string') return DID_NOT_FINISH
  if (code in FAILURES) return FAILURES[code]
  return `${DID_NOT_FINISH} (${code})`
}

const KEY = 'tideline:account:seen'

export function readSeen(): boolean {
  try {
    return localStorage.getItem(KEY) !== null
  } catch {
    // Storage is disabled. The sign-in code waits for a tap; the lesser harm.
    return false
  }
}

export function writeSeen(): void {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // Storage is full or disabled. The next open waits for a tap.
  }
}

export function clearSeen(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Storage is disabled. Nothing was kept to clear.
  }
}

/** Load the sign-in code at start-up only where the flag is set. */
export function startsSignedIn(seen: boolean): boolean {
  return seen
}
