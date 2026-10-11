import { Suspense, lazy, useEffect, useState } from 'react'
import { forgetSpot } from './data/cache.ts'
import { readSavedSpots, addSpot } from './data/savedSpots.ts'
import { SPOTS, allSpots, isSaved } from './spot.ts'
import type { Spot } from './spot.ts'
import { WORDS } from './ui/addSpotView.ts'
import { AddSpotUnavailable } from './ui/AddSpotUnavailable.tsx'
import { BuildStamp } from './ui/BuildStamp.tsx'
import { forgetSavedSpot, readSpot, writeSpot } from './ui/choices.ts'
import { InstallHint } from './ui/InstallHint.tsx'
import { SharedSpot } from './ui/SharedSpot.tsx'
import { openedLink, sharedSpotId } from './ui/shareView.ts'
import type { SharedPoint } from './ui/shareView.ts'
import { SpotScreen } from './ui/SpotScreen.tsx'
import { SpotSwitcher } from './ui/SpotSwitcher.tsx'

// Leaflet and the station list come with it, the first time it is opened.
// Offline, or in a home-screen app left open past a deploy, the fetch fails;
// a failed lazy import would blank the whole app, so a line stands in.
const AddSpot = lazy(() =>
  import('./ui/AddSpot.tsx').catch(() => ({ default: AddSpotUnavailable })),
)

/** Puts the address back to `/`, so a reload does not open the link again. */
function clearAddress() {
  window.history.replaceState(null, '', window.location.pathname)
}

export default function App() {
  const [saved, setSaved] = useState<Spot[]>(readSavedSpots)
  // What the address asked for, read once as the page starts.
  const [opened] = useState(() =>
    openedLink(window.location.search, allSpots(saved)),
  )
  const [spot, setSpot] = useState<Spot>(() =>
    opened.kind === 'have' ? opened.spot : readSpot(allSpots(saved)),
  )
  // The point of a link the device has no spot at, until it is saved or
  // closed. While there is one its screen is the page.
  const [shared, setShared] = useState<SharedPoint | null>(
    opened.kind === 'new' ? opened.point : null,
  )
  const [adding, setAdding] = useState(false)
  // The id of a spot that could not be kept on the device, said on its screen.
  const [notKept, setNotKept] = useState<string | null>(null)
  const spots = allSpots(saved)

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
  }
  const saveSpot = (next: Spot) => {
    setNotKept(addSpot(next) ? null : next.id)
    setSaved([...saved, next])
    selectSpot(next)
    setAdding(false)
    window.scrollTo(0, 0)
  }
  const removeSpot = () => {
    forgetSavedSpot(spot)
    setSaved(saved.filter((each) => each.id !== spot.id))
    selectSpot(SPOTS[0])
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
    clearAddress()
    window.scrollTo(0, 0)
  }

  if (shared) {
    return (
      <main>
        <SharedSpot
          point={shared}
          onSave={saveShared}
          onClose={() => closeShared(shared)}
        />
        <BuildStamp />
      </main>
    )
  }

  if (adding) {
    return (
      <main>
        <h1>{WORDS.heading}</h1>
        <Suspense fallback={<p className="notice">{WORDS.loadingMap}</p>}>
          <AddSpot
            from={spot}
            onSave={saveSpot}
            onCancel={() => setAdding(false)}
          />
        </Suspense>
        <BuildStamp />
      </main>
    )
  }

  return (
    <main>
      <h1>{spot.name}</h1>
      <SpotSwitcher
        spots={spots}
        current={spot}
        onSelect={selectSpot}
        onAdd={() => setAdding(true)}
      />
      <InstallHint />
      {notKept === spot.id && (
        <p className="notice" role="status">
          {WORDS.notKept}
        </p>
      )}
      {/* Keyed, so a switch mounts the screen afresh, as a first open does. */}
      <SpotScreen
        key={spot.id}
        spot={spot}
        onRemove={isSaved(spot) ? removeSpot : undefined}
      />
      <BuildStamp />
    </main>
  )
}
