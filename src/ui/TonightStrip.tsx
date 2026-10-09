import type { DayAstro } from '../data/astro.ts'
import { formatTime } from '../time.ts'

interface TonightStripProps {
  /** Today at the spot. */
  day: DayAstro
  timeZone: string
}

/**
 * Tonight at a glance: sunset and the moon. The coloured bars beside "Sunset"
 * and "Moon" are the key to the vertical lines of the same colours in the
 * panels below.
 */
export function TonightStrip({ day, timeZone }: TonightStripProps) {
  const lit = Math.round(day.illumination * 100)
  return (
    <section className="tonight" aria-label="Tonight">
      <div className="tonight-sun">
        <h2 className="key key-sunset">Sunset</h2>
        <p className="tonight-time">
          {day.sunset === null
            ? 'None today'
            : formatTime(day.sunset, timeZone)}
        </p>
      </div>
      <div className="tonight-moon">
        <h2 className="key key-moonrise">Moon</h2>
        <p>
          {lit}% lit, {day.phase.toLowerCase()}
        </p>
        <p>
          {day.moonrise === null
            ? 'No moonrise today'
            : `Rises ${formatTime(day.moonrise, timeZone)}`}
        </p>
      </div>
      {day.moonriseNearSunset !== null && (
        <p className="tonight-flag">
          Moonrise near sunset: {formatTime(day.moonriseNearSunset, timeZone)}
        </p>
      )}
    </section>
  )
}
