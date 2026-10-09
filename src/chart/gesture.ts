// Telling a tap and a sideways drag apart from the start of a scroll, and
// following one press from the pointer going down to it lifting. Plain
// functions; PanelStack applies them to pointer events.

/** How far, in CSS pixels, a finger may wander and still count as a tap. */
export const SLOP = 6

/**
 * Whether a finger that has moved this far from where it went down is
 * dragging sideways. Until it is, the cursor is left alone, because the
 * touch may be the start of a scroll.
 */
export function isSideways(dx: number, dy: number): boolean {
  return Math.abs(dx) >= SLOP && Math.abs(dx) > Math.abs(dy)
}

/** Whether a finger lifted this far from where it went down was a tap. */
export function isTap(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) < SLOP
}

/** Where a pointer is, and which pointer it is. */
export interface Pointer {
  id: number
  x: number
  y: number
}

/** A press in progress. */
export interface Press<P> extends Pointer {
  /** Whether it is moving the cursor. */
  dragging: boolean
  /**
   * Whatever the page keeps to say where the cursor was put, as it was when
   * the press began. It is handed back if the cursor has to go back there.
   */
  pick: P
}

/** What a pointer event leads to: the press from here on, and what to do. */
export type Outcome<P> =
  | { press: Press<P> | null; act: 'nothing' }
  /** Move the cursor to where the pointer is. */
  | { press: Press<P> | null; act: 'move' }
  /** Put the cursor back where it was when the press began. */
  | { press: null; act: 'restore'; pick: P }

/** Ends a press that will not finish, undoing whatever it did. */
function abandon<P>(press: Press<P>): Outcome<P> {
  return press.dragging
    ? { press: null, act: 'restore', pick: press.pick }
    : { press: null, act: 'nothing' }
}

/** A pointer went down. `touch` says whether it is a finger. */
export function pressDown<P>(
  press: Press<P> | null,
  at: Pointer,
  touch: boolean,
  pick: P,
): Outcome<P> {
  // A second finger makes this a pinch or a stray touch, not one finger
  // pointing at a time of day.
  if (press !== null && press.id !== at.id) return abandon(press)
  // A mouse press means "here". A finger may be starting a scroll, so it
  // moves nothing until it has shown which way it is going.
  const dragging = !touch
  return {
    press: { ...at, dragging, pick },
    act: dragging ? 'move' : 'nothing',
  }
}

/** A pointer moved. */
export function pressMove<P>(press: Press<P> | null, at: Pointer): Outcome<P> {
  if (press === null || press.id !== at.id) return { press, act: 'nothing' }
  const dragging = press.dragging || isSideways(at.x - press.x, at.y - press.y)
  return { press: { ...press, dragging }, act: dragging ? 'move' : 'nothing' }
}

/** A pointer lifted. */
export function pressUp<P>(press: Press<P> | null, at: Pointer): Outcome<P> {
  if (press === null || press.id !== at.id) return { press, act: 'nothing' }
  // A drag has already put the cursor where the pointer was.
  const tapped = !press.dragging && isTap(at.x - press.x, at.y - press.y)
  return { press: null, act: tapped ? 'move' : 'nothing' }
}

/**
 * The browser took the pointer over, to scroll or zoom the page. It can do
 * that after a finger has started to move the cursor, when a swipe begins
 * sideways and then turns up or down.
 */
export function pressCancel<P>(press: Press<P> | null, id: number): Outcome<P> {
  if (press === null || press.id !== id) return { press, act: 'nothing' }
  return abandon(press)
}
