# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Stage 1 is built; its phone check is down to one item. Stage 2 has begun: three spots, the month view, the interpolated curve, own spots from a map, place search by name, share by link and two columns in a wide window are merged and live.

- Built: the scaffold, tooling and CI; the data layer; and the screen for Campus Point, which shows tonight's sunset and moon, four panels on one time axis for any of the next 14 days (the tide with today's observed level, wind, temperature, sky), that day's high/low table, the 14-day list, and the manifest and icons; then three spots with a switcher (Campus Point, Gaviota State Park, La Cumbre Peak), the Santa Barbara gauge's deviation at Gaviota, and no tides at La Cumbre; then the month view (this month and the next three, sunset, moon and highs and lows per day); then a curve interpolated from the highs and lows for stations that publish only those, labelled "interpolated" (a saved spot at a subordinate station uses it); then your own spots: a pin on a map (Leaflet, OpenStreetMap tiles) or the device's location, named and saved on the device, with the NWS cell, the spot's own height from USGS, and the nearest tide station and nearest gauge worked out from a baked station list (`scripts/bake-stations.mjs`, `src/data/stations.json`); then a place name typed on the add screen, looked up with OpenStreetMap's Nominatim (`src/data/geocode.ts`), which prefers places in the map's view, pans the map there and drops the pin; then a link to share any spot by (`src/ui/shareView.ts`), which carries the spot's name and its coordinates to four places and nothing else: opening one shows the spot, looked up as a new pin is, with Save to keep a copy on the device and Close to leave it, and a link to a point the device already has a spot at opens that spot; then two columns in a window 1,000 px wide or more, the 14 days beside the panels and the month view's days in two columns, with "Months ahead" an outlined button beside the "14 days" heading; then sunset and moonrise worked out from the spot's own height where it is 100 ft up or more and near the sea (`src/data/horizon.ts`), with a caption that says so; then an Edit button beside a saved spot's name, which opens the add screen as "Edit spot" with the name, the pin and the facts filled in, where the name or the pin can be changed (a rename keeps the spot's data; a move looks the new point up and saves it under a new id in the same place in the row) and from which the spot is removed; and the moon line in tonight's strip as "Moonrise 5:00 AM"; from 2026-10-17 the three starting spots are seeded into the saved list the first time the app reads it (`readSpots` in `src/data/savedSpots.ts`, marked by `tideline:spots:seeded:v1`) and are the user's from then on, so every spot has Edit and can be renamed, moved or removed, except the last one, whose edit screen says to add another first. Then the wind as an arrow per hour (`src/chart/arrows.ts`), at the hour's speed and pointing where the wind is going, thinned where an hour is narrower than 12 px, with the words "10 mph from WSW, gusts 14" and "Calm"; and the night, from sunset to sunrise by the horizon sunset uses, shaded on all four panels (`night` in `DayAstro`, `dayBands` in `src/ui/selection.ts`). Then today's weather observed up to the current time and forecast after it, at a spot with a weather station within 10 miles and 500 ft (`src/data/weatherRule.ts`): NWS's station list for the cell and the station's reports (`src/data/nwsStations.ts`, `src/data/nwsObservations.ts`), one row an hour (`src/data/observed.ts`), the staircases cut at the current time, solid arrows, the words ending in "observed" or "forecast", and a caption naming the station or saying why there is none. Then the share card's look (2026-10-15): one palette, the dark one, with light mode gone; "Tideline" as the title with the spot named in a muted line under it ("Sunset, tide, weather and moon at Campus Point", `spotSubtitle` in `src/ui/captions.ts`; the weather was added to the card's words at Nico's choice the same day); and the Sunset and Moonrise lines on the tide panel named at the top (`label` on a `Marker`, `labelSide` in `src/chart/scales.ts`). Then the panels across a day, three days or a week (issue 8's first bullet, 2026-10-16): "Day", "3 days" and "Week" buttons under the day's heading (`src/ui/SpanControl.tsx`), the window from the chosen day worked out in `src/ui/spanView.ts` with weekday labels under the stack and the weekday in the cursor's words, the choice kept for a reload in `sessionStorage` and forgotten when a spot is chosen; the sunset and moonrise lines carry their names only at one day, and a panel's markers are keyed by name and instant, since a week has seven sunsets. Then the dew point and the feels-like on the temperature panel (issue 8's second bullet, 2026-10-16): the dew point a thin line, the feels-like dotted and only where it is 2°F or more from the temperature (`shownFeel` in `src/chart/feel.ts`), the words "72°F, dew point 55°F, 57% humidity, feels like 78°F" (`temperaturePanelParts` in `src/chart/readout.ts`), the dew point and the humidity observed where a station serves and the feels-like forecast all day; waves are not in the grid for a land cell (issue 71). Then the "?" at the right of the span buttons (issue 75, 2026-10-16): a sheet over the panels, one for all of them, with a section each for the panels, the tide, the wind, the temperature, the sky, today's observed and forecast sides and the sources, the words in `src/ui/helpText.ts` with a test that every drawn element is named, the sheet in `src/ui/HelpSheet.tsx`, and `'help'` a view in `src/ui/viewHistory.ts` so going back closes it; spec in `docs/superpowers/specs/2026-10-16-panel-help-design.md`.
- Not built: everything else. It is tracked as GitHub issues.
- Approved and specified (2026-10-12): the next stage, in three pieces. Issues 54 (edit and remove a saved spot, the moon line), 55 (wind arrows, night shading) and 56 (today's weather observed up to now and forecast after, where a weather station is near) are all built (above). Each has a spec in `docs/superpowers/specs/` dated 2026-10-12.

Repo: https://github.com/nicolovejoy/tideline (public).

Live: https://tideline.ibuild4you.com (production, deploys from `main`, public). The name is a Cloudflare CNAME to Vercel with the proxy off; https://tideline-inky.vercel.app serves the same build. Pull request previews need a Vercel sign-in. https://tideline.vercel.app is someone else's site, not this project.

## Commands

Node 24 (`.nvmrc`). In a fresh shell: `source ~/.nvm/nvm.sh && nvm use`.

- `npm run dev`: dev server at http://localhost:5173
- `npm run build`: type-check, then build to `dist/`
- `npm run lint`: oxlint, then a Prettier check
- `npm run format`: rewrite files with Prettier
- `npm test`: run all tests once
- `npx vitest run src/time.test.ts`: one test file
- `npx vitest run -t "25 hours"`: tests whose name matches

Tests run with `TZ=Asia/Tokyo` (set in `vite.config.ts`), so code that leans on the viewer's time zone instead of the spot's fails.

Code style is the Vite template's: no semicolons, single quotes, relative imports carry their `.ts`/`.tsx` extension, type-only imports use `import type`, no enums.

## What this is

Tideline is a weather-and-tides web app. For a named spot, tonight and the days ahead, it shows four things side by side for the same place and time: sunset, tide, weather, moon. It replaces checking a weather site and a NOAA tide station page separately and combining them in your head. Santa Barbara, California is the starting point.

## Private context

This repo is public. `private/` is gitignored and holds the personal details: who the first user is, the original brief, and whose answers are whose. Read `private/context.md` at the start of a session if it exists.

In every tracked file, commit message, issue, and pull request, that person is "the first user". Never copy names or personal details out of `private/`.

## Working agreement

- Nico approves each stage before anything is built, and reviews all code before it ships.
- Stage 1 is the smallest thing the first user can open on an iPhone. Later stages are ordered after it has been used.
- Keep the MVP simple. Anything clever that is not needed for a first reaction becomes a GitHub issue on the phased roadmap, not MVP scope.
- Where a decision needs the first user's answer, list the question for Nico to relay. Do not guess.
- The owner's checks are run on production, after the merge (his decision, 2026-10-12). A pull request's check is written for https://tideline.ibuild4you.com, not for its preview, which asks for a Vercel sign-in.

## Product rules

- **Data, not a verdict.** No score, no go/no-go, no alerts.
- Sunset for tonight and following days.
- Tides: high/low table plus a continuous curve; touching the curve shows predicted feet at that time.
- Today's tide: predicted curve overlaid with observed water level, so a deviation is visible.
- Today's weather: at a spot with a weather station within 10 mi and within 500 ft of the spot's height, the wind, temperature, dew point, humidity and sky are what the station reported up to the current time and the forecast after it, with the station named; anywhere else today is forecast only and the screen says why.
- Weather for the spot itself, not the city.
- Moon phase per day; if moonrise is within 2 hours of sunset, flag it and show the time.
- Sun and moon times count the spot's own height where it is 100 ft or more and a tide station is within 25 mi, over a sea-level horizon, and the screen says so. Everywhere else they are for a level horizon, as almanacs give them.
- Default view is the forecast window; extended view is a month at a time, up to 3 months out, tide/sun/moon only.
- Spots are named and saved by the user, shareable publicly or with specific friends.
- Tides only at the coast: a spot has a tide when a tide station is within 25 mi and the spot itself is under 300 ft. It is a fact of the spot, with no switch. Where there is none the screen says why.
- Nearest tide station is picked automatically and disclosed.
- Any US location; responsive web app that prompts iPhone users to add it to the home screen.
- Not in the first version: per-spot photo catalog.

## Stack (approved 2026-10-08)

- Static single-page app with no server: Vite, React, strict TypeScript, plain CSS. Hosted on Vercel. One palette, the dark one from the share card; light mode was removed on 2026-10-15 at Nico's choice. The palette is measured (issue 78, 2026-10-17): the plots have a slate day background (`--day`) and a black night band (`--night`) that stand 3:1 apart as WCAG 1.4.11 asks, since against a ground this dark no darker night could; everything drawn over them is at least 3:1 on both bands, text 4.5:1, with the lighter lines and the rule labels in `--faint` rather than `--muted`. `src/chart/contrast.test.ts` reads the tokens out of `src/styles.css` and asserts each pair, and prints the table; a colour change means running it.
- The layout is the phone's, one column 450 px wide, up to a window 1,000 px wide (the widest iPhone on its side is 956). From there one media query at the end of `src/styles.css` makes the forecast two columns, the 14 days beside the panels, in a page up to 1,080 px wide, and the month view two columns of days (issue 33, which stays open for a calendar grid and more hour labels). Choosing a day still brings the panels to the top of the window. No component knows the window's width.
- The browser calls NOAA and NWS directly. Sun and moon are computed on the device.
- Charts are hand-written SVG: stacked panels on one time axis with one shared cursor. The axis is one day, three or seven from the chosen day, by the user's choice; `src/ui/spanView.ts` has the window and its labels, and the sunset and moonrise lines carry their names only at one day. The arithmetic is in `src/chart/scales.ts`. No charting library and no d3.
- Components hold no arithmetic, no rules and no wording. Those live in plain modules with tests (`src/chart/`, `src/chart/arrows.ts`, `src/ui/captions.ts`, `src/ui/selection.ts`, `src/ui/spanView.ts`, `src/ui/tideView.ts`, `src/ui/weatherView.ts`, `src/ui/dayList.ts`, `src/ui/monthView.ts`, `src/data/load.ts`, `src/data/interpolate.ts`, `src/data/geo.ts`, `src/data/geocode.ts`, `src/data/stations.ts`, `src/data/resolve.ts`, `src/data/tideRule.ts`, `src/data/usgs.ts`, `src/data/weatherRule.ts`, `src/data/observed.ts`, `src/data/nwsStations.ts`, `src/data/nwsObservations.ts`, `src/data/savedSpots.ts`, `src/ui/addSpotView.ts`, `src/ui/buildStamp.ts`, `src/ui/shareView.ts`, `src/ui/viewHistory.ts`), and the components are checked in a browser.
- Weather is drawn as staircases, level across the hour each value is forecast for, so the line, the cursor's dot and the words always agree. The wind's speed is the exception: an arrow at the middle of each hour, at the hour's speed, pointing where the wind is going, and a dot where it is calm or has no direction; the gusts stay a staircase, dotted, and only where they stand out from the wind: more than 1.25 times it, or 5 mph or more above it, and over a calm wind the 5 mph alone (`shownGust` in `src/chart/arrows.ts`, used by the staircase, the dot and the words, so a hidden gust is hidden everywhere; the vertical range still counts it). The feels-like follows the same pattern on the temperature panel: dotted, and only where it is 2°F or more from the temperature (`shownFeel` in `src/chart/feel.ts`); the dew point is a thin line; the humidity is in the words only. The temperature panel's readout is always two rows, the feels-like alone on the second (`rows` on `WeatherPanelView`), so the plot does not move when the feels-like comes and goes under the cursor, as the tide panel keeps two rows for its reading. A panel draws at most six rules: where its step would give more, the step doubles until it does not (`MAX_RULES` in `src/ui/weatherView.ts`), so a dry mountain spot's range from 10°F to 100°F has rules every 20°F. The arrows are thinned to every second, third, fourth, sixth, twelfth or twenty-fourth hour where an hour is narrower than the gap between them (`src/chart/arrows.ts`), which is built for a panel that shows more than a day. The night is a band behind every panel, by the sun's rises and sets over the horizon sunset uses. On today at a spot with a station, each value's observed staircase is cut at the current time and the forecast's starts there (`Cut` in `src/chart/scales.ts`); the observed side is heavier and its arrows solid. The current hour's arrow is the observed one only once its middle is left of the line at the current time; right of the line everything, the arrow included, is the forecast.
- Data modules (NOAA, NWS, USGS, astronomy) are framework-free TypeScript so they can move behind a server function unchanged. Tested with Vitest against recorded real responses.
- The map is Leaflet on OpenStreetMap tiles, loaded only with the add screen. No key. Changing the tile provider is one URL, `MAP.tiles` in `src/ui/addSpotView.ts`. Place search is OpenStreetMap's Nominatim, called from the browser on submit only, one query at a time, with answers remembered for the page. Each query carries the map's view as `viewbox` with `bounded=0`, which prefers places in the box without leaving out the rest; a view under half a degree is widened to that, because a box two miles across, where the map sits after a search, no longer prefers the next beach down the coast (tried on 2026-10-10). Its usage policy is linked in `src/data/geocode.ts`, and changing provider is that one file. Pull request 40 put that policy to the owner as his decision, and he merged it on 2026-10-10.
- Caching is on the device in Stage 1: draw from the last saved data, refresh behind it, show each source's "as of" time. When a write finds the device's storage full, the cache entries of the other spots are dropped and the write tried once more; saved spots and the user's choices are never dropped, and a new spot that could not be kept says so on its screen. The weather station chosen for a spot is kept 30 days; today's observed rows go stale after 6 minutes and at the day's end. A saved entry from an older cache version (the key's `tideline:v2:` against the build's `tideline:v3:`) is dropped once at start-up and whenever the cache is evicted (`sweepOldVersions` in `src/data/cache.ts`), so a version bump does not leave the last version's entries on the device; saved spots and the user's choices are under other keys. A server cache is deferred to an issue.
- The foot of the page says when the running build was made, such as "Build Oct 10, 2:31 PM", and on Vercel the commit's short hash follows, linked to GitHub (issue 38). Vite's `define` in `vite.config.ts` writes the time and `VERCEL_GIT_COMMIT_SHA` into the bundle, `src/build.ts` reads them and `src/ui/buildStamp.ts` words them. It is for whoever is working on the app, and it is the one time shown in the viewer's zone and not a spot's (`deviceTimeZone` in `src/time.ts`). On the dev server the time is when the server started.
- The month view, the add screen, the edit screen and the help sheet each put one entry in the browser's history, at the address the page already has, so that going back closes them and does not leave the site (issue 46). `src/ui/viewHistory.ts` holds which view is up and keeps the history in step, and is tested with a stand-in for the browser; `src/ui/useView.ts` ties it to `window.history` and `popstate`. The view's own button asks the browser to go back, so no entry is left behind; a reload on a view opens that view; and the app says where the page is scrolled to (`history.scrollRestoration` is `manual`). Views have no addresses of their own (issue 48).

## Decisions (2026-10-08)

Settled:
- Audience is the first user and friends, non-commercial.
- Units: feet above MLLW, °F, mph, 12-hour clock.

The first user confirmed these on 2026-10-09 (recorded by Nico on `stage-1/weather-and-days` after pull request 22; ported to main on 2026-10-10):
- Stage 1 spot is Campus Point, UCSB.
- Weather: NWS only, 7 days. Days past the forecast say so in the list. The first user asked for NWS alone; the second source for days 8 to 10 was dropped (issue 1 closed).
- Weather values: temperature, wind, gusts, direction, cloud cover, rain chance, drawn for the full day. A way to dig in is issue 8.
- Where a spot's tide station has no gauge, show the nearest gauge's deviation from its own prediction. Do not redraw the spot's curve with that deviation applied.
- Inland spots: tides hidden by default. Changed by the owner on 2026-10-10 to no tides inland at all, with no switch (see below).
- Sun and moon times should account for the spot's elevation, after launch (issue 9). Built on 2026-10-10 for spots near the sea only; see the question below.
- Sharing: a link to chosen friends is enough. No accounts (issue 12 closed; issue 7 stays).
- The cursor rests on the latest gauge reading today.
- Working offline is not a Stage 1 goal (decided 2026-10-09). The data is saved on the device; the page itself is not.

Decided by the owner on 2026-10-10, after trying own spots on a phone: tides only at the coast. A tick could show a tide curve on La Cumbre Peak, which means nothing there, and it could not be undone. The rule is in `src/data/tideRule.ts` and `hasTides` in `src/spot.ts`; a spot's height is its own, from USGS, because the NWS cell's average puts beaches under hills hundreds of feet up. The first user had confirmed the default it replaces; he was told, and accepted the rule, on 2026-10-12.

The first user answered on 2026-10-16: one line of weather at the hour of sunset per row in the 14-day list is enough, and the full day stays in the panels. No change needed. The wording of the moon line is settled and built: "Moonrise 5:00 AM", risen or not (issue 54).

Open with the first user since 2026-10-10: what a spot's height is counted above. He asked for sun and moon times to count the elevation. The app counts it only where the sea is near (a tide station within 25 mi), over a sea-level horizon, because inland the horizon may be as high as the spot: Denver's own height would put its sunset 7 minutes late. The rule is in `src/data/horizon.ts`. He confirmed on 2026-10-15 that a sea-level horizon, as built, is what he meant. Closed.

The first user's third session, 2026-10-11, refined with the owner on 2026-10-12:
- He accepts tides only at the coast (25 mi, 300 ft, no switch), and that a shared link carries a spot's exact coordinates. Neither changes.
- He asked for three things, which the owner approved on 2026-10-12 as the next stage: a saved spot's name and place can be edited and the spot removed, after he made a duplicate and could not fix it (issue 54); the wind drawn as the Weather Underground iOS app draws it, an arrow per hour at its speed with a gust line and the night shaded (issue 55); and today's wind, temperature and sky observed up to the current hour and forecast after, for now only where a weather station is within 10 miles, with the station named (issue 56).
- He wants a record of forecasts against what happened, "with data over time and ways to dig into it". Not this stage: issue 11, which has the sizing.
- He says the "spot forecast" he looks at gives 10 days, where the app shows about 7. What NWS serves is under Data sources. The address of what he looks at is still to come.

Decided by the owner on 2026-10-12, for that stage:
- A weather station serves a spot when it is within 10 miles and within 500 ft of the spot's height. Without the height La Cumbre Peak would show a canyon's weather as its own. Of the three built-in spots only Campus Point has such a station.
- The observed side of today's weather has one value for each hour, as the forecast has, and the line already drawn at the current time is where observed stops and forecast starts.
- Observed sky is a category (clear, few, scattered, broken, overcast), drawn at the middle of its range on the percent axis and worded as the category. There is no observed chance of rain.
- "Remove this spot" moves to the edit screen.
- Wind arrows point where the wind is going and the words say where it comes from.

Decided by the owner on 2026-10-15: the app takes the share card's look (`public/og.png`). The dark palette is the only one and light mode is gone, not opt-in.

Decided with the first user in person on 2026-10-15 and relayed by the owner on 2026-10-18, for Stage B, sign-in:
- Google sign-in only. No Apple, no Facebook.
- Sign-in is needed only for a user's own spots. Everything else stays open, as it is now.
- A phone's spots move to the account on first sign-in.
- Sharing stays a link that carries the exact coordinates, viewable without an account, with no re-share controls and no revocation. "Friends" in the brief means share-by-link and nothing more. There are no social features and no friend graph, and nothing is to be designed for them; where an architecture choice would make account-based sharing easy later at no cost, the pull request notes it and builds only what is decided.
- Photos (issue 13) are roadmap, not v1: no object storage is provisioned yet.
- The plan to build on, pending the first user's one open answer below: Google auth, a document store for spots, the app still a static page. Sign-in does not ship before he answers.

Open with the first user since 2026-10-18, asked through the ibuild4you handoff: his opinion, as an engineer, on that stack (Firebase Auth and Firestore in the owner's Google Cloud account, called from the browser). A question on the ecosystem's auth and store patterns went to prompt-lab the same day.

Display convention: times and calendar days are shown in the spot's own time zone (returned by NWS `/points`), not the viewer's. Never derive a day from a UTC ISO string; use `Intl.DateTimeFormat` with an explicit `timeZone`.

## Data sources (verified against the live APIs on 2026-10-08)

All four HTTP APIs below send `access-control-allow-origin: *`, need no key, and can be called from a browser.

**NWS (`api.weather.gov`)** — `/points/{lat},{lon}` returns the grid cell, IANA time zone, and forecast URLs.
- Horizon is 7 days: `/forecast` has 14 twelve-hour periods, `/forecast/hourly` has 156 hours, raw grid data covers `P7DT17H`.
- Checked again for Campus Point at midday on 2026-10-12: the raw grid, issued at 12:36 AM, said `P8D` from 6 PM the evening before, and its last hour was 7.3 days ahead for temperature and for wind, gusts and direction, and 7.5 days ahead for cloud and rain chance. `/forecast` reached 6.8 days and `/forecast/hourly` 6.5. Nothing NWS serves reaches 10 days.
- A cell's grid starts about 6½ hours before its own last update (eight cells on 2026-10-12). The app replaces its saved forecast at each refresh, so the early hours of today drop off the weather panels as the day goes on.
- How fine each value is, over the week: temperature 13 to 18 values a day, wind and gusts 4 to 8, direction 5 to 8, cloud 3 to 4, and rain chance coarser still.
- `apparentTemperature`, `dewpoint` and `relativeHumidity` run the whole week at one to three hours a value; `heatIndex` is sparse and `windChill` nearly all null. Every wave and swell layer is one zero across the week in the three spots' cells, which are land cells (checked 2026-10-16); the marine forecast is issue 71.
- Observations (issue 56, built): `/gridpoints/{wfo}/{x},{y}/stations?limit=500` lists a cell's 64 nearest stations with their heights on one page (the answer names a next page even when there is none); `/stations/{id}/observations?start={iso}&limit=500` has a station's reports from that instant, newest first, in SI units, with quality flags (`V`, `S`, `C`, `Z` kept; `X`, `B`, `Q` dropped). The airport reports every 5 minutes, about 310 a day and 1.2 MB; hourly stations 24. The app keeps the rows, not the reports. A report carries `dewpoint` (°C) and `relativeHumidity` (percent) with their own quality flags.
- The grid is 2.5 km. Campus Point, Leadbetter Beach, Gaviota State Park, and La Cumbre Peak resolve to four different cells (Campus Point LOX 100,71, Leadbetter Beach LOX 105,70, Gaviota State Park LOX 87,76, La Cumbre Peak LOX 105,74).
- Cell elevation is a cell average, not the spot: 3 ft for Campus Point, 157 ft for the Leadbetter cell, 3,258 ft for La Cumbre (summit is 3,997 ft).
- `/forecast/hourly` has no wind gust or sky cover. The raw `/gridpoints/{wfo}/{x},{y}` endpoint has both, but in SI units with ISO 8601 `validTime` intervals of varying length.
- Responses carry `cache-control: public, max-age` of about an hour.
- `/points` answers 404 for land outside the US (Mexico, Canada, Europe, Australia) and for the mid-Atlantic and mid-Pacific, but HTTP 500 for open water in the tropics: off Oaxaca, off southern Baja, in the Caribbean and at 20°N 115°W on 2026-10-10. It answers 200 for the Gulf of Mexico and for water off California. A 500 cannot be told from an outage, so the app reads any failure outside a set of loose boxes round the US (`inUsBounds` in `src/data/geo.ts`) as "no forecast here".

**NOAA CO-OPS (`api.tidesandcurrents.noaa.gov`)** — data at `/api/prod/datagetter`, station metadata at `/mdapi/prod/webapi`.
- 3,502 prediction stations, 302 water-level (observing) stations, 238 that are both. Most prediction stations have no observed data.
- The station lists (`mdapi/prod/webapi/stations.json?type=tidepredictions` and `?type=waterlevels`) are baked into `src/data/stations.json` by `scripts/bake-stations.mjs`: 3,566 rows on 2026-10-10 (1,022 harmonic, 2,242 subordinate, 238 harmonic with a gauge, 64 gauges with no predictions, 52 of them on the Great Lakes). About 200 KB, loaded with the add screen.
- 2,242 prediction stations are subordinate (`type: "S"`): they return high/low only, and a 6-minute request returns an error. For these the app interpolates a cosine curve between consecutive highs and lows (`src/data/interpolate.ts`) and says "interpolated" in the readout and the caption. Against Santa Barbara's own curve over 14 days: 0.19 ft rms, 95% within 0.33 ft, worst 1.15 ft in a 16-hour gap where NOAA's list skips a near-stand.
- 9411340 Santa Barbara is harmonic and observing, and is the nearest station of both kinds to Campus Point (8.6 mi) and to La Cumbre Peak (6.3 mi south). 9411399 Gaviota State Park is harmonic with no observations, 0.2 mi from the beach; its nearest observing station is Santa Barbara, 31 mi east.
- Highs and lows from today to the end of the third month ahead are one request of about 22 KB (432 events for Santa Barbara, 10 October 2026 to 31 January 2027); one month at 6-minute resolution is 7,440 points.
- Observed data is preliminary (`q: "p"`). Use `datum=MLLW`, `units=english`, `time_zone=gmt` for both products so they are comparable. Request GMT and convert for display: station-local timestamps (`lst_ldt`) carry no offset and are ambiguous in the repeated hour of a clock change.
- A 14-day predicted curve at 6-minute resolution is one request: 136 KB as JSON, 20 KB gzipped.
- Responses carry `cache-control: no-store`, so any caching of tide data is ours to do. Predictions for a given date do not change.

**USGS Elevation Point Query Service (`epqs.nationalmap.gov/v1/json`)** — a point's own height, asked once when a spot is added (`src/data/usgs.ts`). Verified on 2026-10-10.
- `?x={lon}&y={lat}&wkid=4326&units=Feet&includeDate=false` returns `{"value": 20.77, …}` in 0.2 to 1 second. The request has an 8 second limit; without an answer the spot is saved with no height of its own and the rule falls back to the cell's average.
- Why it is needed: the NWS cell's elevation is an average over 2.5 km. El Capitan State Beach is at 21 ft in a cell that averages 640 ft; Solvang, inland, is at 490 ft in a cell that averages 453 ft. No bar on the cell's average tells the two apart.
- For a point it has no data for (15°N 96°W) it answers with plain text, not JSON.
- A place found by name can sit well off the shore: Nominatim's point for El Capitan State Beach is the middle of the park, 2 mi inland at 583 ft. The add screen then says there is no tide and that the pin can be put on the shore.

**Open-Meteo** — not used. Kept as a reference: its `ncep_nbm_conus` model (NOAA National Blend, 2.5 km) returned 11 days when checked on 2026-10-08. Free for non-commercial use with attribution.

**Sun and moon** — computed locally with `astronomy-engine`. The USNO API (`aa.usno.navy.mil/api/rstt/oneday`) is the reference to test computed values against. It is no reference for a height: asked for La Cumbre Peak on 2026-10-10 with `height=0` and with `height=1218` it gave the same times, 18:31 and 07:05. `astronomy-engine` takes the observer's height, and how far that is above the ground it looks out over as the last argument of `SearchRiseSet`; from 3,997 ft it puts sunset about 6 to 7 minutes later and moonrise about 6 to 7 minutes earlier (7 minutes 14 seconds at the winter solstice).

## Next Steps

Rewritten on 2026-10-17; the history this section used to carry is in the merged pull requests and the git log.

- Live, as of the morning of 2026-10-17: everything under Status, through the first user's sixth-session asks (issues 74, 75, 77 and 78; pull requests 80 to 83, merged by the owner before their production checks). Their checks are in the pull requests and were sent to the first user through the ibuild4you handoff on 2026-10-17.
- The first user's eighth session (2026-10-17): issues 74, 75 and 77 pass; issue 78 fails, the night band's contrast too low for WCAG on every panel. The answer is the measured palette (above), first in the queue; his ninth session checks it on his iPhone at default brightness, with the ratio table in the pull request.
- Checks still owed, none of which needs a build: the iPhone steps of pull requests 49 and 51; the owner's step 6 of pull request 50 (a spot of his own on high ground); and item 7 of Stage 1's phone check (a reopen draws at once from saved data and the captions update when the refresh lands). What they turn up is small fixes, inline.
- The first user's seventh session (2026-10-17) closed his open answers: the 10-day forecast is descoped ("seven is fine", no address); the temperature panel's words fit on one line on his phone; the feels-like is useful and stays. The span buttons, dew point and feels-like passed. He said that before the 2026-10-17 deploy he could not tell night from day on any panel at his usual brightness; the darker band (issue 78) is the answer, and his eighth session verifies it along with the other four checks of pull requests 80 to 83.
- After his eighth session's results, in this order: edit and delete on the three starting spots (built 2026-10-17, above); Stage B, Google sign-in, scoped under Decisions on 2026-10-18 and waiting on the first user's stack answer and prompt-lab's (returning from sign-in to the home-screen app is the known risk, to be spiked before the spec); Stage C, forecast history, design only (issue 11 with issue 10).
- Held, not for the first user yet: issue 76 (from an observed value to its station's kind and the stations near it), a status bar in the home-screen app, the phone on its side, and forecast history (issue 11, sized in the issue; design only, and it needs a store, so it comes with issue 10).
- Then from the issues, in the order the first user's use suggests: what is left of issue 8 (pinch and two-finger drag), issue 71 (waves and swell from the marine forecast), issue 33 (a calendar grid in the month view), issue 48 (addresses for views) with issue 45, issue 11 with issue 10, issue 13 last.
- Known: the three starting spots live in each device's saved list once seeded, so a change to their data in `src/spot.ts` reaches a device only when it has no list (the seed also fills in any of the three whose id is missing, so a removed one comes back only if the list is emptied). A spot saved before 2026-10-10 has no height of its own, so it shows no tide in a cell that averages 300 ft or more and keeps a level horizon, until it is removed and added again or its pin is moved.
- Not yet tried: a screen reader on the cursor.
- Test coverage, reviewed on 2026-10-17 (`npm run coverage`): the plain modules are at 96% of lines, the misses being single defensive branches. Untested by design, and checked in a browser instead: the components, the hooks in `src/data/useSpotData.ts` and `src/ui/useView.ts`, `loadStations` (a dynamic import) and `browserEnv` (the navigator). Nothing there needs a test.
- Everything else is tracked as GitHub issues, in provisional order.

<!-- SHARED-CONVENTIONS:BEGIN v=b2025c189bb4 — auto-managed, do not edit here; source: prompt-lab/workflow/claude-md-shared.md (edit + re-sync) -->
## Shared conventions

<!-- These are Nico's cross-repo output rules. They're materialized into each repo's
CLAUDE.md and AGENTS.md so every agent (local, cloud, third-party) sees them as plain
text. Source of truth: prompt-lab/workflow/claude-md-shared.md — edit there and
re-sync, never here. -->

- **Clickable URLs.** When pointing at any web destination (dashboard, repo, PR, deploy, settings, docs, localhost), print the full bare URL — `https://example.com` or `http://localhost:8080` — on its own, never just the page's name and never a markdown `[label](url)` link. Nico's terminal auto-linkifies raw `https://` text, so a bare URL is one-click and stays copyable.

- **Number your questions.** Any time you ask Nico more than one question, present them as a numbered list (1., 2., 3.) so he can answer by number with no ambiguity. A single standalone question needs no number.

- **Self-contained smoke-test instructions.** When you ask Nico to manually test or verify an app or website, assume zero carried-over context — he should never scroll back or recall a URL/path/credential from earlier. Always include: the exact URL (full `https://…` or `http://localhost:…`, restated even if mentioned above), the precise steps in order, and what a pass vs. fail looks like. Repetition here is a feature, not clutter.

- **UTC at rest, Pacific on display.** Timestamps are stored in UTC, always. A *calendar day* shown to a human is `America/Los_Angeles` — Nico's day, and the clock the work actually happened on. The two rules that follow are the ones that get broken: never form a date bucket with `new Date(…).toISOString().slice(0,10)` (that is UTC, so every chart axis and "today" silently rolls over at 5pm Pacific — it put a phantom tomorrow bar on the Prompt Lab dashboard), and never bucket UTC-stamped rows with a bare `date(col)` in SQL. Use `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' })` in JS and an explicit zone in SQL/Python. Storage in local time is also wrong — it can't be migrated across a DST boundary without loss.

- **No marker before a copy-paste command block.** Nico's terminal renders markdown bullets (`-`, `*`, `•`) as `●`, which breaks paste into zsh. The line directly above a fenced command block must be a plain-text label ending in a colon — never a bullet, dash, asterisk, or number. For loud copy targets, lead the label with `📋` + bold `COPY THE BELOW`, then a colon, then the block. Bracket anything Nico will paste elsewhere (a prompt for another agent, a multi-line command) with a ruler line of `================` above the label and below the closing fence. Rulers go outside the fence so they aren't copied, each with a blank line before it (a `===` line directly under text renders as a heading).

- **No bare backslash in a copy-paste command block.** A `\` is load-bearing shell syntax that renders invisibly and gets silently dropped somewhere between the markdown render, the clipboard, and zsh. `find … -exec test -e {} \; -delete` arrived in the terminal as `… {} ; -delete`, which zsh split into two commands and reported as `find: -exec: no terminating ";"` plus `command not found: -delete` (2026-09-20). Quote it instead — `';'` is exactly equivalent to `\;` and survives any copy path. For the same reason never break a command across lines with a trailing `\`: write one long line, however wide it wraps.

- **Reader-facing text lives in content or copy files, not inline in components.** Some repos ship French alongside English (selected-projects mirrors the site under `/fr`; ibuild4you has French public pages). There, every new string goes in the repo's strings/copy module or content folder, with its translation, and an English copy edit means updating the French twin too. Elsewhere, keeping text out of components is what makes `/localize` cheap later. Terms and register: `prompt-lab/workflow/localization/fr-glossary.md`.

- **A review another agent must act on goes on the PR.** A review that another agent must act on, or that must outlive the session, is posted as a PR comment (`gh pr comment`), where the next session or agent finds it. Live, in-session reviews between Nico and the agent stay in chat. There is no devlog.md: the history DB is the one session record.
<!-- SHARED-CONVENTIONS:END -->
