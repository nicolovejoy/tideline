// Loop is ibuild4you's feedback inbox: a note posted to its endpoint lands in
// the owner's queue under the project named here. No key, and it answers
// browsers from any origin. The wire contract (statuses, the honeypot, the
// Retry-After on a 429) is in ibuild4you's lib/feedback/README.md:
// https://github.com/nicolovejoy/ibuild4you/blob/main/lib/feedback/README.md
// One request per send, no retry. No React, no storage.

import type { FeedbackPayload } from './feedback/payload.ts'

export const LOOP = {
  endpoint: 'https://ibuild4you.com/api/feedback',
  projectId: 'tideline',
} as const

/** A slow connection is told so; past this the note is not sent. */
const TIMEOUT = 15_000

export type SendResult =
  | { kind: 'sent' }
  /** `retryAfter` is in seconds, and only when Loop gave it as a number. */
  | { kind: 'refused'; status: number; retryAfter: number | null }
  | { kind: 'unreachable' }

/** Seconds, from a header that is all digits. A date or text is no wait. */
function retryAfterSeconds(header: string | null): number | null {
  if (header === null || !/^\d+$/.test(header.trim())) return null
  return Number(header.trim())
}

/**
 * Posts the note. A 200 counts as sent: it is the answer to a tripped
 * honeypot, which a person cannot trip. A failed or timed-out request is
 * `unreachable`, which the caller treats as worth trying again.
 */
export async function sendFeedback(
  payload: FeedbackPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  let response: Response
  try {
    response = await fetchImpl(LOOP.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT),
    })
  } catch {
    return { kind: 'unreachable' }
  }
  if (response.status === 200 || response.status === 201) {
    return { kind: 'sent' }
  }
  return {
    kind: 'refused',
    status: response.status,
    retryAfter: retryAfterSeconds(response.headers.get('Retry-After')),
  }
}
