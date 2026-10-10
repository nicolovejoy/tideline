import type { Spot } from '../spot.ts'
import { WORDS } from './addSpotView.ts'

interface SpotSwitcherProps {
  spots: Spot[]
  current: Spot
  onSelect: (spot: Spot) => void
  onAdd: () => void
}

/** The spots, in a row, and a way to add one. The one on screen is marked. */
export function SpotSwitcher({
  spots,
  current,
  onSelect,
  onAdd,
}: SpotSwitcherProps) {
  return (
    <nav className="spots" aria-label="Spots">
      {spots.map((spot) => (
        <button
          key={spot.id}
          type="button"
          className="spot-choice"
          aria-pressed={spot.id === current.id}
          onClick={() => onSelect(spot)}
        >
          {spot.name}
        </button>
      ))}
      <button type="button" className="spot-choice spot-add" onClick={onAdd}>
        {WORDS.addSpot}
      </button>
    </nav>
  )
}
