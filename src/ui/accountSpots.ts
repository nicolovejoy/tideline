// What the page takes from a snapshot of the account's document. An empty
// list is not drawn: the row always has a spot, so the screen keeps what it
// has until the account holds one.

import { toList } from '../data/accountDoc.ts'
import type { Spot } from '../spot.ts'

/** The snapshot's list, or null when there is none or it is empty. */
export function listFromSnapshot(data: unknown): Spot[] | null {
  const list = toList(data)
  return list === null || list.length === 0 ? null : list
}
