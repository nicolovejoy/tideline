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
    key: () => null,
    get length() {
      return items.size
    },
  }
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
  test('with storage disabled there is nothing saved and adding does not throw', () => {
    vi.stubGlobal('localStorage', brokenStorage())
    expect(readSavedSpots()).toEqual([])
    expect(() => addSpot(LEADBETTER)).not.toThrow()
    expect(() => removeSpot('spot-abc')).not.toThrow()
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
    expect(isSpot({ ...LEADBETTER, tidesShown: 'yes' })).toBe(false)
    expect(isSpot(null)).toBe(false)
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
