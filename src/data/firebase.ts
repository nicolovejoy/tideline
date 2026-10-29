// The only file that touches Firebase: it signs in and out, and reads,
// writes and watches a signed-in user's spot list in Firestore. The SDK is
// loaded with a dynamic import the first time it is wanted, to ask for the
// user or to warm it before a tap, so it is a chunk of its own (named
// `firebase` in `vite.config.ts`) and the forecast page never pays for it.
// Firestore is a second chunk (`firestore`), loaded only once a signed-in
// user's spots are wanted, so the first sign-in tap downloads auth alone.
// The auth domain is the page's own host, so the sign-in handoff stays on
// one site: WebKit partitions storage by top-level site, and a handler on
// Firebase's domain could not read what the SDK wrote on ours (see
// `firebaseConfig.ts`).
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
type Ready = { app: FirebaseApp; auth: Auth; sdk: AuthModule }
type StoreReady = { db: Firestore; fs: FirestoreModule }

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
  ]).then(
    ([{ getApp, getApps, initializeApp }, sdk]) => {
      // A retry after `getAuth` threw finds the app already registered, and a
      // second `initializeApp` would fail as a duplicate.
      const app = getApps().length ? getApp() : initializeApp(config)
      return { app, auth: sdk.getAuth(app), sdk }
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
 * The database, made once with the app. The spots are kept on the device
 * across tabs where the browser allows it; where IndexedDB refuses (a private
 * window, or storage off) the SDK falls back to memory by itself and warns,
 * without throwing. `initializeFirestore` throws only when it has been called
 * for the app already, as on a dev server's hot reload, and then the one
 * already made is taken; the memory cache is tried first only as a guard.
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

let storePending: Promise<StoreReady> | null = null

/**
 * Firestore, started once after the app. Throws `NotConfigured`,
 * `SdkUnavailable`, or the start's error; a failure is not kept, so the next
 * call tries again.
 */
function storeReady(): Promise<StoreReady> {
  if (storePending) return storePending
  const started = ready().then(async (r) => {
    if (r instanceof NotConfigured) throw r
    let fs: FirestoreModule
    try {
      fs = await import('firebase/firestore')
    } catch (error) {
      throw new SdkUnavailable(error)
    }
    return { db: firestore(fs, r.app), fs }
  })
  started.catch(() => {
    if (storePending === started) storePending = null
  })
  storePending = started
  return storePending
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

/**
 * The signed-in user's spot list, one document `users/{uid}`. Spot ids can
 * hold dots, so a change writes them as keys of a nested object in a merge
 * `setDoc`, never as dotted field paths.
 */
export const spotStore: SpotStore = {
  async open(uid, decide) {
    const { db, fs } = await storeReady()
    const ref = fs.doc(db, 'users', uid)
    await fs.runTransaction(db, async (tx) => {
      const snap = await tx.get(ref)
      tx.set(ref, {
        ...decide(snap.exists() ? snap.data() : null),
        updatedAt: fs.serverTimestamp(),
      })
    })
  },

  async change(uid, change) {
    const { db, fs } = await storeReady()
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
    storeReady().then(
      ({ db, fs }) => {
        if (stopped) return
        try {
          unsubscribe = fs.onSnapshot(
            fs.doc(db, 'users', uid),
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
