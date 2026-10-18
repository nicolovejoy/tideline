// What the user chose last time, remembered on the device: which spot.
// The span of days the panels draw is a session choice: a reload keeps it,
// the next open starts on a day again, and choosing a spot resets it.
// Every access is wrapped, as the cache's are, so a browser with storage
// disabled still works.

import { forgetSpot } from '../data/cache.ts'
import { removeSpot } from '../data/savedSpots.ts'
import { spotById } from '../spot.ts'
import type { Spot } from '../spot.ts'
import { SPANS } from './spanView.ts'
import type { SpanChoice } from './spanView.ts'

const SPOT_KEY = 'tideline:spot'
const SPAN_KEY = 'tideline:span'

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

function sessionRead(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function sessionWrite(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // Storage is full or disabled. The choice is not kept; the app carries on.
  }
}

function sessionRemove(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // Storage is disabled. There is nothing to forget.
  }
}

/** The spot last chosen, from the list. Nothing chosen, or a spot since gone, is the first. */
export function readSpot(spots: Spot[]): Spot {
  return spotById(read(SPOT_KEY), spots)
}

/** Remember the spot chosen. Choosing a different one forgets the span; choosing the same one keeps it. */
export function writeSpot(spot: Spot): void {
  if (read(SPOT_KEY) !== spot.id) sessionRemove(SPAN_KEY)
  write(SPOT_KEY, spot.id)
}

/** The span chosen this session. None, or a value that is not a choice, is a day. */
export function readSpan(): SpanChoice {
  const stored = sessionRead(SPAN_KEY)
  return SPANS.find((span) => span.id === stored)?.id ?? 'day'
}

export function writeSpan(choice: SpanChoice): void {
  sessionWrite(SPAN_KEY, choice)
}

/** Drop a saved spot and everything remembered about it. */
export function forgetSavedSpot(spot: Spot): void {
  removeSpot(spot.id)
  forgetSpot(spot.id)
}
