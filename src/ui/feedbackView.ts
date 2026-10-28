// Every word of the feedback sheet and the sentences for what can go wrong in
// sending a note. The component only arranges them.

import type {
  FeedbackType,
  ValidationResult,
} from '../data/feedback/payload.ts'
import type { SendResult } from '../data/loop.ts'
import type { Account } from './accountView.ts'

export const WORDS = {
  button: 'Feedback',
  title: 'Send feedback',
  close: 'Close',
  bodyLabel: 'What happened, or what would help',
  emailLabel: 'Email, if you would like an answer',
  emailHint: 'Signed in, this is filled in for you.',
  capture: 'Include an outline of this screen',
  captureMore: 'What is sent',
  address:
    "The page's address goes with it, and for a shared spot that is its name and place.",
  send: 'Send',
  sending: 'Sending…',
  sent: 'Sent. Thank you.',
  another: 'Send another',
} as const

export const TYPES: readonly { value: FeedbackType; words: string }[] = [
  { value: 'bug', words: 'Bug' },
  { value: 'idea', words: 'Idea' },
  { value: 'other', words: 'Other' },
]

const COULD_NOT_SEND = 'Could not send. Try again.'

/**
 * The sentence for a note that did not go, or null where it did. `online` is
 * the device's word on whether it has a network.
 */
export function failureWords(
  result: SendResult,
  online: boolean,
): string | null {
  if (result.kind === 'sent') return null
  if (result.kind === 'unreachable') {
    return online
      ? 'Could not reach the feedback service. Try again in a moment.'
      : 'Could not reach the feedback service. Check the connection and try again.'
  }
  if (result.status === 429) {
    if (result.retryAfter === null) {
      return 'Too many notes from here. Try again later.'
    }
    const minutes = Math.max(1, Math.ceil(result.retryAfter / 60))
    const unit = minutes === 1 ? 'minute' : 'minutes'
    return `Too many notes from here. Try again in ${minutes} ${unit}.`
  }
  if (result.status === 404) return 'Feedback is not set up for Tideline yet.'
  return COULD_NOT_SEND
}

/** The sentence for a note that cannot be sent as written, or null if it can. */
export function invalidWords(result: ValidationResult): string | null {
  if (result.ok) return null
  // The box caps the length, so a body is only ever empty here.
  if (result.field === 'body') return 'Write a note first.'
  if (result.field === 'submitterEmail')
    return 'That email does not look right.'
  return COULD_NOT_SEND
}

/** The email box starts as the signed-in address, and empty otherwise. */
export function initialEmail(account: Account): string {
  return account.kind === 'in' ? (account.email ?? '') : ''
}
