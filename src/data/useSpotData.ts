// Everything the screen needs for one spot, loaded cache-first. This is the
// only place React meets the data layer. The rules are in load.ts, and what
// to load is decided by the two plain functions below.

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { astroForDays } from './astro.ts'
import type { DayAstro } from './astro.ts'
import type { Span } from './cache.ts'
import { createLoader } from './load.ts'
import type { Loaded, SourceSpec } from './load.ts'
import {
  fetchHiLo,
  fetchPredictions,
  fetchWaterLevel,
  isTideExtremes,
  isTidePoints,
} from './noaa.ts'
import type { TideExtreme, TidePoint } from './noaa.ts'
import { curveFromHiLo } from './interpolate.ts'
import { fetchForecast, isForecast } from './nws.ts'
import type { Forecast } from './nws.ts'
import { hasOwnCurve, hasOwnGauge } from '../spot.ts'
import type { Spot } from '../spot.ts'
import {
  MINUTE,
  addDays,
  addMonths,
  localDate,
  localDayStart,
  monthOf,
} from '../time.ts'

const DAYS = 14

/** How many months past this one the month view offers. */
export const MONTHS_AHEAD = 3

export interface SpotData {
  /** The current instant. Advances every minute and when the page is shown. */
  now: number
  /** How many times the page has come back into view since it was opened. */
  shown: number
  /** Today's date at the spot, and the instants it starts and ends. */
  today: string
  day: Span
  /** The 14 local days starting today. */
  window: Span
  /**
   * From today to the end of the last month the month view offers. The
   * highs and lows are fetched for all of it, in one request.
   */
  ahead: Span
  /**
   * From the midnight that starts yesterday to the end of `ahead`. The highs
   * and lows are fetched for all of it: a curve interpolated from them needs
   * yesterday's last extreme to start today's first hours from.
   */
  hiloSpan: Span
  days: DayAstro[]
  /** When each of those days starts and ends, in the same order. */
  spans: Span[]
  predictions: Loaded<TidePoint[]>
  hilo: Loaded<TideExtreme[]>
  observed: Loaded<TidePoint[]>
  /**
   * The gauge station's own predicted curve for today, so its reading can be
   * set against its own prediction. For a spot whose gauge is its tide
   * station this is `predictions` itself.
   */
  gaugePredictions: Loaded<TidePoint[]>
  forecast: Loaded<Forecast>
}

/**
 * The spans of time, and the sun and moon, for the 14 days from today; ahead,
 * which runs to the end of the third month ahead; and hiloSpan, which begins
 * the day before.
 */
export function frameFor(
  spot: Spot,
  today: string,
): Pick<SpotData, 'day' | 'window' | 'ahead' | 'hiloSpan' | 'days' | 'spans'> {
  // One more local midnight than there are days: each day runs from its own
  // midnight to the next, which on a clock-change day is 23 or 25 hours on.
  const midnights = Array.from({ length: DAYS + 1 }, (_, i) =>
    localDayStart(addDays(today, i), spot.timeZone),
  )
  const spans = Array.from({ length: DAYS }, (_, i) => ({
    start: midnights[i],
    end: midnights[i + 1],
  }))
  const lastMonth = addMonths(monthOf(today), MONTHS_AHEAD)
  const ahead = {
    start: midnights[0],
    end: localDayStart(`${addMonths(lastMonth, 1)}-01`, spot.timeZone),
  }
  const hiloSpan = {
    start: localDayStart(addDays(today, -1), spot.timeZone),
    end: ahead.end,
  }
  return {
    day: spans[0],
    window: { start: midnights[0], end: midnights[DAYS] },
    ahead,
    hiloSpan,
    days: astroForDays(spot, today, DAYS),
    spans,
  }
}

