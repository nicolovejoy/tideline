# Three spots design: Campus Point, Gaviota, La Cumbre Peak

Date: 2026-10-09. Status: written on the owner's "get rolling" for issue #2, with the open decisions listed below for review on the pull request.

Issue: https://github.com/nicolovejoy/tideline/issues/2

## Goal

Two fixed spots beside Campus Point, with a way to switch between them. Each exercises a case the single spot does not:

- **Gaviota State Park:** its tide station has a predicted curve but no gauge. The nearest gauge is 31 mi away. The screen shows that gauge's deviation from its own prediction, labelled with the station's name and distance. It never draws another station's measured level on this spot's curve and never redraws the curve with the deviation applied.
- **La Cumbre Peak:** inland, at 3,997 ft, 6.3 mi from the nearest tide station. Tides are hidden by default and collapse to one line naming the nearest station, with a control to show them.
- **Forecast cells:** each spot has its own NWS cell. The caption gives the cell's elevation, so a reader can see that La Cumbre's cell averages 3,258 ft, well below the summit.

Spots are still hard-coded. Saving your own is #4. Sharing is #7. Nothing here writes a URL.

## The spots

All in `src/spot.ts`, as `SPOTS`, in this order. Facts verified against the live APIs on 2026-10-09.

| | Campus Point | Gaviota State Park | La Cumbre Peak |
|---|---|---|---|
| id | `campus-point` | `gaviota` | `la-cumbre-peak` |
| lat, lon | 34.4046, -119.8440 | 34.4716, -120.2284 | 34.4939, -119.7147 |
| time zone | America/Los_Angeles | same | same |
| NWS cell | LOX 100,71 | LOX 87,76 | LOX 105,74 |
| cell elevation | 3 ft | 0 ft | 3,258 ft |
| spot elevation | — | — | 3,997 ft (the summit) |
| tide station (predictions) | 9411340 Santa Barbara, 8.6 mi east | 9411399 Gaviota State Park, 0.2 mi south | 9411340 Santa Barbara, 6.3 mi south |
| gauge (observed level) | the same station | 9411340 Santa Barbara, 31 mi east | the same station |
| tides by default | shown | shown | hidden |

Both NOAA stations are harmonic, so both return a 6-minute curve. 9411399 returns an error for `water_level`, so Gaviota's observed level comes from Santa Barbara. Directions are the 8-point compass name of the bearing from the spot to the station.

The `Spot` type gains:

```ts
interface Station {
  id: string
  name: string
  distanceMi: number
  direction: string
}
interface Spot {
  id: string
  name: string
  lat: number
  lon: number
  timeZone: string
  /** The spot's own height, where it is worth saying: a peak. */
  elevationFt: number | null
  nws: { office: string; gridX: number; gridY: number; elevationFt: number }
  /** Where the predicted curve and the highs and lows come from. */
  tideStation: Station
  /** Where the observed level comes from. The tide station itself when it has a gauge. */
  gauge: Station
  /** Whether the tide is shown until the user says otherwise. Hidden inland. */
  tidesShown: boolean
}
```

`CAMPUS_POINT` stays exported, as `SPOTS[0]`.

## Screen

The single column is unchanged apart from these:

