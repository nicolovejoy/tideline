# Today's weather: observed up to now, forecast after

Date: 2026-10-12. Status: approved by the owner on 2026-10-12 as the third of three pieces of this stage, before anything was built. The decisions this spec makes beyond what he approved are listed at the end for review on the pull request. It is built after the second piece (issue 55), whose arrows and shading it draws on.

Issue: https://github.com/nicolovejoy/tideline/issues/56

## Goal

In his session of 2026-10-11 the first user asked for today's wind, temperature and sky to be what was measured up to the current hour and the forecast after it, the way the tide panel sets the observed level against the prediction. For now this is only where a weather station is near the spot. The station is named, with its distance, as the tide's caption names its gauge. Anywhere else today stays forecast only, and the screen says so.

There is a second reason for it. NWS's grid does not hold the whole of today: each of eight cells sampled on 2026-10-12 began about 6½ hours before its own last update, and the app replaces its saved forecast at each refresh. So the early hours of today drop off the panels as the day goes on. Observations fill exactly that part.

## What the user sees

1. **At a spot with a station near, today's panels have two sides.** Left of the line at the current time, the wind's arrows, the gust line, the temperature and the cloud are what the station reported. Right of it they are the forecast, as now. The line that is already drawn at the current time is where one stops and the other starts: there is no gap, no overlap and no second line.

2. **One value for each hour, on both sides.** An hour gone by is drawn level across the hour, as a forecast hour is, and has one arrow. The current hour is cut at the line: what the station last reported to its left, the forecast for that hour to its right.

3. **The two sides are drawn differently**, so that neither is taken for the other: the observed side heavier, and its arrows filled where the forecast's are outlined. The look is settled from screenshots on the pull request.

4. **The words at the cursor say which.** Left of the line: "9 mph from W, gusts 15, observed" and "64°F, observed". Right of it: "10 mph from WSW, gusts 14, forecast". On any other day nothing is added: all of it is forecast.

5. **Observed sky is a category, not a percentage.** Stations report cloud as layers, each clear, few, scattered, broken or overcast. The panel draws the layer that covers most, at the middle of its range, and the words give the category: "Scattered cloud, observed; 0% rain, forecast". The chance of rain is a forecast all day: there is no observed chance of rain.

6. **A caption names the station**, under the weather's caption, when today is on screen:

   "Observed: NWS KSBA Santa Barbara, Santa Barbara Municipal Airport, 1.5 mi north, at 10 ft, through 11:35 AM. Sky is the cloud layer that covers most. Rain chance is forecast."

   Where the station reports no sky: "… through 9:35 AM. It reports no sky, so sky is forecast."

7. **A spot with no station near says why**, in the same place, when today is on screen:

   - "Today is forecast only: the nearest weather station, KIZA Santa Ynez Airport, is 12.8 mi away."
   - "Today is forecast only: the nearest weather station, LPOC1 Los Prietos, is at 982 ft and this spot at 3,997 ft."

8. **Every other day is as it is now.**

## The rules

**Which station.** The nearest station in NWS's list for the spot's forecast cell that is both:

- within 10 miles of the spot;
- within 500 ft of the spot's height, above or below. The spot's height is its own where that is known and its forecast cell's average where not, as for the tide rule.

Without the second, La Cumbre Peak, at 3,997 ft, would show the wind and temperature of a canyon at 982 ft or of the airport at 10 ft as its own. One station serves a spot. It is looked up once and kept on the device for 30 days.

**An hour's value.** For an hour that has ended, the report nearest the top of the hour, among those from 30 minutes before it to 30 minutes after. The temperature, the wind's speed and direction and the sky all come from that one report. For the current hour, the latest report, if it is no older than 30 minutes before the hour began.

**Gusts.** The highest gust in any report stamped within the hour. Stations give a gust only when there is one: the airport gave one in 19 of 310 reports on 2026-10-12. An hour with reports and no gust has no gust, and none is drawn.

**Where there is no observed value.** An hour gone by with no report, or a report without that value, shows the forecast's value for that hour if the forecast still has it, drawn and worded as forecast. Gusts are the exception, above. A value the station never reports, such as sky at a station with no ceilometer, is forecast all day and the caption says so.

