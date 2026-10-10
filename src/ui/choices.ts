// What the user chose last time, remembered on the device: which spot.
// Every access is wrapped, as the cache's are, so a browser with storage
// disabled still works.

import { forgetSpot } from '../data/cache.ts'
import { removeSpot } from '../data/savedSpots.ts'
import { SPOTS, spotById } from '../spot.ts'
import type { Spot } from '../spot.ts'

const SPOT_KEY = 'tideline:spot'

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

/** The spot last chosen, from the list. Nothing chosen, or a spot since gone, is the first. */
export function readSpot(spots: Spot[] = SPOTS): Spot {
  return spotById(read(SPOT_KEY), spots)
}

export function writeSpot(spot: Spot): void {
  write(SPOT_KEY, spot.id)
}

/** Drop a saved spot and everything remembered about it. */
export function forgetSavedSpot(spot: Spot): void {
  removeSpot(spot.id)
  forgetSpot(spot.id)
}
