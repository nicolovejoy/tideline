# Stage 1 design: Campus Point

Date: 2026-10-08. Status: design approved in conversation; this is the written spec for review.

## Goal

The smallest thing the first user can open on an iPhone and react to: one fixed spot, Campus Point at UCSB, showing sunset, tide, weather and moon side by side for today and the days ahead.

The app shows data. It gives no score, no go/no-go, and no alerts.

## Scope

In Stage 1:
- One hard-coded spot and one hard-coded tide station.
- A top strip for tonight: sunset, moon phase, moonrise and its flag.
- Four stacked panels for one day on a shared time axis with one touch cursor: tide, wind, temperature, sky.
- Today's observed water level drawn over the predicted tide curve.
- A high/low tide table for the selected day.
- A 14-day list. Every row has sunset, tides and moon. Rows inside the NWS forecast horizon also have weather.
- On-device cache so a repeat open draws without waiting on the network.
- Web manifest and icons so the page works from the iPhone home screen.

Not in Stage 1 (each is a GitHub issue): weather for days 8 to 10 (#1), more spots (#2), month view (#3), saving your own spots (#4), interpolated curves (#5), the install hint (#6), sharing (#7, #12), panel zoom and extra values (#8), elevation-adjusted times (#9), a server cache (#10), forecast history (#11), photos (#13).

## The spot

Hard-coded in `src/spot.ts`:

- Name: Campus Point
- Latitude 34.4046, longitude -119.8440
- Time zone: `America/Los_Angeles`
- NWS forecast cell: office `LOX`, grid 100,71. The cell is 2.5 km square with an average elevation of 3 ft.
- Tide station: NOAA 9411340 Santa Barbara, 8.6 mi east. It has both predictions and a gauge, and is the nearest station of either kind.

The NWS cell is hard-coded to skip a `/points` lookup on every open. NWS can re-map a point to a different cell on rare occasions; looking the cell up at run time arrives with #4.

## Screen

A single column, top to bottom. It is designed for a phone held upright and stays a centred single column on wider screens. It follows the system light or dark setting.

1. **Header.** Spot name.
2. **Tonight strip.** Sunset time; moon illumination and phase name; moonrise time, or "no moonrise today". When a moonrise falls within 2 hours of sunset, the strip shows it as a marked line: "Moonrise near sunset: 5:45 PM". The strip always describes today, whichever day is selected below.
3. **Day panels.** The selected day's date on the left and the time at the cursor on the right, written "at 4:00 PM" so it is not mistaken for a clock, then four panels sharing one time axis (see below).
4. **High/low table.** The selected day's highs and lows: time and height in feet.
5. **Source captions.**
   - "Tide: NOAA 9411340 Santa Barbara, 8.6 mi east. Observed through 2:06 PM, preliminary."
   - "Weather: NWS forecast for the 2.5 km cell at this spot, updated 7:26 AM."
6. **Day list.** 14 rows starting today. Tapping a row selects that day for the panels and the table. The selected row is marked.

### Panels

All four panels share one horizontal axis: the selected day from midnight to midnight in the spot's time zone. On a clock-change day the axis is 23 or 25 hours long.

- **Tide (ft).** Predicted curve at 6-minute resolution. On today only, the observed water level is drawn over it. The vertical range is fixed across all 14 days, so one day's curve can be compared with another's; it is widened if needed to fit today's observed level.
- **Wind (mph).** Sustained wind and gusts as two lines. The readout also gives direction as a compass point.
- **Temperature (°F).** One line.
- **Sky (%).** Cloud cover and chance of rain as two lines on a 0 to 100 scale.

Vertical lines cross all four panels at sunset, at moonrise if it falls in the selected day, and at the current time when the selected day is today. The lines carry no labels: the coloured bars beside "Sunset" and "Moon" in the tonight strip are their key, and the current-time line is dashed.

### Cursor and readouts

- One cursor runs through all four panels. A tap on any panel moves it there, and a sideways drag moves it with the finger. A finger moves nothing until it has travelled 6 px sideways, so a swipe up or down that starts on a panel scrolls the page and leaves the cursor alone. If the browser takes a touch over to scroll or zoom after it has begun to move the cursor, or a second finger goes down, the cursor goes back to where it was. A mouse moves the cursor while its button is held. The arrow keys move it one 6-minute step at a time, or an hour with Shift, and Home and End take it to the ends of the day.
- The cursor snaps to 6-minute steps.
- Each panel has a one-line readout above it showing its values at the cursor:
  - Tide: "0.8 ft predicted", plus "1.9 ft observed (+1.1)" when there is a reading at the cursor's own 6-minute step. The number in brackets is observed minus predicted, taken between the two numbers as they are shown, so the three always agree with each other. It can differ by 0.1 ft from a difference worked out at full precision.
  - Wind: "9 mph, gusts 12, from W"
  - Temperature: "74°F"
  - Sky: "3% cloud, 0% rain"
- Weather readouts use the forecast hour that contains the cursor.
- The cursor is always present, so the readouts show useful values before anything is touched. When the selected day is today it rests on the latest observed reading, if there is one from the past hour, and otherwise on the current time. NOAA publishes readings about ten minutes late, so a cursor resting on the current time would never have a reading under it. On any other day it rests at sunset. A cursor put somewhere by hand stays there until the day changes or the page is put away and brought back; then it goes back to rest, so reopening the app shows the latest reading.
- On a day beyond the forecast horizon, the three weather panels are replaced by one line: "No forecast this far out."

### Day list rows

Each row has up to three lines:

- Line 1: weekday and date; sunset time; moon illumination; the moonrise flag with its time when it applies.
- Line 2: that day's highs and lows, each with time and height.
- Line 3, only inside the forecast horizon: the forecast at the hour of sunset, as temperature, wind and gusts with direction, cloud cover, and chance of rain.

Line 3 uses the sunset hour, not a daily high and low, because sunset is the moment the rest of the row describes. This is a design choice to check against the first user's reaction.

## Data

The browser calls each source directly. All of them send `access-control-allow-origin: *` and need no key.

### NOAA tides

Base URL `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter`, with these parameters on every request: `station=9411340`, `datum=MLLW`, `units=english`, `time_zone=gmt`, `format=json`, `application=tideline`.

Timestamps are requested in GMT and converted to the spot's zone only for display. Station-local timestamps carry no offset and are ambiguous in the repeated hour of a clock change.

Three requests:

1. **Predicted curve:** `product=predictions&interval=6` for the UTC dates that cover the 14-day window. About 136 KB as JSON, 20 KB gzipped.
2. **Highs and lows:** `product=predictions&interval=hilo` for the same dates. These are NOAA's own times and heights, so the table matches the NOAA station page to the minute.
3. **Observed level:** `product=water_level` for the UTC dates that cover the spot's today. Six-minute readings, flagged preliminary.

Parsed form for all three: an array of `{ t: number, ft: number }` with `t` in epoch milliseconds; highs and lows also carry `type: 'H' | 'L'`. Rows with an empty value are dropped.

### NWS forecast

One request: `https://api.weather.gov/gridpoints/LOX/100,71`. This is the raw grid endpoint. It is used because `/forecast/hourly` has no gusts and no cloud cover.

Layers used: `temperature`, `windSpeed`, `windGust`, `windDirection`, `skyCover`, `probabilityOfPrecipitation`. Each layer is a list of values with an ISO 8601 interval such as `2026-10-08T08:00:00+00:00/PT3H`. Parsing expands each interval into one entry per hour and converts units: °C to °F, km/h to mph. Direction in degrees is turned into a 16-point compass name for display.

Parsed form: an array of hourly records `{ t, tempF, windMph, gustMph, windDeg, cloudPct, rainPct }`, where any field may be `null` if its layer has no value for that hour. NWS sends a layer it has no data for as an empty list with no unit; that leaves the field `null` and does not fail the forecast. `updateTime` from the response is kept for the caption.

The forecast runs about 7 days and 17 hours. A day is "inside the forecast horizon" if the forecast has a record for that day's sunset hour.

### Sun and moon

Computed on the device with `astronomy-engine`. No network.

For each of the 14 days, for the spot's coordinates at sea level:

- **Sunset:** the sunset that falls within that local day.
- **Moonrise:** the moonrise that falls within that local day, if there is one. About once a month a local day has none.
- **Moon illumination and phase name:** evaluated at that day's sunset. The name is New Moon, First Quarter, Full Moon or Last Quarter when that exact phase occurs during the local day; otherwise Waxing Crescent, Waxing Gibbous, Waning Gibbous or Waning Crescent by phase angle.
- **Moonrise flag:** set when a moonrise occurs between 2 hours before and 2 hours after that day's sunset. The search covers that window directly, so it does not depend on which calendar day the moonrise falls in. The flag carries the moonrise time.

Sunset and moonrise are reported to the nearest minute, which is how the Naval Observatory reports them. Cutting the seconds off instead would show a time one minute early on about half of all days. When the day's own moonrise falls in the flag's window, the flag carries that same instant.

Times assume a flat sea-level horizon, as most weather sites do. Elevation is #9.

## Time handling

- Every stored and computed time is a UTC instant in epoch milliseconds.
- Every displayed time and every calendar day is in the spot's time zone, using `Intl.DateTimeFormat` with an explicit `timeZone`. Nothing reads the viewer's zone, and nothing derives a day from a UTC ISO string.
- `src/time.ts` is the only module that knows about zones. It provides the start of a local day as an instant, the local date of an instant, and display formatting (12-hour clock).

## Cache

Saved in the browser's `localStorage`, one entry per source, each holding its data and the time it was fetched. All access is wrapped so that a browser with storage disabled still works, just without a cache.

On reading, an entry is checked against the shape its caller expects. One that fails, including a leftover from an older version of the app, is treated as nothing saved and is fetched again.

On open:
1. Draw at once from whatever is saved, however old.
2. Refetch each source that is stale, and redraw when it arrives.

Staleness rules:
- Predicted curve and highs/lows: stale when the saved data no longer covers the 14-day window. In practice that is one refetch per day.
- Forecast: stale after 1 hour.
- Observed level: stale after 6 minutes.

When the page becomes visible again after being in the background, the same staleness check runs. While the page stays open and in view it also runs once a minute, which keeps the current-time line moving and picks up new readings. A request with no answer after 20 seconds is given up on. After a failure a source is left alone for about a minute, counted from when the failed request was made, and then tried again.

## Failure behaviour

Each source loads and fails on its own.

- If a refresh fails and saved data exists, the saved data stays on screen and its caption says so and gives the time it was saved: "Couldn't refresh. Showing predictions from 2:05 PM."
- If a source fails and nothing is saved, its part of the screen says "Tide data unavailable" or "Forecast unavailable". The rest of the screen is unaffected.
- Sun and moon cannot fail; they are computed.

There is never a blank screen and never a full-screen error.

## Code layout

```
src/
  spot.ts               the fixed Campus Point configuration
  time.ts               spot-zone day boundaries and formatting
  data/noaa.ts          fetch and parse the three NOAA responses
  data/nws.ts           fetch and parse the raw forecast grid
  data/astro.ts         sunset, moonrise, phase, moonrise flag
  data/cache.ts         localStorage wrapper and staleness rules
  data/load.ts          cache-first loading rules and the loader for one source
  data/useSpotData.ts   what to load for the spot, and the hook that loads it
  chart/scales.ts       scales, bounds and SVG paths
  chart/readout.ts      values at the cursor, as pure functions
  chart/gesture.ts      telling a tap and a sideways drag from a scroll
  chart/Panel.tsx       one generic line panel
  chart/PanelStack.tsx  the four panels, shared cursor, vertical markers
  ui/captions.ts        the small print under the panels
  ui/tideView.ts        what the tide part of the screen shows
  ui/TonightStrip.tsx
  ui/HiLoTable.tsx
  ui/DayList.tsx
  App.tsx
  main.tsx
  styles.css
```

Everything under `data/` except the hook itself, plus `time.ts`, the `.ts` files under `chart/` and `ui/`, is plain TypeScript with no React, so it can be tested without a browser, and the data modules can later move behind a server function unchanged (#10). The components and the hook hold no arithmetic, no rules and no wording: they arrange what the plain modules return.

Dependencies: `react`, `react-dom`, `astronomy-engine`. The charts are hand-written SVG. The arithmetic behind them is about 90 lines in `chart/scales.ts`, so there is no charting library and no d3.

## Testing

Vitest. The logic lives in pure functions, so the tests need no DOM. The components and the few lines of hook that wire them to the loader are not unit-tested; they are checked in a browser against exact expected values, with touch emulated and with a fake clock, and on a real phone for touch.

- **NOAA and NWS parsing:** run against real responses saved as fixtures. The tide fixtures are for 2026-10-08, when the observed level ran about 1.1 ft above the prediction, so they cover the motivating case.
- **NWS interval expansion:** multi-hour intervals, unit conversion, hours with missing layers.
- **Sun and moon:** checked against US Naval Observatory values recorded for Campus Point. Sunset and moonrise must agree within 90 seconds (the Observatory rounds to the minute). The moonrise flag must be set on 23 to 28 October 2026 and not set on 20, 21, 29 or 30 October. 22 October sits within about a minute of the 2-hour threshold, so it is not asserted.
- **Time:** local day boundaries and axis length on 1 November 2026 (25 hours) and 14 March 2027 (23 hours). 2 November 2026 has no moonrise at this spot and is tested as such.
- **Cache:** each staleness rule, and behaviour when storage throws.
- **Readouts:** values at a cursor position, including the observed-minus-predicted number and missing data.

Before Stage 1 is called done, checked by hand on an iPhone:
- The high/low table matches the NOAA station page for the same day.
- Sunset and moonrise match the Naval Observatory.
- A second open draws immediately; in airplane mode it shows the saved data with its times.
- The page works from the home screen icon.

## Tooling

- Node 24 (`.nvmrc`), npm.
- Vite, React and TypeScript as the official Vite `react-ts` template sets them up: TypeScript 6.0.x, strict by default.
- Linting with oxlint, the template's linter. Formatting with Prettier, in the template's style (no semicolons, single quotes).
- Scripts: `dev`, `build`, `typecheck`, `lint`, `format`, `test`.
- Tests run with the device time zone set to Tokyo, so anything that leans on the viewer's zone instead of the spot's fails.
- GitHub Actions on every pull request and on `main`: install, lint, build (which type-checks), test.
- Vercel connected to the GitHub repo: a preview deployment for every pull request, production from `main`.
- Web manifest, a 180 px Apple touch icon, and 192 and 512 px icons. No service worker.

## Delivery

Four pull requests, each reviewed before merge:

1. Scaffold, tooling, CI, and the Vercel connection, deploying a placeholder page.
2. `time.ts` and everything under `data/` except the React hook, with fixtures and tests. No UI.
3. The loading hook, tonight strip, tide panel with the cursor, and the high/low table.
4. The three weather panels, the day list, failure states, the manifest and icons.
