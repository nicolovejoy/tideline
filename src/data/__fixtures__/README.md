# Fixtures

Real responses, saved so the parsers are tested against what the services actually send.

- `noaa-hilo-20261008-20261022.json`: NOAA station 9411340, predicted highs and lows, 8 to 22 October 2026 UTC.
- `noaa-hilo-20261010-20270131.json`: the same station's predicted highs and lows, 10 October 2026 to 31 January 2027 UTC, 432 events: the span the month view lists, recorded on 2026-10-10.
- `noaa-predictions-20261008-20261009.json`: the same station's predicted curve at 6-minute resolution, 8 and 9 October 2026 UTC.
- `noaa-water-level-20261008-20261009.json`: the same station's observed water level, requested for those two days but recorded on the afternoon of the 8th, so it holds readings from midnight UTC to 21:36 UTC that day. On that morning the level ran about 1.1 ft above the prediction.
- `nws-gridpoint-LOX-100-71.json`: the NWS raw forecast grid for the cell containing Campus Point. A live forecast, so tests assert its structure, not its numbers.
- `usno-campus-point.ts`: sunset and moonrise from the US Naval Observatory API (`aa.usno.navy.mil/api/rstt/oneday`) for latitude 34.4046, longitude -119.8440.

The NOAA requests all used `datum=MLLW&units=english&time_zone=gmt&format=json`.
