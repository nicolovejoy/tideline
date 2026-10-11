import { useEffect, useMemo, useRef } from 'react'
import type { Loaded } from '../data/load.ts'
import type { TideExtreme } from '../data/noaa.ts'
import type { Spot } from '../spot.ts'
import { monthCaption, sunCaption } from './captions.ts'
import { monthNav, monthRows } from './monthView.ts'

interface MonthViewProps {
  spot: Spot
  /** Today's date at the spot. */
  today: string
  hilo: Loaded<TideExtreme[]>
  /** The month asked for, or null for this month. */
  month: string | null
  /** Why the spot has no tide, said in place of its caption; null where it has one. */
  noTides: string | null
  onMonth: (month: string) => void
  onBack: () => void
}

/**
 * One month at a time, this month and the next three: each day's sunset,
 * moon, moonrise flag and highs and lows. No weather, no curve, no cursor.
 */
export function MonthView({
  spot,
  today,
  hilo,
  month,
  noTides,
  onMonth,
  onBack,
}: MonthViewProps) {
  const nav = monthNav(month, today)
  // Said only where the spot's own height is counted.
  const sun = sunCaption(spot)
  // The heading takes focus on entry and on each step. The button that was
  // pressed has gone, or is disabled at an end, and a screen reader reads
  // the heading it lands on, so the new month is announced.
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [nav.month])
  // About thirty days of sun and moon, worked out once per month on screen
  // and again at midnight.
  const rows = useMemo(
    () => monthRows(spot, nav.month, { today, hilo }, noTides === null),
    [spot, nav.month, today, hilo, noTides],
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
        <h2 ref={heading} tabIndex={-1}>
          {nav.title}
        </h2>
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

      <p className="caption">{noTides ?? monthCaption(spot, hilo, today)}</p>
      {sun !== null && <p className="caption">{sun}</p>}
    </section>
  )
}
