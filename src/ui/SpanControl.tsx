import { SPANS } from './spanView.ts'
import type { SpanChoice } from './spanView.ts'

interface SpanControlProps {
  span: SpanChoice
  onSpan: (choice: SpanChoice) => void
}

/** The buttons that choose how many days the panels draw: a day, three or a week. */
export function SpanControl({ span, onSpan }: SpanControlProps) {
  return (
    <div className="span-row" role="radiogroup" aria-label="Days on the panels">
      {SPANS.map((entry) => (
        <button
          key={entry.id}
          type="button"
          role="radio"
          aria-checked={entry.id === span}
          className="text-button span-choice"
          onClick={() => onSpan(entry.id)}
        >
          {entry.words}
        </button>
      ))}
    </div>
  )
}
