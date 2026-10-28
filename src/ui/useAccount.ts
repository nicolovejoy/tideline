// The account row's state, tied to the Firebase adapter. What the row says
// is in `accountView.ts`, which is tested; this is the wiring, checked in a
// browser. The SDK is asked about the user at start-up only on a device that
// has signed in before; anywhere else it waits for the button.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  NotConfigured,
  signIn as adapterSignIn,
  signOut as adapterSignOut,
  warm,
  watchUser,
} from '../data/firebase.ts'
import {
  NOT_SET_UP,
  clearSeen,
  failureWords,
  readSeen,
  startsSignedIn,
  writeSeen,
} from './accountView.ts'
import type { Account } from './accountView.ts'

export function useAccount(): {
  account: Account
  signIn: () => void
  signOut: () => void
  warm: () => void
} {
  const [account, setAccount] = useState<Account>(() =>
    startsSignedIn(readSeen())
      ? { kind: 'loading', tapped: false }
      : { kind: 'out' },
  )
  // Watching starts at once where the row starts loading, and otherwise
  // after the first sign-in, so a sign-out in another tab is seen.
  const [watching, setWatching] = useState(() => account.kind === 'loading')
  // While the popup is open the sign-in's own answer settles the row, not
  // the watcher's first word, which is that nobody is signed in yet.
  const signingIn = useRef(false)

  useEffect(() => {
    if (!watching) return
    return watchUser(
      (user) => {
        if (user) {
          setAccount({ kind: 'in', email: user.email })
        } else if (!signingIn.current) {
          clearSeen()
          setAccount({ kind: 'out' })
        }
      },
      // The SDK could not be had. The device's flag stays, so the next open
      // or the next tap asks again. Nothing is watching now, so watching is
      // set false, and a sign-in that later succeeds starts a watcher again.
      () => {
        setWatching(false)
        if (!signingIn.current) setAccount({ kind: 'out' })
      },
    )
  }, [watching])

  const signIn = useCallback(() => {
    signingIn.current = true
    setAccount({ kind: 'loading', tapped: true })
    adapterSignIn().then(
      (user) => {
        signingIn.current = false
        writeSeen()
        setAccount({ kind: 'in', email: user.email })
        setWatching(true)
      },
      (error: unknown) => {
        signingIn.current = false
        if (error instanceof NotConfigured) {
          setAccount({ kind: 'failed', words: NOT_SET_UP })
          return
        }
        const words = failureWords(error)
        setAccount(words === null ? { kind: 'out' } : { kind: 'failed', words })
      },
    )
  }, [])

  const signOut = useCallback(() => {
    clearSeen()
    setAccount({ kind: 'out' })
    adapterSignOut().catch(() => {
      // The row already says signed out, and the flag is gone, so the next
      // open does not ask. Firebase may still hold the user until then.
    })
  }, [])

  return { account, signIn, signOut, warm }
}
