import { memo } from 'react'
import type { DayRow } from './dayList.ts'

interface DayListProps {
  rows: DayRow[]
  /** Called with a row's date when it is tapped. */
  onSelect: (date: string) => void
}

/**
 * The 14 days from today. Tapping a row puts that day in the panels and the
 * table above. Kept from drawing again while only the cursor moves.
 */
export const DayList = memo(function DayList({ rows, onSelect }: DayListProps) {
  return (
    <section className="days">
      <h2>14 days</h2>
      <ol>
        {rows.map((row) => (
          <li key={row.date}>
            <button
              type="button"
              className="day-row"
              aria-pressed={row.selected}
              onClick={() => onSelect(row.date)}
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
              {row.weather !== null && (
                <span className="day-row-weather">
                  {row.weather.map((words) => (
                    <span key={words}>{words}</span>
                  ))}
                </span>
              )}
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
})
