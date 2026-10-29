import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  SAVED_KEY,
  SEEDED_KEY,
  readSpots,
  addSpot,
  isSpot,
  newSpotId,
  readSavedSpots,
  removeSpot,
  replaceSavedSpots,
  replaceSpot,
} from './savedSpots.ts'
import { CAMPUS_POINT, SPOTS } from '../spot.ts'
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

describe('readSpots', () => {
  afterEach(() => vi.unstubAllGlobals())
  const ids = (spots: Spot[]) => spots.map((spot) => spot.id)
  const three = ['campus-point', 'gaviota', 'la-cumbre-peak']

  test('a new device gets the three starting spots, written and marked', () => {
    const storage = fakeStorage()
    vi.stubGlobal('localStorage', storage)
    expect(ids(readSpots())).toEqual(three)
    expect(ids(readSavedSpots())).toEqual(three)
    expect(storage.getItem(SEEDED_KEY)).not.toBeNull()
  })

  test('a device with spots saved before the seed keeps them after the three', () => {
    vi.stubGlobal(
      'localStorage',
      fakeStorage({ [SAVED_KEY]: JSON.stringify([LEADBETTER]) }),
    )
    expect(ids(readSpots())).toEqual([...three, 'spot-abc'])
  })

  test("once seeded, the list is the user's: a removed starting spot stays gone", () => {
    const storage = fakeStorage()
    vi.stubGlobal('localStorage', storage)
    readSpots()
    removeSpot('gaviota')
    replaceSpot('campus-point', { ...CAMPUS_POINT, name: 'The Point' })
    expect(readSpots().map((spot) => spot.name)).toEqual([
      'The Point',
      'La Cumbre Peak',
    ])
  })

  test('an empty list is seeded again, so there is always a spot', () => {
    vi.stubGlobal(
      'localStorage',
      fakeStorage({ [SEEDED_KEY]: '1', [SAVED_KEY]: '[]' }),
    )
    expect(ids(readSpots())).toEqual(three)
  })

  test('with storage disabled the three are the list, unsaved', () => {
    vi.stubGlobal('localStorage', brokenStorage())
    expect(readSpots()).toEqual(SPOTS)
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
      'tideline:v3:campus-point:predictions': 'x'.repeat(80),
      'tideline:v3:elsewhere:forecast': 'y'.repeat(80),
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

describe('replaceSpot', () => {
  const SECOND = { ...LEADBETTER, id: 'spot-def', name: 'Second' }
  const THIRD = { ...LEADBETTER, id: 'spot-ghi', name: 'Third' }

  test('a rename takes the place of the old spot, under the same id', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    addSpot(LEADBETTER)
    addSpot(SECOND)
    addSpot(THIRD)
    expect(replaceSpot('spot-def', { ...SECOND, name: 'Renamed' })).toBe(true)
    expect(readSavedSpots().map((spot) => spot.name)).toEqual([
      'Leadbetter Beach',
      'Renamed',
      'Third',
    ])
  })

  test('a move keeps the place in the row under the new id', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    addSpot(LEADBETTER)
    addSpot(SECOND)
    addSpot(THIRD)
    const moved = { ...SECOND, id: 'spot-new', lat: 34.41, lon: -119.71 }
    replaceSpot('spot-def', moved)
    expect(readSavedSpots().map((spot) => spot.id)).toEqual([
      'spot-abc',
      'spot-new',
      'spot-ghi',
    ])
    expect(readSavedSpots()[1]).toEqual(moved)
  })

  // A spot that could not be kept is in the row but not in storage. Editing
  // it is another try at keeping it, not a way to lose it.
  test('an id not in the list adds the spot at the end', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    addSpot(LEADBETTER)
    expect(replaceSpot('spot-gone', SECOND)).toBe(true)
    expect(readSavedSpots().map((spot) => spot.id)).toEqual([
      'spot-abc',
      'spot-def',
    ])
  })

  test('with storage disabled says the spot was not kept', () => {
    vi.stubGlobal('localStorage', brokenStorage())
    expect(replaceSpot('spot-abc', LEADBETTER)).toBe(false)
  })
})

describe('replaceSavedSpots', () => {
  test('writes the list in order and marks it seeded', () => {
    const storage = fakeStorage()
    vi.stubGlobal('localStorage', storage)
    const list = [LEADBETTER, { ...LEADBETTER, id: 'spot-def' }, SPOTS[0]]
    expect(replaceSavedSpots(list)).toBe(true)
    expect(readSavedSpots().map((spot) => spot.id)).toEqual([
      'spot-abc',
      'spot-def',
      'campus-point',
    ])
    expect(storage.getItem(SEEDED_KEY)).not.toBeNull()
  })

  test('says false when storage refuses', () => {
    vi.stubGlobal('localStorage', brokenStorage())
    expect(replaceSavedSpots([LEADBETTER])).toBe(false)
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
