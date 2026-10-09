// What the user chose last time, remembered on the device: which spot, and
// whether a spot's tide is shown. Every access is wrapped, as the cache's
// are, so a browser with storage disabled still works.

import { spotById } from '../spot.ts'
import type { Spot } from '../spot.ts'

const SPOT_KEY = 'tideline:spot'
const tidesKey = (spot: Spot) => `tideline:tides:${spot.id}`

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage is full or disabled. The choice is not kept; the app carries on.
  }
}

/** The spot last chosen. Nothing chosen, or a spot since gone, is the first. */
export function readSpot(): Spot {
  return spotById(read(SPOT_KEY))
}

export function writeSpot(spot: Spot): void {
  write(SPOT_KEY, spot.id)
}

/** Whether the spot's tide is shown: what the user said, else the default. */
export function readTidesShown(spot: Spot): boolean {
  switch (read(tidesKey(spot))) {
    case 'shown':
      return true
    case 'hidden':
      return false
    default:
      return spot.tidesShown
  }
}

export function writeTidesShown(spot: Spot, shown: boolean): void {
  write(tidesKey(spot), shown ? 'shown' : 'hidden')
}
