import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { isSideways, isTap } from './gesture.ts'
import { STEP, snap } from './readout.ts'
import { linearScale } from './scales.ts'
import type { Scale } from './scales.ts'
import { hourMarks } from '../time.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const HOUR_LABELS: Record<number, string> = {
  0: '12a',
  6: '6a',
  12: '12p',
  18: '6p',
}

interface PanelStackProps {
  /** The instants the shared time axis starts and ends at. */
  start: number
  end: number
  timeZone: string
  cursor: number
  /** The cursor's time and the values under it, in words. */
  cursorText: string
  onCursor: (t: number) => void
  /** Draws the panels, given the width to fill and the shared time scale. */
  children: (frame: { width: number; x: Scale }) => ReactNode
}

/**
 * The panels for one day, stacked on one time axis with one cursor. A tap or
 * a sideways drag anywhere in the stack moves the cursor, and so do the arrow
 * keys. A swipe up or down scrolls the page and leaves the cursor alone.
 */
export function PanelStack({
  start,
  end,
  timeZone,
  cursor,
  cursorText,
  onCursor,
  children,
}: PanelStackProps) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  // The press in progress: where it began, and whether it is moving the cursor.
  const press = useRef<{
    id: number
    x: number
    y: number
    dragging: boolean
  } | null>(null)

  // Measured before the first paint, so the page does not jump when the
  // panels appear.
  useLayoutEffect(() => {
    const element = box.current
    if (!element) return
    const measure = () => setWidth(element.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const x = linearScale([start, end], [0, width])
  const moveTo = (t: number) =>
    onCursor(Math.min(Math.max(snap(t), start), end))
  const moveToPointer = (event: PointerEvent<HTMLDivElement>) => {
    const left = event.currentTarget.getBoundingClientRect().left
    moveTo(x.invert(event.clientX - left))
  }

  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    // A mouse press means "here". A finger may be starting a scroll, so it
    // moves nothing until it has shown which way it is going.
    const dragging = event.pointerType !== 'touch'
    press.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dragging,
    }
    if (dragging) {
      event.currentTarget.setPointerCapture(event.pointerId)
      moveToPointer(event)
    }
  }

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const began = press.current
    if (!began || began.id !== event.pointerId) return
    const dx = event.clientX - began.x
    const dy = event.clientY - began.y
    if (!began.dragging && isSideways(dx, dy)) {
      began.dragging = true
      // Keep receiving the drag even if the finger leaves the stack.
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    if (began.dragging) moveToPointer(event)
  }

  const onUp = (event: PointerEvent<HTMLDivElement>) => {
    const began = press.current
    press.current = null
    if (!began || began.id !== event.pointerId || began.dragging) return
    const dx = event.clientX - began.x
    const dy = event.clientY - began.y
    if (isTap(dx, dy)) moveToPointer(event)
  }

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const jump = event.shiftKey ? HOUR : STEP
    const targets: Record<string, number> = {
      ArrowRight: cursor + jump,
      ArrowUp: cursor + jump,
      ArrowLeft: cursor - jump,
      ArrowDown: cursor - jump,
      Home: start,
      End: end,
    }
    if (!(event.key in targets)) return
    event.preventDefault()
    moveTo(targets[event.key])
  }

  return (
    <div
      className="stack"
      ref={box}
      role="slider"
      tabIndex={0}
      aria-label="Time of day"
      aria-orientation="horizontal"
      // In minutes since the day began. Epoch milliseconds are too large for
      // some browsers' accessibility trees to carry exactly.
      aria-valuemin={0}
      aria-valuemax={Math.round((end - start) / MINUTE)}
      aria-valuenow={Math.round((cursor - start) / MINUTE)}
      aria-valuetext={cursorText}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      // The browser has taken the touch over to scroll the page. The cursor
      // was never moved, so there is nothing to undo.
      onPointerCancel={() => {
        press.current = null
      }}
      onKeyDown={onKey}
    >
      {width > 0 && children({ width, x })}
      {width > 0 && (
        <div className="hours" aria-hidden="true">
          {hourMarks(start, end, timeZone, 6).map((mark) => (
            <span key={mark.t} style={{ left: x(mark.t) }}>
              {HOUR_LABELS[mark.hour]}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
