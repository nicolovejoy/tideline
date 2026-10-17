# Tideline

Sunset, tide, weather and moon for one spot, side by side.

For a named spot, tonight and the days ahead: when the sun sets, what the tide is doing, what the weather is doing, and what the moon is doing. Tideline shows the data and leaves the decision to you. It has no scores and no alerts.

Live at https://tideline.ibuild4you.com

## Status

Early, and in use by its first user. The first spot is Campus Point in Santa Barbara, California. The page shows tonight's sunset and moon; four panels on one time axis (the tide with today's observed water level drawn over it, the wind as an arrow per hour with its gusts, the temperature with the dew point and the feels-like, and the sky) across a day, three days or a week from any of the next 14 days, with the night shaded; that day's highs and lows; and a 14-day list. Where a weather station is near, today's weather is what it reported up to now and the forecast after. A "?" beside the panels explains everything drawn. It can be added to an iPhone home screen. Three spots can be switched between, and a month view lists sunset, moon and highs and lows for this month and the next three. You can add your own spot anywhere in the US from a pin on a map or by typing a place name; it is saved on the device, can be renamed, moved or removed, and can be shared as a link, which carries its name and coordinates and nothing else. The roadmap is in the issues: https://github.com/nicolovejoy/tideline/issues

## Run it

Needs Node 24.

```
npm install
npm run dev
```

Then open http://localhost:5173. `npm test` runs the tests and `npm run coverage` reports their coverage.

## Where the data comes from

- **Tides:** NOAA CO-OPS, the nearest station per spot (named on screen), predicted and observed; where the station publishes highs and lows only, the curve is interpolated between them and labelled so.
- **Weather:** the US National Weather Service forecast for the 2.5 km grid cell at the spot.
- **Height:** the US Geological Survey's Elevation Point Query Service, asked once when you add a spot. A spot has a tide when a tide station is within 25 miles and the spot itself is under 300 feet.
- **Map and place search:** Leaflet on OpenStreetMap tiles, © OpenStreetMap contributors; place names looked up with OpenStreetMap's Nominatim, which is told what the map shows so that the nearest place of that name comes first.
- **Sun and moon:** computed in the browser with `astronomy-engine`, and tested against US Naval Observatory times. Where a spot is 100 feet up or more and near the sea, the times are for that height over a sea-level horizon, and the screen says so.

The browser calls these services directly. There is no server, no account and no API key.
