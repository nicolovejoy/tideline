# Own spots design: add a spot anywhere in the US from a map

Date: 2026-10-10. Status: written on the owner's "carry on SDD, build the next big thing, use a map feature, pick a free one" for issue #4, with the decisions this spec makes listed at the end for review on the pull request.

Issue: https://github.com/nicolovejoy/tideline/issues/4

## Goal

The user adds a spot of their own: a pin on a map or the device's location, a name, saved on the device with no account. For that spot the app works out what the three built-in spots have hard-coded: the NWS forecast cell and time zone, the nearest tide station and whether it publishes a curve or highs and lows only, the nearest gauge, and whether the tide is shown to start with. All of it is disclosed on screen, with distances, as the captions already disclose it for the built-in spots.

The issue says this item will probably split: adding by location with station choice first, place-name search second. This spec is the first half. Search by place name is left for a follow-up issue; a pin on a map, and the device's location, are the two ways to add.

## What the user sees

1. **The switcher** gains a last button, "Add a spot". Pressing it opens the add screen in place of the spot's screen. The heading reads "New spot".

2. **The add screen**, top to bottom:
   - A button, "Use my location". While the device is finding itself it reads "Finding you…". If the browser refuses (permission denied, or no position within 15 seconds) a line under it says "Couldn't get your location. Tap the map instead." and the map stays as it was.
   - A map, 300 px tall, the column's full width, centred on the spot the user came from at a zoom that shows about 30 miles across. OpenStreetMap tiles with their attribution in the corner. A tap drops a pin; another tap moves it. "Use my location" drops the pin there and pans the map to it.
   - A name field, "Name", empty to start, up to 40 characters.
   - **What this spot gets**, filled in once a pin is down. While the lookups run it reads "Looking up the forecast and the nearest stations…". When they land:
     - "Weather: NWS cell LOX 100,71, 3 ft, America/Los_Angeles." The cell's average height, as the caption on the spot screen says it, and the zone every time will be shown in.
     - "Tide: NOAA 9411340 Santa Barbara, 8.6 mi east. 6-minute curve." or, at a subordinate station, "… highs and lows only; the curve will be interpolated."
     - "Gauge: its own." or "Gauge: NOAA 9411340 Santa Barbara, 31 mi east."
     - A checkbox, "Show tides", checked or not by the rule below, with a reason after it when unchecked: "Off to start: the cell is 3,258 ft up." or "Off to start: the nearest station is 140 mi away." The user can change it; the choice is saved with the spot as its default and can be changed later with the hide and show buttons the spot screen already has.
   - Where NWS has no forecast for the pin (its `/points` answers 404, which it does outside the US and its territories): "NWS has no forecast here. Tideline covers the US." and no facts. Where NWS cannot be reached, or the cell's forecast cannot be fetched: "Couldn't reach the National Weather Service. Try again in a minute." and a "Try again" button.
   - Two buttons: "Save" and "Cancel". Save is enabled only with a pin down, a name that is not blank, and the facts in. Save adds the spot after the ones already there, chooses it, and shows its screen. Cancel returns to the spot the user came from.

3. **Removing a saved spot.** On a saved spot's screen, under the captions, a text button "Remove this spot". Pressing it turns the line into "Remove Leadbetter Beach? Yes, remove · Keep". "Yes, remove" drops the spot, forgets everything saved for it, and shows the first built-in spot. The three built-in spots have no remove button. No browser dialog: a dialog would block the page.

4. **Everything else** is as it was. A saved spot's screen is the spot screen as the built-in spots have it: the same captions name the stations and distances, the month view works, the install hint works. The switcher's row wraps as spots are added.

## Data

### A baked station list

`scripts/bake-stations.mjs` (Node, run by hand, no dependencies) fetches NOAA's two station lists, `mdapi/prod/webapi/stations.json?type=tidepredictions` (3,502 stations, 2 MB) and `?type=waterlevels` (302 stations, 0.8 MB), and writes `src/data/stations.json`: one row per station, `[id, name, lat, lon, kind]`, where `kind` is `"R"` for a harmonic prediction station, `"S"` for a subordinate one, `"W"` for a water-level station with no predictions (the Great Lakes and 12 others), and `"RW"` or `"SW"` for a prediction station with a gauge. Coordinates are kept to four decimals (about 36 ft). The file is committed, about 200 KB, and re-baked when someone chooses to; the README in `src/data/__fixtures__` is not where it lives, because it is data the app ships, not a test fixture. The file is listed in `.prettierignore`.

