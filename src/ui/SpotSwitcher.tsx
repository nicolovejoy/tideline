import type { Spot } from '../spot.ts'

interface SpotSwitcherProps {
  spots: Spot[]
  current: Spot
  onSelect: (spot: Spot) => void
}

/** The spots, in a row. The one on screen is marked. */
export function SpotSwitcher({ spots, current, onSelect }: SpotSwitcherProps) {
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
    </nav>
  )
}
