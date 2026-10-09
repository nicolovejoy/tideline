import { describe, expect, test } from 'vitest'
import {
  SLOP,
  isSideways,
  isTap,
  pressCancel,
  pressDown,
  pressMove,
  pressUp,
} from './gesture.ts'

describe('isSideways', () => {
  test('a clear sideways movement is a drag', () => {
    expect(isSideways(20, 2)).toBe(true)
    expect(isSideways(-20, 2)).toBe(true)
  })

  test('a movement that is mostly up or down is not', () => {
    expect(isSideways(8, 30)).toBe(false)
    expect(isSideways(8, -30)).toBe(false)
  })

  test('nothing counts until the finger has travelled the slop distance', () => {
    expect(isSideways(SLOP - 1, 0)).toBe(false)
    expect(isSideways(SLOP, 0)).toBe(true)
  })

  test('an exact diagonal is treated as a scroll', () => {
    expect(isSideways(10, 10)).toBe(false)
  })
})

describe('isTap', () => {
  test('a finger that barely moved was a tap', () => {
    expect(isTap(0, 0)).toBe(true)
    expect(isTap(3, -3)).toBe(true)
  })

  test('a finger that moved the slop distance or more was not', () => {
    expect(isTap(SLOP, 0)).toBe(false)
    expect(isTap(5, 5)).toBe(false)
  })
})

describe('a press', () => {
  const at = (x: number, y: number, id = 1) => ({ id, x, y })
  // Stands in for whatever the page keeps to say where the cursor was put.
  const PICK = 'where it was'

  const finger = () => pressDown(null, at(100, 100), true, PICK).press!
  const dragged = () => pressMove(finger(), at(108, 100)).press!

  test('a mouse press moves the cursor at once', () => {
    const { press, act } = pressDown(null, at(100, 100), false, PICK)
    expect(act).toBe('move')
    expect(press).toMatchObject({ id: 1, dragging: true })
  })

  test('a finger going down moves nothing', () => {
    const { press, act } = pressDown(null, at(100, 100), true, PICK)
    expect(act).toBe('nothing')
    expect(press).toMatchObject({ id: 1, dragging: false })
  })

  test('a finger that travels sideways starts moving the cursor', () => {
    const { press, act } = pressMove(finger(), at(108, 101))
    expect(act).toBe('move')
    expect(press?.dragging).toBe(true)
  })

  test('once it is moving the cursor it keeps moving it, whichever way it goes', () => {
    expect(pressMove(dragged(), at(110, 160)).act).toBe('move')
  })

  test('a finger that travels up or down moves nothing', () => {
    const { press, act } = pressMove(finger(), at(102, 60))
    expect(act).toBe('nothing')
    expect(press?.dragging).toBe(false)
  })

  test('lifting a finger that barely moved is a tap', () => {
    expect(pressUp(finger(), at(101, 101))).toEqual({
      press: null,
      act: 'move',
    })
  })

  test('lifting a finger after a scroll moves nothing', () => {
    expect(pressUp(finger(), at(100, 30))).toEqual({
      press: null,
      act: 'nothing',
    })
  })

  test('lifting after a drag moves nothing more', () => {
    expect(pressUp(dragged(), at(180, 100))).toEqual({
      press: null,
      act: 'nothing',
    })
  })

  test('when the browser takes over a drag, the cursor goes back where it was', () => {
    expect(pressCancel(dragged(), 1)).toEqual({
      press: null,
      act: 'restore',
      pick: PICK,
    })
  })

  test('when the browser takes over a touch that moved nothing, there is nothing to put back', () => {
    expect(pressCancel(finger(), 1)).toEqual({ press: null, act: 'nothing' })
  })

  test('a second finger ends the press, and puts the cursor back if the first had moved it', () => {
    expect(pressDown(dragged(), at(200, 100, 2), true, 'later')).toEqual({
      press: null,
      act: 'restore',
      pick: PICK,
    })
    expect(pressDown(finger(), at(200, 100, 2), true, 'later')).toEqual({
      press: null,
      act: 'nothing',
    })
  })

  test('after a second finger, neither finger moves the cursor', () => {
    const { press } = pressDown(dragged(), at(200, 100, 2), true, 'later')
    expect(pressMove(press, at(150, 100, 1)).act).toBe('nothing')
    expect(pressMove(press, at(250, 100, 2)).act).toBe('nothing')
    expect(pressUp(press, at(150, 100, 1)).act).toBe('nothing')
    expect(pressUp(press, at(200, 100, 2)).act).toBe('nothing')
  })

  test("another pointer's events leave the press as it was", () => {
    const press = finger()
    expect(pressMove(press, at(300, 100, 2))).toEqual({ press, act: 'nothing' })
    expect(pressUp(press, at(100, 100, 2))).toEqual({ press, act: 'nothing' })
    expect(pressCancel(press, 2)).toEqual({ press, act: 'nothing' })
  })
})
