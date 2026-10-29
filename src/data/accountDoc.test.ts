import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  ACCOUNT_KEY,
  addChange,
  clearCombined,
  combine,
  openAccount,
  readCombined,
  removeChange,
  replaceChange,
  sameSpot,
  toDoc,
  toList,
  writeCombined,
} from './accountDoc.ts'
import type { AccountDoc, SpotStore } from './accountDoc.ts'
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

  test('an id with a dot round-trips and is a key of set', () => {
    const D = spot('shared-34.4062,-119.8448', 34.4062, -119.8448)
    expect(toList(toDoc([D]))).toEqual([D])
    expect(Object.keys(addChange([], D).set)).toEqual([D.id])
  })

  test('toList skips non-spots and repeated ids in order', () => {
    expect(toList({ spots: { a: A, b: 7 }, order: ['a', 'a', 'b'] })).toEqual([
      A,
    ])
  })

  test('addChange of an id already in the list keeps one in order', () => {
    expect(addChange([A, B], A).order).toEqual([A.id, B.id])
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

function fakeStore(read: () => Promise<unknown>, failWrite = false) {
  const written: AccountDoc[] = []
  let reads = 0
  const store: SpotStore = {
    read: () => {
      reads += 1
      return read()
    },
    write: async (_uid, doc) => {
      if (failWrite) throw new Error('write failed')
      written.push(doc)
    },
    change: async () => {},
    watch: () => () => {},
  }
  return { store, written, reads: () => reads }
}

describe('openAccount', () => {
  test('openAccount with the mark set reads nothing', async () => {
    vi.stubGlobal('localStorage', fakeStorage())
    writeCombined('u1')
    const f = fakeStore(async () => null)
    expect(await openAccount('u1', f.store, () => [A])).toBe(true)
    expect(f.reads()).toBe(0)
    expect(f.written).toEqual([])
  })

  test('openAccount with no document writes the device list', async () => {
    vi.stubGlobal('localStorage', fakeStorage())
    const f = fakeStore(async () => undefined)
    expect(await openAccount('u1', f.store, () => [A, B])).toBe(true)
    expect(f.written[0]).toEqual(toDoc([A, B]))
    expect(readCombined()).toBe('u1')
  })

  test('openAccount combines with the account winning', async () => {
    vi.stubGlobal('localStorage', fakeStorage())
    const f = fakeStore(async () => toDoc([C]))
    expect(await openAccount('u1', f.store, () => [CAMPUS, A])).toBe(true)
    expect(f.written[0]).toEqual(toDoc([C, A]))
    expect(readCombined()).toBe('u1')
  })

  test('openAccount rewrites a list-shaped document as a map', async () => {
    vi.stubGlobal('localStorage', fakeStorage())
    const f = fakeStore(async () => ({ spots: [C] }))
    expect(await openAccount('u1', f.store, () => [])).toBe(true)
    expect(f.written[0].spots).toEqual({ [C.id]: C })
  })

  test('openAccount is false and leaves the mark when the read fails', async () => {
    vi.stubGlobal('localStorage', fakeStorage())
    const f = fakeStore(async () => {
      throw new Error('offline')
    })
    expect(await openAccount('u1', f.store, () => [A])).toBe(false)
    expect(readCombined()).toBeNull()
    expect(f.written).toEqual([])
  })

  test('openAccount is false and leaves the mark when the write fails', async () => {
    vi.stubGlobal('localStorage', fakeStorage())
    const f = fakeStore(async () => null, true)
    expect(await openAccount('u1', f.store, () => [A])).toBe(false)
    expect(readCombined()).toBeNull()
  })
})
