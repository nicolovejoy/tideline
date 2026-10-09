import { useState } from 'react'
import { SPOTS } from './spot.ts'
import type { Spot } from './spot.ts'
import { readSpot, writeSpot } from './ui/choices.ts'
import { SpotScreen } from './ui/SpotScreen.tsx'
import { SpotSwitcher } from './ui/SpotSwitcher.tsx'

export default function App() {
  const [spot, setSpot] = useState<Spot>(readSpot)
  const selectSpot = (next: Spot) => {
    writeSpot(next)
    setSpot(next)
  }

  return (
    <main>
      <h1>{spot.name}</h1>
      <SpotSwitcher spots={SPOTS} current={spot} onSelect={selectSpot} />
      {/* Keyed, so a switch mounts the screen afresh, as a first open does. */}
      <SpotScreen key={spot.id} spot={spot} />
    </main>
  )
}
