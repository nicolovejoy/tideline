import { describe, expect, test } from 'vitest'
import { DAY, HOUR } from '../time.ts'
import { panBy, pinchWindow, wheelWindow, zoomAbout } from './zoom.ts'

const T0 = Date.UTC(2026, 9, 29, 7)
const BOUNDS = { start: T0, end: T0 + 14 * DAY }
const DAY1 = { start: T0, end: T0 + DAY }

function near(
  got: { start: number; end: number },
  want: { start: number; end: number },
) {
  expect(got.start).toBeCloseTo(want.start, 0)
  expect(got.end).toBeCloseTo(want.end, 0)
}

describe('zoomAbout', () => {
  test('zooming in by 2 about noon halves the day about noon', () => {
    near(zoomAbout(DAY1, T0 + 12 * HOUR, 2, BOUNDS), {
      start: T0 + 6 * HOUR,
      end: T0 + 18 * HOUR,
    })
  })
  test('the instant zoomed about keeps its place in the window', () => {
    near(zoomAbout(DAY1, T0 + 6 * HOUR, 2, BOUNDS), {
      start: T0 + 3 * HOUR,
      end: T0 + 15 * HOUR,
    })
  })
  test('no shorter than 3 hours', () => {
    near(zoomAbout(DAY1, T0 + 12 * HOUR, 100, BOUNDS), {
      start: T0 + 10.5 * HOUR,
      end: T0 + 13.5 * HOUR,
    })
  })
  test('no longer than a week', () => {
    const week = { start: T0, end: T0 + 7 * DAY }
    near(zoomAbout(week, T0, 0.5, BOUNDS), week)
  })
  test('zooming out at the start of the 14 days stays inside them', () => {
    near(zoomAbout(DAY1, T0, 0.5, BOUNDS), { start: T0, end: T0 + 2 * DAY })
  })
  test('never longer than the bounds', () => {
    const short = { start: T0, end: T0 + 2 * DAY }
    near(zoomAbout(DAY1, T0, 0.1, short), short)
  })
})

describe('panBy', () => {
  test('panning back a day', () => {
    near(panBy({ start: T0 + 2 * DAY, end: T0 + 3 * DAY }, -DAY, BOUNDS), {
      start: T0 + DAY,
      end: T0 + 2 * DAY,
    })
  })
  test('panning stops at either end', () => {
    near(panBy(DAY1, -DAY, BOUNDS), DAY1)
    const last = { start: T0 + 13 * DAY, end: T0 + 14 * DAY }
    near(panBy(last, DAY, BOUNDS), last)
  })
})

// 240 px for a day: 10 px an hour.
describe('pinchWindow', () => {
  const day2 = { start: T0 + DAY, end: T0 + 2 * DAY }
  test('spreading two fingers puts the hours under them under them still', () => {
    near(pinchWindow(DAY1, 240, [60, 120], [0, 240], BOUNDS), {
      start: T0 + 6 * HOUR,
      end: T0 + 12 * HOUR,
    })
  })
  test('moving both fingers sideways pans', () => {
    near(pinchWindow(day2, 240, [60, 120], [80, 140], BOUNDS), {
      start: T0 + DAY - 2 * HOUR,
      end: T0 + 2 * DAY - 2 * HOUR,
    })
  })
  test('fingers that come together only pan, by their midpoint', () => {
    // From a midpoint of 90 px to 101 px: 1.1 hours earlier.
    near(pinchWindow(day2, 240, [60, 120], [100, 102], BOUNDS), {
      start: T0 + DAY - 1.1 * HOUR,
      end: T0 + 2 * DAY - 1.1 * HOUR,
    })
  })
  test('fingers that cross only pan', () => {
    near(pinchWindow(day2, 240, [60, 120], [130, 70], BOUNDS), {
      start: T0 + DAY - 1 * HOUR,
      end: T0 + 2 * DAY - 1 * HOUR,
    })
  })
})

describe('wheelWindow', () => {
  const wheel = (
    deltaX: number,
    deltaY: number,
    ctrlKey = false,
    deltaMode = 0,
  ) => ({ deltaX, deltaY, ctrlKey, deltaMode })

  test('a trackpad pinch zooms about the instant under the pointer', () => {
    const about = T0 + 12 * HOUR
    near(
      wheelWindow(
        DAY1,
        wheel(0, -100 * Math.log(2), true),
        400,
        about,
        BOUNDS,
      )!,
      zoomAbout(DAY1, about, 2, BOUNDS),
    )
  })

  test('a sideways swipe pans by the time under the distance', () => {
    const later = { start: T0 + DAY, end: T0 + 2 * DAY }
    near(wheelWindow(later, wheel(100, 10), 400, T0, BOUNDS)!, {
      start: T0 + DAY + 6 * HOUR,
      end: T0 + 2 * DAY + 6 * HOUR,
    })
  })

  test('a wheel counted in lines is counted as 16 pixels a line', () => {
    const later = { start: T0 + DAY, end: T0 + 2 * DAY }
    near(wheelWindow(later, wheel(-25 / 4, 0, false, 1), 400, T0, BOUNDS)!, {
      start: T0 + DAY - 6 * HOUR,
      end: T0 + 2 * DAY - 6 * HOUR,
    })
  })

  test('a wheel turning up or down is left to the page', () => {
    expect(wheelWindow(DAY1, wheel(5, 40), 400, T0, BOUNDS)).toBeNull()
    expect(wheelWindow(DAY1, wheel(0, 0), 400, T0, BOUNDS)).toBeNull()
  })

  test('nothing is worked out before the stack has a width', () => {
    expect(wheelWindow(DAY1, wheel(0, 50, true), 0, T0, BOUNDS)).toBeNull()
    expect(wheelWindow(DAY1, wheel(50, 0), 0, T0, BOUNDS)).toBeNull()
  })
})