/** What to load for the tide: which source, for which span, and how. */
export function tideSpecs(
  spot: Spot,
  frame: Pick<SpotData, 'day' | 'window' | 'ahead' | 'hiloSpan'>,
): {
  predictions: SourceSpec<TidePoint[]>
  hilo: SourceSpec<TideExtreme[]>
  observed: SourceSpec<TidePoint[]>
  gaugePredictions: SourceSpec<TidePoint[]>
} {
  const station = spot.tideStation.id
  const gauge = spot.gauge.id
  const noPoints = (data: unknown[]) => data.length === 0
  return {
    predictions: {
      spotId: spot.id,
      source: 'predictions',
      isData: isTidePoints,
      needed: frame.window,
      fetch: (needed) => fetchPredictions(station, needed.start, needed.end),
      isEmpty: noPoints,
    },
    hilo: {
      spotId: spot.id,
      source: 'hilo',
      isData: isTideExtremes,
      // The month view lists highs and lows months ahead, and a curve
      // interpolated from them needs yesterday's last one. They never
      // change, so one longer request a month costs less than a shorter one
      // every day.
      needed: frame.hiloSpan,
      fetch: (needed) => fetchHiLo(station, needed.start, needed.end),
      isEmpty: noPoints,
    },
    observed: {
      spotId: spot.id,
      source: 'observed',
      isData: isTidePoints,
      // Readings are only drawn for today, so only today is asked for.
      needed: frame.day,
      fetch: (needed) => fetchWaterLevel(gauge, needed.start, needed.end),
      // Just after midnight there are no readings yet, and that is fine.
      isEmpty: () => false,
    },
    // Only fetched where the gauge is another station. Its readings are
    // set against its own prediction, not the spot's.
    gaugePredictions: {
      spotId: spot.id,
      source: 'gauge-predictions',
      isData: isTidePoints,
      needed: frame.day,
      fetch: (needed) => fetchPredictions(gauge, needed.start, needed.end),
      isEmpty: noPoints,
    },
  }
}

/** What to load for the weather. */
export function forecastSpec(
  spot: Spot,
  frame: Pick<SpotData, 'window'>,
): SourceSpec<Forecast> {
  const { office, gridX, gridY } = spot.nws
  return {
    spotId: spot.id,
    source: 'forecast',
    isData: isForecast,
    // NWS decides how far the forecast runs. It goes stale by age, not by
    // which days it covers, so the window is only recorded with what is saved.
    needed: frame.window,
    fetch: () => fetchForecast(office, gridX, gridY),
    isEmpty: (forecast) => forecast.hours.length === 0,
  }
}

function useClock(): Pick<SpotData, 'now' | 'shown'> {
  const [clock, setClock] = useState(() => ({ now: Date.now(), shown: 0 }))
  useEffect(() => {
    const timer = setInterval(() => {
      // No point rechecking a page nobody can see.
      if (document.visibilityState !== 'visible') return
      setClock((was) => ({ ...was, now: Date.now() }))
    }, MINUTE)
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      setClock((was) => ({ now: Date.now(), shown: was.shown + 1 }))
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return clock
}

/**
 * One source over time. The loader is always made, so the hooks are called
 * in one order, but it fetches nothing while `wanted` is false: a hidden
 * tide is not loaded, a gauge's own prediction is not loaded where the
 * gauge is the spot's own station, and a curve is not loaded where the
 * station publishes none.
 */
function useLoaded<T>(
  spec: SourceSpec<T>,
  now: number,
  wanted: boolean,
): Loaded<T> {
  const [loader] = useState(() => createLoader(spec, now))
  // After every render. The loader decides whether anything needs fetching,
  // and guards against asking twice or retrying a failure too soon.
  useEffect(() => {
    if (wanted) loader.check(spec, now)
  })
  return useSyncExternalStore(loader.subscribe, loader.current)
}

export function useSpotData(spot: Spot, tidesShown: boolean): SpotData {
  const { now, shown } = useClock()
  const today = localDate(now, spot.timeZone)
  // Recomputed only when the date at the spot changes, such as at midnight
  // on a phone left open.
  const frame = useMemo(() => frameFor(spot, today), [spot, today])
  const specs = tideSpecs(spot, frame)
  const ownGauge = hasOwnGauge(spot)
  const ownCurve = hasOwnCurve(spot)

  // A subordinate station publishes no curve, and a 6-minute request to it
  // returns an error, so its loader is never asked to fetch. Its curve is
  // made from the highs and lows instead.
  const fetched = useLoaded(specs.predictions, now, tidesShown && ownCurve)
  const hilo = useLoaded(specs.hilo, now, tidesShown)
  const predictions = useMemo(
    () => (ownCurve ? fetched : curveFromHiLo(hilo, frame.window)),
    [ownCurve, fetched, hilo, frame.window],
  )
  const observed = useLoaded(specs.observed, now, tidesShown)
  const gaugeOwn = useLoaded(
    specs.gaugePredictions,
    now,
    tidesShown && !ownGauge,
  )
  const gaugePredictions = ownGauge ? predictions : gaugeOwn
  const forecast = useLoaded(forecastSpec(spot, frame), now, true)

  return {
    now,
    shown,
    today,
    ...frame,
    predictions,
    hilo,
    observed,
    gaugePredictions,
    forecast,
  }
}
