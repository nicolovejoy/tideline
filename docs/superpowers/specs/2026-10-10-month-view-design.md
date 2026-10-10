# Month view design: tide, sun and moon up to 3 months out

Date: 2026-10-10. Status: written on the owner's "keep cruising" for issue #3, with the open decisions listed below for review on the pull request.

Issue: https://github.com/nicolovejoy/tideline/issues/3

## Goal

A second view of a spot for planning further ahead than the forecast reaches: one calendar month at a time, this month and the next three, listing each day's sunset, moon, moonrise-near-sunset flag and NOAA's highs and lows. No weather, no curve, no cursor. The product rule it fills: "Default view is the forecast window; extended view is a month at a time, up to 3 months out, tide/sun/moon only."

Nothing here writes a URL. What a view's address looks like is for #7.

## Screen

The screen for a spot is in one of two views. It opens in the forecast view, as now. Nothing about the view is remembered on the device.

1. **Entry.** The 14-day list's heading becomes a row: "14 days" on the left, a "Months ahead" button on the right. Tapping it shows the month view in place of everything below the install hint: the tonight strip, the day's panels, the table, the captions and the 14-day list all go. The page scrolls to the top.
2. **Month head.** A "Back to forecast" button on its own line, then a row with the month's name, "October 2026", between a previous-month button on its left and a next-month button on its right. The buttons are labelled for screen readers ("Previous month", "Next month") and show "‹" and "›". At the current month the previous button is disabled; at the last offered month the next button is disabled. The months offered are the current month at the spot and the three after it: on 10 October 2026, October through January. Tapping back returns to the forecast view, with today on the panels and the cursor at rest, and scrolls to the top.
3. **Rows.** One per day of the month, in order. The current month starts at today; earlier days are not shown. Each row has the same first line as a 14-day row: "Sat Oct 10", "Sunset 6:29 PM", then the moon, then the flag "Moonrise 5:12 PM" where moonrise is within 2 hours of sunset. The moon line names the phase as the tonight strip does: "Moon 1% lit, new moon", so the full and new moons can be found by eye. Under the first line, the day's highs and lows in order, "Low 2:35 AM 0.2 ft", as in the 14-day rows. Rows are not buttons. Today's row is marked (`aria-current="date"`) with the tint the 14-day list uses for its chosen day.
4. **Tides hidden.** At a spot that hides its tide, the rows have no tide lines, and where the caption would be stands the same line and "Show tides" button the forecast view shows, which shows the tide in both views. A spot whose tide is shown but hidden by default gets "Hide tides" after the caption, as the forecast view does. The choice is the one the forecast view keeps, remembered per spot.
5. **Caption.** Under the rows: "Tide: NOAA 9411340 Santa Barbara, 8.6 mi east." With the highs and lows unavailable, "High and low times unavailable." follows; with a failed refresh, "Couldn't refresh the high and low times. Showing those from Fri Oct 9, 2:06 PM." These are the forecast caption's sentences, reused. Nothing about the predicted curve or the gauge, since neither is on this screen. Where the saved highs and lows stop short of the month, the rows past them simply have no tide lines; the caption's refresh sentence says why.
6. **Switching spots** resets the view to the forecast, as it resets the day and the cursor: the screen is mounted afresh per spot.
7. **Midnight.** When today moves on, the rows move with it. On the first of a month, the month that ended is no longer offered; if it was on screen, the current month takes its place.

## Data

### One longer fetch of highs and lows

The highs and lows source already fetched for the 14 days is asked for a longer span instead: from today's midnight at the spot to the midnight that ends the last offered month, a little under four months. One request, 22 KB (432 events for Santa Barbara, verified on 2026-10-10 and saved as a fixture). It is cached as now and, since predictions for a date never change, is only fetched again when the months move on. Nothing else about the source changes: the 14-day list, the day's table and the rules on the tide panel already take only the events on their day.

`frameFor` gains `ahead: Span`, that longer span, and `tideSpecs` gives `hilo` that as its `needed` window. No new source, no new loader, no cache version bump: a saved 14-day entry is stale against the longer window and is fetched again once.

### Sun and moon

Computed on the device for the month's dates with `dayAstro`, as the 14 days are. About 30 days' worth per month, worked out once per month on screen and again at midnight.

