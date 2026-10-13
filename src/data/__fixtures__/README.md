# Fixtures

Real responses, saved so the parsers are tested against what the services actually send.

- `noaa-hilo-20261008-20261022.json`: NOAA station 9411340, predicted highs and lows, 8 to 22 October 2026 UTC.
- `noaa-hilo-20261010-20270131.json`: the same station's predicted highs and lows, 10 October 2026 to 31 January 2027 UTC, 432 events: the span the month view lists, recorded on 2026-10-10.
- `noaa-predictions-9411340-20261010-20261023.json`: the same station's predicted curve at 6-minute resolution, 10 to 23 October 2026 UTC, 3,360 points, recorded on 2026-10-10. The truth the interpolated curve is measured against.
- `noaa-hilo-9411340-20261009-20261024.json`: the same station's highs and lows, 9 to 24 October 2026 UTC, 58 events: a day either side of that curve, so every point of it is bracketed.
- `noaa-hilo-9411189-20261009-20261024.json`: station 9411189 Ventura, a subordinate station, highs and lows for the same days, 58 events.
- `noaa-predictions-9411189-error.json`: NOAA's answer to a 6-minute request at Ventura. A subordinate station publishes no curve, and this error body is the whole response, with HTTP 200.
- `noaa-predictions-20261008-20261009.json`: the same station's predicted curve at 6-minute resolution, 8 and 9 October 2026 UTC.
- `noaa-water-level-20261008-20261009.json`: the same station's observed water level, requested for those two days but recorded on the afternoon of the 8th, so it holds readings from midnight UTC to 21:36 UTC that day. On that morning the level ran about 1.1 ft above the prediction.
- `nws-gridpoint-LOX-100-71.json`: the NWS raw forecast grid for the cell containing Campus Point. A live forecast, so tests assert its structure, not its numbers.
- `nws-points-34.4046--119.844.json`: NWS `/points` for Campus Point, recorded on 2026-10-10: the cell LOX 100,71 and the zone America/Los_Angeles.
- `nws-points-48.5--3.0.json`: NWS `/points` for a point in France, the 404 body that means "no forecast here".
- `nws-stations-LOX-100-71.json`: NWS `/gridpoints/LOX/100,71/stations?limit=500`, the 64 stations listed for Campus Point's cell, recorded on 2026-10-13 and cut to six in NWS's order: KSBA Santa Barbara Municipal Airport (10 ft, 1.5 mi from Campus Point), LPOC1 Los Prietos (982 ft), MOIC1 Montecito #2 (285 ft), KIZA Santa Ynez Airport (673 ft), WBPC1 West Big Pine (6,360 ft) and KLAX. The `pagination.next` link is NWS's, which names a next page even when there is none.
- `nws-observations-KSBA.json`: NWS `/stations/KSBA/observations`, the airport's reports, recorded at 17:40 UTC on 2026-10-13 and cut to the 16 newest: 16:30 to 17:40 UTC, every 5 minutes with the hourly report at 16:53, newest first as NWS sends them. All clear sky, no gusts, calm at 16:45. Values carry quality flags: `V` on values that are there, `Z` on nulls.
- `nws-observations-LPOC1.json`: the same for LPOC1 Los Prietos, a station that reports hourly, 11:35 to 16:35 UTC on 2026-10-13, 6 reports: gusts in most, flagged `S`; two temperatures null; no cloud layers at all.
- `nominatim-santa-barbara.json`: OpenStreetMap Nominatim's answer to "Santa Barbara" with `format=jsonv2&countrycodes=us&limit=5`, recorded on 2026-10-10: the city, the county and Hatch, New Mexico (a fuzzy match), 3 places. The app asks for `limit=1`; the parser takes the first.
- `nominatim-leadbetter-beach.json`: the same for "Leadbetter Beach", recorded on 2026-10-10: one place of type beach.
- `nominatim-summerland-beach-santa-barbara-view.json`: Nominatim's answer to "Summerland Beach" as the app asks it from a map over the Santa Barbara coast, `format=jsonv2&countrycodes=us&limit=1&viewbox=-120.12,34.65,-119.57,34.15&bounded=0`, recorded on 2026-10-10: the beach at Summerland, 5 mi down the coast.
- `nominatim-summerland-beach-ohio-view.json`: the same question from a map over Buckeye Lake, Ohio (`viewbox=-82.8,40.15,-82.25,39.65`), recorded on 2026-10-10: a hamlet in Fairfield County, Ohio. It is also what Nominatim answers with no view at all, and what the app showed before it sent one.
- `usgs-epqs-34.4586--120.0236.json`: the USGS Elevation Point Query Service's answer for El Capitan State Beach in feet, recorded on 2026-10-10: 20.77 ft, where the NWS cell containing the beach averages 640 ft.
- `usno-campus-point.ts`: sunset and moonrise from the US Naval Observatory API (`aa.usno.navy.mil/api/rstt/oneday`) for latitude 34.4046, longitude -119.8440.

The NOAA requests all used `datum=MLLW&units=english&time_zone=gmt&format=json`.
