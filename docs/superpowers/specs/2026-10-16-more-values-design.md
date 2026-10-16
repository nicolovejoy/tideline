# Feels like, dew point and humidity on the temperature panel

Date: 2026-10-16. Status: written for the owner's review on the pull request, under his standing instruction to carry on without blocking on questions. The decisions this spec makes beyond the issue are listed at the end.

Issue: https://github.com/nicolovejoy/tideline/issues/8, its second bullet: "more values from the NWS grid: relative humidity, dew point, apparent temperature. Coastal cells also carry wave height, wave period and swell." The waves are not in this change (see "Not in this change"). Pinch and two-finger drag, the rest of the first bullet, are a later change of their own.

## Goal

The first user asked for a way to dig into each value. The temperature alone does not say what a day on the beach feels like: a 68°F afternoon with a 64°F dew point is muggy and a 68°F afternoon with a 40°F dew point is dry, and a windy 55°F morning feels colder than the thermometer says. NWS's grid carries the apparent temperature, the dew point and the relative humidity for every hour it carries a temperature, and the airport reports the dew point and the humidity with each observation, so the app can show them alongside the temperature with the rules it already has.

What the grid carries was checked on 2026-10-16 for the three built-in spots' cells (LOX 100,71; 87,76; 105,74): `apparentTemperature`, `dewpoint` and `relativeHumidity` run the whole week at one to three hours a value. `heatIndex` is sparse and `windChill` nearly all null, so the apparent temperature, which NWS folds both into, is the one to take. Every wave and swell layer (`waveHeight`, `wavePeriod`, `primarySwellHeight` and the rest) is one zero across the week in all three cells: they are land cells, and NWS's marine values live in its coastal-waters forecasts, not here.

## What the user sees

1. **The temperature panel carries three lines.** The temperature as now, in the text colour. The dew point as a thin line in the muted colour, under the temperature as it always is. The feels-like temperature as a dotted line in the muted colour, as the gusts are drawn on the wind panel, and only where it stands out from the temperature: where NWS's apparent temperature is within 2°F of the temperature the dotted line is not drawn, so it never lies on top of the temperature's own line. The panel's title stays "Temperature".

2. **The words at the cursor say all four.** "72°F, dew point 55°F, 57% humidity, feels like 78°F", each part present only where the hour has it, with the temperature's colour key on the first and the muted key on the dew point and the feels-like. The humidity has no line and so no key. The feels-like words follow the line: an hour whose feels-like is hidden has no "feels like" in the words either, so the line, the dot and the words agree as they do for the gusts.

3. **A dot at the cursor on each line the hour has**, as now: the temperature's, the dew point's and the feels-like's where it is shown.

4. **The panel's vertical range takes the new values in**, over the whole forecast and the day's observed rows, stepped by 10 as now, so a dry day at La Cumbre Peak with a 20°F dew point draws down to 20°F on every day. The feels-like counts in the range whole, hidden hours included, as the gusts do, so the panel does not jump as an hour's feels-like comes and goes.

