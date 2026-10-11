# Wide Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In a window 960 px wide or more, the forecast is two columns, the panels on the left and the 14 days on the right, and nothing moves on a phone.

**Architecture:** One media query at the end of `src/styles.css`. `main` becomes a two-column grid; its children are placed by class. No component changes, no JavaScript. The pictures taken in the browser check are committed for the pull request, because the owner judges a layout by eye.

**Tech Stack:** Plain CSS (grid, multi-column), checked in Chromium with Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-wide-window-design.md`. Read it first; it says what the user sees and lists the decisions the owner reviews.

## Global Constraints

- One media query, `@media (min-width: 60rem)`, appended at the end of `src/styles.css`. No rule outside it changes, and no other file under `src/` changes.
- Under 960 px nothing may change: `main` stays `display: block` with `max-width: 30rem` (450 px at the page's 15 px root font).
- No JavaScript measures anything. Components hold no arithmetic.
- CSS follows the file: two-space indent, a comment above a block saying why. `npm run lint` (oxlint then Prettier) must pass; run `npm run format` before committing.
- `CLAUDE.md`: two other open pull requests edit it. Add the one bullet this plan gives, where it says, and touch nothing else.
- Commit trailer, on every commit: the LAST paragraph of the message must be exactly these two lines together, with no blank line between them (one `-m` argument holding both lines), regardless of the model doing the work:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_011uFB3EqJLYQ5h3p8Hc6jPq`
- In every tracked file and commit message the first user is "the first user"; no names from `private/`.
- Node 24. In each shell, before any `npm` or `npx`: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH`. Do not `source` nvm.
- Work only in this worktree, on the branch it is on. No `git stash`, `git reset`, `git checkout` of other branches, or `git clean`.

## Review Focus

1. A phone must be untouched, upright and on its side: at 390 px and at 932 px wide `main` is one 450 px column. Pinned in the browser check, part F.
2. The 14 days must sit beside the panels, not under them, with the two headings level. Pinned in the browser check, part A.
3. A spot with no tide, a spot opened from a link and the add screen must not fall apart in the grid. Pinned in the browser check, parts B and D.
4. The page must not scroll sideways at any width tried. Pinned in every part.
5. Today's tinted row in the month view must not be cut off at the edge of a column, and no day may be split between the two. Pinned in the browser check, part C.

---

### Task 1: The two columns

**Files:**
- Modify: `src/styles.css` (append one block at the end)
- Create: six pictures under `docs/superpowers/plans/assets/`
- Modify: `CLAUDE.md` (one bullet)

**Interfaces:**
- Consumes: the class names the components already give: `main`, `.tonight`, `.day`, `.day-head`, `.days`, `.days-head`, `.month`, `.month-row`, `.add-spot`, `.stack`.
- Produces: nothing another task uses.

There is no unit test: this is a stylesheet. Its test is the browser check in Step 3, which is required, and it is measurements as well as pictures.

- [ ] **Step 1: Measure before changing anything**

Start the dev server on its own port, in the background: `npm run dev -- --port 5185 --strictPort`. Use the Playwright browser tools (`mcp__playwright__*`; load them with ToolSearch if they are not loaded).

Set the window to 390 × 844 and open `http://localhost:5185/`. When the forecast has drawn, evaluate this and keep the result as "before, 390":

```js
() => {
  const box = (selector) => {
    const r = document.querySelector(selector).getBoundingClientRect()
    return [
      Math.round(r.left),
      Math.round(r.top + window.scrollY),
      Math.round(r.width),
    ]
  }
  return {
    display: getComputedStyle(document.querySelector('main')).display,
    main: box('main'),
    tonight: box('.tonight'),
    day: box('.day'),
    dayHeading: box('.day-head h2'),
    days: box('.days'),
    daysHeading: box('.days-head h2'),
    stack: box('.stack'),
    scrollWidth: document.documentElement.scrollWidth,
  }
}
```

Each box is `[left, top, width]`. Do the same at 932 × 430 and keep it as "before, 932".

- [ ] **Step 2: Add the media query**

Append exactly this at the end of `src/styles.css`, after a blank line:

```css
/* A wide window: the forecast in two columns, the 14 days beside the panels
   they choose for. A rem here is the browser's own 16px, so this begins at
   960px: wider than any phone on its side, so nothing moves on one. */
@media (min-width: 60rem) {
  main {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 22rem;
    column-gap: 3rem;
    align-items: start;
    max-width: 72rem;
  }
  /* Everything runs the full width, but for the day and what goes where
     the day does. */
  main > * {
    grid-column: 1 / -1;
  }
  main > .day,
  main > .add-spot {
    grid-column: 1;
  }
  /* The 14 days come straight after the day, so they land in its row. Their
     heading has a button beside it and a taller line, so a little less
     room above puts it level with the day's. */
  main > .days {
    grid-column: 2;
    margin-top: 1.6rem;
  }
  /* The month in two columns of days, and no day split between them. */
  .month ol {
    columns: 2;
    column-gap: 4rem;
  }
  .month-row {
    break-inside: avoid;
  }
}
```

