// Telling a tap and a sideways drag apart from the start of a scroll.
// Plain functions; PanelStack applies them to pointer events.

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
