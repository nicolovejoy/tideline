// The account document's shape and the device's mark. A signed-in user's
// spots are one document: `spots` a map by id, `order` a list of ids. This
// module turns the document into a list and back, and turns each change into
// a merge write. Nothing here touches the network or the SDK.

import { SPOTS } from '../spot.ts'
import type { Spot } from '../spot.ts'
import { isSpot } from './savedSpots.ts'

export const ACCOUNT_KEY = 'tideline:spots:account:v2'

/** The uid the device last combined its spots with, or null. */
export function readCombined(): string | null {
  try {
    return localStorage.getItem(ACCOUNT_KEY)
  } catch {
    return null
  }
}

/** Notes that the device's spots have been combined with this account. */
export function writeCombined(uid: string): void {
  try {
    localStorage.setItem(ACCOUNT_KEY, uid)
  } catch {
    // Storage is off or full: the combine is done again next time.
  }
}

/** Forgets the mark. */
export function clearCombined(): void {
  try {
    localStorage.removeItem(ACCOUNT_KEY)
  } catch {
    // Nothing to clear.
  }
}

/** Whether two spots are the same: one id, or one point to four decimals. */
export function sameSpot(a: Spot, b: Spot): boolean {
  return (
    a.id === b.id ||
    (a.lat.toFixed(4) === b.lat.toFixed(4) &&
      a.lon.toFixed(4) === b.lon.toFixed(4))
  )
}

/** The account's spots in its order, then the device's that match none. */
export function combine(account: Spot[], device: Spot[]): Spot[] {
  const startingIds = new Set(SPOTS.map((s) => s.id))
  const out = [...account]
  for (const spot of device) {
    if (startingIds.has(spot.id)) continue
    if (out.some((s) => sameSpot(s, spot))) continue
    out.push(spot)
  }
  return out
}

export type AccountDoc = { spots: Record<string, Spot>; order: string[] }

/** A spot with its undefined fields gone, as the store needs it. */
function clean(spot: Spot): Spot {
  return JSON.parse(JSON.stringify(spot)) as Spot
}

/** The document for a list. */
export function toDoc(list: Spot[]): AccountDoc {
  const spots: Record<string, Spot> = {}
  for (const spot of list) spots[spot.id] = clean(spot)
  return { spots, order: list.map((s) => s.id) }
}

/** The list a document holds, or null when it is no document of spots. */
export function toList(data: unknown): Spot[] | null {
  if (typeof data !== 'object' || data === null) return null
  const { spots, order } = data as { spots?: unknown; order?: unknown }
  if (Array.isArray(spots)) return spots.filter(isSpot)
  if (typeof spots !== 'object' || spots === null) return null
  const map = spots as Record<string, unknown>
  const out: Spot[] = []
  const seen = new Set<string>()
  const ids = Array.isArray(order) ? order : []
  for (const id of ids) {
    if (typeof id !== 'string' || seen.has(id)) continue
    const spot = map[id]
    if (isSpot(spot)) {
      out.push(spot)
      seen.add(id)
    }
  }
  for (const [id, spot] of Object.entries(map)) {
    if (!seen.has(id) && isSpot(spot)) out.push(spot)
  }
  return out
}

/**
 * A change to the document. The adapter must write `set` as keys of a nested
 * object in a merge `setDoc` (or with `new FieldPath('spots', id)`), never as a
 * dotted string path such as `spots.${id}`, because an id can hold dots.
 */
export type SpotChange = {
  set: Record<string, Spot>
  remove: string[]
  order: string[]
}

/** The ids with each kept once, at its first place. */
function unique(ids: string[]): string[] {
  return [...new Set(ids)]
}

/** The change that adds a spot at the end. */
export function addChange(list: Spot[], spot: Spot): SpotChange {
  return {
    set: { [spot.id]: clean(spot) },
    remove: [],
    order: unique([...list.map((s) => s.id), spot.id]),
  }
}

/** The change that puts `next` in `id`'s place, under a new id if it has one. */
export function replaceChange(
  list: Spot[],
  id: string,
  next: Spot,
): SpotChange {
  const ids = list.map((s) => s.id)
  const at = ids.indexOf(id)
  const order =
    at === -1 ? [...ids, next.id] : ids.map((i) => (i === id ? next.id : i))
  return {
    set: { [next.id]: clean(next) },
    remove: next.id === id ? [] : [id],
    order: unique(order),
  }
}

/** The change that removes a spot. */
export function removeChange(list: Spot[], id: string): SpotChange {
  return {
    set: {},
    remove: [id],
    order: list.map((s) => s.id).filter((i) => i !== id),
  }
}

/** What the page needs of the account's store; the adapter in firebase.ts is the real one. */
export type SpotStore = {
  read(uid: string): Promise<unknown>
  write(uid: string, doc: AccountDoc): Promise<void>
  change(uid: string, change: SpotChange): Promise<void>
  watch(
    uid: string,
    onData: (data: unknown, pending: boolean) => void,
    onError: (error: unknown) => void,
  ): () => void
}

/**
 * The first sign-in on a device: puts the device's spots into the account,
 * the account's winning, and marks the device. False when the account could
 * not be read or written, with the mark left for the next try.
 */
export async function openAccount(
  uid: string,
  store: SpotStore,
  device: () => Spot[],
): Promise<boolean> {
  if (readCombined() === uid) return true
  try {
    const account = toList(await store.read(uid))
    const list =
      account === null || account.length === 0
        ? device()
        : combine(account, device())
    await store.write(uid, toDoc(list))
    writeCombined(uid)
    return true
  } catch {
    return false
  }
}
