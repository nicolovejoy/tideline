# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Stage 1 is built and waiting for its checks on a phone.

- Built: the scaffold, tooling and CI; the data layer; and the screen for Campus Point, which shows tonight's sunset and moon, four panels on one time axis for any of the next 14 days (the tide with today's observed level, wind, temperature, sky), that day's high/low table, the 14-day list, and the manifest and icons.
- Not built: everything after Stage 1. It is tracked as GitHub issues.

Repo: https://github.com/nicolovejoy/tideline (public).

Live: https://tideline.ibuild4you.com (production, deploys from `main`, public). The name is a Cloudflare CNAME to Vercel with the proxy off; https://tideline-inky.vercel.app serves the same build. Pull request previews need a Vercel sign-in. https://tideline.vercel.app is someone else's site, not this project.

## Commands

Node 24 (`.nvmrc`). In a fresh shell: `source ~/.nvm/nvm.sh && nvm use`.

- `npm run dev`: dev server at http://localhost:5173
- `npm run build`: type-check, then build to `dist/`
- `npm run lint`: oxlint, then a Prettier check
- `npm run format`: rewrite files with Prettier
- `npm test`: run all tests once
- `npx vitest run src/time.test.ts`: one test file
- `npx vitest run -t "25 hours"`: tests whose name matches

Tests run with `TZ=Asia/Tokyo` (set in `vite.config.ts`), so code that leans on the viewer's time zone instead of the spot's fails.

Code style is the Vite template's: no semicolons, single quotes, relative imports carry their `.ts`/`.tsx` extension, type-only imports use `import type`, no enums.

## What this is

Tideline is a weather-and-tides web app. For a named spot, tonight and the days ahead, it shows four things side by side for the same place and time: sunset, tide, weather, moon. It replaces checking a weather site and a NOAA tide station page separately and combining them in your head. Santa Barbara, California is the starting point.

## Private context

This repo is public. `private/` is gitignored and holds the personal details: who the first user is, the original brief, and whose answers are whose. Read `private/context.md` at the start of a session if it exists.

In every tracked file, commit message, issue, and pull request, that person is "the first user". Never copy names or personal details out of `private/`.

## Working agreement

- Nico approves each stage before anything is built, and reviews all code before it ships.
- Stage 1 is the smallest thing the first user can open on an iPhone. Later stages are ordered after it has been used.
- Keep the MVP simple. Anything clever that is not needed for a first reaction becomes a GitHub issue on the phased roadmap, not MVP scope.
- Where a decision needs the first user's answer, list the question for Nico to relay. Do not guess.

## Product rules

- **Data, not a verdict.** No score, no go/no-go, no alerts.
- Sunset for tonight and following days.
- Tides: high/low table plus a continuous curve; touching the curve shows predicted feet at that time.
- Today's tide: predicted curve overlaid with observed water level, so a deviation is visible.
- Weather for the spot itself, not the city.
- Moon phase per day; if moonrise is within 2 hours of sunset, flag it and show the time.
- Default view is the forecast window; extended view is a month at a time, up to 3 months out, tide/sun/moon only.
- Spots are named and saved by the user, shareable publicly or with specific friends.
- Nearest tide station is picked automatically and disclosed.
- Any US location; responsive web app that prompts iPhone users to add it to the home screen.
- Not in the first version: per-spot photo catalog.

## Stack (approved 2026-10-08)

- Static single-page app with no server: Vite, React, strict TypeScript, plain CSS. Hosted on Vercel.
- The browser calls NOAA, NWS and Open-Meteo directly. Sun and moon are computed on the device.
- Charts are hand-written SVG: stacked panels on one time axis with one shared cursor. The arithmetic is in `src/chart/scales.ts`. No charting library and no d3.
- Components hold no arithmetic, no rules and no wording. Those live in plain modules with tests (`src/chart/`, `src/ui/captions.ts`, `src/ui/selection.ts`, `src/ui/tideView.ts`, `src/ui/weatherView.ts`, `src/ui/dayList.ts`, `src/data/load.ts`), and the components are checked in a browser.
- Weather is drawn as staircases, level across the hour each value is forecast for, so the line, the cursor's dot and the words always agree.
- Data modules (NOAA, NWS, astronomy) are framework-free TypeScript so they can move behind a server function unchanged. Tested with Vitest against recorded real responses.
- Caching is on the device in Stage 1: draw from the last saved data, refresh behind it, show each source's "as of" time. A server cache is deferred to an issue.

## Decisions (2026-10-08)

