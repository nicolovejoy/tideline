# The "?" that explains the panels

Issue 75, the first user's second ask from his sixth phone session (2026-10-16). Nico chose on 2026-10-16: a sheet over the panels, one for all the panels.

## What the user sees

A round "?" button at the right end of the row with the "Day", "3 days" and "Week" buttons, outlined as they are, 44 px tall. Its accessible name is "What the panels show".

Tapping it slides a sheet up over the panels: a heading, a Close button, and short sections, one each for the panels as a whole, the tide, the wind, the temperature, the sky, today's observed and forecast sides, and where the numbers come from. The sheet scrolls on its own; the page behind it does not. Close, a tap on the shaded page behind, Escape or going back closes it. A reload with the sheet up brings it back.

The words are plain and say what is drawn and why, with the thresholds the app uses (the gust and feels-like rules, the station rule, the horizon rule). They give data, not advice.

## How it is built

- `'help'` is a view in `src/ui/viewHistory.ts`, so the sheet has one history entry at the page's address and going back closes it, as the month view's does. The spot screen keeps drawing the panels under it.
- The words are in `src/ui/helpText.ts`, a plain module: a title and a list of sections, each a heading and paragraphs. Its test checks that every element the panels draw is named somewhere, so a new element without a word fails a test.
- `src/ui/HelpSheet.tsx` draws it: a dialog with `aria-modal`, its heading focused on open, Escape and the backdrop wired to close. The "?" button is in `src/ui/SpotScreen.tsx` beside the span control, and takes focus back when the sheet closes.
- Styles at the end of the panel section of `src/styles.css`: a fixed backdrop, a sheet at the foot of the window up to 85% of its height, the page's palette.

## Not in this

A "?" per panel, a tour, or links from the sheet into the captions. The words describe the look of pull request 82 (forecast in sea-green, observed in white dashes); if that look changes, the sentence in the "Today" section changes with it.
