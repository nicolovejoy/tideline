import { useMemo } from 'react'
import type { Loaded } from '../data/load.ts'
import type { TideExtreme } from '../data/noaa.ts'
import type { Spot } from '../spot.ts'
import { monthCaption } from './captions.ts'
import { monthNav, monthRows } from './monthView.ts'
import { TidesHidden } from './TidesHidden.tsx'

interface MonthViewProps {
  spot: Spot
  /** Today's date at the spot. */
  today: string
  hilo: Loaded<TideExtreme[]>
  tidesShown: boolean
  /** The month asked for, or null for this month. */
  month: string | null
  /** The line that stands in for the tide when it is hidden; null when shown. */
  hidden: string | null
  /** Whether "Hide tides" is offered: the tide is shown at a spot that hides it by default. */
  canHide: boolean
  onMonth: (month: string) => void
  onBack: () => void
  onShowTides: (shown: boolean) => void
}

/**
 * One month at a time, this month and the next three: each day's sunset,
 * moon, moonrise flag and highs and lows. No weather, no curve, no cursor.
 */
export function MonthView({
  spot,
  today,
  hilo,
  tidesShown,
  month,
  hidden,
  canHide,
  onMonth,
  onBack,
  onShowTides,
}: MonthViewProps) {
  const nav = monthNav(month, today)
  // About thirty days of sun and moon, worked out once per month on screen
  // and again at midnight.
  const rows = useMemo(
    () => monthRows(spot, nav.month, { today, hilo }, tidesShown),
    [spot, nav.month, today, hilo, tidesShown],
  )

  return (
    <section className="month" aria-label={nav.title}>
      <button type="button" className="text-button month-back" onClick={onBack}>
        <span aria-hidden="true">‹</span> Back to forecast
      </button>
      <header className="month-head">
        <button
          type="button"
          className="month-step"
          aria-label="Previous month"
          disabled={nav.prev === null}
          onClick={() => nav.prev !== null && onMonth(nav.prev)}
        >
          ‹
        </button>
        <h2>{nav.title}</h2>
        <button
          type="button"
          className="month-step"
          aria-label="Next month"
          disabled={nav.next === null}
          onClick={() => nav.next !== null && onMonth(nav.next)}
        >
          ›
        </button>
      </header>

      <ol>
        {rows.map((row) => (
          <li
            key={row.date}
            className="month-row"
            aria-current={row.isToday ? 'date' : undefined}
          >
            <span className="day-row-head">
              <span className="day-row-date">{row.day}</span>
              <span>{row.sunset}</span>
              <span>{row.moon}</span>
              {row.flag !== null && (
                <span className="day-row-flag">{row.flag}</span>
              )}
            </span>
            {row.tides.length > 0 && (
              <span className="day-row-tides">
                {row.tides.map((tide) => (
                  <span key={tide}>{tide}</span>
                ))}
              </span>
            )}
          </li>
        ))}
      </ol>

      {hidden !== null ? (
        <TidesHidden words={hidden} onShow={() => onShowTides(true)} />
      ) : (
        <p className="caption">
          {monthCaption(spot, hilo, today)}
          {canHide && (
            <>
              {' '}
              <button
                type="button"
                className="tides-toggle"
                onClick={() => onShowTides(false)}
              >
                Hide tides
              </button>
            </>
          )}
        </p>
      )}
    </section>
  )
}
