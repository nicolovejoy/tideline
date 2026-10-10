// Whether a spot has a tide to show. Imports nothing, so the words of the
// add screen and the spot screen can use it without bringing the station
// code into the bundle every open loads.

/** A spot has a tide when its station is this near... */
export const TIDES_WITHIN_MI = 25
/** ...and the spot is under this. */
export const TIDES_BELOW_FT = 300

/**
 * Tides are for the coast, and this is how the coast is told. Distance
 * alone is not enough: a 4,000 ft peak can be 6 mi from a station. Height
 * alone is not enough either: a lake shore is low and hundreds of miles
 * from any tide. The height is the spot's own where that is known. Its
 * forecast cell's average is a poor second: a beach under hills sits in a
 * cell hundreds of feet up.
 */
export function tidesApply(tideDistanceMi: number, heightFt: number): boolean {
  return tideDistanceMi <= TIDES_WITHIN_MI && heightFt < TIDES_BELOW_FT
}
