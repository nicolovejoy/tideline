import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  forgetSavedSpot,
  readSpan,
  readSpot,
  writeSpan,
  writeSpot,
} from './choices.ts'
import { CAMPUS_POINT, SPOTS, spotById } from '../spot.ts'

const GAVIOTA = spotById('gaviota')

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
    expect(readSpot(SPOTS)).toBe(CAMPUS_POINT)
  })

  test('is remembered once chosen', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    writeSpot(GAVIOTA)
    expect(readSpot(SPOTS)).toBe(GAVIOTA)
  })

  test('a remembered id that is no longer a spot means Campus Point', () => {
    vi.stubGlobal('localStorage', fakeStorage({ 'tideline:spot': 'gone' }))
    expect(readSpot(SPOTS)).toBe(CAMPUS_POINT)
  })

  test('with storage disabled it is Campus Point, and choosing does not throw', () => {
    vi.stubGlobal('localStorage', brokenStorage())
    expect(readSpot(SPOTS)).toBe(CAMPUS_POINT)
    expect(() => writeSpot(GAVIOTA)).not.toThrow()
  })

  test('with no localStorage at all, the same', () => {
    expect(readSpot(SPOTS)).toBe(CAMPUS_POINT)
    expect(() => writeSpot(GAVIOTA)).not.toThrow()
  })
})

describe('with saved spots', () => {
  afterEach(() => vi.unstubAllGlobals())
  const saved = { ...CAMPUS_POINT, id: 'spot-abc', name: 'Leadbetter Beach' }

  test('readSpot finds a saved spot in the list it is given', () => {
    vi.stubGlobal('localStorage', fakeStorage({ 'tideline:spot': 'spot-abc' }))
    expect(readSpot([...SPOTS, saved])).toBe(saved)
    expect(readSpot(SPOTS)).toBe(CAMPUS_POINT)
  })

  test('forgetSavedSpot drops the spot and its cache', () => {
    const storage = fakeStorage({
      'tideline:spots:v1': JSON.stringify([saved]),
      'tideline:v3:spot-abc:forecast': '{}',
      'tideline:spot': 'spot-abc',
    })
    vi.stubGlobal('localStorage', storage)
    forgetSavedSpot(saved)
    expect(storage.getItem('tideline:spots:v1')).toBe('[]')
    expect(storage.getItem('tideline:v3:spot-abc:forecast')).toBeNull()
  })
})

describe('the span', () => {
  test('choosing the spot already chosen keeps the span', () => {
    vi.stubGlobal('localStorage', fakeStorage({ 'tideline:spot': GAVIOTA.id }))
    vi.stubGlobal('sessionStorage', fakeStorage({ 'tideline:span': 'week' }))
    writeSpot(GAVIOTA)
    expect(readSpan()).toBe('week')
  })

  test('is a day until one is chosen', () => {
    vi.stubGlobal('sessionStorage', fakeStorage())
    expect(readSpan()).toBe('day')
  })

  test('is kept for the session, not on the device', () => {
    const session = fakeStorage()
    const device = fakeStorage()
    vi.stubGlobal('sessionStorage', session)
    vi.stubGlobal('localStorage', device)
    writeSpan('week')
    expect(readSpan()).toBe('week')
    expect(session.getItem('tideline:span')).toBe('week')
    expect(device.getItem('tideline:span')).toBeNull()
  })

  test('a value that is not a choice is a day', () => {
    vi.stubGlobal('sessionStorage', fakeStorage({ 'tideline:span': 'month' }))
    expect(readSpan()).toBe('day')
  })

  test('is a day with storage disabled, and writing does not throw', () => {
    vi.stubGlobal('sessionStorage', brokenStorage())
    expect(readSpan()).toBe('day')
    expect(() => writeSpan('days3')).not.toThrow()
  })

  test('choosing a spot starts it on a day', () => {
    vi.stubGlobal('sessionStorage', fakeStorage({ 'tideline:span': 'week' }))
    vi.stubGlobal('localStorage', fakeStorage())
    writeSpot(GAVIOTA)
    expect(readSpan()).toBe('day')
  })
})
