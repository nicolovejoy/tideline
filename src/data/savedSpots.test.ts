import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  SAVED_KEY,
  addSpot,
  isSpot,
  newSpotId,
  readSavedSpots,
  removeSpot,
} from './savedSpots.ts'
import { CAMPUS_POINT } from '../spot.ts'
import type { Spot } from '../spot.ts'

const LEADBETTER: Spot = {
  ...CAMPUS_POINT,
  id: 'spot-abc',
  name: 'Leadbetter Beach',
  lat: 34.4027,
  lon: -119.7073,
  nws: { office: 'LOX', gridX: 105, gridY: 70, elevationFt: 157 },
}

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const items = new Map(Object.entries(initial))
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

/** A storage with room for `bytes` of values in all, as a full one behaves. */
function fullStorage(bytes: number, initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial))
  const used = () => [...items.values()].reduce((n, v) => n + v.length, 0)
  const storage: Storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      const without = used() - (items.get(key)?.length ?? 0)
      if (without + value.length > bytes) {
        throw new DOMException('full', 'QuotaExceededError')
      }
      items.set(key, value)
    },
    removeItem: (key: string) => void items.delete(key),
    clear: () => items.clear(),
    key: (index: number) => [...items.keys()][index] ?? null,
    get length() {
      return items.size
    },
  }
  return { storage, items }
}

function brokenStorage(): Storage {
  const fail = () => {
    throw new Error('storage is disabled')
  }
  return {
    getItem: fail,
    setItem: fail,
    removeItem: fail,
    clear: fail,
    key: fail,
    length: 0,
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('readSavedSpots', () => {
  test('nothing saved is an empty list', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    expect(readSavedSpots()).toEqual([])
  })
  test('what was added comes back, in order', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    addSpot(LEADBETTER)
    addSpot({ ...LEADBETTER, id: 'spot-def', name: 'Second' })
    expect(readSavedSpots().map((spot) => spot.name)).toEqual([
      'Leadbetter Beach',
      'Second',
    ])
  })
  test('a damaged entry is dropped and the rest kept', () => {
    const bad = { ...LEADBETTER, id: 'spot-bad', tideStation: { id: 'x' } }
    vi.stubGlobal(
      'localStorage',
      fakeStorage({ [SAVED_KEY]: JSON.stringify([bad, LEADBETTER]) }),
    )
    expect(readSavedSpots()).toEqual([LEADBETTER])
  })
  test('text that is not a list, or not JSON, is nothing saved', () => {
    vi.stubGlobal('localStorage', fakeStorage({ [SAVED_KEY]: '{"a":1}' }))
    expect(readSavedSpots()).toEqual([])
    vi.stubGlobal('localStorage', fakeStorage({ [SAVED_KEY]: 'not json' }))
    expect(readSavedSpots()).toEqual([])
  })
  test('with storage disabled there is nothing saved and adding says so', () => {
    vi.stubGlobal('localStorage', brokenStorage())
    expect(readSavedSpots()).toEqual([])
    expect(addSpot(LEADBETTER)).toBe(false)
    expect(() => removeSpot('spot-abc')).not.toThrow()
  })
})

describe('addSpot', () => {
  test('says the spot was kept', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    expect(addSpot(LEADBETTER)).toBe(true)
  })
  test('in a full storage, drops the cache to make room and keeps the spot', () => {
    const one = JSON.stringify([LEADBETTER]).length
    const { storage, items } = fullStorage(one + 100, {
      'tideline:v2:campus-point:predictions': 'x'.repeat(80),
      'tideline:v2:elsewhere:forecast': 'y'.repeat(80),
      'tideline:spot': 'campus-point',
    })
    vi.stubGlobal('localStorage', storage)
    expect(addSpot(LEADBETTER)).toBe(true)
    expect(readSavedSpots()).toEqual([LEADBETTER])
    expect([...items.keys()].sort()).toEqual(['tideline:spot', SAVED_KEY])
  })
  test('when there is no room even then, says the spot was not kept', () => {
    const { storage } = fullStorage(10)
    vi.stubGlobal('localStorage', storage)
    expect(addSpot(LEADBETTER)).toBe(false)
    expect(readSavedSpots()).toEqual([])
  })
})

describe('removeSpot', () => {
  test('drops that one and keeps the others', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    addSpot(LEADBETTER)
    addSpot({ ...LEADBETTER, id: 'spot-def', name: 'Second' })
    removeSpot('spot-abc')
    expect(readSavedSpots().map((spot) => spot.id)).toEqual(['spot-def'])
  })
})

describe('isSpot', () => {
  test('the hard-coded spots pass', () => {
    expect(isSpot(CAMPUS_POINT)).toBe(true)
  })
  test('a station without a type, or a missing field, fails', () => {
    const { type: _type, ...untyped } = LEADBETTER.gauge
    expect(isSpot({ ...LEADBETTER, gauge: untyped })).toBe(false)
    const { timeZone: _zone, ...noZone } = LEADBETTER
    expect(isSpot(noZone)).toBe(false)
    expect(isSpot(null)).toBe(false)
  })
  // Spots saved before 2026-10-10 carry tidesShown. It is no longer part
  // of a spot, and neither needed nor minded.
  test('a spot passes with or without the old tidesShown', () => {
    const { tidesShown: _old, ...bare } = { ...LEADBETTER, tidesShown: true }
    expect(isSpot(bare)).toBe(true)
    expect(isSpot({ ...bare, tidesShown: true })).toBe(true)
    expect(isSpot({ ...bare, tidesShown: 'yes' })).toBe(true)
  })
  test('elevationFt may be null or a number, nothing else', () => {
    expect(isSpot({ ...LEADBETTER, elevationFt: 3997 })).toBe(true)
    expect(isSpot({ ...LEADBETTER, elevationFt: '3997' })).toBe(false)
  })
})

describe('newSpotId', () => {
  test('is spot- and the time in base 36', () => {
    expect(newSpotId(1_760_000_000_000)).toBe(
      'spot-' + (1_760_000_000_000).toString(36),
    )
  })
})
