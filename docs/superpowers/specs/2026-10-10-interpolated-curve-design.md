# Interpolated tide curve design: a curve for stations that publish highs and lows only

Date: 2026-10-10. Status: written on the owner's "carry on" for issue #5, with the open decisions listed below for review on the pull request.

Issue: https://github.com/nicolovejoy/tideline/issues/5

## Goal

A tide curve, a cursor readout and a vertical scale for a spot whose nearest tide station is subordinate: 2,242 of NOAA's 3,502 prediction stations publish highs and lows only, and a 6-minute request to one of them returns an error. Today the three shipped spots all sit nearest a harmonic station, so no shipped spot changes. This is the groundwork that #4 (your own spots anywhere in the US) needs before it can pick the nearest station without regard to its kind: without it, a spot near Ventura, Port Hueneme or any of the island stations would have a table and no curve.

The product rule it fills: "A curve for these has to be interpolated and labeled as such" (CLAUDE.md, data sources).

## What the user sees

At a spot whose tide station has no curve of its own:

1. **The panel** draws a curve made from the station's highs and lows, filled in the same colour as a NOAA curve, with the cursor's dot on it and the highs and lows table under it as now. Nothing about the layout changes.
2. **The readout** says "3.2 ft interpolated" where a NOAA curve says "3.2 ft predicted". A screen reader is told the same words. "No prediction here" stays as it is, for a cursor off the curve.
3. **The caption** says where the curve comes from: "Tide: NOAA 9411189 Ventura, 33 mi east, highs and lows only. Curve interpolated between them, not NOAA's." Where the gauge is elsewhere, the gauge sentence follows as now; the "predictions only" tag a gauge elsewhere adds today is dropped at such a station, since "highs and lows only" already says it. A failed refresh is reported once, by the highs-and-lows sentence ("Couldn't refresh the high and low times. Showing those from Fri Oct 9, 2:06 PM."), never by the curve's sentence as well, because the curve comes from the same data.
4. **The hidden line, the 14-day list, the month view and the day's table** do not change. None of them draws the curve.
5. **While the highs and lows are loading** the panel says "Loading tides", and with none saved and the request failed, "Tide data unavailable", as a NOAA curve does.

Nothing else moves. The three shipped spots draw exactly what they draw today.

## Data

### Each station says whether it has a curve

`Station` in `src/spot.ts` gains `type: 'harmonic' | 'subordinate'`, NOAA's own distinction (`stationType` R or S in the station metadata). The three shipped stations are harmonic, verified against the metadata on 2026-10-10. A gauge station is assumed harmonic: a gauge elsewhere has its own curve fetched and set against its readings, and every observing station with predictions that this project has looked at has one. #4 chooses gauges, and chooses them from harmonic stations.

### No 6-minute request to a subordinate station

For a subordinate station `useSpotData` does not fetch predictions at all: the loader is made, as every loader is, but never asked to fetch, exactly as the gauge's own curve is not fetched where the gauge is the spot's station. In its place `predictions` is derived from the highs and lows: a `Loaded<TidePoint[]>` whose data is the interpolated curve over the 14-day window, whose `status` and `fetchedAt` are the highs and lows' own, and whose `span` is the window. Everything downstream (`tideView`, the captions, the bounds, the readout) takes `predictions` as it always has and does not know the difference, apart from the two places that put the word "interpolated" on screen.

### The highs and lows are fetched from the day before

The curve over today's first hours needs the last high or low of yesterday. The highs and lows are fetched from the midnight that starts yesterday at the spot, instead of today's, for every station: one rule, and the saved entry covers the needed span the same way it does now, so it is still fetched once a month, not once a day. The first use after this change fetches once more, for the earlier start. Nothing bumps the cache version. The 14-day window ends well inside the fetched span, so the curve's last hours are always bracketed too.

### The interpolation

Cosine between consecutive highs and lows: between an extreme at (t1, h1) and the next at (t2, h2), the height at t is

    (h1 + h2) / 2 + (h1 - h2) / 2 * cos(pi * (t - t1) / (t2 - t1))

which is h1 at t1, h2 at t2, level at both, and halfway between at the midpoint. One point per 6 minutes on the hour's boundaries in UTC, as NOAA's own points fall, from the first step at or after the span's start to the last at or before its end, both ends included where there is a bracketing pair. A step before the first high or low, or after the last, is left out rather than guessed. Fewer than two events give no points.

### Its error, measured

Against Santa Barbara's own 6-minute curve for 10 to 23 October 2026 (3,360 points, recorded on 2026-10-10):

- root mean square 0.19 ft, mean 0.08 ft
- 95 per cent of points within 0.33 ft
- worst 1.15 ft, at 10:30 UTC on 17 October, in a 16-hour run between a low and a high where NOAA's list skips a near-stand and the real curve has a shoulder the cosine cannot have

