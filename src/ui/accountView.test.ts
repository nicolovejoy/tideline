import { afterEach, describe, expect, test, vi } from 'vitest'
import { SdkUnavailable } from '../data/firebase.ts'
import {
  clearSeen,
  emailWords,
  failureWords,
  loadingWords,
  readSeen,
  startsSignedIn,
  warmsAtStart,
  writeSeen,
} from './accountView.ts'

describe('the words', () => {
  test('the email, or "Signed in" when there is none', () => {
    expect(emailWords('a@b.c')).toBe('a@b.c')
    expect(emailWords(null)).toBe('Signed in')
  })

  test('a tap that started the load says so; start-up does not', () => {
    expect(loadingWords(true)).toBe('Signing in…')
    expect(loadingWords(false)).toBe('…')
  })
})

describe('failureWords', () => {
  test('closing the window is not a failure', () => {
    expect(failureWords({ code: 'auth/popup-closed-by-user' }, true)).toBeNull()
    expect(
      failureWords({ code: 'auth/cancelled-popup-request' }, true),
    ).toBeNull()
  })

  test('the three known failures have their own sentences', () => {
    expect(failureWords({ code: 'auth/popup-blocked' }, true)).toBe(
      'The sign-in window was blocked. Allow pop-ups for this site and try again.',
    )
    expect(failureWords({ code: 'auth/network-request-failed' }, true)).toBe(
      'Could not reach Google. Check the connection and try again.',
    )
    expect(failureWords({ code: 'auth/unauthorized-domain' }, true)).toBe(
      'This address is not set up for sign-in.',
    )
  })

  test('any other code is named', () => {
    expect(failureWords({ code: 'auth/internal-error' }, true)).toBe(
      'Sign-in did not finish. Try again. (auth/internal-error)',
    )
  })

  test('an error with no code is not named', () => {
    expect(failureWords(new Error('boom'), true)).toBe(
      'Sign-in did not finish. Try again.',
    )
    expect(failureWords(undefined, true)).toBe(
      'Sign-in did not finish. Try again.',
    )
  })

  test('a sign-in code that could not load says to reload the page', () => {
    expect(failureWords(new SdkUnavailable(), true)).toBe(
      'Sign-in could not load. Reload the page, or close and reopen the app, and try again.',
    )
  })

  test('a sign-in code that could not load while offline names the network', () => {
    expect(failureWords(new SdkUnavailable(), false)).toBe(
      'Could not reach Google. Check the connection and try again.',
    )
  })
})

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

describe('the flag that says this device has signed in', () => {
  test('is unset, then set, then cleared', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    expect(readSeen()).toBe(false)
    writeSeen()
    expect(readSeen()).toBe(true)
    clearSeen()
    expect(readSeen()).toBe(false)
  })

  test('with storage disabled, reads false and writes do not throw', () => {
    vi.stubGlobal('localStorage', brokenStorage())
    expect(readSeen()).toBe(false)
    expect(() => writeSeen()).not.toThrow()
    expect(() => clearSeen()).not.toThrow()
  })

  test('with no localStorage at all, the same', () => {
    expect(readSeen()).toBe(false)
    expect(() => writeSeen()).not.toThrow()
    expect(() => clearSeen()).not.toThrow()
  })
})

describe('startsSignedIn', () => {
  test('loads the SDK at start-up only where the flag is set', () => {
    expect(startsSignedIn(true)).toBe(true)
    expect(startsSignedIn(false)).toBe(false)
  })
})

describe('warmsAtStart', () => {
  test('warms the SDK at start-up in a home-screen app that has not signed in', () => {
    expect(warmsAtStart(false, true)).toBe(true)
  })

  test('not where the flag is set, which loads it anyway, nor in a tab', () => {
    expect(warmsAtStart(true, true)).toBe(false)
    expect(warmsAtStart(false, false)).toBe(false)
    expect(warmsAtStart(true, false)).toBe(false)
  })
})
