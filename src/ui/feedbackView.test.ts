import { describe, expect, test } from 'vitest'
import {
  backdropCloses,
  failureWords,
  initialEmail,
  invalidWords,
  showsEmailHint,
  TYPES,
  WORDS,
} from './feedbackView.ts'

describe('failureWords', () => {
  test('an unreachable service depends on the device being online', () => {
    expect(failureWords({ kind: 'unreachable' }, false)).toBe(
      'Could not reach the feedback service. Check the connection and try again.',
    )
    expect(failureWords({ kind: 'unreachable' }, true)).toBe(
      'Could not reach the feedback service. Try again in a moment.',
    )
  })

  test.each([
    [120, 'Too many notes from here. Try again in 2 minutes.'],
    [121, 'Too many notes from here. Try again in 3 minutes.'],
    [30, 'Too many notes from here. Try again in 1 minute.'],
    [60, 'Too many notes from here. Try again in 1 minute.'],
    [null, 'Too many notes from here. Try again later.'],
  ])('429 with Retry-After %j', (retryAfter, words) => {
    expect(
      failureWords({ kind: 'refused', status: 429, retryAfter }, true),
    ).toBe(words)
  })

  test('404, other refusals and sent', () => {
    expect(
      failureWords({ kind: 'refused', status: 404, retryAfter: null }, true),
    ).toBe('Feedback is not set up for Tideline yet.')
    for (const status of [400, 500]) {
      expect(
        failureWords({ kind: 'refused', status, retryAfter: null }, true),
      ).toBe('Could not send. Try again.')
    }
    expect(failureWords({ kind: 'sent' }, true)).toBeNull()
  })
})

describe('invalidWords', () => {
  test('each field has its sentence', () => {
    const bad = (
      field: 'projectId' | 'type' | 'body' | 'submitterEmail',
      body = '',
    ) => invalidWords({ ok: false, field, message: 'x' }, body)
    expect(bad('body')).toBe('Write a note first.')
    expect(bad('body', '   ')).toBe('Write a note first.')
    expect(bad('body', 'x'.repeat(5001))).toBe(
      'Keep the note under 5,000 characters.',
    )
    expect(bad('submitterEmail')).toBe('That email does not look right.')
    expect(bad('projectId')).toBe('Could not send. Try again.')
    expect(bad('type')).toBe('Could not send. Try again.')
    expect(invalidWords({ ok: true }, 'hi')).toBeNull()
  })
})

describe('initialEmail', () => {
  test('the signed-in address, or nothing', () => {
    expect(initialEmail({ kind: 'in', email: 'a@b.co' })).toBe('a@b.co')
    expect(initialEmail({ kind: 'in', email: null })).toBe('')
    expect(initialEmail({ kind: 'out' })).toBe('')
    expect(initialEmail({ kind: 'loading', tapped: false })).toBe('')
    expect(initialEmail({ kind: 'failed', words: 'x' })).toBe('')
  })
})

describe('showsEmailHint', () => {
  test('only where the account is known to be signed out', () => {
    expect(showsEmailHint({ kind: 'out' })).toBe(true)
    expect(showsEmailHint({ kind: 'failed', words: 'x' })).toBe(true)
    expect(showsEmailHint({ kind: 'loading', tapped: false })).toBe(false)
    expect(showsEmailHint({ kind: 'loading', tapped: true })).toBe(false)
    expect(showsEmailHint({ kind: 'in', email: 'a@b.co' })).toBe(false)
    expect(showsEmailHint({ kind: 'in', email: null })).toBe(false)
  })
})

describe('backdropCloses', () => {
  test('a tap behind the sheet closes it only while the note is empty', () => {
    expect(backdropCloses('')).toBe(true)
    expect(backdropCloses('  \n ')).toBe(true)
    expect(backdropCloses('a')).toBe(false)
    expect(backdropCloses('  half a note ')).toBe(false)
  })
})

describe('the words and the types', () => {
  test('types in order', () => {
    expect(TYPES.map((t) => t.value)).toEqual(['bug', 'idea', 'other'])
    expect(TYPES.map((t) => t.words)).toEqual(['Bug', 'Idea', 'Other'])
  })

  test('the sheet opens with a button and a title', () => {
    expect(WORDS.button).toBe('Feedback')
    expect(WORDS.title).toBe('Send feedback')
  })
})
