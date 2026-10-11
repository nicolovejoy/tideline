import { describe, expect, test, vi } from 'vitest'
import { createViewStore, entryFor, viewOf } from './viewHistory.ts'
import type { Pages } from './viewHistory.ts'

interface Entry {
  state: unknown
  url: string
}

/**
 * A stand-in for the browser's history: a list of entries and a place in
 * it. As in a browser, `back()` only asks. `land()` is the browser getting
 * there, and gives the state it lands on, which `popstate` would carry.
 */
function fakeBrowser(entries: Entry[] = [{ state: null, url: '/' }]) {
  let at = entries.length - 1
  let backs = 0
  const pages: Pages = {
    get state() {
      return entries[at].state
    },
    pushState(state) {
      entries.splice(at + 1, Infinity, { state, url: entries[at].url })
      at += 1
    },
    replaceState(state, _unused, url) {
      entries[at] = { state, url: url ?? entries[at].url }
    },
    back() {
      backs += 1
    },
  }
  return {
    pages,
    entries,
    backs: () => backs,
    land(): unknown {
      at -= 1
      return entries[at].state
    },
    forward(): unknown {
      at += 1
      return entries[at].state
    },
  }
}

describe('viewOf', () => {
  test("a view's entry", () => {
    expect(viewOf(entryFor('month'))).toBe('month')
    expect(viewOf(entryFor('add'))).toBe('add')
    expect(viewOf({ tidelineView: 'month', other: 1 })).toBe('month')
  })

  test.each([
    [null],
    [undefined],
    ['month'],
    [7],
    [[]],
    [{}],
    [{ tidelineView: 'week' }],
    [{ tidelineView: null }],
    [{ view: 'month' }],
  ])('%j is the forecast', (state) => {
    expect(viewOf(state)).toBeNull()
  })
})

