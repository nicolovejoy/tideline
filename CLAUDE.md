# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Stage 1 is built; its phone check is down to one item. Stage 2 has begun: three spots, the month view, the interpolated curve, own spots from a map, place search by name, share by link and two columns in a wide window are merged and live.

- Built: the scaffold, tooling and CI; the data layer; and the screen for Campus Point, which shows tonight's sunset and moon, four panels on one time axis for any of the next 14 days (the tide with today's observed level, wind, temperature, sky), that day's high/low table, the 14-day list, and the manifest and icons; then three spots with a switcher (Campus Point, Gaviota State Park, La Cumbre Peak), the Santa Barbara gauge's deviation at Gaviota, and no tides at La Cumbre; then the month view (this month and the next three, sunset, moon and highs and lows per day); then a curve interpolated from the highs and lows for stations that publish only those, labelled "interpolated" (a saved spot at a subordinate station uses it); then your own spots: a pin on a map (Leaflet, OpenStreetMap tiles) or the device's location, named and saved on the device, with the NWS cell, the spot's own height from USGS, and the nearest tide station and nearest gauge worked out from a baked station list (`scripts/bake-stations.mjs`, `src/data/stations.json`); then a place name typed on the add screen, looked up with OpenStreetMap's Nominatim (`src/data/geocode.ts`), which prefers places in the map's view, pans the map there and drops the pin; then a link to share any spot by (`src/ui/shareView.ts`), which carries the spot's name and its coordinates to four places and nothing else: opening one shows the spot, looked up as a new pin is, with Save to keep a copy on the device and Close to leave it, and a link to a point the device already has a spot at opens that spot; then two columns in a window 1,000 px wide or more, the 14 days beside the panels and the month view's days in two columns, with "Months ahead" an outlined button beside the "14 days" heading; then sunset and moonrise worked out from the spot's own height where it is 100 ft up or more and near the sea (`src/data/horizon.ts`), with a caption that says so; then an Edit button beside a saved spot's name, which opens the add screen as "Edit spot" with the name, the pin and the facts filled in, where the name or the pin can be changed (a rename keeps the spot's data; a move looks the new point up and saves it under a new id in the same place in the row) and from which the spot is removed; and the moon line in tonight's strip as "Moonrise 5:00 AM".
- Not built: everything else. It is tracked as GitHub issues.
- Approved and specified (2026-10-12): the next stage, in three pieces. Issue 54, edit and remove a saved spot and the moon line as "Moonrise 5:00 AM", is built (above). Not built: issue 55, wind as an arrow per hour, and night shaded on every panel; issue 56, today's weather observed up to now and forecast after, where a weather station is near. Each has a spec in `docs/superpowers/specs/` dated 2026-10-12.

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

- Static single-page app with no server: Vite, React, strict TypeScript, plain CSS. Hosted on Vercel.
- The layout is the phone's, one column 450 px wide, up to a window 1,000 px wide (the widest iPhone on its side is 956). From there one media query at the end of `src/styles.css` makes the forecast two columns, the 14 days beside the panels, in a page up to 1,080 px wide, and the month view two columns of days (issue 33, which stays open for a calendar grid and more hour labels). Choosing a day still brings the panels to the top of the window. No component knows the window's width.
- The browser calls NOAA and NWS directly. Sun and moon are computed on the device.
- Charts are hand-written SVG: stacked panels on one time axis with one shared cursor. The arithmetic is in `src/chart/scales.ts`. No charting library and no d3.
- Components hold no arithmetic, no rules and no wording. Those live in plain modules with tests (`src/chart/`, `src/ui/captions.ts`, `src/ui/selection.ts`, `src/ui/tideView.ts`, `src/ui/weatherView.ts`, `src/ui/dayList.ts`, `src/ui/monthView.ts`, `src/data/load.ts`, `src/data/interpolate.ts`, `src/data/geo.ts`, `src/data/geocode.ts`, `src/data/stations.ts`, `src/data/resolve.ts`, `src/data/tideRule.ts`, `src/data/usgs.ts`, `src/data/savedSpots.ts`, `src/ui/addSpotView.ts`, `src/ui/buildStamp.ts`, `src/ui/shareView.ts`, `src/ui/viewHistory.ts`), and the components are checked in a browser.
- Weather is drawn as staircases, level across the hour each value is forecast for, so the line, the cursor's dot and the words always agree.
- Data modules (NOAA, NWS, USGS, astronomy) are framework-free TypeScript so they can move behind a server function unchanged. Tested with Vitest against recorded real responses.
- The map is Leaflet on OpenStreetMap tiles, loaded only with the add screen. No key. Changing the tile provider is one URL, `MAP.tiles` in `src/ui/addSpotView.ts`. Place search is OpenStreetMap's Nominatim, called from the browser on submit only, one query at a time, with answers remembered for the page. Each query carries the map's view as `viewbox` with `bounded=0`, which prefers places in the box without leaving out the rest; a view under half a degree is widened to that, because a box two miles across, where the map sits after a search, no longer prefers the next beach down the coast (tried on 2026-10-10). Its usage policy is linked in `src/data/geocode.ts`, and changing provider is that one file. Pull request 40 put that policy to the owner as his decision, and he merged it on 2026-10-10.
- Caching is on the device in Stage 1: draw from the last saved data, refresh behind it, show each source's "as of" time. When a write finds the device's storage full, the cache entries of the other spots are dropped and the write tried once more; saved spots and the user's choices are never dropped, and a new spot that could not be kept says so on its screen. A server cache is deferred to an issue.
- The foot of the page says when the running build was made, such as "Build Oct 10, 2:31 PM", and on Vercel the commit's short hash follows, linked to GitHub (issue 38). Vite's `define` in `vite.config.ts` writes the time and `VERCEL_GIT_COMMIT_SHA` into the bundle, `src/build.ts` reads them and `src/ui/buildStamp.ts` words them. It is for whoever is working on the app, and it is the one time shown in the viewer's zone and not a spot's (`deviceTimeZone` in `src/time.ts`). On the dev server the time is when the server started.
- The month view, the add screen and the edit screen each put one entry in the browser's history, at the address the page already has, so that going back closes them and does not leave the site (issue 46). `src/ui/viewHistory.ts` holds which view is up and keeps the history in step, and is tested with a stand-in for the browser; `src/ui/useView.ts` ties it to `window.history` and `popstate`. The view's own button asks the browser to go back, so no entry is left behind; a reload on a view opens that view; and the app says where the page is scrolled to (`history.scrollRestoration` is `manual`). Views have no addresses of their own (issue 48).

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

Still open with the first user, as of 2026-10-09: whether the forecast at the hour of sunset is the right moment for a day's row. The wording of the moon line is settled and built: "Moonrise 5:00 AM", risen or not (issue 54).

Open with the first user since 2026-10-10: what a spot's height is counted above. He asked for sun and moon times to count the elevation. The app counts it only where the sea is near (a tide station within 25 mi), over a sea-level horizon, because inland the horizon may be as high as the spot: Denver's own height would put its sunset 7 minutes late. The rule is in `src/data/horizon.ts`. He has not been asked whether that is what he meant.

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

Display convention: times and calendar days are shown in the spot's own time zone (returned by NWS `/points`), not the viewer's. Never derive a day from a UTC ISO string; use `Intl.DateTimeFormat` with an explicit `timeZone`.

## Data sources (verified against the live APIs on 2026-10-08)

All four HTTP APIs below send `access-control-allow-origin: *`, need no key, and can be called from a browser.

**NWS (`api.weather.gov`)** — `/points/{lat},{lon}` returns the grid cell, IANA time zone, and forecast URLs.
- Horizon is 7 days: `/forecast` has 14 twelve-hour periods, `/forecast/hourly` has 156 hours, raw grid data covers `P7DT17H`.
- Checked again for Campus Point at midday on 2026-10-12: the raw grid, issued at 12:36 AM, said `P8D` from 6 PM the evening before, and its last hour was 7.3 days ahead for temperature and for wind, gusts and direction, and 7.5 days ahead for cloud and rain chance. `/forecast` reached 6.8 days and `/forecast/hourly` 6.5. Nothing NWS serves reaches 10 days.
- A cell's grid starts about 6½ hours before its own last update (eight cells on 2026-10-12). The app replaces its saved forecast at each refresh, so the early hours of today drop off the weather panels as the day goes on.
- How fine each value is, over the week: temperature 13 to 18 values a day, wind and gusts 4 to 8, direction 5 to 8, cloud 3 to 4, and rain chance coarser still.
- Observations, not used yet (issue 56): `/gridpoints/{wfo}/{x},{y}/stations` lists a cell's 64 nearest stations with their heights, and `/stations/{id}/observations` has a station's reports for about the last 7 days, in SI units, newest first. What was found on 2026-10-12 is in `docs/superpowers/specs/2026-10-12-observed-weather-design.md`.
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

- Stage 1 (Campus Point) is built. Items 1 to 6 of the phone check in the pull request for `stage-1/weather-and-days` passed on 2026-10-09; item 7 remains: a reopen with a connection draws at once from saved data and the captions update when the refresh lands.
- Own spots and place search (pull requests 37 and 40) are merged and live. The owner tried them on 2026-10-10, added several spots and said they work well, and issue #4 is closed.
- Three things from that try are merged and live (pull request 41, 2026-10-10): tides only at the coast, a spot's own height from USGS (a new data source, which that pull request put to the owner), and one message for every pin outside the US. The owner ran its phone check on production on 2026-10-10: the first six steps passed, and the last two (pins outside the US, and Campus Point drawing as before) were not run.
- Spots saved before that change have no height of their own. One in a forecast cell that averages 300 ft or more shows no tide until it is removed and added again.
- Sun and moon times count a spot's own height near the sea (issue #9). Waiting for the owner's check, and for the first user's answer on what the height should be counted above. A spot saved before spots had heights stays at a level horizon until it is removed and added again.
- Place search prefers the map's view (issue #42). Without a view Nominatim's first answer could be anywhere: "Ventura" gave the county, "Summerland Beach" a place in Ohio, "Rincon Point" one in Utah. With it all three and "Loon Point" come back on the Santa Barbara coast, and "Seattle" is still found. The owner's phone check on production passed on 2026-10-10 for "Summerland Beach", "Rincon Point", "Ventura" and "Seattle". If wrong matches survive it, a list of results to choose from is the next step.
- Two columns in a wide window (pull request 51, part of issue #33) and the outlined "Months ahead" button (pull request 52) are merged and live. The owner tried the layout in Safari on a Mac on 2026-10-11: steps 1 to 5 of pull request 51's check passed, and he kept the page's move to the panels when a day is chosen. Steps 6 and 7, an iPhone and an iPad, were not run. Issue #33 stays open for a calendar grid and more hour labels.
- The build stamp (issue #38) is merged and live; the owner saw the time and the commit's link on production on 2026-10-10.
- Share by link (issue #7) passed the owner's phone check on production on 2026-10-13, all eight steps. Step 6 confirmed issue #45: a spot saved in Safari is not in the home-screen app, which keeps its own storage. Views still have no addresses (issue #48).
- Going back closes the month view, the add screen and the edit screen (issue #46), by history entries only. Steps 1 to 6 of pull request 49's check passed in Safari on a Mac on 2026-10-13, with a brief white flash on the reload in step 4. Steps 7 and 8 need the iPhone and were not run.
- Pull request 50 (sun and moon from a spot's height) was merged on 2026-10-12 before its phone check, which the owner runs on production. That check is still to run; on 2026-10-13 it was sent to the first user along with the iPhone steps of pull requests 49 and 51 and the two open questions. Issues 46 and 9 closed with the merges.
- Issue 54 (edit and remove a saved spot, the moon line) is built on `feat/edit-spots`, waiting for the owner's review of the pull request and his phone check on production. Next are issue 55 (wind arrows, night shading) and issue 56 (observed weather today), in that order, each its own pull request, from their specs in `docs/superpowers/specs/`.
- Forecast history (issue 11) was sized on 2026-10-12; the sizing is in the issue. Not this stage.
- Not yet tried: a screen reader on the cursor.
- The first user: the two questions still open under Decisions (the sunset-hour row, what a spot's height is counted above), and the address of the 10-day forecast he looks at.
- Everything after Stage 1 is tracked as GitHub issues, in provisional order.

<!-- SHARED-CONVENTIONS:BEGIN v=2ed9fb390e55 — auto-managed, do not edit here; source: prompt-lab/workflow/claude-md-shared.md (edit + re-sync) -->
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

- **Codex branches are named `codex/<description>`.** When working in this repo via Codex CLI, always create a working branch under the `codex/` prefix (e.g. `codex/fix-flaky-test`) rather than working directly on `main` or an unprefixed branch. Claude Code has no visibility into other tools' running sessions (`ListAgents` only sees Claude sessions), so this prefix is the one signal a Claude session can check for — a local or remote `codex/*` branch means Codex has touched or is touching this repo, even though its session itself is invisible. Claude branches keep whatever naming they already use; only Codex adopts this new prefix.

- **Codex: run commands in a form a rule can match.** Codex approval rules match a command's leading tokens, so a wrapped command never matches an existing allow and every variant prompts again, then leaves a dead one-off "don't ask again" rule behind (36 of them in five days, 2026-09-23). The program is the first token: call helpers and tools directly, never through `/bin/zsh -lc "…"`, never with a `PATH=…` or other `VAR=…` prefix, never with `$(…)` in the arguments. Work only inside your clone (one long-lived `~/src/<repo>-codex`, no worktrees, no scratch clones — everything outside it escalates, except the cross-repo handoff log at `~/src/.handoff`, which is granted). Redirect output only to files inside the workspace, and keep temp files in a gitignored `tmp/` there, never `/private/tmp`. If a tool is missing from `PATH`, report it: the fix belongs in `~/.zprofile` (Nico's edit), not in an inline `PATH=` prefix.

- **Reader-facing text lives in content or copy files, not inline in components.** Some repos ship French alongside English (selected-projects mirrors the site under `/fr`; ibuild4you has French public pages). There, every new string goes in the repo's strings/copy module or content folder, with its translation, and an English copy edit means updating the French twin too. Elsewhere, keeping text out of components is what makes `/localize` cheap later. Terms and register: `prompt-lab/workflow/localization/fr-glossary.md`.

- **A review another agent must act on goes on the PR.** A review that another agent must act on, or that must outlive the session, is posted as a PR comment (`gh pr comment`), where the next session or agent finds it. Live, in-session reviews between Nico and the agent stay in chat. There is no devlog.md: the history DB is the one session record.
<!-- SHARED-CONVENTIONS:END -->
