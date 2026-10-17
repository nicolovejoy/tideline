import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Panel } from '../chart/Panel.tsx'
import { PanelStack } from '../chart/PanelStack.tsx'
import { cursorText } from '../chart/readout.ts'
import { linearScale } from '../chart/scales.ts'
import { useSpotData } from '../data/useSpotData.ts'
import { hasTides } from '../spot.ts'
import type { Spot } from '../spot.ts'
import { todaysObserved } from '../data/observed.ts'
import {
  observedCaption,
  sunCaption,
  tideCaption,
  weatherCaption,
} from './captions.ts'
import { DayList } from './DayList.tsx'
import { dayRows, tonightWords } from './dayList.ts'
import { HiLoTable } from './HiLoTable.tsx'
import { MonthView } from './MonthView.tsx'
import { readSpan, writeSpan } from './choices.ts'
import { selectedDay, unlabelled } from './selection.ts'
import { ShareSpot } from './ShareSpot.tsx'
import { HELP } from './helpText.ts'
import { HelpSheet } from './HelpSheet.tsx'
import { SpanControl } from './SpanControl.tsx'
import {
  cursorWords,
  headingWords,
  stackLabels,
  windowBands,
  windowMarkers,
} from './spanView.ts'
import type { SpanChoice } from './spanView.ts'
import { tideView } from './tideView.ts'
import type { CursorPick } from './tideView.ts'
import { TonightStrip } from './TonightStrip.tsx'
import { closeView, openView, useView } from './useView.ts'
import { WeatherPanels } from './WeatherPanels.tsx'
import { weatherView } from './weatherView.ts'

const TIDE_HEIGHT = 200
/** Room above the highest tide for a rule's label and the event lines' names. */
const HEADROOM = 26

interface SpotScreenProps {
  spot: Spot
}

/**
 * Everything for one spot: tonight, the day's panels, its highs and lows,
 * the captions, the line to share it from and the 14 days, or the month
 * view in their place. Mounted afresh for each spot, so a switch starts
 * from saved data, today and a resting cursor, as a first open does.
 */
export function SpotScreen({ spot }: SpotScreenProps) {
  const zone = spot.timeZone
  // A fact of the spot, not a choice: there is no switch.
  const tidal = hasTides(spot)
  // Said only where the spot's own height is counted.
  const sun = sunCaption(spot)
  const data = useSpotData(spot, tidal)
  const { days, spans, hilo, forecast } = data

  const [pickedDay, setPickedDay] = useState<string | null>(null)
  const [pick, setPick] = useState<CursorPick | null>(null)
  // The forecast, or one month at a time. The month view has an entry in
  // the browser's history, so going back closes it. Which month was on
  // screen is not remembered.
  const view = useView()
  const monthOpen = view === 'month'
  // The help sheet, over the panels. It has an entry in the history too.
  const helpOpen = view === 'help'
  const [month, setMonth] = useState<string | null>(null)
  // A day, three or a week from the chosen day. Kept for a reload; choosing
  // a spot forgets it.
  const [span, setSpan] = useState<SpanChoice>(readSpan)
  const chooseSpan = useCallback((choice: SpanChoice) => {
    setSpan(choice)
    writeSpan(choice)
  }, [])
  const selected = selectedDay(data, pickedDay, span)
  const tide = tideView(data, selected, pick, spot)
  const observedToday = todaysObserved(
    data.station,
    data.observedWeather,
    data.day,
  )
  const weather = weatherView(
    forecast,
    selected,
    tide.cursor,
    data.now,
    observedToday,
  )
  const observed = observedCaption(
    spot,
    data.station,
    data.observedWeather,
    data.day,
    selected.isToday,
  )
  const cursorTime = cursorWords(tide.cursor, zone, selected.window)
  const markers = windowMarkers(days, selected.window, data.now)
  const bands = windowBands(days, selected.window)
  // Not memoized: the window is a new object at each drawing, and the labels
  // are a handful.
  const labels = stackLabels(selected.window, zone, span)

  const tonight = useMemo(() => tonightWords(days[0], zone), [days, zone])
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
    // On a phone the panels are above the list, usually off screen. In a
    // wide window they are beside it, and not always all in the window. The
    // page jumps to them either way. A glide would move the list under a
    // second tap and choose whichever row had arrived under the finger.
    dayTop.current?.scrollIntoView({ block: 'start' })
  }, [])

  const openMonths = useCallback(() => openView('month'), [])
  const openHelp = useCallback(() => openView('help'), [])
  // When the sheet closes, focus goes back to the button that opened it.
  const helpButton = useRef<HTMLButtonElement>(null)
  const shownHelp = useRef(helpOpen)
  useEffect(() => {
    if (shownHelp.current === helpOpen) return
    shownHelp.current = helpOpen
    if (!helpOpen) helpButton.current?.focus({ preventScroll: true })
  }, [helpOpen])
  // Each time the month view comes up, by its button or by the browser
  // going forward, the forecast under it is put back to today, with the
  // cursor at rest, and the month to this one. Set on the way in, so that
  // every way back finds the forecast as on a first open. Done while
  // drawing, as React asks of state that follows another value, so nothing
  // of what was there before is seen.
  const [wasMonth, setWasMonth] = useState(monthOpen)
  if (wasMonth !== monthOpen) {
    setWasMonth(monthOpen)
    if (monthOpen) {
      setPickedDay(null)
      setPick(null)
      setMonth(null)
    }
  }
  // The page goes to its top each time the month view comes up or goes.
  // When it goes, the button pressed has gone with it, and focus goes to
  // the day's heading, not to the page.
  const shownMonth = useRef(monthOpen)
  useLayoutEffect(() => {
    if (shownMonth.current === monthOpen) return
    shownMonth.current = monthOpen
    if (!monthOpen) dayHeading.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [monthOpen])

  if (monthOpen) {
    return (
      <MonthView
        spot={spot}
        today={data.today}
        hilo={hilo}
        month={month}
        noTides={tide.noTides}
        onMonth={setMonth}
        onBack={closeView}
      />
    )
  }

  return (
    <>
      <TonightStrip words={tonight} />

      <section className="day" ref={dayTop}>
        <header className="day-head">
          <h2 ref={dayHeading} tabIndex={-1}>
            {headingWords(days, selected.window)}
          </h2>
          <p className="day-cursor">at {cursorTime}</p>
        </header>
        <div className="day-controls">
          <SpanControl span={span} onSpan={chooseSpan} />
          <button
            type="button"
            className="text-button help-button"
            aria-label={HELP.button}
            ref={helpButton}
            onClick={openHelp}
          >
            ?
          </button>
        </div>
        {helpOpen ? <HelpSheet onClose={closeView} /> : null}

        <PanelStack
          start={selected.window.start}
          end={selected.window.end}
          labels={labels}
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
                  bands={bands}
                  markers={markers}
                  cursor={tide.cursor}
                  dots={tide.dots}
                />
              )}
              <WeatherPanels
                view={weather}
                width={width}
                x={x}
                markers={unlabelled(markers)}
                cursor={tide.cursor}
                start={selected.window.start}
                bands={bands}
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
        {observed !== null && <p className="caption">{observed}</p>}
        {sun !== null && <p className="caption">{sun}</p>}
        <ShareSpot spot={spot} />
      </section>

      <DayList rows={rows} onSelect={selectDay} onMonths={openMonths} />
    </>
  )
}
