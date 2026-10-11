# A wide window: the forecast in two columns

Date: 2026-10-10. Status: written on the owner's "get going on our roadmap", with the decisions this spec makes listed at the end for review on the pull request. The pull request carries pictures; this is a layout, and the owner's eye decides it.

Issue: https://github.com/nicolovejoy/tideline/issues/33

## Goal

On a laptop the whole app sits in one phone-width column with empty space either side. In a window 1,000 px wide or more, the forecast uses the room: the panels on the left, the 14 days beside them on the right. Nothing moves on a phone.

This is a first part of the issue, the part that needs no new markup and no new arithmetic. The issue stays open for the rest.

## What the user sees

In a window 1,000 px wide or more:

1. **The page is up to 1,080 px wide**, centred, where it was 450 px.
2. **The forecast is two columns.** On the left, the day's panels, its highs and lows, the captions and the lines to share and remove. On the right, 330 px wide, the 14 days, their heading level with the day's. The panels and the first days of the list are in the window together, so the nearer days can be chosen and seen without going down the page for them. The later days are still below the window.
3. **The panels are as wide as the left column**, about 700 px. The chart already draws to the width it is given.
4. **The title, the row of spots, tonight's strip and the foot of the page** run the full width.
5. **The month view is two columns of days**, the first half of what is left of the month on the left and the rest on the right. That halves the scrolling; a whole month is still taller than a laptop's window.
6. **The add screen keeps to the left column's width**, so the map sits where the panels were.
7. **What is made for a phone's width keeps it**: the table of highs and lows, the month's heading with its two buttons, the add screen's fields, and the hint to add the app to the home screen. Stretched across the page their parts drift apart.

Under 1,000 px everything is exactly as it is now. The widest iPhone on its side is 956 px, so every phone stays in one column. An iPad on its side gets the two columns; an 11-inch iPad upright does not.

## How it works

One media query at the end of `src/styles.css`, `(min-width: 1000px)`, and nothing else: no component changes, no JavaScript that measures anything.

- `main` becomes a grid of two columns, `minmax(0, 1fr)` and `22rem`, with `max-width: 72rem`.
- Every child of `main` spans both columns, except `.day` and `.add-spot`, which take the first, and `.days`, which takes the second. `.days` comes straight after `.day` in the page, so the grid puts it in the same row.
- The month view's list becomes two CSS columns, and a day is never broken across them.
- The few things in item 7 are held to `30rem`, the phone's column.

The layout was tried against the live site with this stylesheet added by hand before it was written down. It has been checked in Chromium only. Safari on a Mac and on an iPad is the owner's check.

## Limits

- **Choosing a day still moves the page.** The panels come to the top of the window, as on a phone. From the top of the page that is a move of about 200 px, and the list moves with it under the pointer; from a day far down the list it is a jump back up, with the row that was chosen left below the window. See decision 8.
- **The month view is still a list.** The issue's calendar grid needs each day placed under its weekday, which is arithmetic for `monthView.ts` and its own design.
- **The hour labels under the panels are the same four.** At 700 px there is room for more, and that is arithmetic too.
- **The captions are not put on one line**, and tonight's strip is as it was, with room to its right.
- **The 14 days are longer than the panels**, so the left column ends first, with about 400 px of nothing under "Share this spot".
- **The add screen has nothing to its right.**
- **A wide window is still one spot.**

## Not in this change

- The calendar grid, more hour labels, and anything that needs new markup. They stay in issue 33.
- Panel drill-down, issue 8, which would gain most from the room.

## Decisions this spec makes that the issue leaves open

1. **1,000 px is where two columns begin.** The widest iPhone on its side is 956 px. It is written in px, not rem: a rem in a media query follows the reader's default font size, which nothing else on this page does.
2. **The 14 days go on the right, 330 px wide**, about what they have on a phone, so their rows wrap as they do there.
3. **The page stops growing at 1,080 px.** Wider than that the panels get long and thin.
4. **Tonight's strip stays above both columns.** Beside the list it would leave the two headings out of line.
5. **The month view becomes two columns of days**, not a calendar grid.
6. **The add screen stays as wide as the left column**, and its fields as wide as a phone's. A map across the whole page is possible; a taller map may do more for it than a wider one.
7. **Plain CSS, one media query.** The issue asks for this.
8. **Choosing a day still brings the panels to the top of the window**, as on a phone. This is the one place the change falls short of the issue's own words, "so choosing a day does not scroll the page". The move is there because it is what gets all four panels into a window 800 px tall. Taking it away needs the page to know how it is laid out, which is the JavaScript the issue rules out, or a large `scroll-margin-top`, which leaves the last panel below the window. It is the owner's call, with the pull request's window-sized pictures in front of him.
9. **Issue 33 stays open.**
