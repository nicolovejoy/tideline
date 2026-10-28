import { WORDS } from './feedbackView.ts'

interface FeedbackButtonProps {
  onOpen: () => void
}

/**
 * The button that opens the feedback sheet, at the bottom right of the
 * window over whatever is under it. It leaves itself out of the outline.
 */
export function FeedbackButton({ onOpen }: FeedbackButtonProps) {
  return (
    <button
      type="button"
      className="feedback-button"
      data-loop-redact=""
      onClick={onOpen}
    >
      {WORDS.button}
    </button>
  )
}
