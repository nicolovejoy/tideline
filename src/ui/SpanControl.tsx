import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { SPANS, spanBeside } from './spanView.ts'
import type { SpanChoice } from './spanView.ts'

interface SpanControlProps {
  span: SpanChoice
  /** The panels are zoomed to a window of their own, so no button is checked. */
  zoomed: boolean
  onSpan: (choice: SpanChoice) => void
}

const ARROWS: Record<string, 1 | -1> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
}

/**
 * The buttons that choose how many days the panels draw: a day, three or a
 * week. A group of radio buttons: Tab reaches the chosen one, the arrow keys
 * move the choice and the focus with it.
 */
export function SpanControl({ span, zoomed, onSpan }: SpanControlProps) {
  const group = useRef<HTMLDivElement>(null)
  const focusChosen = useRef(false)

  // After an arrow key moves the choice, the focus follows it.
  useEffect(() => {
    if (!focusChosen.current) return
    focusChosen.current = false
    group.current
      ?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
      ?.focus()
  }, [span])

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = ARROWS[event.key]
    if (!direction) return
    event.preventDefault()
    focusChosen.current = true
    onSpan(spanBeside(span, direction))
  }

  return (
    <div
      className="span-row"
      role="radiogroup"
      aria-label="Days on the panels"
      ref={group}
      onKeyDown={onKey}
    >
      {SPANS.map((entry) => (
        <button
          key={entry.id}
          type="button"
          role="radio"
          aria-checked={!zoomed && entry.id === span}
          tabIndex={entry.id === span ? 0 : -1}
          className="text-button span-choice"
          onClick={() => onSpan(entry.id)}
        >
          {entry.words}
        </button>
      ))}
    </div>
  )
}
