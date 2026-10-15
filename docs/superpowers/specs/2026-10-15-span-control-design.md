# The panels across a day, three days or a week

Date: 2026-10-15. Status: design agreed with the owner in chat on 2026-10-15 (the span control, option 1 of 3, and the two sections below); this spec is for his review before the plan is written. The decisions this spec makes beyond what he agreed are listed at the end for review on the pull request.

Issue: https://github.com/nicolovejoy/tideline/issues/8, its first bullet only. The extra NWS values in the same issue (humidity, dew point, apparent temperature, waves) stay in the issue for later, and the uPlot fallback is not needed.

## Goal

The panels show one day at a time on the shared time axis, chosen from the 14-day list, and the first user asked for a way to dig further. A wider window shows the week's shape: a wind that builds over three days, a swell of tides, the nights lengthening. The arrow thinning of issue 55 was built for a panel that shows more than a day and waits for this.

## What the user sees

1. **Three buttons under the day's heading, above the panels: "Day", "3 days", "Week".** They look like the outlined "Months ahead" button, with the chosen one filled. "Day" is chosen on a first open, and then nothing on the screen differs from today.

2. **The panels draw that window.** It starts at the chosen day's start and runs 1, 3 or 7 days through the 14 days the app has. Tapping another day in the 14-day list pans the window to start there, as it chooses the day now. From day 12, "Week" and "3 days" show the two days that exist. On the days past the forecast's reach the weather panels are empty on the right, as a day past the forecast is empty today.

3. **The tide, the readings, the weather and the arrows run across the window.** The arrows thin to every second, third, fourth, sixth, twelfth or twenty-fourth hour by the width of an hour, as built. The night is shaded on every day in the window, and the sunset and moonrise lines are drawn for each day. Their names, "Sunset" and "Moonrise", are drawn only in the one-day window; at three days they would print over each other.

4. **Under the panels, day names instead of hours.** At one day the hour labels stay as they are (12a, 6a, 12p, 6p). At three days each day's start is labelled with its weekday, "Thu", "Fri", "Sat", and its noon with "12p". At a week each day's start is labelled with its weekday and nothing else.

5. **The cursor is one finger, as now.** It rests where it rests today, on the chosen day, and a drag or a tap moves it anywhere in the window. Its time in words carries the weekday when the window is wider than a day: "Fri 3:00 PM", and "at Fri 3:00 PM" in the heading's corner.

6. **The heading, the readout, the highs and lows and the captions keep saying the chosen day.** The heading reads "Thu Oct 15 to Wed Oct 21" when the window is wider than a day, or "Thu Oct 15 to Fri Oct 16" where it is clipped. The highs-and-lows table stays the chosen day's: the readout at the cursor gives the rest.

7. **A reload keeps the choice**, as it keeps the view. Choosing a spot starts the screen afresh, on "Day", as it starts on today. The choice is not kept across sessions: the next open is on "Day".

## The rules

**The window.** With `i` the chosen day's index in the 14 and `n` the span's days (1, 3 or 7), the window is the days `i` through `min(i + n, 14) - 1`, and its instants run from the first day's start to the last day's end. Days are the spot's local days, as the 14 spans already are, so a day the clocks change on is 23 or 25 hours long and the window with it.

**The labels under the stack.** For each day in the window, a label at its start with its weekday in three letters, in the spot's time zone. At three days, one more at each local noon, "12p". At one day the labels are the hour marks as today. The first label is left-aligned and the last right-aligned, as the hour labels are.

**The heading's words.** The chosen day's date as today ("Thu Oct 15"), then " to " and the window's last day's date, only when the window has more than one day.

**The cursor's time.** The time as today ("3:00 PM"), with the weekday in three letters before it when the window has more than one day. The weekday is the cursor's local day's.

**Markers and bands.** The union over the days in the window of what each day gives today: a sunset and a moonrise line per day, the current time where today is in the window, and the night spans of each day. The labels go on the markers only when the window is one day.

**The cursor's rest and its clamp.** Unchanged in substance: the rest is the chosen day's (the latest reading or the clock on today, the anchor's step on another day), and a cursor put by hand is clamped to the window, not to the chosen day. A pick belongs to the chosen day as now; changing the span keeps the pick, since the day has not changed, and the clamp widens or narrows with the window.

**The weather's reach.** Unchanged: the notice "No forecast this far out." stands when the chosen day is past the forecast. Where the chosen day is reached and later days in the window are not, the panels draw the hours that exist and nothing after them.

**The arrows.** Unchanged: thinned by the width of an hour from the window's start, which `WeatherPanels` already takes as `start`.

## How it works

- `src/ui/spanView.ts`, new, plain, tested: the `Span` type (`'day' | 'days3' | 'week'`), `SPANS` with each one's days and its button's words, `windowFor(spans, index, span)` giving the window's `{ start, end, first, last }` (indices in the 14), `stackLabels(window, spans, zone, span)` giving `{ t, text }[]`, `headingWords(days, window)`, `cursorWords(t, zone, window)`, `windowMarkers(days, window, now)` and `windowBands(days, window)`. The last two are built on `dayMarkers`, `dayBands` and `unlabelled` in `src/ui/selection.ts`, which keep their tests.
- `src/ui/SpotScreen.tsx` holds the span as state beside the chosen day, works the window out from `spanView`, and passes the window where it passes `selected.span` now. `Selected` in `src/ui/selection.ts` gains `window: Span`, worked out in `selectedDay` from the span handed to it, with `span` staying the chosen day's: `tideView` and `weatherView` slice what they draw (the curve, the readings, the hours) and clamp the cursor by `window`, and keep the chosen day's `span` for the highs and lows, `anchor`, `isToday` and the forecast's reach. `PanelStack` gets the window as `start` and `end`, `WeatherPanels` as `start`, and the panels the window's markers and bands. The reset on choosing a day stays (the pick cleared, the page to the panels).
- `src/chart/PanelStack.tsx` takes `labels: { t: number; text: string }[]` and draws them where it draws the hour marks now; the hour marks move into `spanView.stackLabels` for the one-day case, with `HOUR_LABELS`. `aria-valuemax` and `aria-valuenow` are minutes from the window's start, as they are from the day's.
- `src/ui/SpanControl.tsx`, new: a `div` with `role="radiogroup"` and an `aria-label`, three `button`s with `role="radio"` and `aria-checked`, class `span-choice`, calling `onSpan`. No arithmetic.
- `src/ui/choices.ts` gains `readSpan` and `writeSpan` on `sessionStorage`, under one key, read on mount and written on change, so a reload keeps the choice as it keeps the view. Not `localStorage`: the choice does not outlive the session.
- `src/styles.css`: the `.span-row` (a row of three, under the heading, a 0.5rem gap) and `.span-choice` (the `.month-open` look, `aria-checked` filled with `--sea` on `--ground` ink), nothing else. The stack's foot keeps `.hours`.
- `CLAUDE.md`: the status line, the Stack bullet on the charts, and the Next Steps.

## Not in this change

- Pinch and two-finger drag on the stack (option 2). The buttons are the whole control.
- More NWS values (the rest of issue 8), which stay in the issue.
- A wider default window on a wide screen. The window is the user's choice at every width.
- The choice kept across sessions.
- The 14-day list and the month view, unchanged.

## Decisions made here, for review on the pull request

1. The window starts at the chosen day rather than centring on it, so that the day tapped is the first day drawn and "Week" from today is the forecast week.
2. The highs-and-lows table stays the chosen day's rather than growing to the window's, which would be 28 rows at a week.
3. The names on the sunset and moonrise lines are kept only at one day.
4. The choice is kept for a reload and not across sessions.
