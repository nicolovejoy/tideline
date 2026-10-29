import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import type { Span } from '../data/cache.ts'
import {
  pinchBegin,
  pinchEnds,
  pinchMove,
  pressCancel,
  pressDown,
  pressMove,
  pressUp,
} from './gesture.ts'
import type { Outcome, Pinch, Pointer, Press } from './gesture.ts'
import { STEP, snap } from './readout.ts'
import { linearScale } from './scales.ts'
import type { Scale } from './scales.ts'
import { DAY, HOUR, MINUTE } from '../time.ts'
import type { StackLabel } from '../ui/spanView.ts'
import { pinchWindow, wheelWindow, zoomAbout } from './zoom.ts'

/** Safari's pinch on a trackpad, which is not in TypeScript's DOM types. */
type GestureEvent = Event & { scale: number; clientX: number }

interface PanelStackProps<P> {
  /** The instants the shared time axis starts and ends at. */
  start: number
  end: number
  /** The words under the stack, at their instants. */
  labels: StackLabel[]
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
  /** The days a pinch or a pan may show, from the first to the last. */
  bounds: Span
  /** Asks for the panels to show another window, after a pinch or a pan. */
  onWindow: (window: Span) => void
  /** Draws the panels, given the width to fill and the shared time scale. */
  children: (frame: { width: number; x: Scale }) => ReactNode
}

/**
 * The panels for a day or more, stacked on one time axis with one cursor. A
 * tap or a sideways drag anywhere in the stack moves the cursor, and so do the
 * arrow keys. A swipe up or down scrolls the page and leaves the cursor alone.
 * Two fingers pinch the window shorter or longer and slide it along; on a
 * trackpad a pinch zooms about the pointer and a sideways swipe pans; and the
 * `+` and `-` keys zoom about the cursor. Each asks for a new window through
 * `onWindow`, inside `bounds`. The rules for a press and a pinch are in
 * gesture.ts and the window's arithmetic in zoom.ts; this applies what they
 * decide.
 */
