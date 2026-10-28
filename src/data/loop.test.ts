import { describe, expect, it, vi } from 'vitest'
import { LOOP, sendFeedback } from './loop.ts'
import type { FeedbackPayload } from './feedback/payload.ts'

const PAYLOAD: FeedbackPayload = {
  projectId: 'tideline',
  type: 'idea',
  body: 'Show the swell.',
  pageUrl: 'https://tideline.ibuild4you.com/',
  userAgent: 'test',
  viewport: '390x844',
  website: '',
  _ts: 1_000,
}

function standIn(response: Response) {
  return vi.fn<typeof fetch>(() => Promise.resolve(response))
}

describe('sendFeedback', () => {
  it('posts once to Loop, as JSON, with a time limit', async () => {
    const fetchImpl = standIn(new Response('{"id":"x"}', { status: 201 }))
    await sendFeedback(PAYLOAD, fetchImpl)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(LOOP.endpoint)
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(init?.body).toBe(JSON.stringify(PAYLOAD))
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('counts a 201 as sent', async () => {
    const fetchImpl = standIn(new Response('{"id":"x"}', { status: 201 }))
    expect(await sendFeedback(PAYLOAD, fetchImpl)).toEqual({ kind: 'sent' })
  })

  it('counts the honeypot answer, a 200, as sent', async () => {
    const fetchImpl = standIn(new Response('{"ok":true}', { status: 200 }))
    expect(await sendFeedback(PAYLOAD, fetchImpl)).toEqual({ kind: 'sent' })
  })

  it('reads Retry-After in seconds from a 429', async () => {
    const fetchImpl = standIn(
      new Response('{}', { status: 429, headers: { 'Retry-After': '120' } }),
    )
    expect(await sendFeedback(PAYLOAD, fetchImpl)).toEqual({
      kind: 'refused',
      status: 429,
      retryAfter: 120,
    })
  })

  it.each([
    ['no header', undefined],
    ['text', 'abc'],
    ['a date', 'Wed, 21 Oct 2026 07:28:00 GMT'],
  ])('has no wait for a 429 with %s', async (_name, value) => {
    const headers: Record<string, string> = value
      ? { 'Retry-After': value }
      : {}
    const fetchImpl = standIn(new Response('{}', { status: 429, headers }))
    expect(await sendFeedback(PAYLOAD, fetchImpl)).toEqual({
      kind: 'refused',
      status: 429,
      retryAfter: null,
    })
  })

  it('reports an unknown project as refused', async () => {
    const fetchImpl = standIn(new Response('{}', { status: 404 }))
    expect(await sendFeedback(PAYLOAD, fetchImpl)).toEqual({
      kind: 'refused',
      status: 404,
      retryAfter: null,
    })
  })

  it('reports a server error as refused with its status', async () => {
    const fetchImpl = standIn(new Response('{}', { status: 500 }))
    expect(await sendFeedback(PAYLOAD, fetchImpl)).toEqual({
      kind: 'refused',
      status: 500,
      retryAfter: null,
    })
  })

  it('says unreachable when the request fails', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.reject(new TypeError('Failed to fetch')),
    )
    expect(await sendFeedback(PAYLOAD, fetchImpl)).toEqual({
      kind: 'unreachable',
    })
  })

  it('says unreachable when the request times out', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.reject(new DOMException('timed out', 'TimeoutError')),
    )
    expect(await sendFeedback(PAYLOAD, fetchImpl)).toEqual({
      kind: 'unreachable',
    })
  })
})