Settled:
- Audience is the first user and friends, non-commercial.
- Units: feet above MLLW, °F, mph, 12-hour clock.

Provisional. Nico gave these on the first user's behalf; the first user has not confirmed them:
- Stage 1 spot is Campus Point, UCSB.
- Forecast horizon: add a second source for days 8 to 10 rather than stopping at 7.
- Weather: temperature, wind, gusts, direction, cloud cover, rain chance, each with a way to dig in.
- Where a spot's tide station has no gauge, show the nearest gauge's deviation from its own prediction. Do not redraw the spot's curve with that deviation applied.
- Inland spots: tides hidden by default.
- Sun and moon times should account for the spot's elevation, but after launch.
- Sharing (is share-by-link enough?) is still unanswered.

Display convention: times and calendar days are shown in the spot's own time zone (returned by NWS `/points`), not the viewer's. Never derive a day from a UTC ISO string; use `Intl.DateTimeFormat` with an explicit `timeZone`.

## Data sources (verified against the live APIs on 2026-10-08)

All three HTTP APIs below send `access-control-allow-origin: *`, need no key, and can be called from a browser.

**NWS (`api.weather.gov`)** — `/points/{lat},{lon}` returns the grid cell, IANA time zone, and forecast URLs.
- Horizon is 7 days: `/forecast` has 14 twelve-hour periods, `/forecast/hourly` has 156 hours, raw grid data covers `P7DT17H`.
- The grid is 2.5 km. Campus Point, Leadbetter Beach, Gaviota State Park, and La Cumbre Peak resolve to four different cells (LOX 100,71 / 105,70 / 87,76 / 105,74).
- Cell elevation is a cell average, not the spot: 3 ft for Campus Point, 157 ft for the Leadbetter cell, 3,258 ft for La Cumbre (summit is 3,997 ft).
- `/forecast/hourly` has no wind gust or sky cover. The raw `/gridpoints/{wfo}/{x},{y}` endpoint has both, but in SI units with ISO 8601 `validTime` intervals of varying length.
- Responses carry `cache-control: public, max-age` of about an hour.

**NOAA CO-OPS (`api.tidesandcurrents.noaa.gov`)** — data at `/api/prod/datagetter`, station metadata at `/mdapi/prod/webapi`.
- 3,502 prediction stations, 302 water-level (observing) stations, 238 that are both. Most prediction stations have no observed data.
- 2,242 prediction stations are subordinate (`type: "S"`): they return high/low only, and a 6-minute request returns an error. A curve for these has to be interpolated and labeled as such.
- 9411340 Santa Barbara is harmonic and observing, and is the nearest station of both kinds to Campus Point (8.6 mi). 9411399 Gaviota State Park is harmonic with no observations; its nearest observing station is Santa Barbara, 31 mi away.
- Three months of high/low is one 18 KB request; one month at 6-minute resolution is 7,440 points.
- Observed data is preliminary (`q: "p"`). Use `datum=MLLW`, `units=english`, `time_zone=gmt` for both products so they are comparable. Request GMT and convert for display: station-local timestamps (`lst_ldt`) carry no offset and are ambiguous in the repeated hour of a clock change.
- A 14-day predicted curve at 6-minute resolution is one request: 136 KB as JSON, 20 KB gzipped.
- Responses carry `cache-control: no-store`, so any caching of tide data is ours to do. Predictions for a given date do not change.

**Open-Meteo** — second source for days 8 to 10. Its `ncep_nbm_conus` model (NOAA National Blend, 2.5 km) returns 11 days. Free for non-commercial use with attribution.

**Sun and moon** — computed locally with `astronomy-engine`. The USNO API (`aa.usno.navy.mil/api/rstt/oneday`) is the reference to test computed values against.

## Next Steps

- Stage 1 (Campus Point) is built. Before it is called done, the owner checks it on an iPhone against the list in the pull request for `stage-1/weather-and-days`: touch on the panels, the home-screen icon, and a reopen in airplane mode.
- Not yet tried: a screen reader on the cursor.
- The first user: confirm or correct the provisional decisions above, and answer the sharing question.
- Everything after Stage 1 is tracked as GitHub issues, in provisional order.

<!-- SHARED-CONVENTIONS:BEGIN v=28022362f01b — auto-managed, do not edit here; source: prompt-lab/workflow/claude-md-shared.md (edit + re-sync) -->
## Shared conventions

<!-- These are Nico's cross-repo output rules. They're materialized into each repo's
CLAUDE.md and AGENTS.md so every agent (local, cloud, third-party) sees them as plain
text. Source of truth: prompt-lab/workflow/claude-md-shared.md — edit there and
re-sync, never here. -->

