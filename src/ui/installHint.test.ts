import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  readDismissed,
  wantsInstallHint,
  writeDismissed,
} from './installHint.ts'
import type { BrowserEnv } from './installHint.ts'

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1'
const IPHONE_FIREFOX =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/143.0 Mobile/15E148 Safari/605.1.15'
// An app's web view: WebKit without the Safari token.
const IPHONE_WEBVIEW =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
// iPadOS presents itself as a Mac. Touch points are what give it away.
const IPAD_AS_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15'
const MAC_SAFARI = IPAD_AS_MAC
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'

function env(overrides: Partial<BrowserEnv>): BrowserEnv {
  return {
    userAgent: IPHONE_SAFARI,
    maxTouchPoints: 5,
    standalone: false,
    ...overrides,
  }
}

describe('wantsInstallHint', () => {
  test('iPhone Safari in the browser wants the hint', () => {
    expect(wantsInstallHint(env({}))).toBe(true)
  })

  test('already running from the home screen does not', () => {
    expect(wantsInstallHint(env({ standalone: true }))).toBe(false)
  })

  test('other browsers on the iPhone do not: their menus differ', () => {
    expect(wantsInstallHint(env({ userAgent: IPHONE_CHROME }))).toBe(false)
    expect(wantsInstallHint(env({ userAgent: IPHONE_FIREFOX }))).toBe(false)
  })

  test("an app's web view does not: it has no Share menu of its own", () => {
    expect(wantsInstallHint(env({ userAgent: IPHONE_WEBVIEW }))).toBe(false)
  })

  test('iPad Safari does, even though it calls itself a Mac', () => {
    expect(
      wantsInstallHint(env({ userAgent: IPAD_AS_MAC, maxTouchPoints: 5 })),
    ).toBe(true)
  })

  test('a Mac does not', () => {
    expect(
      wantsInstallHint(env({ userAgent: MAC_SAFARI, maxTouchPoints: 0 })),
    ).toBe(false)
  })

  test('Android does not', () => {
    expect(wantsInstallHint(env({ userAgent: ANDROID_CHROME }))).toBe(false)
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

describe('the remembered dismissal', () => {
  test('is not set until the hint is dismissed', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    expect(readDismissed()).toBe(false)
    writeDismissed()
    expect(readDismissed()).toBe(true)
  })

  test('with storage disabled, the hint shows and dismissing it does not throw', () => {
    vi.stubGlobal('localStorage', brokenStorage())
    expect(readDismissed()).toBe(false)
    expect(() => writeDismissed()).not.toThrow()
  })

  test('with no localStorage at all, the same', () => {
    expect(readDismissed()).toBe(false)
    expect(() => writeDismissed()).not.toThrow()
  })
})