1. **Header.** The spot's name, as now. Under it, a row of three buttons naming the spots, the current one marked (`aria-pressed`). Tapping one switches the whole screen to that spot: tonight strip, panels, table, captions and list. The chosen day and the cursor go back to rest, as they do at midnight.
2. **Tide panel, spot with its own gauge** (Campus Point, and La Cumbre once shown): exactly as now.
3. **Tide panel, spot with a separate gauge** (Gaviota): the spot's own predicted curve, with no observed series and no observed dot. The readout's second line, which at Campus Point reads "1.9 ft observed (+1.1)", instead reads the gauge's deviation at the cursor's step: "Santa Barbara gauge +1.2 ft vs its prediction". It is there on today only, when the gauge has a reading at that step and its own prediction at that step; otherwise the slot is blank, as the observed slot is now. The sign is always written: "+1.2 ft", "-0.3 ft", "0.0 ft" (never "-0.0"). The difference is taken between the two values rounded to a tenth, as the observed-minus-predicted number is now, so it agrees with what a station page would show. On today the cursor rests on the gauge's latest reading, as it rests on the latest reading at Campus Point.
4. **Tide hidden** (La Cumbre by default): where the tide panel, the table and the tide caption would be, one line in the notice style: "Tides hidden. Nearest station: NOAA 9411340 Santa Barbara, 6.3 mi south." followed by a "Show tides" button, placed above the panel stack so the stack's cursor handling does not take its tap. Showing them draws the panel, table and caption as for a spot with its own gauge, and puts a "Hide tides" button after the tide caption. Only a spot that hides its tide by default offers "Hide tides". The choice is remembered per spot on the device. While hidden, the tide sources are not fetched. The list's rows omit their tide line.
5. **Weather caption.** Gains the cell's elevation, and the update time becomes its own sentence. Campus Point: "Weather: NWS forecast for the 2.5 km cell at this spot, 3 ft above sea level. Updated 7:26 AM." La Cumbre: "Weather: NWS forecast for the 2.5 km cell at this spot, which averages 3,258 ft above sea level; the spot itself is at 3,997 ft. Updated 7:26 AM." The second form is used whenever the spot has its own elevation. Thousands get a comma.
6. **Tide caption, separate gauge.** "Tide: NOAA 9411399 Gaviota State Park, 0.2 mi south, predictions only. Gauge: NOAA 9411340 Santa Barbara, 31 mi east, observed through 2:06 PM, preliminary." The failure sentences stay as they are, with "the observed level" meaning the gauge's.
7. **Screen reader words.** The tide panel's run of words uses the same text as the readout: "Tide: 2.0 ft predicted, Santa Barbara gauge +1.2 ft vs its prediction". Hidden tides say the hidden line.

Everything else, including the tonight strip, the sun and moon, the markers and the forecast panels, is per spot already and just follows the spot.

## Data

### Per spot

`useSpotData(spot)` already keys its cache entries by spot id. Two additions:

- **`gaugePredictions`**, a new source, `'gauge-predictions'` in the cache: the gauge station's own 6-minute curve for today, needed only when the gauge is not the tide station. Staleness as for predictions: good while it covers the span. For a spot whose gauge is its tide station, the gauge's prediction is the spot's own `predictions`, and nothing extra is fetched.
- **`observed`** is fetched from `spot.gauge.id`, not `spot.tideStation.id`.

`SpotData` gains `gaugePredictions: Loaded<TidePoint[]>`. For a spot whose gauge is its own station, that field is the same object as `predictions`.

### Wanted or not

`useLoaded` gains a third argument, `wanted: boolean`. The loader is always created, so hooks are called in one order, but it never fetches while `wanted` is false. Tide sources are wanted only while tides are shown; gauge predictions only when the gauge is a different station. Switching tides on starts the fetches without remounting anything.

### Switching spots

The spot is state in `App`, read on first render from the device, default Campus Point. The screen for a spot is one component rendered with `key={spot.id}`, so a switch mounts fresh loaders, a fresh picked day and a fresh cursor, exactly as a first open does.

### Remembered on the device

A plain module `src/ui/choices.ts`, wrapped like the cache so a browser without storage still works:

- `tideline:spot`: the id of the spot last chosen. An id that is not one of the spots means Campus Point.
- `tideline:tides:<spot id>`: `'shown'` or `'hidden'`. Absent means the spot's default.

## Rules, in plain modules

