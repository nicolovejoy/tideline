# Tideline

Sunset, tide, weather and moon for one spot, side by side.

For a named spot, tonight and the days ahead: when the sun sets, what the tide is doing, what the weather is doing, and what the moon is doing. Tideline shows the data and leaves the decision to you. It has no scores and no alerts.

Live at https://tideline.ibuild4you.com

## Status

Early. The first spot is Campus Point in Santa Barbara, California. The live page shows tonight's sunset and moon; four panels on one time axis for any of the next 14 days (the tide with today's observed water level drawn over it, wind, temperature and sky); that day's highs and lows; and a 14-day list. It can be added to an iPhone home screen. Three spots can be switched between, and a month view lists sunset, moon and highs and lows for this month and the next three. The roadmap is in the issues: https://github.com/nicolovejoy/tideline/issues

## Run it

Needs Node 24.

```
npm install
npm run dev
```

Then open http://localhost:5173. `npm test` runs the tests.

## Where the data comes from

- **Tides:** NOAA CO-OPS, the nearest station per spot (named on screen), predicted and observed; where the station publishes highs and lows only, the curve is interpolated between them and labelled so.
- **Weather:** the US National Weather Service forecast for the 2.5 km grid cell at the spot.
- **Sun and moon:** computed in the browser with `astronomy-engine`, and tested against US Naval Observatory times.

The browser calls these services directly. There is no server, no account and no API key.