## Rules, in plain modules

- `src/time.ts`: `monthOf(date)` ('2026-10-10' → '2026-10'), `addMonths(month, n)`, `datesOfMonth(month)` (every date in it, in order), `formatMonth(month)` ('October 2026'). Calendar arithmetic on strings, no zone involved, like `addDays`.
- `src/data/useSpotData.ts`: `MONTHS_AHEAD = 3`; `frameFor` adds `ahead`; `hilo.needed` is `frame.ahead`.
- `src/ui/monthView.ts`:
  - `monthsOffered(today)`: the current month and the next three, as `'YYYY-MM'`.
  - `monthNav(month, today)`: `{ month, title, prev, next }` with `prev` and `next` the neighbouring offered months or null. A month that is not offered means the current month.
  - `monthRows(spot, month, { today, hilo }, tidesShown)`: `MonthRow[]`, one per date from today or the first of the month to its last, each with `date`, `day`, `isToday`, `sunset`, `moon`, `flag`, `tides`. The sunset, flag and tide words are made by the same functions as the 14-day rows, which move from `dayList.ts` into shared helpers so one wording serves both.
- `src/ui/captions.ts`: `monthCaption(spot, hilo, today)`: the station sentence and the highs-and-lows failure sentences, which `tideCaption` is reworked to share.
- Components: `MonthView.tsx` (head, rows, caption, the hidden line and toggles), `DayList.tsx` gains the heading row with its button, `SpotScreen.tsx` holds `view` and `month` state and chooses which to draw. No arithmetic, rules or wording in any of them.

## Testing

Fixture recorded on 2026-10-10 and added to `src/data/__fixtures__/`: `noaa-hilo-20261010-20270131.json`, Santa Barbara's highs and lows from 10 October 2026 to 31 January 2027 UTC, 432 events.

Tests run with `TZ=Asia/Tokyo`, so anything that leaned on the viewer's zone would show.

- `time.test.ts`: `monthOf`, `addMonths` across a year end, `datesOfMonth` for a 31-day month, February 2028 (29 days) and November 2026 (30 days), `formatMonth`.
- `useSpotData.test.ts`: the `hilo` window starts at today's midnight and ends at the midnight that ends the third month after this one; predictions still take the 14-day window.
- `monthView.test.ts`: `monthsOffered` on 15 November 2026 gives November to February; `monthNav` at each end and for a month not offered; `monthRows` for October 2026 on the 10th gives 22 rows, the first marked today, with the fixture's first events in Pacific time and the right words; rows for January 2027 hold every day; tides are empty when hidden; a row's moon line names the phase.
- `captions.test.ts`: `monthCaption` for a ready, an unavailable and a stale source; `tideCaption` unchanged by the rework.
- `dayList.test.ts`: unchanged behaviour after the shared helpers move.

Checked in a browser against the live APIs, with the fake clock where a date matters: the entry button, the four months, the disabled ends, the current month starting at today, a full-moon day's row, the tide lines agreeing with the NOAA station page, back to the forecast, the hidden line and toggle at La Cumbre, and the one highs-and-lows request covering the whole span.

## Decisions this spec makes that the issue leaves open

1. **A list, not a calendar grid.** Seven columns at phone width leave no room for a time and a height per high and low. The list reads like the 14-day list continued.
2. **No tide curve and no cursor in the month view.** The issue suggests a coarser curve or a day's curve on demand. A month of highs and lows with their times is what a planner needs, and a curve would bring back the panels, the cursor and a second fetch per day. A day inside the next two weeks has its curve on the forecast view already.
3. **The forecast's highs-and-lows fetch is lengthened rather than a second source added.** One 22 KB request a month instead of a 2 KB one every two weeks, and one loader, one cache entry and one failure story.
4. **The month view replaces the forecast view** instead of sitting below the 14-day list, so the page does not become two screens tall and the month's rows start at the top.
5. **The current month starts at today.** Past days are not shown anywhere in the app.
6. **Rows are not buttons.** Most days in the month have nothing more to show. Tapping a row to open a day in the forecast view would work for the first 14 days only, which is a surprise rather than a feature.
7. **The month rows name the moon's phase; the 14-day rows do not change.** Finding the full moon is the point of looking months ahead.
8. **The view is not remembered on the device.** The app opens on tonight.
