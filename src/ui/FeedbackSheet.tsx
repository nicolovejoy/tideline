import { useEffect, useRef, useState } from 'react'
import type { FormEvent, SyntheticEvent } from 'react'
import { buildPageCapture } from '../data/feedback/capture.ts'
import {
  MAX_FEEDBACK_BODY_CHARS,
  buildFeedbackPayload,
  validateFeedbackInput,
} from '../data/feedback/payload.ts'
import type { FeedbackType } from '../data/feedback/payload.ts'
import { LOOP, sendFeedback } from '../data/loop.ts'
import { TYPES, WORDS, failureWords, invalidWords } from './feedbackView.ts'

interface FeedbackSheetProps {
  /** The email the box starts with: the account's, or empty. */
  email: string
  onClose: () => void
}

type Status = 'idle' | 'sending' | 'sent'

/**
 * The sheet that sends a note to Loop, over the page. It opens and closes
 * as the help sheet does. A note that did not go stays in the box with the
 * sentence that says why; only a sent one is cleared. The sheet and its
 * backdrop leave themselves out of the outline. The words are in
 * `feedbackView.ts`.
 */
export function FeedbackSheet({ email, onClose }: FeedbackSheetProps) {
  const heading = useRef<HTMLHeadingElement>(null)
  const [type, setType] = useState<FeedbackType>('bug')
  const [body, setBody] = useState('')
  const [submitterEmail, setSubmitterEmail] = useState(email)
  // The hint is for a box that started empty, and stays whatever is typed.
  const [hinted] = useState(email === '')
  // The honeypot: a person never sees it, so it stays empty.
  const [website, setWebsite] = useState('')
  const [capture, setCapture] = useState(true)
  const [preview, setPreview] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [sentence, setSentence] = useState<string | null>(null)
  // When the note was begun: Loop refuses one sent under 2 seconds after.
  const renderedAt = useRef(0)
  // A second tap before the button is drawn disabled sends nothing.
  const sending = useRef(false)

  useEffect(() => {
    renderedAt.current = Date.now()
  }, [])

  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (sending.current) return
    const input = { projectId: LOOP.projectId, type, body, submitterEmail }
    const invalid = invalidWords(validateFeedbackInput(input))
    setSentence(invalid)
    if (invalid) return
    const payload = {
      ...buildFeedbackPayload(
        input,
        {
          pageUrl: window.location.href,
          userAgent: navigator.userAgent,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          renderedAt: renderedAt.current || Date.now(),
        },
        capture ? buildPageCapture(document, window.location) : null,
      ),
      // As typed, so a bot that fills the field is caught. The payload's
      // type says what a person sends, which is ''.
      website: website as '',
    }
    sending.current = true
    setStatus('sending')
    const failure = failureWords(await sendFeedback(payload), navigator.onLine)
    sending.current = false
    setSentence(failure)
    if (failure) {
      setStatus('idle')
      return
    }
    setBody('')
    setStatus('sent')
  }

  // The next note keeps its type and email, and is timed from now.
  const another = () => {
    renderedAt.current = Date.now()
    setStatus('idle')
  }

  const showOutline = (event: SyntheticEvent<HTMLDetailsElement>) => {
    if (!event.currentTarget.open) return
    const page = buildPageCapture(document, window.location)
    setPreview([page.route, page.title, page.outline].join('\n'))
  }

  return (
    <div className="sheet-backdrop" data-loop-redact="" onClick={onClose}>
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet-head">
          <h2 id="feedback-title" ref={heading} tabIndex={-1}>
            {WORDS.title}
          </h2>
          <button type="button" className="text-button" onClick={onClose}>
            {WORDS.close}
          </button>
        </header>
        {status === 'sent' ? (
          <div className="feedback-form">
            <p className="notice" role="status">
              {WORDS.sent}
            </p>
            <button type="button" className="text-button" onClick={another}>
              {WORDS.another}
            </button>
          </div>
        ) : (
          <form className="feedback-form" noValidate onSubmit={send}>
            <div className="span-row">
              {TYPES.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  aria-pressed={entry.value === type}
                  className="text-button span-choice"
                  onClick={() => setType(entry.value)}
                >
                  {entry.words}
                </button>
              ))}
            </div>
            <div className="field feedback-field">
              <label htmlFor="feedback-body">{WORDS.bodyLabel}</label>
              <textarea
                id="feedback-body"
                rows={5}
                maxLength={MAX_FEEDBACK_BODY_CHARS}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </div>
            <div className="field feedback-field">
              <label htmlFor="feedback-email">{WORDS.emailLabel}</label>
              <input
                id="feedback-email"
                type="email"
                autoComplete="email"
                value={submitterEmail}
                onChange={(event) => setSubmitterEmail(event.target.value)}
              />
              {hinted && <p className="caption">{WORDS.emailHint}</p>}
            </div>
            <input
              className="feedback-honeypot"
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
            <div>
              <div className="field">
                <input
                  id="feedback-capture"
                  type="checkbox"
                  checked={capture}
                  onChange={(event) => setCapture(event.target.checked)}
                />
                <label htmlFor="feedback-capture">{WORDS.capture}</label>
              </div>
              {capture && (
                <details className="feedback-more" onToggle={showOutline}>
                  <summary>{WORDS.captureMore}</summary>
                  <pre>{preview}</pre>
                </details>
              )}
            </div>
            <p className="caption">{WORDS.address}</p>
            {sentence && (
              <p className="notice" role="alert">
                {sentence}
              </p>
            )}
            <button
              type="submit"
              className="spot-choice feedback-send"
              disabled={status === 'sending'}
            >
              {status === 'sending' ? WORDS.sending : WORDS.send}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