export function PanelStack<P>({
  start,
  end,
  labels,
  cursor,
  cursorText,
  onCursor,
  pick,
  onRestore,
  bounds,
  onWindow,
  children,
}: PanelStackProps<P>) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const press = useRef<Press<P> | null>(null)
  // The fingers that are down, by pointer, at their x from the stack's left.
  const touches = useRef(new Map<number, number>())
  const pinch = useRef<Pinch | null>(null)
  // What the wheel and Safari's gesture listeners read. They are added once,
  // so they find the current window here rather than in their closure.
  const live = useRef({ start, end, width, bounds, onWindow })
  useLayoutEffect(() => {
    live.current = { start, end, width, bounds, onWindow }
  })

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

  // React's wheel listener is passive and cannot keep the page from scrolling
  // or zooming, so the stack's own are added here.
  useEffect(() => {
    const element = box.current
    if (!element) return
    const under = (clientX: number) => {
      const { start, end, width } = live.current
      const left = element.getBoundingClientRect().left
      return linearScale([start, end], [0, width]).invert(clientX - left)
    }
    const onWheel = (event: WheelEvent) => {
      const { start, end, width, bounds, onWindow } = live.current
      if (width === 0) return
      const next = wheelWindow(
        { start, end },
        event,
        width,
        under(event.clientX),
        bounds,
      )
      if (next === null) return
      event.preventDefault()
      onWindow(next)
    }
    // Safari pinches on a trackpad with these, not with a wheel. On an iPhone
    // they come with a two-finger touch too, which the pointers already pinch.
    let gesture: { window: Span; about: number } | null = null
    const onGestureStart = (event: Event) => {
      event.preventDefault()
      const { start, end, width } = live.current
      gesture =
        width === 0
          ? null
          : {
              window: { start, end },
              about: under((event as GestureEvent).clientX),
            }
    }
    const onGestureChange = (event: Event) => {
      event.preventDefault()
      if (gesture === null || touches.current.size > 0) return
      const { bounds, onWindow } = live.current
      const { scale } = event as GestureEvent
      onWindow(zoomAbout(gesture.window, gesture.about, scale, bounds))
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    element.addEventListener('gesturestart', onGestureStart)
    element.addEventListener('gesturechange', onGestureChange)
    return () => {
      element.removeEventListener('wheel', onWheel)
      element.removeEventListener('gesturestart', onGestureStart)
      element.removeEventListener('gesturechange', onGestureChange)
    }
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

  // The x of a finger from the stack's left, the frame a pinch works in.
  const fromLeft = (event: PointerEvent<HTMLDivElement>) =>
    event.clientX - event.currentTarget.getBoundingClientRect().left
  const capture = (event: PointerEvent<HTMLDivElement>, id: number) => {
    // A finger lifted between the events cannot be captured, and need not be.
    try {
      event.currentTarget.setPointerCapture(id)
    } catch {
      // Nothing to do.
    }
  }

  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    const touch = event.pointerType === 'touch'
    if (!touch) {
      apply(pressDown(press.current, pointer(event), false, pick), event)
      return
    }
    touches.current.set(event.pointerId, fromLeft(event))
    // A third finger, or a second while a pinch is on, is not followed.
    if (pinch.current !== null || touches.current.size > 2) return
    if (touches.current.size === 1) {
      apply(pressDown(press.current, pointer(event), true, pick), event)
      return
    }
    // A second finger abandons the first finger's press, putting the cursor
    // back if it had moved it. When the first is what is left of a pinch, it
    // has no press, and none is begun for the second.
    if (press.current !== null)
      apply(pressDown(press.current, pointer(event), true, pick), event)
    if (width === 0) return
    const [[a, ax], [b, bx]] = [...touches.current]
    pinch.current = pinchBegin(
      { id: a, x: ax, y: 0 },
      { id: b, x: bx, y: 0 },
      { start, end },
    )
    capture(event, a)
    capture(event, b)
  }

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (touches.current.has(event.pointerId))
      touches.current.set(event.pointerId, fromLeft(event))
    const current = pinch.current
    if (current === null) {
      apply(pressMove(press.current, pointer(event)), event)
      return
    }
    const next = pinchMove(current, {
      id: event.pointerId,
      x: fromLeft(event),
      y: 0,
    })
    if (next === current || width === 0) return
    pinch.current = next
    onWindow(pinchWindow(next.window, width, next.from, next.to, bounds))
  }

  // A finger of a pinch lifting ends it, and the other then does nothing
  // until it lifts too.
  const onLift = (
    event: PointerEvent<HTMLDivElement>,
    outcome: () => Outcome<P>,
  ) => {
    touches.current.delete(event.pointerId)
    if (pinch.current !== null) {
      if (pinchEnds(pinch.current, event.pointerId)) pinch.current = null
      return
    }
    apply(outcome(), event)
  }

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    // Zooming about the cursor. With Ctrl or Command the keys are the
    // browser's, to zoom the page.
    const zooms: Record<string, number> = { '+': 2, '=': 2, '-': 0.5 }
    if (event.key in zooms && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      onWindow(zoomAbout({ start, end }, cursor, zooms[event.key], bounds))
      return
    }
    const jump = event.shiftKey ? HOUR : STEP
    const targets: Record<string, number> = {
      ArrowRight: cursor + jump,
      ArrowUp: cursor + jump,
      ArrowLeft: cursor - jump,
      ArrowDown: cursor - jump,
      PageUp: cursor + DAY,
      PageDown: cursor - DAY,
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
      // In minutes since the window began. Epoch milliseconds are too large for
      // some browsers' accessibility trees to carry exactly.
      aria-valuemin={0}
      aria-valuemax={Math.round((end - start) / MINUTE)}
      aria-valuenow={Math.round((cursor - start) / MINUTE)}
      aria-valuetext={cursorText}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={(event) =>
        onLift(event, () => pressUp(press.current, pointer(event)))
      }
      onPointerCancel={(event) =>
        onLift(event, () => pressCancel(press.current, event.pointerId))
      }
      onKeyDown={onKey}
    >
      {width > 0 && children({ width, x })}
      {width > 0 && (
        <div className="hours" aria-hidden="true">
          {labels.map((label) => (
            <span
              key={label.t}
              data-edge={
                label.t === start
                  ? 'start'
                  : label.t === end
                    ? 'end'
                    : undefined
              }
              style={{ left: x(label.t) }}
            >
              {label.text}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
