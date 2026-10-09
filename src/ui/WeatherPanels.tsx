import { Panel } from '../chart/Panel.tsx'
import type { Marker } from '../chart/Panel.tsx'
import { linearScale } from '../chart/scales.ts'
import type { Scale } from '../chart/scales.ts'
import type { WeatherPanelView, WeatherView } from './weatherView.ts'

const HEIGHT = 84
/** Room above the highest value for a rule's label. */
const HEADROOM = 14

interface WeatherPanelsProps {
  view: WeatherView
  width: number
  x: Scale
  markers: Marker[]
  cursor: number
}

/** Wind, temperature and sky for one day, or a line saying why not. */
export function WeatherPanels({
  view,
  width,
  x,
  markers,
  cursor,
}: WeatherPanelsProps) {
  if (view.notice !== null) return <p className="notice">{view.notice}</p>

  const panel = (one: WeatherPanelView) => (
    <Panel
      title={one.title}
      readout={
        <span className="readout-row">
          {one.readout.map((part) => (
            <span
              key={part.text}
              className={part.key === null ? undefined : `key key-${part.key}`}
            >
              {part.text}
            </span>
          ))}
        </span>
      }
      width={width}
      height={HEIGHT}
      x={x}
      y={linearScale(one.bounds, [HEIGHT, HEADROOM])}
      rules={one.rules}
      series={one.series}
      markers={markers}
      cursor={cursor}
      dots={one.dots}
    />
  )

  return (
    <>
      {panel(view.wind)}
      {panel(view.temp)}
      {panel(view.sky)}
    </>
  )
}
