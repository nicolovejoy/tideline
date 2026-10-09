import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  readSpot,
  readTidesShown,
  writeSpot,
  writeTidesShown,
} from './choices.ts'
import { CAMPUS_POINT, spotById } from '../spot.ts'

const GAVIOTA = spotById('gaviota')
const LA_CUMBRE = spotById('la-cumbre-peak')

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

describe('the spot', () => {
  test('is Campus Point until one is chosen', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    expect(readSpot()).toBe(CAMPUS_POINT)
  })

  test('is remembered once chosen', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    writeSpot(GAVIOTA)
    expect(readSpot()).toBe(GAVIOTA)
  })

  test('a remembered id that is no longer a spot means Campus Point', () => {
    vi.stubGlobal('localStorage', fakeStorage({ 'tideline:spot': 'gone' }))
    expect(readSpot()).toBe(CAMPUS_POINT)
  })

  test('with storage disabled it is Campus Point, and choosing does not throw', () => {
    vi.stubGlobal('localStorage', brokenStorage())
    expect(readSpot()).toBe(CAMPUS_POINT)
    expect(() => writeSpot(GAVIOTA)).not.toThrow()
  })
})

describe('whether tides are shown', () => {
  test("is the spot's own default until the user says otherwise", () => {
    vi.stubGlobal('localStorage', fakeStorage())
    expect(readTidesShown(CAMPUS_POINT)).toBe(true)
    expect(readTidesShown(LA_CUMBRE)).toBe(false)
  })

  test('is remembered per spot', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    writeTidesShown(LA_CUMBRE, true)
    expect(readTidesShown(LA_CUMBRE)).toBe(true)
    expect(readTidesShown(CAMPUS_POINT)).toBe(true)
    writeTidesShown(CAMPUS_POINT, false)
    expect(readTidesShown(CAMPUS_POINT)).toBe(false)
    expect(readTidesShown(LA_CUMBRE)).toBe(true)
  })

  test('a saved value that is neither word means the default', () => {
    vi.stubGlobal(
      'localStorage',
      fakeStorage({ 'tideline:tides:la-cumbre-peak': 'maybe' }),
    )
    expect(readTidesShown(LA_CUMBRE)).toBe(false)
  })

  test('with storage disabled it is the default, and choosing does not throw', () => {
    vi.stubGlobal('localStorage', brokenStorage())
    expect(readTidesShown(LA_CUMBRE)).toBe(false)
    expect(() => writeTidesShown(LA_CUMBRE, true)).not.toThrow()
  })

  test('with no localStorage at all, the same', () => {
    expect(readSpot()).toBe(CAMPUS_POINT)
    expect(readTidesShown(LA_CUMBRE)).toBe(false)
    expect(() => writeSpot(GAVIOTA)).not.toThrow()
  })
})
