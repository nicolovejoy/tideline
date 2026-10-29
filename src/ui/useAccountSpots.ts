// A signed-in user's spots, tied to the account's document in Firestore.
// On sign-in the device's list is combined into the account once, then the
// screen and the device's copy follow the document's live snapshot. A change
// made while the account is still being opened waits in a queue and is sent,
// in order, once it is open; if the open fails the queue is dropped and the
// device keeps the change. The caption's rule is `spotsCaption`; the hook
// gives it how long a write has been pending. Signed out it does nothing and
// touches no Firestore code. The list arithmetic is in `accountDoc.ts` and
// `accountSpots.ts`; this is the wiring, checked in a browser.

import { useCallback, useEffect, useRef, useState } from 'react'
import { clearCombined, openAccount, readCombined } from '../data/accountDoc.ts'
import type { SpotChange } from '../data/accountDoc.ts'
import { spotStore } from '../data/firebase.ts'
import { readSpots, replaceSavedSpots } from '../data/savedSpots.ts'
import type { Spot } from '../spot.ts'
import { listFromSnapshot } from './accountSpots.ts'
import { UNSENT_AFTER_MS, spotsCaption } from './accountView.ts'

/** Where the account stands: none, being opened, open, or failed to open. */
type Phase = 'none' | 'opening' | 'open' | 'failed'

/** Sends a change; a refusal is put back by the snapshot, so it is only logged. */
function send(uid: string, change: SpotChange): void {
  spotStore.change(uid, change).catch((error: unknown) => {
    console.error(error)
  })
}

export function useAccountSpots({
  uid,
  onList,
}: {
  uid: string | null
  onList: (spots: Spot[]) => void
}): { caption: string; apply: (change: SpotChange) => void } {
  // Whether a snapshot has come, so the screen is the account's.
  const [active, setActive] = useState(false)
  // When a write of this device's that has not reached the server was first
  // seen pending, or null when none is.
  const [pendingSince, setPendingSince] = useState<number | null>(null)
  // The time a pending write's wait was last checked, moved on by a timer.
  const [now, setNow] = useState(0)
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
  // The uid now, for a change and for an open that ends after a sign-out.
  const uidRef = useRef<string | null>(null)
  const phase = useRef<Phase>('none')
  // Changes made while the account is being opened, oldest first.
  const queue = useRef<SpotChange[]>([])

  useEffect(() => {
    uidRef.current = uid
    if (uid === null) {
      if (lastUid.current !== null) clearCombined()
      lastUid.current = null
      return
    }
    lastUid.current = uid
    phase.current = 'opening'
    queue.current = []
    let stopped = false
    let unsubscribe: (() => void) | undefined
    void openAccount(uid, spotStore, readSpots).then((ok) => {
      if (stopped) {
        // Signed out while the open was under way: its mark goes too.
        if (uidRef.current === null) clearCombined()
        return
      }
      if (!ok) {
        phase.current = 'failed'
        queue.current = []
        setFailed(true)
        return
      }
      phase.current = 'open'
      const waiting = queue.current
      queue.current = []
      // The SDK's cache folds these into the first snapshot.
      for (const change of waiting) send(uid, change)
      unsubscribe = spotStore.watch(
        uid,
        (data, isPending) => {
          const list = listFromSnapshot(data)
          if (list) {
            replaceSavedSpots(list)
            onListRef.current(list)
          }
          setPendingSince((since) => (isPending ? (since ?? Date.now()) : null))
          setActive(true)
        },
        () => setFailed(true),
      )
    })
    return () => {
      stopped = true
      phase.current = 'none'
      queue.current = []
      unsubscribe?.()
      setActive(false)
      setPendingSince(null)
      setFailed(false)
    }
  }, [uid])

  // Once a write has been pending as long as the caption allows, the page is
  // drawn again so the caption can say so; the timer goes when it is sent.
  useEffect(() => {
    if (pendingSince === null) return
    const left = pendingSince + UNSENT_AFTER_MS - Date.now()
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, left))
    return () => clearTimeout(timer)
  }, [pendingSince])

  const apply = useCallback((change: SpotChange) => {
    const current = uidRef.current
    if (current === null) return
    if (phase.current === 'open') send(current, change)
    else if (phase.current === 'opening') queue.current.push(change)
  }, [])

  const caption = spotsCaption({
    opened: active,
    combined: uid !== null && readCombined() === uid,
    pending: pendingSince !== null,
    pendingFor: pendingSince === null ? 0 : Math.max(0, now - pendingSince),
    online: navigator.onLine,
    failed,
  })
  return { caption, apply }
}