- `src/spot.ts`: `Station`, the three spots as `SPOTS`, `spotById`, `hasOwnGauge`.
- `src/ui/choices.ts`: `readSpot()` (the remembered spot, by `spotById`), `writeSpot(spot)`, `readTidesShown(spot)`, `writeTidesShown(spot, shown)`.
- `src/data/useSpotData.ts`: `tideSpecs` gains the gauge-predictions spec and takes the observed station from `spot.gauge`; `useLoaded(spec, now, wanted)`; `useSpotData(spot, tidesShown)`.
- `src/data/cache.ts`: `Source` gains `'gauge-predictions'`, stale like predictions.
- `src/chart/readout.ts`: `gaugeWords(name, aboveFt)`, with the sign rule above. The deviation itself is `tideReadout` run on the gauge's own prediction and its readings, so one rule serves both.
- `src/ui/tideView.ts`: takes `{ spot, shown }`; draws the observed series only when the gauge is the tide station; `text.second` is the reading or the gauge line; `readings` is the gauge's readings for the caption; `hidden: string | null` when tides are hidden, and then no series, no rules, no events; `canHide`.
- `src/ui/captions.ts`: `tideCaption` adds the "predictions only. Gauge: …" form; `weatherCaption` adds the elevation sentence.
- `src/ui/dayList.ts`: `dayRows` takes `tidesShown` and leaves `tides` empty when false.
- Components: `SpotSwitcher.tsx` (the row of buttons), `TidesHidden.tsx` (the one line and its button), and `App.tsx` split into `App` (which spot) and `SpotScreen` (everything for one spot). No arithmetic, rules or wording in any of them.

## Testing

Fixtures recorded on 2026-10-09 and already in `src/data/__fixtures__/`:

- `noaa-hilo-9411399-20261009-20261023.json`, `noaa-predictions-9411399-20261009-20261010.json`: Gaviota's highs and lows and 6-minute curve.
- `noaa-predictions-20261009-20261010.json`, `noaa-water-level-20261009-20261010.json`: Santa Barbara's curve and readings for the 9th, recorded at 17:00 UTC, when the level ran 1.2 ft above the prediction. These are the gauge pair for Gaviota.
- `nws-gridpoint-LOX-87-76.json`, `nws-gridpoint-LOX-105-74.json`: the two new cells. Their `elevation` values are 0 m and 993.0384 m.

Tests, beside each module:

- `spot.test.ts`: the three ids in order; the three cells differ; each cell's elevation is NWS's own from the fixture, in feet; Gaviota's gauge is Santa Barbara; defaults for tides shown; an unknown id is Campus Point.
- `choices.test.ts`: each remembered choice round-trips, an unknown spot id falls back, and broken storage falls back.
- `cache.test.ts`: gauge predictions are stale by coverage.
- `useSpotData.test.ts`: `tideSpecs` fetches observed from the gauge; gauge predictions are wanted only for a separate gauge.
- `readout.test.ts`: `gaugeWords`, including "+1.2 ft", "-0.3 ft" and "0.0 ft".
- `tideView.test.ts`: Gaviota draws no observed series; the readout shows the gauge deviation at the cursor on today and nothing on other days; hidden tides give no series and the hidden words; the cursor rests on the gauge's latest reading.
- `captions.test.ts`: the three weather captions and the Gaviota tide caption.
- `dayList.test.ts`: rows omit tides when hidden.

Checked in a browser against the live APIs: each spot's screen, the switcher, the Gaviota readout naming the Santa Barbara gauge with a signed number, La Cumbre's hidden line and its toggle surviving a reload, no tide entries saved while hidden, and the captions.

## Decisions this spec makes that the issue leaves open

1. **The deviation is read at the cursor's step, like the observed reading, not as one fixed "latest" number.** The cursor rests on the latest reading, so the first thing seen is the latest deviation, and dragging shows how it ran through the day. This reuses the existing cursor rules unchanged.
2. **The switcher is a row of buttons under the title, not a menu and not a route.** Three fixed names fit on one line. The URL does not change: what a spot's address looks like is for #7 to decide.
3. **Hidden tides also drop the rows' tide lines.** A spot that hides its tide panel should not list highs and lows below.
4. **The hidden line names the nearest station with distance and direction,** and the "Show tides" choice is kept per spot, so showing them at La Cumbre does not show them anywhere else.
5. **The cell's elevation goes in the weather caption, not a new line,** since the caption is where the cell is already explained.
6. **Switching spots resets the chosen day and the cursor.** A day picked at one spot has no meaning at another.