Linear interpolation on the same data: root mean square 0.31 ft, worst 0.92 ft. Cosine is closer nearly everywhere and the usual method; its one weakness is the long gap, which is the issue's "state the error". The test pins these numbers as ceilings.

## Rules, in plain modules

- `src/data/interpolate.ts` (new, framework-free): `interpolateCurve(events: TideExtreme[], span: Span): TidePoint[]`, the arithmetic above; `curveFromHiLo(hilo: Loaded<TideExtreme[]>, span: Span): Loaded<TidePoint[]>`, the derived source.
- `src/spot.ts`: `Station.type`; `hasOwnCurve(spot): boolean`, true for a harmonic tide station, beside `hasOwnGauge`.
- `src/data/useSpotData.ts`: `tideSpecs` asks for the highs and lows from the day before today; `useSpotData` fetches predictions only where `hasOwnCurve`, and derives them otherwise.
- `src/chart/readout.ts`: `tideWords(readout, curve: 'predicted' | 'interpolated')`, the readout's first line ending in that word.
- `src/ui/tideView.ts`: passes `'interpolated'` where the spot has no curve of its own; nothing else changes.
- `src/ui/captions.ts`: `tideCaption`'s station sentence for a subordinate station, the dropped "predictions only", and no curve-refresh sentence at such a station.
- Components: nothing. `SpotScreen` already hands `tideView` the spot, and the words come back in `text` and `words`.

## Testing

Fixtures recorded on 2026-10-10 and added to `src/data/__fixtures__/`:

- `noaa-predictions-9411340-20261010-20261023.json`: Santa Barbara's 6-minute curve for 10 to 23 October 2026 UTC, 3,360 points, the truth the interpolation is measured against.
- `noaa-hilo-9411340-20261009-20261024.json`: Santa Barbara's highs and lows for 9 to 24 October 2026 UTC, 58 events, one day either side of the curve so every point is bracketed.
- `noaa-hilo-9411189-20261009-20261024.json`: Ventura's highs and lows for the same days, 58 events, from a subordinate station.
- `noaa-predictions-9411189-error.json`: NOAA's answer to a 6-minute request at Ventura, the error body a subordinate station returns.

Tests run with `TZ=Asia/Tokyo`, so anything that leaned on the viewer's zone would show.

- `interpolate.test.ts`: the endpoints and the midpoint of one pair; points fall on 6-minute boundaries from the hour in UTC; both ends of the span included; steps before the first event and after the last are left out; one event, or none, gives no points; the error against Santa Barbara's real curve is under the ceilings above (root mean square 0.2 ft, 95th percentile 0.35 ft, worst 1.2 ft); `curveFromHiLo` carries the highs and lows' status and stamp and gives null data while they are null.
- `noaa.test.ts`: `parsePredictions` on the Ventura error body throws with NOAA's message.
- `spot.test.ts`: every shipped station is harmonic; `hasOwnCurve`.
- `useSpotData.test.ts`: the highs and lows' needed span starts a day before today's midnight; predictions still take the 14-day window.
- `readout.test.ts`: `tideWords` with `'interpolated'`.
- `tideView.test.ts`: at a spot with a subordinate station, the readout's first line says "interpolated" and so do the spoken words; the curve and dots are drawn as for a harmonic one.
- `captions.test.ts`: the caption at a subordinate station with a gauge elsewhere, ready, stale and unavailable.

Checked in a browser against the live API by pointing a spot at Ventura 9411189 in a scratch edit that is not committed: the curve draws, the cursor reads "interpolated", the highs and lows on the table sit on the curve's peaks and troughs, the caption reads as above, the network log shows no 6-minute request to the station, and Campus Point is unchanged.

## Decisions this spec makes that the issue leaves open

1. **Cosine, not linear and not the rule of twelfths.** Measured above: cosine is closer nearly everywhere. The rule of twelfths is a hand approximation of the same cosine.
2. **The word is "interpolated", in the readout and the caption, and the curve looks the same.** A dashed or paler curve would need a second key colour and a legend; one word at the cursor and one sentence under the panel say it. The panel title stays "Tide".
3. **One rule for the highs-and-lows span, not a branch for subordinate stations.** Every spot fetches from the day before, for the price of one extra request on the first open after this ships.
4. **No point is guessed outside the first and last high or low.** A short gap at the plot's edge is honest; a guessed slope is not.
5. **Points on 6-minute boundaries, as NOAA's are.** The readout, the cursor's snap and the observed readings all work in those steps already.
6. **A gauge is assumed harmonic.** Noted for #4, which will choose gauges, rather than handled here for a case no spot has.
7. **No shipped spot changes.** Adding a spot to show the feature is the first user's call (the spots are theirs), and #4 is where new spots come from.