The list is imported dynamically, with the add screen, so the spot screen's bundle does not carry it.

Measured on 2026-10-10 from the live lists: 1,260 harmonic, 2,242 subordinate, 302 water-level stations of which 238 also predict and 52 are on the Great Lakes.

### Nearest stations

`src/data/stations.ts` (framework-free): `nearestStations(lat, lon, rows)` returns the nearest prediction station (kind R or S) as the tide station, and the nearest station that is both harmonic and a gauge (kind RW) as the gauge. Where the tide station itself has a gauge, the gauge is the tide station. Each comes back as a `Station` as `src/spot.ts` defines it: id, name, distance in miles to one decimal, the 8-point direction word of the bearing from the spot to the station, and `type` harmonic or subordinate.

The gauge is chosen from harmonic stations because the spot screen fetches the gauge's own predicted curve and sets its readings against it; a gauge with no curve would have nothing to deviate from. This is what the interpolated-curve spec assumed #4 would do.

`src/data/geo.ts` (framework-free): `distanceMi(a, b)` by the haversine formula, `bearingDeg(a, b)`, and `directionWord(deg)` giving north, northeast, east, southeast, south, southwest, west, northwest. Checked against the hard-coded spots: Campus Point to Santa Barbara is 8.6 mi east, Gaviota to its station 0.2 mi south, La Cumbre Peak to Santa Barbara 6.3 mi south.

### The NWS cell

`src/data/nws.ts` gains `fetchPoints(lat, lon)`: `GET https://api.weather.gov/points/{lat},{lon}` with the coordinates to four decimals, returning `{ office, gridX, gridY, timeZone }` from `properties.gridId`, `gridX`, `gridY`, `timeZone`. A 404 is reported as a distinct `NwsOutsideError`, since it means "no forecast here" rather than "NWS is down". It also gains `fetchElevationFt(office, gridX, gridY)`: the gridpoint endpoint the forecast already uses, reading `properties.elevation` (metres, `wmoUnit:m`) and converting to feet. Both are tested against recorded responses: `nws-points-34.4046--119.844.json` (Campus Point: LOX 100,71, America/Los_Angeles) and `nws-points-48.5--3.0.json` (the 404 body for a point in France).

### Resolving a pin

`src/data/resolve.ts` (framework-free): `resolveSpot(lat, lon, io)` where `io` supplies `fetchPoints`, `fetchElevationFt` and the station rows, so the test needs no network. It returns either `{ ok: true, spot: Omit<Spot, 'id' | 'name'> }` or `{ ok: false, reason: 'outside' | 'unreachable' }`. The spot's `elevationFt` (its own height, used for a peak's caption) is null: no source gives a point height, and issue #9 is where that goes. `tidesShown` comes from the rule below.

### Whether the tide is shown to start with

`defaultTidesShown(tideDistanceMi, cellElevationFt)` in `resolve.ts`: shown when the nearest prediction station is within 25 miles and the cell's average height is under 300 ft. The issue asks for distance plus elevation. Against the built-in spots: Campus Point (8.6 mi, 3 ft) shown; Gaviota (0.2 mi, 0 ft) shown; La Cumbre Peak (6.3 mi, 3,258 ft) hidden. A Great Lakes shore is hundreds of miles from any prediction station, so hidden, and its gauge (there are 52 on the lakes, none harmonic) is never chosen: the gauge comes from the nearest harmonic coastal station, which the facts disclose with its distance.

### Saving spots

`src/data/savedSpots.ts` (framework-free, every storage access wrapped as `cache.ts` and `choices.ts` wrap theirs): `readSavedSpots(): Spot[]`, `addSpot(spot)`, `removeSpot(id)`, under one key `tideline:spots:v1` holding a JSON array of `Spot`. Reading validates each entry's shape with a type guard and drops any that fail, so a damaged entry or one from an older build cannot break every open. A new spot's id is `spot-` followed by the time in base 36. `removeSpot` also calls `forgetSpot(id)` in `cache.ts`, which removes the spot's five cache entries, and the tides choice for it in `choices.ts`.

