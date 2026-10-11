# A wide window: the forecast in two columns

Date: 2026-10-10. Status: written on the owner's "get going on our roadmap", with the decisions this spec makes listed at the end for review on the pull request. The pull request carries pictures; this is a layout, and the owner's eye decides it.

Issue: https://github.com/nicolovejoy/tideline/issues/33

## Goal

On a laptop the whole app sits in one phone-width column with empty space either side. In a window 960 px wide or more, the forecast uses the room: the panels on the left, the 14 days beside them on the right. Nothing moves on a phone.

This is a first part of the issue, the part that needs no new markup and no new arithmetic. The issue stays open for the rest.

## What the user sees

In a window 960 px wide or more:

1. **The page is up to 1,080 px wide**, centred, where it was 450 px.
2. **The forecast is two columns.** On the left, the day's panels, its highs and lows, the captions and the lines to share and remove. On the right, 330 px wide, the 14 days, their heading level with the day's. Choosing a day no longer means scrolling down a page to find it and back up to see it.
3. **The panels are as wide as the left column**, about 700 px. The chart already draws to the width it is given.
4. **The title, the row of spots, tonight's strip and the foot of the page** run the full width.
5. **The month view is two columns of days**, the first half of what is left of the month on the left and the rest on the right. A month fits in one window.
6. **The add screen keeps to the left column's width**, so the map and the fields sit where the panels were.

Under 960 px everything is exactly as it is now. An iPhone on its side is at most 932 px wide, so it stays in one column. An iPad on its side gets the two columns.

## How it works

One media query at the end of `src/styles.css`, `(min-width: 60rem)`, and nothing else: no component changes, no JavaScript that measures anything. A `rem` in a media query is the browser's own 16 px, whatever the page's font size, so `60rem` is 960 px.

- `main` becomes a grid of two columns, `minmax(0, 1fr)` and `22rem`, with `max-width: 72rem`.
- Every child of `main` spans both columns, except `.day` and `.add-spot`, which take the first, and `.days`, which takes the second. `.days` comes straight after `.day` in the page, so the grid puts it in the same row.
- The month view's list becomes two CSS columns, and a day is never broken across them.

The layout was tried against the live site with this stylesheet added by hand before it was written down.

## Limits

- **The month view is still a list.** The issue's calendar grid needs each day placed under its weekday, which is arithmetic for `monthView.ts` and its own design.
- **The hour labels under the panels are the same four.** At 700 px there is room for more, and that is arithmetic too.
- **The captions are not put on one line**, and tonight's strip is as it was, with room to its right.
- **The 14 days are longer than the panels**, so the left column ends first and the page still scrolls to reach the last days.
- **A wide window is still one spot.**

## Not in this change

- The calendar grid, more hour labels, and anything that needs new markup. They stay in issue 33.
- Panel drill-down, issue 8, which would gain most from the room.

## Decisions this spec makes that the issue leaves open

1. **960 px is where two columns begin.** Wider than any iPhone on its side.
2. **The 14 days go on the right, 330 px wide**, about what they have on a phone, so their rows wrap as they do there.
3. **The page stops growing at 1,080 px.** Wider than that the panels get long and thin.
4. **Tonight's strip stays above both columns.** Beside the list it would leave the two headings out of line.
5. **The month view becomes two columns of days**, not a calendar grid.
6. **The add screen stays as wide as the left column.** A map across the whole page is possible; the fields under it would stretch with it.
7. **Plain CSS, one media query.** The issue asks for this.
8. **Choosing a day still brings the panels to the top of the window**, as on a phone. With the list beside the panels this is a small move, not a jump up the page.
9. **Issue 33 stays open.**
