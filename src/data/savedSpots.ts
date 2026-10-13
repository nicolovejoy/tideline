// The spots the user added, saved on the device as whole Spot objects under
// one key. Every access is wrapped, as the cache's are, so a browser with
// storage disabled still works. Each entry is checked on read: a damaged
// one, or one from another build, is dropped rather than break every open.

import type { Spot, Station } from '../spot.ts'
import { evictCache } from './cache.ts'

export const SAVED_KEY = 'tideline:spots:v1'

function isStation(value: unknown): value is Station {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    typeof s.distanceMi === 'number' &&
    typeof s.direction === 'string' &&
    (s.type === 'harmonic' || s.type === 'subordinate')
  )
}

export function isSpot(value: unknown): value is Spot {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  const nws = s.nws as Record<string, unknown> | null | undefined
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    typeof s.lat === 'number' &&
    typeof s.lon === 'number' &&
    typeof s.timeZone === 'string' &&
    (s.elevationFt === null || typeof s.elevationFt === 'number') &&
    typeof nws === 'object' &&
    nws !== null &&
    typeof nws.office === 'string' &&
    typeof nws.gridX === 'number' &&
    typeof nws.gridY === 'number' &&
    typeof nws.elevationFt === 'number' &&
    isStation(s.tideStation) &&
    isStation(s.gauge)
  )
}

export function readSavedSpots(): Spot[] {
  try {
    const text = localStorage.getItem(SAVED_KEY)
    if (text === null) return []
    const list: unknown = JSON.parse(text)
    if (!Array.isArray(list)) return []
    return list.filter(isSpot)
  } catch {
    return []
  }
}

/**
 * Writes the list and says whether it went in. The list matters more than
 * any cached data, so when a write fails the whole cache goes to make room
 * and the write is tried once more. False means storage is disabled or too
 * full even so: the spot lasts the session and is gone on the next open.
 */
function writeSavedSpots(spots: Spot[]): boolean {
  const text = JSON.stringify(spots)
  try {
    localStorage.setItem(SAVED_KEY, text)
    return true
  } catch {
    evictCache()
    try {
      localStorage.setItem(SAVED_KEY, text)
      return true
    } catch {
      return false
    }
  }
}

/** Keeps the spot on the device; false when it could not be kept. */
export function addSpot(spot: Spot): boolean {
  return writeSavedSpots([...readSavedSpots(), spot])
}

export function removeSpot(id: string): void {
  writeSavedSpots(readSavedSpots().filter((spot) => spot.id !== id))
}

/**
 * Puts `next` where the spot with `id` stands, so an edit keeps its place
 * in the row; its own id may differ, as a moved spot's does. An id not in
 * the list adds the spot at the end: a spot that could not be kept is in
 * the row but not here, and an edit is another try at keeping it. Says
 * whether the list went in, as `addSpot` does.
 */
export function replaceSpot(id: string, next: Spot): boolean {
  const spots = readSavedSpots()
  const at = spots.findIndex((spot) => spot.id === id)
  if (at === -1) return writeSavedSpots([...spots, next])
  return writeSavedSpots(spots.map((spot, i) => (i === at ? next : spot)))
}

/** An id no hard-coded spot has, from the time it was made. */
export function newSpotId(now: number = Date.now()): string {
  return `spot-${now.toString(36)}`
}
