# Wind as an arrow per hour, and night shaded on every panel

Date: 2026-10-12. Status: approved by the owner on 2026-10-12 as the second of three pieces of this stage; built on 2026-10-13 from `docs/superpowers/plans/2026-10-13-wind-arrows-and-night.md`. The decisions this spec makes beyond what he approved are listed at the end for review on the pull request.

Issue: https://github.com/nicolovejoy/tideline/issues/55

## Goal

In his session of 2026-10-11 the first user asked for the wind panel to be drawn the way the Weather Underground iOS app draws it: an arrow for each hour, placed at the wind's speed, with a line for gusts, and the night shaded. He also asked why the panel showed one direction only.

It showed one because the panel draws two lines, wind and gust, and says the direction only in words, for the hour under the cursor. The forecast already carries a direction for every hour (`windDeg`, from the `windDirection` layer, `src/data/nws.ts`). Nothing new needs fetching.

## What the user sees

1. **An arrow for each hour, in place of the wind line.** Each arrow is the same small size. It sits at the middle of its hour across the panel and at the hour's wind speed up the mph axis, and it points where the wind is blowing toward. A wind from the west points to the right.

2. **A calm hour is a dot**, at the foot of the panel. So is an hour whose direction the forecast does not give, at its speed.

3. **The gust line stays** as it is: a staircase on the same axis.

4. **The words at the cursor read "10 mph from WSW, gusts 14".** The words say where the wind comes from and the arrow points where it goes, which is the meteorological convention. A calm hour reads "Calm". The cursor's dots stay, on the wind's speed and on the gust.

5. **Fewer arrows where they would crowd.** Arrows are never drawn closer together than a set distance. Where an hour is narrower than that, every second hour gets an arrow, then every third, fourth, sixth or twelfth. A phone 375 px wide or more shows all 24. Zoom does not exist yet (issue 8); when a panel shows more than a day, the same rule thins the arrows.

6. **Night is shaded on all four panels**: the tide, wind, temperature and sky. The shade covers the hours the sun is down, before sunrise and after sunset. The lines at sunset, at moonrise and at the current time stay as they are.

7. **Both colour schemes.** The shade reads as night on the light ground and on the dark one.

## The rules

**Direction.** NWS gives the direction the wind comes from, in degrees clockwise from north. The words use it as it is ("from WSW"). The arrow is turned half a circle from it.

**Calm.** An hour whose speed rounds to 0 mph.

**Thinning.** With `w` the width of an hour in pixels and `g` the least distance between arrows, the step is the smallest of 1, 2, 3, 4, 6, 12 and 24 hours that is at least `g / w`. The hours that keep their arrow are counted from the start of the span drawn, so the same hours keep theirs as the cursor moves. Starting values, to be settled in a browser: an arrow 10 px long and `g` of 12 px.

**Night.** The parts of the spot's local day when the sun is below the horizon, by the same horizon the app's sunset uses: the spot's own height where that is counted (`src/data/horizon.ts`), a level one elsewhere. On a day with a sunrise and a sunset that is midnight to sunrise and sunset to midnight. Where the day has one of the two, the shade is on the dark side of it. Where it has neither, the whole day is shaded if the sun is down at the middle of the day and none of it if the sun is up. Twilight is not counted: the shade begins at sunset.

## How it works

- **`src/data/astro.ts`**: `DayAstro` gains `night`, the spans of the local day when the sun is down, to the nearest minute like every time in the record. Sunrise is found as sunset is, with the same observer. The tests check a day's sunrise against the Naval Observatory's, as they check sunset.
- **`src/chart/arrows.ts`**, a plain module with tests: the step for a width of hour, which hours keep an arrow, and the angle an arrow is turned to.
- **`src/chart/Panel.tsx`** gains two things to draw, each given to it as plain data:
  - bands: a span of time and a name, drawn as a rectangle the height of the plot behind everything else (`band-night`);
  - arrows: a time, a value and an angle, or no angle for a dot.
- **`src/ui/weatherView.ts`**: the wind panel's view has the gust series and a list of arrows, one for each hour that has a speed. Its vertical range is worked out as now, from every wind and gust value in the forecast.
- **`src/chart/readout.ts`**: `windParts` gives the speed and the direction as one part, then the gusts, and "Calm" for a calm hour.
- **`src/ui/selection.ts`**: the bands for the day on screen, from its `night`.
- **`src/ui/WeatherPanels.tsx`** and **`src/ui/SpotScreen.tsx`** hand the bands to all four panels, and the wind panel its arrows, thinned for the plot's width.
- **`src/styles.css`**: the shade, in both schemes, and the arrow.
- **`CLAUDE.md`**: the rule that weather is drawn as staircases is reworded. The gust, the temperature, cloud and rain are staircases, level across the hour; the wind's speed is an arrow at the middle of the hour, at the hour's value; and the cursor's dot and the words still agree with both.

Nothing new is fetched and nothing new is stored.

## What was found, on 2026-10-12

- NWS's direction for Campus Point changes about every 3 hours: 5 to 8 values a day, against 4 to 8 for speed and for gusts. Arrows will come in runs that point the same way.
- The plot on an iPhone 393 px wide is about 353 px, so an hour is about 14.7 px. On one 375 px wide it is about 14 px. These are worked out from the page's width in `src/styles.css`, not measured in a browser.

## Limits

- **The shade is the sun's, not the sky's.** It is light for half an hour either side of it.
- **Hills are not counted**, as for sunset.
- **An arrow shows the hour's direction, not the moment's.** NWS forecasts one value for the hour.

## Not in this change

- Zoom and pan (issue 8). The thinning is built and tested for a span of any length, and is seen at work only on a narrow phone until then.
- Observed wind. That is the third piece of this stage (issue 56), which draws its arrows with this piece's code.
- Arrows in the 14-day list.
- A sunrise time anywhere on the screen. Sunrise is worked out only for the shade.

## The owner's check, on production after the merge

At https://tideline.ibuild4you.com on an iPhone, in a Safari tab, at Campus Point:

1. Look at the Wind panel. Pass: a row of small arrows, one for each hour, at different heights where the speed changes, and a gust line above them. Fail: a line for the wind and no arrows.
2. Drag across the Wind panel. Pass: the words read like "10 mph from WSW, gusts 14", and where the words say "from W" the arrow under the cursor points to the right. Fail: the arrow points the way the wind comes from.
3. Look at all four panels. Pass: the hours before sunrise and after sunset are shaded on each, and the shade begins at the sunset line. Fail: a panel with no shade, or a shade that begins somewhere else.
4. Choose La Cumbre Peak. Pass: the three weather panels are shaded, and there is no tide panel. Then turn the phone's appearance to dark and back. Pass: the shade can be seen in both.

## Decisions this spec makes

Approved by the owner on 2026-10-12:

1. **Arrows replace the wind line**, and gusts stay a line.
2. **The words say where the wind comes from and the arrow points where it goes.**
3. **The readout is "10 mph from WSW, gusts 14".**
4. **Night is shaded on all four panels.** No reason was found to leave one out.
5. **The thinning is built now**, for zoom to use.

For review on the pull request:

6. **A calm hour is a dot and reads "Calm".**
7. **The thinning's steps** (1, 2, 3, 4, 6, 12, 24) **and its starting sizes.**
8. **Night is sunset to sunrise**, with no twilight, and uses the horizon the sunset uses.
9. **Sunrise is not shown as a time.**
