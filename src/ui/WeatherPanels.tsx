import { Panel } from '../chart/Panel.tsx'
import type { Marker } from '../chart/Panel.tsx'
import { linearScale, wholeSteps } from '../chart/scales.ts'
import type { Scale } from '../chart/scales.ts'
import type { WeatherPanelView, WeatherView } from './weatherView.ts'

const HEIGHT = 84
/** Room above the highest value for a rule's label. */
const HEADROOM = 14
/** Each forecast value holds for an hour. */
const HOUR = 3_600_000

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

  const panel = (
    title: string,
    one: WeatherPanelView,
    every: number,
    unit: string,
  ) => (
    <Panel
      title={title}
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
      rules={wholeSteps(one.bounds[0], one.bounds[1], every).map((v) => ({
        v,
        label: `${v}${unit}`,
      }))}
      series={one.series.map((series) => ({ ...series, step: HOUR }))}
      markers={markers}
      cursor={cursor}
      dots={one.dots}
    />
  )

  return (
    <>
      {panel('Wind', view.wind, 10, ' mph')}
      {panel('Temperature', view.temp, 10, '°F')}
      {panel('Sky', view.sky, 50, '%')}
    </>
  )
}
