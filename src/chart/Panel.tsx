import { useId } from 'react'
import type { ReactNode } from 'react'
import {
  ARROW_PATH,
  ARROW_SOLID_PATH,
  DOT_RADIUS,
  DOT_RADIUS_OBSERVED,
} from './arrows.ts'
import type { Arrow } from './arrows.ts'
import {
  areaPath,
  labelWidth,
  linePath,
  placeLabels,
  stepPath,
} from './scales.ts'
import type { Cut, Point, Scale } from './scales.ts'

export interface Series {
  /** Names the series for styling: its class is `series-<name>`. */
  name: string
  points: Point[]
  /** Fill down to the bottom of the panel as well as drawing the line. */
  filled?: boolean
  /** Break the line where neighbours are further apart in time than this. */
  maxGap?: number
  /**
   * Each value holds for this long, as an hourly forecast's does. The series
   * is drawn as a staircase instead of a line from point to point.
   */
  step?: number
  /** Where the staircase is cut, and which side is drawn. Only with `step`. */
  cut?: Cut
}

/** Where a marker's label sits: in the headroom above the highest value. */
const LABEL_Y = 12

export interface Marker {
  /** Names the marker for styling: its class is `marker-<name>`. */
  name: string
  t: number
  /** Its name, drawn at the top beside the line, where the panel is the one to carry it. */
  label?: string
}

/** A span of time shaded across the plot, behind everything. Its class is `band-<name>`. */
export interface Band {
  name: string
  start: number
  end: number
}

/** A horizontal rule across the plot, and its label. */
export interface Rule {
  v: number
  label: string
}

/** A dot where the cursor meets a value. Its class is `dot-<name>`. */
export interface Dot {
  name: string
  v: number
}

interface PanelProps {
  title: string
  /** The values under the cursor, in words. */
  readout: ReactNode
  width: number
  height: number
  x: Scale
  y: Scale
  /** Values to draw a horizontal rule and a label at. */
  rules: Rule[]
  series: Series[]
  /** Spans shaded behind everything, such as the night. */
  bands: Band[]
  /** One small arrow per instant, at a value, turned to an angle; a dot where there is no angle. */
  arrows?: Arrow[]
  /** Vertical lines at instants that matter, such as sunset. */
  markers: Marker[]
  cursor: number
  /** A dot is drawn where the cursor meets each of these values. */
  dots: Dot[]
}

/**
 * One chart on the shared time axis: a title, a readout, and a plot, with
 * bands shaded behind the series and arrows drawn over them.
 */
export function Panel({
  title,
  readout,
  width,
  height,
  x,
  y,
  rules,
  series,
  bands,
  arrows = [],
  markers,
  cursor,
  dots,
}: PanelProps) {
  const cursorX = x(cursor)
  const places = placeLabels(
    markers.map((m) => ({ x: x(m.t), width: labelWidth(m.label ?? '') })),
    width,
  )
  // The plot shows its window and nothing past it: a curve's point beyond
  // each edge, an hour a zoom cuts into or an arrow at the middle of one
  // would otherwise be drawn over the page beside the plot, which lets its
  // marker labels and the cursor's dots overflow. Ids are unique per panel,
  // and useId's own characters are not all allowed in a url().
  const clip = `plot-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const clipped = `url(#${clip})`
  return (
    <section className="panel">
      <h3 className="panel-title">{title}</h3>
      <div className="panel-readout">{readout}</div>
      {/* The readout says everything the plot shows at the cursor. */}
      <svg
        className="panel-plot"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
      >
        <defs>
          {/* Cut in time only: a line at the lowest value sits on the
              plot's bottom edge, and half its stroke is below it. */}
          <clipPath id={clip}>
            <rect x={0} y={-height} width={width} height={3 * height} />
          </clipPath>
        </defs>
        <g clipPath={clipped}>
          {bands.map((band) => (
            <rect
              key={`${band.name}-${band.start}`}
              className={`band band-${band.name}`}
              x={x(band.start)}
              y={0}
              width={x(band.end) - x(band.start)}
              height={height}
            />
          ))}
          {series.map((one) => (
            <g key={one.name} className={`series series-${one.name}`}>
              {one.filled && (
                <path className="fill" d={areaPath(one.points, x, y, height)} />
              )}
              <path
                className="line"
                d={
                  one.step === undefined
                    ? linePath(one.points, x, y, one.maxGap)
                    : stepPath(one.points, x, y, one.step, one.cut)
                }
              />
            </g>
          ))}
          {arrows.map((arrow) =>
            arrow.angle === null ? (
              <circle
                key={arrow.t}
                className={
                  arrow.observed ? 'arrow-dot arrow-dot-observed' : 'arrow-dot'
                }
                cx={x(arrow.t)}
                cy={y(arrow.v)}
                r={arrow.observed ? DOT_RADIUS_OBSERVED : DOT_RADIUS}
              />
            ) : (
              <g
                key={arrow.t}
                className={arrow.observed ? 'arrow arrow-observed' : 'arrow'}
                transform={`translate(${x(arrow.t).toFixed(1)} ${y(arrow.v).toFixed(1)}) rotate(${arrow.angle})`}
              >
                <path d={arrow.observed ? ARROW_SOLID_PATH : ARROW_PATH} />
              </g>
            ),
          )}
          {rules.map((rule) => (
            <g key={rule.v} className="rule">
              <line x1={0} x2={width} y1={y(rule.v)} y2={y(rule.v)} />
            </g>
          ))}
        </g>
        {rules.map((rule) => (
          <g key={rule.v} className="rule">
            <text x={4} y={y(rule.v) - 4}>
              {rule.label}
            </text>
          </g>
        ))}
        <g clipPath={clipped}>
          {markers.map((marker) => {
            const at = x(marker.t)
            return (
              <g
                key={`${marker.name}-${marker.t}`}
                className={`marker marker-${marker.name}`}
              >
                <line x1={at} x2={at} y1={0} y2={height} />
              </g>
            )
          })}
        </g>
        {markers.map((marker, i) =>
          marker.label === undefined ? null : (
            <g
              key={`${marker.name}-${marker.t}`}
              className={`marker marker-${marker.name}`}
            >
              <text
                className="marker-label"
                x={places[i].x}
                y={LABEL_Y}
                textAnchor={places[i].anchor}
              >
                {marker.label}
              </text>
            </g>
          ),
        )}
        <line className="cursor" x1={cursorX} x2={cursorX} y1={0} y2={height} />
        {dots.map((dot) => (
          <circle
            key={dot.name}
            className={`dot dot-${dot.name}`}
            cx={cursorX}
            cy={y(dot.v)}
            r={4.5}
          />
        ))}
      </svg>
    </section>
  )
}