describe('opening a view', () => {
  test('starts on the forecast', () => {
    const { pages } = fakeBrowser()
    expect(createViewStore(pages).current()).toBeNull()
  })

  test('adds one entry, at the address the page has, and shows the view', () => {
    const browser = fakeBrowser([{ state: null, url: '/?name=A&at=1,2' }])
    const store = createViewStore(browser.pages)
    const listener = vi.fn()
    store.subscribe(listener)

    store.open('month')

    expect(store.current()).toBe('month')
    expect(browser.entries).toEqual([
      { state: null, url: '/?name=A&at=1,2' },
      { state: { tidelineView: 'month' }, url: '/?name=A&at=1,2' },
    ])
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('the view already up adds nothing', () => {
    const browser = fakeBrowser()
    const store = createViewStore(browser.pages)
    store.open('month')
    const listener = vi.fn()
    store.subscribe(listener)

    store.open('month')

    expect(browser.entries).toHaveLength(2)
    expect(listener).not.toHaveBeenCalled()
  })

  test("another view takes the first one's entry", () => {
    const browser = fakeBrowser()
    const store = createViewStore(browser.pages)
    store.open('month')

    store.open('add')

    expect(store.current()).toBe('add')
    expect(browser.entries).toEqual([
      { state: null, url: '/' },
      { state: { tidelineView: 'add' }, url: '/' },
    ])
  })
})

describe('closing a view', () => {
  test('shows the forecast at once and asks the browser to go back, once', () => {
    const browser = fakeBrowser()
    const store = createViewStore(browser.pages)
    store.open('month')
    const listener = vi.fn()
    store.subscribe(listener)

    store.close()

    // Before the browser has gone anywhere.
    expect(store.current()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(browser.backs()).toBe(1)

    store.arrived(browser.land())

    expect(store.current()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(browser.pages.state).toBeNull()
  })

  test('with nothing open does not go back', () => {
    const browser = fakeBrowser()
    const store = createViewStore(browser.pages)
    store.close()
    expect(browser.backs()).toBe(0)
  })

  test('twice goes back once', () => {
    const browser = fakeBrowser()
    const store = createViewStore(browser.pages)
    store.open('add')
    store.close()
    store.close()
    expect(browser.backs()).toBe(1)
  })

  test("does not go back from an entry that is not a view's", () => {
    const browser = fakeBrowser()
    const store = createViewStore(browser.pages)
    store.open('month')
    // Something else has rewritten the entry on top.
    browser.pages.replaceState(null, '')

    store.close()

    expect(store.current()).toBeNull()
    expect(browser.backs()).toBe(0)
  })
})

describe('the browser going back and forward', () => {
  test('back from a view shows the forecast', () => {
    const browser = fakeBrowser()
    const store = createViewStore(browser.pages)
    store.open('month')
    const listener = vi.fn()
    store.subscribe(listener)

    store.arrived(browser.land())

    expect(store.current()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)
    // The browser went back by itself. The store asks for nothing more.
    expect(browser.backs()).toBe(0)
  })

  test('forward opens the view again', () => {
    const browser = fakeBrowser()
    const store = createViewStore(browser.pages)
    store.open('month')
    store.close()
    store.arrived(browser.land())

    store.arrived(browser.forward())

    expect(store.current()).toBe('month')
  })

  test('a listener that has stopped is not called', () => {
    const browser = fakeBrowser()
    const store = createViewStore(browser.pages)
    const listener = vi.fn()
    const stop = store.subscribe(listener)
    stop()
    store.open('month')
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('a reload', () => {
  test("on a view's entry opens that view, and back still shows the forecast", () => {
    const browser = fakeBrowser([
      { state: null, url: '/' },
      { state: entryFor('month'), url: '/' },
    ])
    const store = createViewStore(browser.pages)
    expect(store.current()).toBe('month')

    store.close()
    expect(browser.backs()).toBe(1)
    store.arrived(browser.land())

    expect(store.current()).toBeNull()
    expect(browser.pages.state).toBeNull()
  })
})

describe('opening while the browser is still going back', () => {
  test('waits for it to arrive, then adds its one entry', () => {
    const browser = fakeBrowser()
    const store = createViewStore(browser.pages)
    store.open('month')
    store.close()

    store.open('add')

    // Not yet: the entry on top is still the month view's, on its way out.
    expect(store.current()).toBeNull()
    expect(browser.entries).toHaveLength(2)

    store.arrived(browser.land())

    expect(store.current()).toBe('add')
    expect(browser.entries).toEqual([
      { state: null, url: '/' },
      { state: { tidelineView: 'add' }, url: '/' },
    ])
  })
})

describe('clearing the address', () => {
  test('on the forecast, rewrites the entry and keeps its state', () => {
    const browser = fakeBrowser([{ state: null, url: '/?name=A&at=1,2' }])
    const store = createViewStore(browser.pages)

    store.clearAddress('/')

    expect(browser.entries).toEqual([{ state: null, url: '/' }])
  })

  test('as a view is left, cleans the entry underneath as well', () => {
    const browser = fakeBrowser([{ state: null, url: '/?name=A&at=1,2' }])
    const store = createViewStore(browser.pages)
    store.open('month')
    store.close()

    store.clearAddress('/')

    // The view's entry, still on top until the browser has gone back.
    expect(browser.entries[1]).toEqual({
      state: { tidelineView: 'month' },
      url: '/',
    })
    expect(browser.entries[0].url).toBe('/?name=A&at=1,2')

    store.arrived(browser.land())

    expect(browser.entries[0]).toEqual({ state: null, url: '/' })
    expect(store.current()).toBeNull()
  })

  test('cleans the entry underneath once only', () => {
    const browser = fakeBrowser([{ state: null, url: '/?name=A&at=1,2' }])
    const store = createViewStore(browser.pages)
    store.open('month')
    store.close()
    store.clearAddress('/')
    store.arrived(browser.land())

    // A later address is left alone when the browser next goes anywhere.
    browser.pages.replaceState(null, '', '/?name=B&at=3,4')
    store.arrived(browser.forward())
    store.arrived(browser.land())

    expect(browser.entries[0].url).toBe('/?name=B&at=3,4')
  })
})
