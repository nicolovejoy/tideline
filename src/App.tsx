import { Suspense, lazy, useEffect, useState } from 'react'
import { addChange, removeChange, replaceChange } from './data/accountDoc.ts'
import { forgetSpot } from './data/cache.ts'
import { readSpots, addSpot, replaceSpot } from './data/savedSpots.ts'
import type { Spot } from './spot.ts'
import { WORDS } from './ui/addSpotView.ts'
import { Account } from './ui/Account.tsx'
import { AddSpotUnavailable } from './ui/AddSpotUnavailable.tsx'
import { BuildStamp } from './ui/BuildStamp.tsx'
import { FeedbackButton } from './ui/FeedbackButton.tsx'
import { FeedbackSheet } from './ui/FeedbackSheet.tsx'
import { initialEmail, showsEmailHint } from './ui/feedbackView.ts'
import { forgetSavedSpot, readSpot, writeSpot } from './ui/choices.ts'
import { spotSubtitle } from './ui/captions.ts'
import { InstallHint } from './ui/InstallHint.tsx'
import { SharedSpot } from './ui/SharedSpot.tsx'
import { openedLink, sharedSpotId } from './ui/shareView.ts'
import type { SharedPoint } from './ui/shareView.ts'
import { SpotScreen } from './ui/SpotScreen.tsx'
import { SpotSwitcher } from './ui/SpotSwitcher.tsx'
import { useAccount } from './ui/useAccount.ts'
import { useAccountSpots } from './ui/useAccountSpots.ts'
import { clearAddress, closeView, openView, useView } from './ui/useView.ts'

// Leaflet and the station list come with it, the first time it is opened.
// Offline, or in a home-screen app left open past a deploy, the fetch fails;
// a failed lazy import would blank the whole app, so a line stands in.
const AddSpot = lazy(() =>
  import('./ui/AddSpot.tsx').catch(() => ({ default: AddSpotUnavailable })),
)

export default function App() {
  // The device's spots, the three it started with among them.
  const [spots, setSpots] = useState<Spot[]>(readSpots)
  // What the address asked for, read once as the page starts.
  const [opened] = useState(() => openedLink(window.location.search, spots))
  const [spot, setSpot] = useState<Spot>(() =>
    opened.kind === 'have' ? opened.spot : readSpot(spots),
  )
  // The point of a link the device has no spot at, until it is saved or
  // closed. While there is one its screen is the page.
  const [shared, setShared] = useState<SharedPoint | null>(
    opened.kind === 'new' ? opened.point : null,
  )
  // The add screen and the edit screen each have an entry in the browser's
  // history, so going back closes them.
  const view = useView()
  const adding = view === 'add'
  const editing = view === 'edit'
  // The id of a spot that could not be kept on the device, said on its screen.
  const [notKept, setNotKept] = useState<string | null>(null)
  // One watcher of the account, for its row and for the feedback sheet's
  // email.
  const account = useAccount()
  // Signed in, the account's list is the truth: each snapshot of it replaces
  // the row, and the chosen spot stays chosen while the list has it. A view
  // that is up stays up.
  const uid = account.account.kind === 'in' ? account.account.uid : null
  const accountSpots = useAccountSpots({
    uid,
    onList: (list) => {
      setSpots(list)
      setSpot((prev) => {
        const same = list.find((each) => each.id === prev.id)
        if (same) return same
        writeSpot(list[0])
        return list[0]
      })
    },
  })

  // A link to a spot the device has is a choice of that spot, as a tap on
  // the row is, and is dealt with as soon as it is read.
  useEffect(() => {
    if (opened.kind !== 'have') return
    writeSpot(opened.spot)
    clearAddress()
  }, [opened])

  const selectSpot = (next: Spot) => {
    writeSpot(next)
    setSpot(next)
    // A spot opens on its forecast, whichever view was up.
    closeView()
  }
  const saveSpot = (next: Spot) => {
    setNotKept(addSpot(next) ? null : next.id)
    accountSpots.apply(addChange(spots, next))
    setSpots([...spots, next])
    selectSpot(next)
    window.scrollTo(0, 0)
  }
  // A rename keeps the id and what was fetched. A move is a new id, in the
  // old one's place; what was fetched for the old point is dropped, so a
  // late answer for it cannot be drawn for the new one.
  const editSpot = (next: Spot) => {
    if (next.id !== spot.id) forgetSpot(spot.id)
    setNotKept(replaceSpot(spot.id, next) ? null : next.id)
    accountSpots.apply(replaceChange(spots, spot.id, next))
    setSpots(spots.map((each) => (each.id === spot.id ? next : each)))
    selectSpot(next)
    window.scrollTo(0, 0)
  }
  // The last spot cannot be removed, so there is always one left to show:
  // the first of the rest.
  const removeSpot = () => {
    const rest = spots.filter((each) => each.id !== spot.id)
    forgetSavedSpot(spot)
    accountSpots.apply(removeChange(spots, spot.id))
    setSpots(rest)
    selectSpot(rest[0])
    window.scrollTo(0, 0)
  }
  // Either way out of a shared spot deals with the link.
  const saveShared = (next: Spot) => {
    saveSpot(next)
    setShared(null)
    clearAddress()
  }
  const closeShared = (point: SharedPoint) => {
    // What was fetched for a spot that was not kept does not stay.
    forgetSpot(sharedSpotId(point))
    setShared(null)
    // Before the address is cleared, so the entry under the view is too.
    closeView()
    clearAddress()
    window.scrollTo(0, 0)
  }

  // The button is shown only where no view is up, since the sheet takes the
  // place of whichever view it is opened over.
  const feedback = (
    <>
      {view === null && <FeedbackButton onOpen={() => openView('feedback')} />}
      {view === 'feedback' && (
        <FeedbackSheet
          email={initialEmail(account.account)}
          hinted={showsEmailHint(account.account)}
          onClose={closeView}
        />
      )}
    </>
  )

  if (shared) {
    return (
      <main>
        <SharedSpot
          point={shared}
          onSave={saveShared}
          onClose={() => closeShared(shared)}
        />
        <BuildStamp />
        {feedback}
      </main>
    )
  }

  if (adding || editing) {
    return (
      <main>
        <h1>{editing ? WORDS.editHeading : WORDS.heading}</h1>
        <Suspense fallback={<p className="notice">{WORDS.loadingMap}</p>}>
          <AddSpot
            key={editing ? spot.id : 'new'}
            from={spot}
            editing={editing ? spot : undefined}
            onSave={editing ? editSpot : saveSpot}
            onCancel={closeView}
            onRemove={editing && spots.length > 1 ? removeSpot : undefined}
          />
        </Suspense>
        <BuildStamp />
      </main>
    )
  }

  return (
    <main>
      <header>
        <h1 className="title">Tideline</h1>
        <div className="spot-line">
          <p className="subtitle">{spotSubtitle(spot)}</p>
          <button
            type="button"
            className="text-button"
            onClick={() => openView('edit')}
          >
            {WORDS.edit}
          </button>
        </div>
        <Account {...account} pending={accountSpots.pending} />
      </header>
      <SpotSwitcher
        spots={spots}
        current={spot}
        onSelect={selectSpot}
        onAdd={() => openView('add')}
      />
      <InstallHint />
      {notKept === spot.id && (
        <p className="notice" role="status">
          {WORDS.notKept}
        </p>
      )}
      {/* Keyed, so a switch mounts the screen afresh, as a first open does. */}
      <SpotScreen key={spot.id} spot={spot} />
      <BuildStamp />
      {feedback}
    </main>
  )
}