> **As shipped:** the whole-branch review moved the line from `60rem` to `1000px` (the widest iPhone on its side is 956 px, and a rem in a media query follows the reader's default font size), and held a few phone-width things to `30rem` in the wide layout: the hint to add the app to the home screen, the table of highs and lows, the month's heading and the add screen's fields. An empty `.facts` line also takes no room. The stylesheet in `src/styles.css` is the record; the block above is where it started.

Run: `npm run format && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 3: Check it in a browser**

The dev server from Step 1 is still running; reload the page after the edit. In every part also check that the page does not scroll sideways: `document.documentElement.scrollWidth <= window.innerWidth`. Record pass or fail for every numbered step in your report, with the numbers you measured.

Save each picture as a full-page screenshot to `docs/superpowers/plans/assets/` under the name given.

**A. The forecast at 1280 × 800**
1. Set the window to 1280 × 800 and open `http://localhost:5185/` (Campus Point). Evaluate the function from Step 1. Pass: `display` is `grid`; `main` is 1110 wide (1,080 and its padding) with its left at 85; `.day` is at least 640 wide; `.days` is 330 wide and its left is greater than `.day`'s left plus `.day`'s width; `.tonight` is 1080 wide; and the two headings are level: `daysHeading`'s top is within 4 px of `dayHeading`'s top.
2. Pass: `.stack` is within 2 px as wide as `.day` (the panels fill the column).
3. Picture: `2026-10-10-wide-forecast.png`.
4. Click the fifth row of the 14 days. Pass: the day's heading names that day; `document.querySelector('.day').getBoundingClientRect().top` is between 0 and 20; and the row you clicked is still in the window (its `getBoundingClientRect().bottom` is under `window.innerHeight`, and its `top` is 0 or more).

**B. A spot with no tide, at 1280 × 800**
5. Click "La Cumbre Peak". Pass: the same measurements as step 1 hold, and the caption that begins "Tides are not shown here" is in the left column (its left is `.day`'s left). Picture: `2026-10-10-wide-no-tides.png`.

**C. The month view at 1280 × 800**
6. Click "Campus Point", then "Months ahead". Pass: `getComputedStyle(document.querySelector('.month ol')).columnCount` is `2`; the first `.month-row` and the last `.month-row` have different `left`s; and no `.month-row` is taller than 140 px (none was split and stretched).
7. Today's row is tinted. Pass: the tint and its bar on the left are wholly visible, not cut off: the row's `left` is 0 or more, and you can see the whole bar in the picture. Say what you see. Picture: `2026-10-10-wide-month.png`.
8. Click "›" for next month. Pass: two columns again, about fifteen days in each. Click "Back to forecast".

**D. The add screen and a shared spot at 1280 × 800**
9. Click "Add a spot". Pass: `.add-spot` is within 2 px as wide as `.day` was in step 1, the map is drawn across it, and its tiles have loaded. Picture: `2026-10-10-wide-add.png`. Click "Cancel".
10. Open `http://localhost:5185/?name=Hendry%27s+Beach&at=34.4026%2C-119.7437` and wait for the spot's screen. Pass: the notice, Save and Close run across the top, and under them the two columns as in step 1. Click "Close". If the live lookup does not answer, mark this step "not run" and say what the page said.

**E. An iPad on its side, and just under the line**
11. Set the window to 1024 × 768 and open `http://localhost:5185/`. Pass: `display` is `grid`, `.day` is at least 560 wide, `.days` is beside it. Picture: `2026-10-10-wide-forecast-1024.png`.
12. Set the window to 959 × 800 and reload. Pass: `display` is `block` and `main` is 480 wide (450 and its padding).

**F. A phone, upright and on its side**
13. Set the window to 390 × 844 and reload. Evaluate the function from Step 1. Pass: every number equals "before, 390". Picture: `2026-10-10-narrow-forecast.png`.
14. Set the window to 932 × 430 and reload. Evaluate it again. Pass: every number equals "before, 932".

**G. After dark**
15. Set the window to 1280 × 800, emulate dark mode (`async (page) => { await page.emulateMedia({ colorScheme: 'dark' }) }` through the code tool), and reload. Pass: the two columns as in step 1, on the dark ground, with the chosen day's tint readable. No picture needed; say what you saw. Put the colour scheme back (`colorScheme: null`).

Afterwards: evaluate `localStorage.clear()` on `http://localhost:5185`, close the browser page, and stop the dev server.

If a step fails, report it. Do not change the CSS to get past a failure without saying exactly what you changed and why: the stylesheet in Step 2 is what the spec describes.

- [ ] **Step 4: Commit the stylesheet and the pictures**

```bash
git add src/styles.css docs/superpowers/plans/assets/2026-10-10-wide-forecast.png docs/superpowers/plans/assets/2026-10-10-wide-no-tides.png docs/superpowers/plans/assets/2026-10-10-wide-month.png docs/superpowers/plans/assets/2026-10-10-wide-add.png docs/superpowers/plans/assets/2026-10-10-wide-forecast-1024.png docs/superpowers/plans/assets/2026-10-10-narrow-forecast.png
git commit -m "In a wide window, the 14 days sit beside the panels

From 960 px the forecast is two columns and the page is up to 1,080 px
wide. The month view is two columns of days. Under 960 px nothing
changes. One media query; no component changes.

Part of #33.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011uFB3EqJLYQ5h3p8Hc6jPq"
```

- [ ] **Step 5: Record it in `CLAUDE.md`**

In the Stack section, directly after the first bullet (it begins "- Static single-page app with no server:"), add this bullet. Touch nothing else in the file.

```
- The layout is the phone's, one column 450 px wide, up to a window 960 px wide. From there one media query at the end of `src/styles.css` makes the forecast two columns, the 14 days beside the panels, in a page up to 1,080 px wide, and the month view two columns of days (issue 33, which stays open for a calendar grid and more hour labels). No component knows the window's width.
```

- [ ] **Step 6: Commit the record**

```bash
git add CLAUDE.md
git commit -m "Record the wide window's two columns in CLAUDE.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011uFB3EqJLYQ5h3p8Hc6jPq"
```