**Sky.** The layer that covers most decides: clear 0%, few 19%, scattered 44%, broken 75%, overcast 100%. Those are the middles of the ranges the categories stand for, in eighths of the sky: few is 1 to 2, scattered 3 to 4, broken 5 to 7, overcast 8. A sky hidden by fog, reported as a vertical visibility, counts as overcast. A report with no layers at all has no sky.

**Units.** Reports come in °C and km/h and are shown in °F and mph, as the forecast's are.

## How it works

- **`src/data/nws.ts`**, or a module beside it, framework-free and tested against recorded real responses cut down to a few hours of reports:
  - the stations of a cell: `/gridpoints/{office}/{x},{y}/stations?limit=500`, parsed to an id, a name, a point and a height in feet;
  - a station's reports: `/stations/{id}/observations?start={time}&limit=500`, from 30 minutes before the spot's day begins, parsed to a time and the five values.
- **`src/data/weatherRule.ts`**, plain and tested: the two bars, 10 miles and 500 ft; which station a spot gets from a list; and, where it gets none, the nearest and why it does not serve.
- **`src/data/observed.ts`**, plain and tested: the reports of a day turned into one row for each hour, by the rules above.
- **`src/data/cache.ts`**: two more sources. The station chosen, or that there is none, goes stale after 30 days. The hours observed go stale after 6 minutes, as the observed tide does. Both are dropped with the spot's other saved data. The hours are saved, not the reports: 24 rows, where a day of the airport's reports is over a megabyte.
- **`src/data/useSpotData.ts`**: the two are loaded as the other sources are. The reports are asked for only once a station is known, and only for today.
- **`src/ui/weatherView.ts`**: given the observed hours, the current time and whether today is on screen, it builds the observed and the forecast series, the arrows marked as one or the other, and the words. The vertical ranges take the observed values in.
- **`src/chart/Panel.tsx`** and **`src/chart/scales.ts`**: a staircase can stop at a time or start at one, which is how the current hour is cut at the line.
- **`src/ui/captions.ts`**: the station's line, or why there is none, and what to say when the reports could not be refreshed or there are none yet today.
- **`src/styles.css`**: the observed series and arrows.
- **`CLAUDE.md`**: the product rule, the station rule, and what was found about these two endpoints.

Built-in spots are looked up as saved ones are. No spot carries its weather station, so spots already saved get theirs without being added again.

What is fetched that was not: one request for the station list the first time a spot is opened (6 KB compressed), then one request for the day's reports each time today's panels refresh at a spot that has a station, no more often than every 6 minutes while the page is in view (21 to 23 KB compressed at an airport, 3 KB at an hourly station). Both are on the host the forecast comes from.

## What was found, on 2026-10-12

All from `api.weather.gov`, with no key, and open to a browser (`access-control-allow-origin: *`).

- **The station list** for a cell has 64 stations and is complete on one page; a second page is empty. For Campus Point's cell it is 88 KB, 6 KB compressed, and carries `cache-control: public, max-age` of about 13 hours. Every station in it has a height.
- **The built-in spots:**
  - Campus Point: KSBA Santa Barbara Municipal Airport, 1.5 mi, 10 ft. The next is LPOC1, 10.1 mi.
  - Gaviota State Park: none within 10 miles. The nearest is KIZA Santa Ynez Airport, 12.8 mi, 673 ft.
  - La Cumbre Peak (3,997 ft): LPOC1 Los Prietos, 5.6 mi, 982 ft; MOIC1 Montecito #2, 6.1 mi, 285 ft; KSBA, 8.7 mi, 10 ft. None is within 500 ft of the peak's height. The next beyond 10 miles is WBPC1 West Big Pine, 13.9 mi, 6,360 ft.
- **So of the three, Campus Point alone gets observations.**
- **How often they report, over 24 hours:**
  - KSBA: 310 reports, every 5 minutes and the hourly report at 53 minutes past. Temperature in all, wind and direction in 293, sky in 301, a gust in 19.
  - LPOC1: 24 reports, hourly. Wind and direction in all, temperature in 20, a gust in 11, no sky.
  - MOIC1: 24 reports, hourly. Temperature, wind and direction in all, a gust in 12, no sky.
  - KIZA: 71 reports, about every 20 minutes. Sky in 32.
