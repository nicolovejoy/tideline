import { useCallback, useMemo, useRef, useState } from 'react'
import { Panel } from './chart/Panel.tsx'
import { PanelStack } from './chart/PanelStack.tsx'
import { cursorText } from './chart/readout.ts'
import { linearScale } from './chart/scales.ts'
import { useSpotData } from './data/useSpotData.ts'
import { CAMPUS_POINT } from './spot.ts'
import { formatDay, formatTime } from './time.ts'
import { tideCaption, weatherCaption } from './ui/captions.ts'
import { DayList } from './ui/DayList.tsx'
import { dayRows, tonightWords } from './ui/dayList.ts'
import { HiLoTable } from './ui/HiLoTable.tsx'
import { dayMarkers, selectedDay } from './ui/selection.ts'
import { tideView } from './ui/tideView.ts'
import type { CursorPick } from './ui/tideView.ts'
import { TonightStrip } from './ui/TonightStrip.tsx'
import { WeatherPanels } from './ui/WeatherPanels.tsx'
import { weatherView } from './ui/weatherView.ts'

const TIDE_HEIGHT = 168
/** Room above the highest tide for a rule's label. */
const HEADROOM = 14

export default function App() {
  const spot = CAMPUS_POINT
  const zone = spot.timeZone
  const data = useSpotData(spot, true)
  const { days, spans, hilo, forecast } = data

  const [pickedDay, setPickedDay] = useState<string | null>(null)
  const [pick, setPick] = useState<CursorPick | null>(null)
  const selected = selectedDay(data, pickedDay)
  const tide = tideView(data, selected, pick)
  const weather = weatherView(forecast, selected, tide.cursor, data.now)
  const cursorTime = formatTime(tide.cursor, zone)
  const markers = dayMarkers(selected, data.now)

  const tonight = useMemo(
    () => tonightWords(days[0], data.now, zone),
    [days, data.now, zone],
  )
  // The rows do not depend on the cursor, so they are not worked out again,
  // and the list is not drawn again, each time it moves. They are worked out
  // again once a minute, with the clock.
  const rows = useMemo(
    () =>
      dayRows({ now: data.now, days, spans, hilo, forecast }, pickedDay, zone),
    [data.now, days, spans, hilo, forecast, pickedDay, zone],
  )

  const dayTop = useRef<HTMLElement>(null)
  const selectDay = useCallback((date: string) => {
    setPickedDay(date)
    // The cursor goes back to rest, on this day and on the one left behind.
    setPick(null)
    // The panels are above the list, usually off screen. The page jumps to
    // them. A glide would move the list under a second tap and choose
    // whichever row had arrived under the finger.
    dayTop.current?.scrollIntoView({ block: 'start' })
  }, [])

  return (
    <main>
      <h1>{spot.name}</h1>
      <TonightStrip words={tonight} />

      <section className="day" ref={dayTop}>
        <header className="day-head">
          <h2>{formatDay(selected.date)}</h2>
          <p className="day-cursor">at {cursorTime}</p>
        </header>

        <PanelStack
          start={selected.span.start}
          end={selected.span.end}
          timeZone={zone}
          cursor={tide.cursor}
          cursorText={cursorText(cursorTime, [tide.words, weather.words])}
          onCursor={(t) =>
            setPick({ t, day: selected.date, shown: data.shown })
          }
          pick={pick}
          onRestore={setPick}
        >
          {({ width, x }) => (
            <>
              {tide.notice !== null ? (
                <p className="notice">{tide.notice}</p>
              ) : (
                <Panel
                  title={tide.title}
                  readout={
                    <>
                      <span className="key key-predicted">
                        {tide.text.predicted}
                      </span>
                      {/* Always there, so the plot does not move when the
                          reading comes and goes. */}
                      <span
                        className={
                          tide.text.observed === null
                            ? undefined
                            : 'key key-observed'
                        }
                      >
                        {tide.text.observed}
                      </span>
                    </>
                  }
                  width={width}
                  height={TIDE_HEIGHT}
                  x={x}
                  y={linearScale(tide.bounds, [TIDE_HEIGHT, HEADROOM])}
                  rules={tide.rules}
                  series={tide.series}
                  markers={markers}
                  cursor={tide.cursor}
                  dots={tide.dots}
                />
              )}
              <WeatherPanels
                view={weather}
                width={width}
                x={x}
                markers={markers}
                cursor={tide.cursor}
              />
            </>
          )}
        </PanelStack>

        {tide.events.length > 0 && (
          <HiLoTable events={tide.events} timeZone={zone} />
        )}

        <p className="caption">
          {tideCaption(spot, {
            predictions: data.predictions,
            hilo,
            observed: data.observed,
            readings: tide.observed,
            today: data.today,
            isToday: selected.isToday,
          })}
        </p>
        <p className="caption">{weatherCaption(spot, forecast, data.today)}</p>
      </section>

      <DayList rows={rows} onSelect={selectDay} />
    </main>
  )
}
