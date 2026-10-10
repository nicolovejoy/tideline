// Whether a spot's tide is shown to start with. Imports nothing, so the
// add screen's words can use it without bringing the station code into the
// bundle every open loads.

/** Tides are shown to start with when the station is this near... */
export const TIDES_WITHIN_MI = 25
/** ...and the cell's average height is under this. */
export const TIDES_BELOW_FT = 300

/**
 * Distance alone is not enough: a 4,000 ft peak can be 6 mi from a
 * station. Elevation alone is not enough either: a lake shore is low and
 * hundreds of miles from any tide.
 */
export function defaultTidesShown(
  tideDistanceMi: number,
  cellElevationFt: number,
): boolean {
  return tideDistanceMi <= TIDES_WITHIN_MI && cellElevationFt < TIDES_BELOW_FT
}
