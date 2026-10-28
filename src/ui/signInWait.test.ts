import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { GIVE_UP_MS, signInWait } from './signInWait.ts'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('signInWait', () => {
  test('gives up once the clock has run, and only once', () => {
    const giveUp = vi.fn()
    signInWait(giveUp)
    vi.advanceTimersByTime(GIVE_UP_MS - 1)
    expect(giveUp).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(giveUp).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(GIVE_UP_MS * 3)
    expect(giveUp).toHaveBeenCalledTimes(1)
  })

  test('the time out of view does not count', () => {
    const giveUp = vi.fn()
    const wait = signInWait(giveUp)
    vi.advanceTimersByTime(GIVE_UP_MS - 1000)
    wait.hidden()
    vi.advanceTimersByTime(GIVE_UP_MS * 6)
    expect(giveUp).not.toHaveBeenCalled()
    wait.visible()
    vi.advanceTimersByTime(GIVE_UP_MS - 1)
    expect(giveUp).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(giveUp).toHaveBeenCalledTimes(1)
  })

  test('an answer stops it, out of view or in', () => {
    const giveUp = vi.fn()
    const wait = signInWait(giveUp)
    wait.hidden()
    wait.stop()
    wait.visible()
    vi.advanceTimersByTime(GIVE_UP_MS * 2)
    expect(giveUp).not.toHaveBeenCalled()
  })

  test('coming back after it gave up does not start it again', () => {
    const giveUp = vi.fn()
    const wait = signInWait(giveUp)
    vi.advanceTimersByTime(GIVE_UP_MS)
    wait.hidden()
    wait.visible()
    vi.advanceTimersByTime(GIVE_UP_MS * 2)
    expect(giveUp).toHaveBeenCalledTimes(1)
  })
})