5. **Today with a station.** Where a station serves the spot, the dew point and the humidity are observed up to the current time and forecast after it, as the temperature is: the observed dew point is the heavy line in the observed colour, cut at the line at the current time, and the forecast's dew point starts there; left of the line the words say "72°F, dew point 52°F, 61% humidity, observed", right of it "forecast". The feels-like is forecast all day, as the chance of rain is, because a station's heat index and wind chill are reported only in extremes and are null in nearly every report; the words end "feels like 78°F, forecast" on both sides of the line, as the rain says "forecast". A report whose dew point or humidity failed its quality flag keeps its temperature and lacks that one value (`measure` in `src/data/nwsObservations.ts` reads each measure's flag on its own), and the row then takes that value from the forecast for the hour, worded as forecast, as a row lacking the wind does today.

6. **Nothing else changes.** The wind and sky panels, the 14-day list, the month view, the share card and the captions stay as they are.

## The rules

**The forecast.** `ForecastHour` gains `feelsF`, `dewF` and `humidityPct`, read from the grid's `apparentTemperature` (°C to °F), `dewpoint` (°C to °F) and `relativeHumidity` (percent) by the same layer table as the rest, spread over each value's hours as the rest are. An hour the grid lacks a value for has null.

**The observed rows.** `Report` and `ObservedHour` gain `dewF` and `humidityPct`, from a report's `dewpoint` (°C) and `relativeHumidity` (percent), with the quality flags read as the temperature's are. The row for an hour takes them from the same report its temperature comes from.

**The shown feels-like.** `shownFeel(hour)` is the hour's `feelsF` where `|feelsF − tempF| ≥ 2`, and null where it is closer, or where either is null. The staircase, the dot and the words all use it, so a hidden feels-like is hidden everywhere; the vertical range uses `feelsF` as given.

**The words.** In this order, each only where the hour has it: the temperature "72°F"; "dew point 55°F"; "57% humidity"; "feels like 78°F" from the shown feels-like. Whole degrees and whole percent. The unit is written on every temperature, since "feels like 78" alone could read as anything. The feels-like comes last so that on today with a station the parts from the row run together and the forecast's feels-like stands alone after them. These are the panel's parts, a new `temperaturePanelParts` beside `tempParts`; `tempParts` stays the one part for the 14-day list, which does not change. On today with a station each part carries its side, worded by `withSourceWords`, which already says the side once after a run of parts from it: the temperature, the dew point and the humidity from the row where the row has them, else the forecast; the feels-like from the forecast always. A full row with a shown feels-like reads "72°F, dew point 52°F, 61% humidity, observed, feels like 78°F, forecast"; a row whose dew point was flagged bad reads "72°F, observed, dew point 52°F, 61% humidity, feels like 78°F, forecast", since the three forecast parts run together.

**Which temperature the feels-like is set against.** The forecast's own, always: `shownFeel` reads one `ForecastHour` and compares its `feelsF` with its `tempF`, as `shownGust` compares a gust with its wind. On today with a station, left of the line, the feels-like line can therefore sit within 2°F of the observed temperature line, or cross it. That is accepted: the feels-like is a forecast value and is hidden by the forecast's own rule, and the line, the dot and the words all go by the same `shownFeel` of the forecast hour, whichever side the cursor is on.

**The staircases.** On the temperature panel, in the order drawn: the dew point, the feels-like, the temperature, so the temperature's line is on top. The dew point goes by the observed rule exactly as the temperature does: in `OBSERVED_FIELDS`, its observed staircase cut at the line at the current time, the current hour's value the observed one only left of the line, and the forecast's step for the current hour starting at the line. The humidity is in `OBSERVED_FIELDS` too, so the words take it from the row, but it is in no panel's `fields` and so has no staircase and no dot. The feels-like is not in `OBSERVED_FIELDS`: its staircase is the forecast's, whole, as the rain's is.

**The dots.** One for each of the three the hour has, named `temp`, `dew` and `feels`, with `-observed` where the row stands for it as now.

**The range.** `steppedBounds` over `tempF`, `feelsF` and `dewF` of every forecast hour and every observed row, by 10.

**The cache.** A saved forecast or observed day from before this change lacks the new fields. `isForecast` and `isObservedHour` ask for every field to be null or a number, so an old entry fails the check and counts as nothing saved, as a leftover from an older version does: the screen says "Loading forecast" until the fetch lands, as on a first open, and a device opening the new build with no connection has no forecast until it has one. Accepted; it happens once per spot. The cache's version is bumped to v3 as the comment in `src/data/cache.ts` asks when a saved shape changes, which drops every saved entry at once rather than one source at a time.

## How it works

- `src/data/nws.ts`: three more rows in `LAYERS` and `emptyHour`; `parseGridpoint` and `isForecast` need no change beyond them. The recorded gridpoint fixtures already carry the layers.
- `src/data/nwsObservations.ts`: two more measures in `parseObservations`. The recorded KSBA fixture carries both.
- `src/data/observed.ts`: `row` carries the two from its base report; `isObservedHour` checks them.
- `src/chart/arrows.ts` or a new `src/chart/feel.ts`, plain, tested: `shownFeel`, beside `shownGust`, with the 2°F threshold as a named constant.
- `src/chart/readout.ts`: a new `temperaturePanelParts(hour, source?)` with the four parts in order and the keys `temp`, `dew`, null and `feels`; `tempParts` unchanged for `dayList.ts`. `asForecastHour` in `weatherView.ts` carries the new fields across.
- `src/ui/weatherView.ts`: `TEMP`'s `fields` and `dots` grow to the three (dew, feels, temp, in that order); `OBSERVED_FIELDS` gains `dewF` and `humidityPct`; `withShownGusts` becomes `withShownValues`, applying `shownFeel` too; `tempBounds` takes the three fields; `readoutFor`'s temperature branch builds the parts from the row where it stands and the forecast where not, per part.
- `src/styles.css`: `.series-dew .line` thin and muted; `.series-feels .line` dotted and muted as `.series-gust`; `.series-dew-observed .line` heavy in the observed colour; `.key-feels`, `.key-dew`, `.dot-feels`, `.dot-dew`, `.dot-dew-observed`.
- `src/data/cache.ts`: the prefix to `tideline:v3:`, with the comment saying why.
- `CLAUDE.md`: the status line, the Product rules bullet on today's weather, the Stack bullet on weather, and Data sources (what the grid carries, and that the waves are zero on land cells).
- Tests: `nws.test.ts` on the real fixture for the three layers; `nwsObservations.test.ts` and `observed.test.ts` for the two measures; `readout.test.ts` for the words; `weatherView.test.ts` for the staircases, the dots, the range, the hidden feels-like and the observed side; a test for `shownFeel`.

## Not in this change

- Waves and swell. The three spots' cells carry zeros. NWS's marine forecast is a different product (the coastal-waters zone forecast, or a marine gridpoint over the water), with its own shape and its own question of which point stands for a beach; it gets an issue of its own.
- Pinch and two-finger drag on the stack (issue 8's first bullet, what is left of it).
- The heat index and wind chill as values of their own; the apparent temperature stands for both.
- Humidity as a line. It is in the words only (decision 2).
- The 14-day list's rows, which stay the temperature alone.

## Decisions made here, for review on the pull request

1. The three values go on the temperature panel rather than panels of their own, so the stack stays four panels tall on a phone. The feels-like is dotted and shown only where it stands out, by the gust's pattern, so the common case, where NWS's apparent temperature equals the temperature, draws nothing extra.
2. The humidity is in the words only, with no line, because it says the same thing as the dew point and the temperature together, and a third line on the temperature panel or a line on the sky panel's percent axis would crowd either. If the first user wants to see it, a line on the sky panel is the place.
3. The feels-like threshold is 2°F. NWS's apparent temperature equals the temperature in mild hours and departs from it by several degrees in heat or wind; 2°F is the smallest difference that is a different whole number on the words.
4. The feels-like is forecast all day on today with a station, as the chance of rain is, rather than observed from the station's heat index and wind chill, which are null in nearly every report.
5. Waves are out, with an issue filed for the marine forecast, because the grid carries none for these spots and the issue's premise ("coastal cells also carry wave height") does not hold for a land cell.

## Builder's questions, settled

A fresh reader was asked what it would still need before planning this. Its six questions and the answers, all of them answered from the code or by a call made here, none needing the owner:

1. The 14-day list calls `tempParts`: it keeps it unchanged, and the panel gets `temperaturePanelParts`.
2. Mixed sides in the words: each part carries its own side, `withSourceWords` says the side once after each run, and the feels-like comes last so the forecast parts run together (the order changed from the first draft for this).
3. The 2°F test is against the forecast's own temperature, on both sides of the line.
4. The dew point is treated exactly as the temperature by the observed rule; the humidity is in `OBSERVED_FIELDS` for the words and has no staircase; the feels-like is forecast whole.
5. An old saved entry counts as nothing saved and the screen says "Loading forecast" until the fetch lands. Accepted, and the version is bumped.
6. `measure` reads each measure's own quality flag; a dropped dew point falls back to the forecast for that hour, worded as forecast.
