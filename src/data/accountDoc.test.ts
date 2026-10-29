import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  ACCOUNT_KEY,
  addChange,
  clearCombined,
  combine,
  readCombined,
  removeChange,
  replaceChange,
  sameSpot,
  toDoc,
  toList,
  writeCombined,
} from './accountDoc.ts'
import { SPOTS } from '../spot.ts'
import type { Spot } from '../spot.ts'

const CAMPUS = SPOTS[0]

function spot(id: string, lat: number, lon: number): Spot {
  return { ...CAMPUS, id, name: `Spot ${id}`, lat, lon }
}

const A = spot('a', 34.1, -119.1)
const B = spot('b', 34.2, -119.2)
const C = spot('c', 34.3, -119.3)

function fakeStorage(): Storage {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    clear: () => items.clear(),
    key: (index: number) => [...items.keys()][index] ?? null,
    get length() {
      return items.size
    },
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('accountDoc', () => {
  test('sameSpot by id or by point to four decimals', () => {
    expect(sameSpot(A, { ...B, id: 'a' })).toBe(true)
    expect(
      sameSpot({ ...A, lat: 34.40621 }, { ...B, lat: 34.40624, lon: A.lon }),
    ).toBe(true)
    expect(
      sameSpot({ ...A, lat: 34.4062 }, { ...B, lat: 34.4063, lon: A.lon }),
    ).toBe(false)
  })

  test("combine keeps the account first and adds the device's others", () => {
    expect(combine([A], [B, A])).toEqual([A, B])
  })

  test('combine does not add a starting spot from the device', () => {
    expect(combine([A], [CAMPUS, B])).toEqual([A, B])
  })

  test('toDoc and toList round-trip in order', () => {
    expect(toList(toDoc([B, A]))).toEqual([B, A])
  })

  test('toList is null with no document or no spots', () => {
    expect(toList(null)).toBeNull()
    expect(toList({})).toBeNull()
    expect(toList({ updatedAt: 1 })).toBeNull()
  })

  test('tolerates order and spots disagreeing', () => {
    expect(toList({ spots: { a: A, c: C }, order: ['c', 'zzz'] })).toEqual([
      C,
      A,
    ])
  })

  test('reads a list-shaped document', () => {
    expect(toList({ spots: [A, 7, B] })).toEqual([A, B])
  })

  test('drops undefined fields', () => {
    const doc = toDoc([{ ...A, elevationFt: undefined } as unknown as Spot])
    expect('elevationFt' in doc.spots[A.id]).toBe(false)
  })

  test('addChange', () => {
    expect(addChange([A], B)).toEqual({
      set: { [B.id]: B },
      remove: [],
      order: [A.id, B.id],
    })
  })

  test('replaceChange renames in place', () => {
    expect(replaceChange([A, B], A.id, { ...A, name: 'x' })).toEqual({
      set: { [A.id]: { ...A, name: 'x' } },
      remove: [],
      order: [A.id, B.id],
    })
  })

  test('replaceChange moves under a new id in place', () => {
    expect(replaceChange([A, B], A.id, C)).toEqual({
      set: { [C.id]: C },
      remove: [A.id],
      order: [C.id, B.id],
    })
  })

  test('replaceChange of an absent id adds at the end', () => {
    expect(replaceChange([A], 'zzz', B)).toEqual({
      set: { [B.id]: B },
      remove: ['zzz'],
      order: [A.id, B.id],
    })
  })

  test('removeChange', () => {
    expect(removeChange([A, B], A.id)).toEqual({
      set: {},
      remove: [A.id],
      order: [B.id],
    })
  })

  test('the mark is read, written and cleared', () => {
    const storage = fakeStorage()
    vi.stubGlobal('localStorage', storage)
    expect(readCombined()).toBeNull()
    writeCombined('u1')
    expect(storage.getItem(ACCOUNT_KEY)).toBe('u1')
    expect(readCombined()).toBe('u1')
    clearCombined()
    expect(readCombined()).toBeNull()
  })
})
