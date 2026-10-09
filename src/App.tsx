import { useState } from 'react'
import { Panel } from './chart/Panel.tsx'
import { PanelStack } from './chart/PanelStack.tsx'
import { tideWords } from './chart/readout.ts'
import { linearScale, wholeSteps } from './chart/scales.ts'
import { useSpotData } from './data/useSpotData.ts'
import { CAMPUS_POINT } from './spot.ts'
import { formatDay, formatTime } from './time.ts'
import { tideCaption } from './ui/captions.ts'
import { HiLoTable } from './ui/HiLoTable.tsx'
import { tideView } from './ui/tideView.ts'
import type { CursorPick } from './ui/tideView.ts'
import { TonightStrip } from './ui/TonightStrip.tsx'

const TIDE_HEIGHT = 168
/** Room above the highest tide for a rule's label. */
const HEADROOM = 14
/** Readings come every 6 minutes. A longer gap is an outage. */
const OBSERVED_GAP = 13 * 60_000

export default function App() {
  const spot = CAMPUS_POINT
  const zone = spot.timeZone
  const data = useSpotData(spot)
  const today = data.days[0]

  const [pick, setPick] = useState<CursorPick | null>(null)
  const view = tideView(data, pick)
  const [low, high] = view.bounds
  const words = tideWords(view.readout)
  const cursorTime = formatTime(view.cursor, zone)

  const markers = [{ name: 'now', t: data.now }]
  if (today.sunset !== null) markers.push({ name: 'sunset', t: today.sunset })
  if (today.moonrise !== null) {
    markers.push({ name: 'moonrise', t: today.moonrise })
  }

  const dots: { name: string; v: number }[] = []
  if (view.readout.predictedFt !== null) {
    dots.push({ name: 'predicted', v: view.readout.predictedFt })
  }
  if (view.readout.observedFt !== null) {
    dots.push({ name: 'observed', v: view.readout.observedFt })
  }

  return (
    <main>
      <h1>{spot.name}</h1>
      <TonightStrip day={today} timeZone={zone} />

      <section className="day">
        <header className="day-head">
          <h2>{formatDay(data.today)}</h2>
          <p className="day-cursor">at {cursorTime}</p>
        </header>

        {view.notice !== null ? (
          <p className="notice">{view.notice}</p>
        ) : (
          <PanelStack
            start={data.day.start}
            end={data.day.end}
            timeZone={zone}
            cursor={view.cursor}
            cursorText={[cursorTime, words.predicted, words.observed]
              .filter(Boolean)
              .join(', ')}
            onCursor={(t) => setPick({ t, day: data.today, shown: data.shown })}
            pick={pick}
            onRestore={setPick}
          >
            {({ width, x }) => (
              <Panel
                title="Tide"
                readout={
                  <>
                    <span className="key key-predicted">{words.predicted}</span>
                    {words.observed !== null && (
                      <span className="key key-observed">{words.observed}</span>
                    )}
                  </>
                }
                width={width}
                height={TIDE_HEIGHT}
                x={x}
                y={linearScale([low, high], [TIDE_HEIGHT, HEADROOM])}
                rules={wholeSteps(low, high, 2).map((v) => ({
                  v,
                  label: `${v} ft`,
                }))}
                series={[
                  {
                    name: 'predicted',
                    filled: true,
                    points: view.predicted.map((p) => ({ t: p.t, v: p.ft })),
                  },
                  {
                    name: 'observed',
                    maxGap: OBSERVED_GAP,
                    points: view.observed.map((p) => ({ t: p.t, v: p.ft })),
                  },
                ]}
                markers={markers}
                cursor={view.cursor}
                dots={dots}
              />
            )}
          </PanelStack>
        )}

        {view.events.length > 0 && (
          <HiLoTable events={view.events} timeZone={zone} />
        )}

        <p className="caption">
          {tideCaption(
            spot,
            data.predictions,
            data.observed,
            view.observed,
            data.today,
          )}
        </p>
      </section>
    </main>
  )
}
