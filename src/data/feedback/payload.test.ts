import { describe, expect, test } from 'vitest'
import { buildFeedbackPayload, validateFeedbackInput } from './payload.ts'

const base = { projectId: 'tideline', type: 'bug' as const, body: 'hello' }

describe('validateFeedbackInput', () => {
  test('a blank body fails on body', () => {
    const r = validateFeedbackInput({ ...base, body: '   ' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.field).toBe('body')
  })

  test('5,001 characters fail on body and 5,000 pass', () => {
    const over = validateFeedbackInput({ ...base, body: 'x'.repeat(5001) })
    expect(over.ok).toBe(false)
    if (!over.ok) expect(over.field).toBe('body')
    expect(validateFeedbackInput({ ...base, body: 'x'.repeat(5000) })).toEqual({
      ok: true,
    })
  })

  test('a bad email fails on submitterEmail; empty and blank pass', () => {
    const r = validateFeedbackInput({ ...base, submitterEmail: 'nope' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.field).toBe('submitterEmail')
    expect(validateFeedbackInput({ ...base, submitterEmail: '' })).toEqual({
      ok: true,
    })
    expect(validateFeedbackInput({ ...base, submitterEmail: '  ' })).toEqual({
      ok: true,
    })
  })
})

describe('buildFeedbackPayload', () => {
  const ctx = {
    pageUrl: 'https://tideline.ibuild4you.com/?name=X&at=1,2',
    userAgent: 'UA',
    viewport: '390x844',
    renderedAt: 1000,
  }

  test('trims, lowercases the email and keeps the query in the page URL', () => {
    const payload = buildFeedbackPayload(
      {
        projectId: ' tideline ',
        type: 'idea',
        body: '  hi  ',
        submitterEmail: ' A@B.co ',
      },
      ctx,
    )
    expect(payload).toEqual({
      projectId: 'tideline',
      type: 'idea',
      body: 'hi',
      submitterEmail: 'a@b.co',
      pageUrl: 'https://tideline.ibuild4you.com/?name=X&at=1,2',
      userAgent: 'UA',
      viewport: '390x844',
      website: '',
      _ts: 1000,
    })
  })

  test('an empty email leaves no submitterEmail key', () => {
    const payload = buildFeedbackPayload({ ...base, submitterEmail: '' }, ctx)
    expect('submitterEmail' in payload).toBe(false)
  })

  test('a capture is carried', () => {
    const capture = {
      v: 1 as const,
      route: '/',
      title: 'Tideline',
      outline: 'h1: Tideline',
    }
    expect(buildFeedbackPayload(base, ctx, capture).capture).toEqual(capture)
  })
})
