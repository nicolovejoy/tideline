// The height that sunset and moonrise are worked out from. From high up the
// horizon is lower, so the sun sets later and the moon rises earlier: by 6
// to 7 minutes at 4,000 ft. What counts is how far the spot stands above
// the ground it looks out over, tens of miles off, and the app has no map
// of that ground. Near the sea it is the sea, so the spot's height above
// sea level is the height. Inland it may be a plain as high as the spot,
// and nothing is counted.

import type { Spot } from '../spot.ts'
import { TIDES_WITHIN_MI } from './tideRule.ts'

/**
 * Below this a spot's height moves sunset by under a minute, and times are
 * shown to the minute: 26 seconds at 21 ft, 57 seconds at 100 ft.
 */
export const SEEN_FROM_FT = 100

/**
 * The height in feet that a spot's sun and moon times are worked out from,
 * over a sea-level horizon. 0 means a level horizon, as almanacs use. It
 * is the spot's own height where that is known, is 100 ft or more, and the
 * sea is near: a tide station within the distance the tide rule goes by.
 * The forecast cell's average is never used. It puts a beach under hills
 * hundreds of feet up, which here would be minutes of error.
 */
export function seenFromFt(
  spot: Pick<Spot, 'elevationFt' | 'tideStation'>,
): number {
  const own = spot.elevationFt
  if (own === null || own < SEEN_FROM_FT) return 0
  return spot.tideStation.distanceMi <= TIDES_WITHIN_MI ? own : 0
}