- **A day of KSBA's reports** is 1.2 MB, 21 to 23 KB compressed, in about a second, with `cache-control: public, max-age=300`. Reports come newest first. A page holds 500 at most, and the answer names a next page even when there is none.
- **A calm report** has a speed of 0 and a direction all the same (78 of 78 at KSBA).
- **Quality flags** seen on values: `V`, `C` and `S` on values that are there, `Z` on values that are null. No value was seen flagged as failed. What NWS's other flags mean is to be read from its documentation when the plan is written, and a value flagged as failed is to be left out.
- **NWS keeps about 7 days of reports.**

## Limits

- **The station is not the spot.** The airport is a mile and a half inland of Campus Point, and wind at a beach is not wind on a runway. That is why the station is named, with its distance and its height.
- **"Clear" from an automated station** means clear below about 12,000 ft.
- **One station.** If the one chosen stops reporting, today is forecast with a line saying there are no reports, until the choice is next looked up. A second station is not tried.
- **A station that reports more than 500 times a day** would lose its earliest hours. None was seen.
- **Observed sky and forecast sky are different measures** drawn on one axis: a category at the middle of its range, and a percentage.
- **Reports are preliminary.**

## Not in this change

- **A record of forecasts and observations over time** (issue 11). NWS serves no past forecasts and a week of past reports, so both would have to be saved as they are issued. The issue has the sizing.
- **Every reading drawn.** The airport reports every 5 minutes; one value an hour is drawn. The detail belongs with zoom (issue 8).
- **Other sources of observations.** NOAA's tide station at Santa Barbara harbour (9411340) has wind and air temperature every 6 minutes and is not in NWS's list. Weather Underground's personal stations and the Synoptic network were not checked: both need a key, as far as is known.
- **Observed values in the 14-day list**, whose row for today stays the forecast at the hour of sunset.
- **The add screen naming the station.**
- **Choosing a station by hand.**

## The owner's check, on production after the merge

At https://tideline.ibuild4you.com on an iPhone, in a Safari tab, after about 10 AM so that there are hours gone by:

1. Choose Campus Point. Pass: on the Wind, Temperature and Sky panels, what is left of the line at the current time is drawn differently from what is right of it. Fail: one look all the way across.
2. Drag left of the line. Pass: the words end in "observed", and the Sky panel's words give a category such as "Overcast" or "Clear". Drag right of it. Pass: the words end in "forecast".
3. Read the captions under the panels. Pass: a line that begins "Observed: NWS KSBA" and gives a distance, a height and a time within the last 15 minutes. Fail: no such line, or a time hours old.
4. Choose Gaviota State Park. Pass: a line that begins "Today is forecast only" and names a station and its distance, and panels with one look all the way across.
5. Choose La Cumbre Peak. Pass: a line that begins "Today is forecast only" and gives two heights.
6. Choose Campus Point and tap tomorrow in the 14 days. Pass: no "Observed" line, and the words at the cursor end in neither "observed" nor "forecast".

## Decisions this spec makes

Approved by the owner on 2026-10-12:

1. **A station serves a spot within 10 miles and within 500 ft of its height.** The 10 miles is the first user's, for now. The height is the owner's, so that a peak does not show a valley's weather.
2. **One value for each hour on the observed side**, not every reading.
3. **The line at the current time is where observed stops and forecast starts.** No gap, no overlap, no second line.
4. **Observed sky is drawn at the middle of its category's range, and worded as the category.** There is no observed chance of rain.
5. **The station is named, with its distance.** A spot with none says so.
6. **The look of the two sides is chosen from screenshots on the pull request.**

For review on the pull request:

7. **An hour's value is the report nearest the top of the hour**, not an average of the hour's reports.
8. **An hour's gust is the highest reported in it, and an hour with reports and no gust has none.**
9. **An hour with no observed value shows the forecast's, as forecast.**
10. **The current hour is cut at the line.**
11. **The station is looked up for every spot and kept for 30 days**, and is no part of a saved spot.
12. **The hours are saved on the device, not the reports.**
13. **The words**: "observed" and "forecast" after each panel's values on today only, and the captions above.
14. **A second station is not tried when the first is silent.**