`src/spot.ts`: `spotById(id, spots)` now takes the list to look in; `allSpots(saved)` is the built-in three followed by the saved ones; `isSaved(spot)` says whether a spot can be removed. `App` holds the saved list in state and reads it once on open.

### The map

Leaflet 1.9.4 (BSD, no key, 42 KB gzipped) with OpenStreetMap's standard tiles at `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, credited "© OpenStreetMap contributors". OSM's tile policy allows light use from a site like this one with no key; changing provider is one URL. Leaflet is used directly, without react-leaflet: one component, `src/ui/SpotMap.tsx`, makes the map in an effect on a ref, puts a circle marker where the pin is, and calls `onPick(lat, lon)` on a tap. A circle marker, not Leaflet's default image marker, so there is no icon path for the bundler to lose. Leaflet's stylesheet is imported in that component.

The add screen (`src/ui/AddSpot.tsx`) is loaded with `React.lazy`, so Leaflet, its stylesheet and the station list are fetched the first time someone presses "Add a spot", not on every open.

## Rules, in plain modules

- `src/data/geo.ts`: distance, bearing, direction word.
- `src/data/stations.ts`: the row type, the loader, `nearestStations`.
- `src/data/nws.ts`: `fetchPoints`, `fetchElevationFt`, `NwsOutsideError`.
- `src/data/resolve.ts`: `resolveSpot`, `defaultTidesShown`.
- `src/data/savedSpots.ts`: read, add, remove, the type guard.
- `src/data/cache.ts`: `forgetSpot`.
- `src/ui/addSpotView.ts`: the words of the add screen: the facts lines, the tides reason, the two error lines, and whether Save is enabled, from the resolve result, the name and the pin.
- `src/spot.ts`: `spotById(id, spots)`, `allSpots`, `isSaved`.

Components (`AddSpot.tsx`, `SpotMap.tsx`, the switcher's button, the remove line in `SpotScreen.tsx`) hold no arithmetic and no wording, and are checked in a browser.

## Testing

- Unit tests for every plain module above, against the recorded responses and a short station list.
- One test of `nearestStations` against the real baked list: from Campus Point's coordinates it picks 9411340 Santa Barbara at 8.6 mi east for both roles; from Gaviota's, 9411399 as the tide station and 9411340 as the gauge at 31 mi; from a point on Lake Michigan, a far tide station and `tidesShown` false.
- The browser check, by the implementer with Playwright: open the add screen, tap the map, see the facts fill in, save, see the new spot's screen with its captions; reopen and see it still there; remove it; cancel from the add screen; the outside-US message for a pin in the Pacific off Mexico. The pull request lists the same steps for the owner's phone.

## Out of scope

- Place-name search (the issue's second half; a follow-up issue, with Nominatim as the likely geocoder).
- Editing a saved spot's name or moving its pin: remove and add again.
- Share by link (#7).
- Point elevation for sun and moon times (#9).
- The home-screen app's storage being separate from Safari's: noted in the issue, nothing to do here.

## Decisions this spec makes that the issue leaves open

1. **Leaflet with OpenStreetMap tiles**, loaded only when the add screen opens. The owner asked for a free map that is easy to work with; this is the lightest one with no key.
2. **A tap drops the pin; no dragging.** A second tap moves it. Simpler on a phone, and the map pans with a drag as usual.
3. **Tides shown by default within 25 mi and under 300 ft.** Two round numbers that classify the three built-in spots correctly.
4. **The gauge is the nearest harmonic station with a gauge**, never a Great Lakes or non-tidal gauge, because the deviation needs the gauge's own curve.
5. **The station list is committed**, not fetched at build time, so builds need no network and the list changes only when someone re-bakes it.
6. **Saved spots live in one storage key** as whole `Spot` objects, so a saved spot needs no lookups on open. If the station list changes, saved spots keep the stations they were saved with.
7. **No search by name in this pull request.** A follow-up issue.
8. **Removing is a two-press text line**, not a browser dialog.
9. **No edit.** Remove and add again.
