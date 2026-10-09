# Tideline

Sunset, tide, weather and moon for one spot, side by side.

For a named spot, tonight and the days ahead: when the sun sets, what the tide is doing, what the weather is doing, and what the moon is doing. Tideline shows the data and leaves the decision to you. It has no scores and no alerts.

Live at https://tideline-inky.vercel.app

## Status

Early. The first spot is Campus Point in Santa Barbara, California. The data layer is built and tested; the screen is next, so the live page is still a placeholder. The roadmap is in the issues: https://github.com/nicolovejoy/tideline/issues

## Run it

Needs Node 24.

```
npm install
npm run dev
```

Then open http://localhost:5173. `npm test` runs the tests.

## Where the data comes from

- **Tides:** NOAA CO-OPS, predicted and observed, station 9411340 (Santa Barbara).
- **Weather:** the US National Weather Service forecast for the 2.5 km grid cell at the spot.
- **Sun and moon:** computed in the browser with `astronomy-engine`, and tested against US Naval Observatory times.

The browser calls these services directly. There is no server, no account and no API key.
