// The only file that touches Firebase: it signs in and out, and reads,
// writes and watches a signed-in user's spot list in Firestore. The SDK is
// loaded with a dynamic import the first time it is wanted, to ask for the
// user, to reach the spots or to warm it before a tap, so it is a chunk of
// its own (named `firebase` in `vite.config.ts`) and the forecast page never
// pays for it. The auth domain is the page's
// own host, so the sign-in handoff stays on one site: WebKit partitions
// storage by top-level site, and a handler on Firebase's domain could not
// read what the SDK wrote on ours (see `firebaseConfig.ts`).
//
// Two ways to have no user are kept apart. Firebase saying nobody is signed
// in is `listener(null)`. Not being able to ask at all, because the config is
// missing or the SDK would not load (offline, or a home-screen app left open
// past a deploy, so its chunk is gone), is `unavailable()`: the device's
// record that it has signed in stays, and the next tap tries again.
// Browsers remember a failed chunk import until the page reloads, so a
// failed load is reported as its own error, `SdkUnavailable`, for the row to
// word.

import type { FirebaseApp } from 'firebase/app'
import type { Auth, User } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import type { SpotStore } from './accountDoc.ts'
import { firebaseConfig } from './firebaseConfig.ts'

/** What the app needs to know about the signed-in user. */
export type AccountUser = { uid: string; email: string | null }

/** The env has no Firebase config, so there is nothing to sign in to. */
export class NotConfigured extends Error {
  readonly missing: string[]
  constructor(missing: string[]) {
    super(`Firebase is not configured: ${missing.join(', ')} missing`)
    this.name = 'NotConfigured'
    this.missing = missing
  }
}

/** The SDK's chunk could not be loaded; the import's error is `cause`. */
export class SdkUnavailable extends Error {
  constructor(cause?: unknown) {
    super('The sign-in code could not be loaded', { cause })
    this.name = 'SdkUnavailable'
  }
}

type AuthModule = typeof import('firebase/auth')
type FirestoreModule = typeof import('firebase/firestore')
type Ready = { auth: Auth; sdk: AuthModule; db: Firestore; fs: FirestoreModule }

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
    import('firebase/firestore'),
  ]).then(
    ([{ getApp, getApps, initializeApp }, sdk, fs]) => {
      // A retry after `getAuth` threw finds the app already registered, and a
      // second `initializeApp` would fail as a duplicate.
      const app = getApps().length ? getApp() : initializeApp(config)
      const auth = sdk.getAuth(app)
      return { auth, sdk, db: firestore(fs, app), fs }
    },
    (error: unknown) => {
      throw new SdkUnavailable(error)
    },
  )
  started.catch(() => {
    if (pending === started) pending = null
  })
  pending = started
  return pending
}

/**
 * The database, made once with the app: `initializeFirestore` throws if it is
 * called twice. The spots are kept on the device across tabs where the browser
 * allows it, and in memory where it does not (a private window, or storage off).
 * Where one is already made for the app (a dev server's hot reload), it is taken.
 */
function firestore(fs: FirestoreModule, app: FirebaseApp): Firestore {
  try {
    return fs.initializeFirestore(app, {
      localCache: fs.persistentLocalCache({
        tabManager: fs.persistentMultipleTabManager(),
      }),
    })
  } catch {
    try {
      return fs.initializeFirestore(app, { localCache: fs.memoryLocalCache() })
    } catch {
      return fs.getFirestore(app)
    }
  }
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
  return { uid: user.uid, email: user.email }
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

/**
 * Google's sign-in in a popup. Throws `NotConfigured`, `SdkUnavailable`, or
 * the SDK's error.
 */
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

/** The SDK started, or the reason it could not be, as an error to throw. */
async function readyOrThrow(): Promise<Ready> {
  const r = await ready()
  if (r instanceof NotConfigured) throw new NotConfigured(r.missing)
  return r
}

/**
 * The signed-in user's spot list, one document `users/{uid}`. Spot ids can
 * hold dots, so a change writes them as keys of a nested object in a merge
 * `setDoc`, never as dotted field paths.
 */
export const spotStore: SpotStore = {
  async read(uid) {
    const { db, fs } = await readyOrThrow()
    const snap = await fs.getDoc(fs.doc(db, 'users', uid))
    return snap.exists() ? snap.data() : null
  },

  async write(uid, doc) {
    const { db, fs } = await readyOrThrow()
    await fs.setDoc(fs.doc(db, 'users', uid), {
      ...doc,
      updatedAt: fs.serverTimestamp(),
    })
  },

  async change(uid, change) {
    const { db, fs } = await readyOrThrow()
    await fs.setDoc(
      fs.doc(db, 'users', uid),
      {
        spots: {
          ...change.set,
          ...Object.fromEntries(
            change.remove.map((id) => [id, fs.deleteField()]),
          ),
        },
        order: change.order,
        updatedAt: fs.serverTimestamp(),
      },
      { merge: true },
    )
  },

  /**
   * Calls `onData` with the document, or null when there is none, and whether
   * a write of this device's has not reached the server yet. Where the SDK
   * cannot be had, calls `onError` once. The returned function stops it, and
   * may be called before the SDK has loaded.
   */
  watch(uid, onData, onError) {
    let stopped = false
    let unsubscribe: (() => void) | null = null
    ready().then(
      (r) => {
        if (stopped) return
        if (r instanceof NotConfigured) {
          onError(new NotConfigured(r.missing))
          return
        }
        try {
          unsubscribe = r.fs.onSnapshot(
            r.fs.doc(r.db, 'users', uid),
            { includeMetadataChanges: true },
            (snap) =>
              onData(
                snap.exists() ? snap.data() : null,
                snap.metadata.hasPendingWrites,
              ),
            onError,
          )
        } catch (error) {
          onError(error)
        }
      },
      (error: unknown) => {
        if (!stopped) onError(error)
      },
    )
    return () => {
      stopped = true
      unsubscribe?.()
      unsubscribe = null
    }
  },
}
