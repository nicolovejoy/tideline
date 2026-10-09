import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { pressCancel, pressDown, pressMove, pressUp } from './gesture.ts'
import type { Outcome, Pointer, Press } from './gesture.ts'
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

interface PanelStackProps<P> {
  /** The instants the shared time axis starts and ends at. */
  start: number
  end: number
  timeZone: string
  cursor: number
  /** The cursor's time and the values under it, in words. */
  cursorText: string
  onCursor: (t: number) => void
  /**
   * Whatever the page keeps to say where the cursor was put. It is read when
   * a press begins, and handed to `onRestore` if the cursor has to go back.
   */
  pick: P
  onRestore: (pick: P) => void
  /** Draws the panels, given the width to fill and the shared time scale. */
  children: (frame: { width: number; x: Scale }) => ReactNode
}

/**
 * The panels for one day, stacked on one time axis with one cursor. A tap or
 * a sideways drag anywhere in the stack moves the cursor, and so do the arrow
 * keys. A swipe up or down scrolls the page and leaves the cursor alone. The
 * rules for a press are in gesture.ts; this applies what they decide.
 */
export function PanelStack<P>({
  start,
  end,
  timeZone,
  cursor,
  cursorText,
  onCursor,
  pick,
  onRestore,
  children,
}: PanelStackProps<P>) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const press = useRef<Press<P> | null>(null)

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

  const pointer = (event: PointerEvent<HTMLDivElement>): Pointer => ({
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
  })
  const apply = (outcome: Outcome<P>, event: PointerEvent<HTMLDivElement>) => {
    const startsDrag = outcome.press?.dragging && !press.current?.dragging
    press.current = outcome.press
    // Keep receiving a drag even if the pointer leaves the stack.
    if (startsDrag) event.currentTarget.setPointerCapture(event.pointerId)
    if (outcome.act === 'move') moveToPointer(event)
    if (outcome.act === 'restore') onRestore(outcome.pick)
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
      onPointerDown={(event) => {
        const touch = event.pointerType === 'touch'
        apply(pressDown(press.current, pointer(event), touch, pick), event)
      }}
      onPointerMove={(event) =>
        apply(pressMove(press.current, pointer(event)), event)
      }
      onPointerUp={(event) =>
        apply(pressUp(press.current, pointer(event)), event)
      }
      onPointerCancel={(event) =>
        apply(pressCancel(press.current, event.pointerId), event)
      }
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
