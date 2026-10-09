import { feet } from '../chart/readout.ts'
import type { TideExtreme } from '../data/noaa.ts'
import { formatTime } from '../time.ts'

interface HiLoTableProps {
  /** One day's highs and lows, in order. */
  events: TideExtreme[]
  timeZone: string
}

/** NOAA's own times and heights, so it matches the station page. */
export function HiLoTable({ events, timeZone }: HiLoTableProps) {
  return (
    <table className="hilo">
      <caption>High and low tides</caption>
      <tbody>
        {events.map((event) => (
          <tr key={event.t}>
            <th scope="row">{event.type === 'H' ? 'High' : 'Low'}</th>
            <td>{formatTime(event.t, timeZone)}</td>
            <td>{feet(event.ft)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
