import { useCallback, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Panel } from '../chart/Panel.tsx'
import { PanelStack } from '../chart/PanelStack.tsx'
import { cursorText } from '../chart/readout.ts'
import { linearScale } from '../chart/scales.ts'
import { useSpotData } from '../data/useSpotData.ts'
import { hasTides } from '../spot.ts'
import type { Spot } from '../spot.ts'
import { formatDay, formatTime } from '../time.ts'
import { WORDS, removeQuestion } from './addSpotView.ts'
import { sunCaption, tideCaption, weatherCaption } from './captions.ts'
import { DayList } from './DayList.tsx'
import { dayRows, tonightWords } from './dayList.ts'
import { HiLoTable } from './HiLoTable.tsx'
import { MonthView } from './MonthView.tsx'
import { dayMarkers, selectedDay } from './selection.ts'
import { ShareSpot } from './ShareSpot.tsx'
import { tideView } from './tideView.ts'
import type { CursorPick } from './tideView.ts'
import { TonightStrip } from './TonightStrip.tsx'
import { WeatherPanels } from './WeatherPanels.tsx'
import { weatherView } from './weatherView.ts'

const TIDE_HEIGHT = 168
/** Room above the highest tide for a rule's label. */
const HEADROOM = 14

interface SpotScreenProps {
  spot: Spot
  /** Given for a spot the user saved, which can be removed. */
  onRemove?: () => void
}

/**
 * Everything for one spot: tonight, the day's panels, its highs and lows,
 * the captions, the line to share it from and the 14 days, or the month
 * view in their place. Mounted afresh for each spot, so a switch starts
 * from saved data, today and a resting cursor, as a first open does.
 */
export function SpotScreen({ spot, onRemove }: SpotScreenProps) {
  const zone = spot.timeZone
  // A fact of the spot, not a choice: there is no switch.
  const tidal = hasTides(spot)
  // Said only where the spot's own height is counted.
  const sun = sunCaption(spot)
  const data = useSpotData(spot, tidal)
  const { days, spans, hilo, forecast } = data

  const [pickedDay, setPickedDay] = useState<string | null>(null)
  const [pick, setPick] = useState<CursorPick | null>(null)
  // The forecast, or one month at a time. Opens on the forecast; nothing
  // about the view is remembered.
  const [view, setView] = useState<'forecast' | 'month'>('forecast')
  const [month, setMonth] = useState<string | null>(null)
  // Removing asks once, on the line itself.
  const [removing, setRemoving] = useState(false)
  const selected = selectedDay(data, pickedDay)
  const tide = tideView(data, selected, pick, spot)
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
      dayRows(
        { now: data.now, days, spans, hilo, forecast },
        pickedDay,
        zone,
        tidal,
      ),
    [data.now, days, spans, hilo, forecast, pickedDay, zone, tidal],
  )

  const dayTop = useRef<HTMLElement>(null)
  const dayHeading = useRef<HTMLHeadingElement>(null)
  const selectDay = useCallback((date: string) => {
    setPickedDay(date)
    // The cursor goes back to rest, on this day and on the one left behind.
    setPick(null)
    // The panels are above the list, usually off screen. The page jumps to
    // them. A glide would move the list under a second tap and choose
    // whichever row had arrived under the finger.
    dayTop.current?.scrollIntoView({ block: 'start' })
  }, [])

  const openMonths = useCallback(() => {
    setView('month')
    window.scrollTo(0, 0)
  }, [])
  const backToForecast = () => {
    flushSync(() => {
      setView('forecast')
      setMonth(null)
      // Today on the panels, with the cursor at rest, as on a first open.
      setPickedDay(null)
      setPick(null)
    })
    // The button pressed has gone with the month view; focus goes to the
    // day's heading, not to the page.
    dayHeading.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }

  if (view === 'month') {
    return (
      <MonthView
        spot={spot}
        today={data.today}
        hilo={hilo}
        month={month}
        noTides={tide.noTides}
        onMonth={setMonth}
        onBack={backToForecast}
      />
    )
  }

  return (
    <>
      <TonightStrip words={tonight} />

      <section className="day" ref={dayTop}>
        <header className="day-head">
          <h2 ref={dayHeading} tabIndex={-1}>
            {formatDay(selected.date)}
          </h2>
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
              {tide.noTides !== null ? null : tide.notice !== null ? (
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
                          second line comes and goes. */}
                      <span
                        className={
                          tide.text.second?.key === 'observed'
                            ? 'key key-observed'
                            : undefined
                        }
                      >
                        {tide.text.second?.words}
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

        {/* Where the tide's caption goes: the caption, or why there is no
            tide here. */}
        <p className="caption">
          {tide.noTides ??
            tideCaption(spot, {
              predictions: data.predictions,
              hilo,
              observed: data.observed,
              readings: tide.readings,
              today: data.today,
              isToday: selected.isToday,
            })}
        </p>
        <p className="caption">{weatherCaption(spot, forecast, data.today)}</p>
        {sun !== null && <p className="caption">{sun}</p>}
        <ShareSpot spot={spot} />
        {onRemove &&
          (removing ? (
            <p className="caption remove-spot">
              <span>{removeQuestion(spot.name)}</span>{' '}
              <button type="button" className="text-button" onClick={onRemove}>
                {WORDS.removeYes}
              </button>{' '}
              <span aria-hidden="true">{WORDS.separator}</span>{' '}
              <button
                type="button"
                className="text-button"
                onClick={() => setRemoving(false)}
              >
                {WORDS.removeNo}
              </button>
            </p>
          ) : (
            <p className="caption remove-spot">
              <button
                type="button"
                className="text-button"
                onClick={() => setRemoving(true)}
              >
                {WORDS.remove}
              </button>
            </p>
          ))}
      </section>

      <DayList rows={rows} onSelect={selectDay} onMonths={openMonths} />
    </>
  )
}