- **Clickable URLs.** When pointing at any web destination (dashboard, repo, PR, deploy, settings, docs, localhost), print the full bare URL — `https://example.com` or `http://localhost:8080` — on its own, never just the page's name and never a markdown `[label](url)` link. Nico's terminal auto-linkifies raw `https://` text, so a bare URL is one-click and stays copyable.

- **Number your questions.** Any time you ask Nico more than one question, present them as a numbered list (1., 2., 3.) so he can answer by number with no ambiguity. A single standalone question needs no number.

- **Self-contained smoke-test instructions.** When you ask Nico to manually test or verify an app or website, assume zero carried-over context — he should never scroll back or recall a URL/path/credential from earlier. Always include: the exact URL (full `https://…` or `http://localhost:…`, restated even if mentioned above), the precise steps in order, and what a pass vs. fail looks like. Repetition here is a feature, not clutter.

- **UTC at rest, Pacific on display.** Timestamps are stored in UTC, always. A *calendar day* shown to a human is `America/Los_Angeles` — Nico's day, and the clock the work actually happened on. The two rules that follow are the ones that get broken: never form a date bucket with `new Date(…).toISOString().slice(0,10)` (that is UTC, so every chart axis and "today" silently rolls over at 5pm Pacific — it put a phantom tomorrow bar on the Prompt Lab dashboard), and never bucket UTC-stamped rows with a bare `date(col)` in SQL. Use `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' })` in JS and an explicit zone in SQL/Python. Storage in local time is also wrong — it can't be migrated across a DST boundary without loss.

- **No marker before a copy-paste command block.** Nico's terminal renders markdown bullets (`-`, `*`, `•`) as `●`, which breaks paste into zsh. The line directly above a fenced command block must be a plain-text label ending in a colon — never a bullet, dash, asterisk, or number. For loud copy targets, lead the label with `📋` + bold `COPY THE BELOW`, then a colon, then the block. Bracket anything Nico will paste elsewhere (a prompt for another agent, a multi-line command) with a ruler line of `================` above the label and below the closing fence. Rulers go outside the fence so they aren't copied, each with a blank line before it (a `===` line directly under text renders as a heading).

- **No bare backslash in a copy-paste command block.** A `\` is load-bearing shell syntax that renders invisibly and gets silently dropped somewhere between the markdown render, the clipboard, and zsh. `find … -exec test -e {} \; -delete` arrived in the terminal as `… {} ; -delete`, which zsh split into two commands and reported as `find: -exec: no terminating ";"` plus `command not found: -delete` (2026-09-20). Quote it instead — `';'` is exactly equivalent to `\;` and survives any copy path. For the same reason never break a command across lines with a trailing `\`: write one long line, however wide it wraps.

- **Codex branches are named `codex/<description>`.** When working in this repo via Codex CLI, always create a working branch under the `codex/` prefix (e.g. `codex/fix-flaky-test`) rather than working directly on `main` or an unprefixed branch. Claude Code has no visibility into other tools' running sessions (`ListAgents` only sees Claude sessions), so this prefix is the one signal a Claude session can check for — a local or remote `codex/*` branch means Codex has touched or is touching this repo, even though its session itself is invisible. Claude branches keep whatever naming they already use; only Codex adopts this new prefix.

- **Codex: run commands in a form a rule can match.** Codex approval rules match a command's leading tokens, so a wrapped command never matches an existing allow and every variant prompts again, then leaves a dead one-off "don't ask again" rule behind (36 of them in five days, 2026-09-23). The program is the first token: call helpers and tools directly, never through `/bin/zsh -lc "…"`, never with a `PATH=…` or other `VAR=…` prefix, never with `$(…)` in the arguments. Work only inside your clone (one long-lived `~/src/<repo>-codex`, no worktrees, no scratch clones — everything outside it escalates, except the cross-repo handoff log at `~/src/.handoff`, which is granted). Redirect output only to files inside the workspace, and keep temp files in a gitignored `tmp/` there, never `/private/tmp`. If a tool is missing from `PATH`, report it: the fix belongs in `~/.zprofile` (Nico's edit), not in an inline `PATH=` prefix.

- **A review another agent must act on goes on the PR.** A review that another agent must act on, or that must outlive the session, is posted as a PR comment (`gh pr comment`), where the next session or agent finds it. Live, in-session reviews between Nico and the agent stay in chat. There is no devlog.md: the history DB is the one session record.
<!-- SHARED-CONVENTIONS:END -->
