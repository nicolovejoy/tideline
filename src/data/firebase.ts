// The only file that touches Firebase. The SDK is loaded with a dynamic
// import the first time something asks for the user, so it is a chunk of its
// own and the forecast page never pays for it. The auth domain is the page's
// own host, so the sign-in handoff stays on one site: WebKit partitions
// storage by top-level site, and a handler on Firebase's domain could not
// read what the SDK wrote on ours (see `firebaseConfig.ts`).
//
// Two ways to have no user are kept apart. Firebase saying nobody is signed
// in is `listener(null)`. Not being able to ask at all, because the config is
// missing or the SDK would not load (offline, or a home-screen app left open
// past a deploy, so its chunk is gone), is `unavailable()`: the device's
// record that it has signed in stays, and the next tap tries again.

import type { Auth, User } from 'firebase/auth'
import type { AccountUser } from '../ui/accountView.ts'
import { firebaseConfig } from './firebaseConfig.ts'

/** The env has no Firebase config, so there is nothing to sign in to. */
export class NotConfigured extends Error {
  readonly missing: string[]
  constructor(missing: string[]) {
    super(`Firebase is not configured: ${missing.join(', ')} missing`)
    this.name = 'NotConfigured'
    this.missing = missing
  }
}

type AuthModule = typeof import('firebase/auth')
type Ready = { auth: Auth; sdk: AuthModule }

let pending: Promise<Ready | NotConfigured> | null = null

/**
 * The SDK, started once. A missing config is kept, since the env does not
 * change while the page is open. A failed import is not: the next call tries
 * again, so a tap once the network is back can succeed.
 */
function ready(): Promise<Ready | NotConfigured> {
  if (pending) return pending
  const result = firebaseConfig(import.meta.env, window.location.host)
  if (!result.ok) {
    pending = Promise.resolve(new NotConfigured(result.missing))
    return pending
  }
  const { config } = result
  const started = Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
  ]).then(([{ getApp, getApps, initializeApp }, sdk]) => {
    // A retry after `getAuth` threw finds the app already registered, and a
    // second `initializeApp` would fail as a duplicate.
    const app = getApps().length ? getApp() : initializeApp(config)
    return { auth: sdk.getAuth(app), sdk }
  })
  started.catch(() => {
    if (pending === started) pending = null
  })
  pending = started
  return pending
}

/**
 * Starts loading the SDK without asking it anything, for a pointer-down or a
 * focus on the sign-in button. Safari may block a popup that opens long
 * after the tap, and on a device's first sign-in the download would otherwise
 * sit in that gap.
 */
export function warm(): void {
  ready().catch(() => {})
}

function accountUser(user: User): AccountUser {
  return { email: user.email }
}

/**
 * Calls `listener` on every change of the signed-in user, starting the SDK
 * if it has not started. Where the SDK cannot be had, calls `unavailable`
 * once and never `listener`. The returned function stops it, and may be
 * called before the SDK has loaded.
 */
export function watchUser(
  listener: (user: AccountUser | null) => void,
  unavailable: () => void,
): () => void {
  let stopped = false
  let unsubscribe: (() => void) | null = null
  ready().then(
    (r) => {
      if (stopped) return
      if (r instanceof NotConfigured) {
        unavailable()
        return
      }
      try {
        unsubscribe = r.sdk.onAuthStateChanged(r.auth, (user) =>
          listener(user ? accountUser(user) : null),
        )
      } catch {
        unavailable()
      }
    },
    () => {
      if (!stopped) unavailable()
    },
  )
  return () => {
    stopped = true
    unsubscribe?.()
    unsubscribe = null
  }
}

/** Google's sign-in in a popup. Throws `NotConfigured`, or the SDK's error. */
export async function signIn(): Promise<AccountUser> {
  const r = await ready()
  if (r instanceof NotConfigured) throw new NotConfigured(r.missing)
  const { user } = await r.sdk.signInWithPopup(
    r.auth,
    new r.sdk.GoogleAuthProvider(),
  )
  return accountUser(user)
}

/** Signs out. Without a config nobody can be signed in, so it does nothing. */
export async function signOut(): Promise<void> {
  const r = await ready()
  if (r instanceof NotConfigured) return
  await r.sdk.signOut(r.auth)
}
