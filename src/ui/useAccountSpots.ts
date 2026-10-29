// A signed-in user's spots, tied to the account's document in Firestore.
// On sign-in the device's list is combined into the account once, then the
// screen and the device's copy follow the document's live snapshot. Signed
// out it does nothing and touches no Firestore code. The list arithmetic is
// in `accountDoc.ts` and `accountSpots.ts`; this is the wiring, checked in a
// browser.

import { useCallback, useEffect, useRef, useState } from 'react'
import { clearCombined, openAccount } from '../data/accountDoc.ts'
import type { SpotChange } from '../data/accountDoc.ts'
import { spotStore } from '../data/firebase.ts'
import { readSavedSpots, replaceSavedSpots } from '../data/savedSpots.ts'
import type { Spot } from '../spot.ts'
import { listFromSnapshot } from './accountSpots.ts'

export function useAccountSpots({
  uid,
  onList,
}: {
  uid: string | null
  onList: (spots: Spot[]) => void
}): { active: boolean; pending: boolean; apply: (change: SpotChange) => void } {
  // Whether the snapshot is running, so a change goes to the account.
  const [active, setActive] = useState(false)
  // Whether a write of this device's has not reached the server.
  const [pending, setPending] = useState(false)
  // Whether the first sign-in's read or write, or the watch, failed.
  const [failed, setFailed] = useState(false)
  // Read through a ref, so the effect runs again only when the uid changes.
  const onListRef = useRef(onList)
  useEffect(() => {
    onListRef.current = onList
  })
  // The uid of the last run, so a sign-out clears the mark and a page that
  // starts signed out does not.
  const lastUid = useRef<string | null>(null)

  useEffect(() => {
    if (uid === null) {
      if (lastUid.current !== null) clearCombined()
      lastUid.current = null
      return
    }
    lastUid.current = uid
    let stopped = false
    let unsubscribe: (() => void) | undefined
    void openAccount(uid, spotStore, readSavedSpots).then((ok) => {
      if (stopped) return
      if (!ok) {
        setFailed(true)
        return
      }
      unsubscribe = spotStore.watch(
        uid,
        (data, isPending) => {
          const list = listFromSnapshot(data)
          if (list) {
            replaceSavedSpots(list)
            onListRef.current(list)
          }
          setPending(isPending)
          setActive(true)
        },
        () => setFailed(true),
      )
    })
    return () => {
      stopped = true
      unsubscribe?.()
      setActive(false)
      setPending(false)
      setFailed(false)
    }
  }, [uid])

  const apply = useCallback(
    (change: SpotChange) => {
      if (!active || uid === null) return
      spotStore.change(uid, change).catch((error: unknown) => {
        // The snapshot puts back what the server refused.
        console.error(error)
      })
    },
    [active, uid],
  )

  return { active, pending: pending || failed, apply }
}
