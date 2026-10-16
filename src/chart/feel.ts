// When the feels-like temperature is worth showing. Plain functions.

import type { ForecastHour } from '../data/nws.ts'

/** How far the feels-like must be from the temperature to be shown, in °F. */
export const FEEL_STANDS_OUT_F = 2

/**
 * The hour's feels-like where it stands out from the hour's temperature (2°F
 * or more either way), else none: a feels-like within two degrees of the
 * temperature says nothing the temperature does not, and with no temperature
 * there is nothing to set it against. The words use it, so a hidden
 * feels-like is hidden everywhere.
 */
export function shownFeel(hour: ForecastHour): number | null {
  if (hour.feelsF === null || hour.tempF === null) return null
  return Math.abs(hour.feelsF - hour.tempF) >= FEEL_STANDS_OUT_F
    ? hour.feelsF
    : null
}
