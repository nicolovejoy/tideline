# Forecast history: what was forecast against what happened (Stage C)

Design only, 2026-10-29. Issues 11 and 10. Nothing is built until the owner approves this document.

## Intent

The first user asked, in his third session, for "a record of forecasts against what happened, with data over time and ways to dig into it". The owner's reading, confirmed 2026-10-29: he wants to know whether the forecast for his spot can be trusted, the wind first, both at the spot in the moment and looking back over weeks. He would look whenever, not on a schedule.

Today the app throws every forecast away when the next one arrives, so the question cannot be answered: NWS serves the current forecast only, never a past one. Forecast history is the app keeping what NWS said, so that once an hour has happened it can be laid beside what the station reported.

## Goals

- For a spot with a weather station (the existing rule: within 10 mi and 500 ft, `src/data/weatherRule.ts`), keep what NWS forecast for each hour at several lead times, and what the station reported for that hour.
- On a past day's panels, draw what was forecast for that day beside what was observed, so a miss is visible in the same way today's tide deviation is.
- One view that digs in: for a spot and one value (wind first), the difference between forecast and observed over the last weeks, by how far ahead the forecast was made.
- Tides: the same comparison, predicted against observed, for past days. NOAA serves past observed water levels on demand, so tides need no archive.

## Non-goals

- No score, grade, trust rating, or "the forecast is usually right". Product rule: data, not a verdict. Differences are shown as numbers and lines; the user draws the conclusion.
- No second forecast source to compare NWS with.
- No history for spots without a station: there is nothing observed to compare with. Their screen says why, as today's does.
- No alerts, no notifications.
- Not a backfill: history starts the day the recorder starts.

## Anti-goals (a failure even if it works)

- A recorder that quietly stops and nobody notices: the screen must say how far back the record goes and when it was last written.
- A view that needs a manual to read. It follows the panels' existing look and the "?" sheet explains it (`src/ui/helpText.ts`).
- Cost or secrets creep: the app stays a static page for users; nothing a viewer loads needs a key.

## Constraints from what exists

- NWS raw grid (`src/data/nws.ts`, `Forecast`, `ForecastHour`): one cell's forecast is about 7.3 days of hourly values, with `updatedAt` when NWS last issued it. Issuances come several times a day.
- Station reports (`src/data/nwsObservations.ts`) are reduced to `ObservedHour` rows (`src/data/observed.ts`), one an hour. How far back `/stations/{id}/observations` reaches is not recorded in this repo; the recorder keeps the rows so the app never depends on it.
- Firestore exists (project `tideline-ibuild4you`, `(default)`, `nam5`), with rules in `firestore.rules` tested in `rules-tests/`, pasted by the owner. Users write only `users/{uid}`.
- The browser cannot record: an hour nobody has the app open is an hour lost. Recording needs something that runs on a schedule.
- Times and days in the spot's zone, units as everywhere (°F, mph, 12-hour clock).

## How it works

### What is recorded

A **recorded place** is a pair: an NWS cell (`office/x,y`) and the station that serves it. Several spots can share one. The recorder keeps, per place:

- **Forecasts as issued.** Each distinct `updatedAt` of the cell's grid, trimmed to the values the panels draw (`ForecastHour`'s fields), keyed by issue time. Trimmed and hourly, one issuance is a few KB.
- **Observed hours.** `ObservedHour` rows for each past hour, written once the hour is over.

From these, any comparison is arithmetic on the device: for an hour H and a lead time L, take the latest issuance at or before H − L and read its value for H.

Lead times shown: 6, 24, 48 and 72 hours (builder's call to adjust after seeing data; no lead beyond the grid's ~7 days).

### Which places are recorded (needs the owner's answer)

Proposed: the three starting spots' places (only Campus Point has a station today) plus the place of every spot saved in any signed-in account that has a station. Signed-out users' spots on a device are invisible to the recorder, which is accepted.

How the recorder learns them (designer's call): each run it reads every `users/{uid}` document with its service account (the owner's own system reading his own database), runs `chooseStation` from `src/data/weatherRule.ts` for each spot (a `Spot` stores no station; the choice is made from the point and height, as on the device), and keeps the distinct places. Clients write nothing new. A place no saved spot has needed for 30 days stops being recorded; its record is kept, not deleted. The NWS station list per cell is cached by the recorder as the device caches it (30 days).

What is public (designer's call, the owner to confirm): a place is keyed by its station id and NWS cell, both public NWS facts. No uid, spot name or coordinates are written to `history/**`. What anyone can still learn is that some account has a spot within 10 mi of that station.

### Where it runs (needs the owner's answer)

Proposed: a scheduled GitHub Actions workflow, hourly, in this public repo, running a Node script that reuses the framework-free data modules unchanged (`src/data/nws.ts`, `nwsObservations.ts`, `observed.ts`). It writes to Firestore with a service account whose key is a GitHub Actions secret (the owner creates it; it is never read into a session). The script sends NWS the identifying User-Agent it asks for (issue 10's side benefit).

Why not the alternatives: a Vercel cron on the Hobby plan runs at most once a day; Firebase scheduled functions need the Blaze (pay-as-you-go) plan. GitHub's scheduled runs can be late by minutes and are paused after 60 days with no repository activity; the screen's "last written" line makes a pause visible.

Issue 10's server cache is not needed for this and stays deferred.

### Store and rules

- `history/{placeId}` with the place's facts (cell, station, first and last write).
- `history/{placeId}/issued/{issueTime}`: one trimmed forecast.
- `history/{placeId}/observed/{day}`: that day's `ObservedHour` rows, in the spot's zone.
- Rules: anyone may read `history/**` (it is public weather data); no client may write. Tested in `rules-tests/` like the users rule.
- Reads (designer's call): history is open like everything but a user's own spots, so a signed-out viewer and a shared link see it too. They read it through Firestore's REST API with plain `fetch`, so the 173 kB Firestore chunk still loads only for a signed-in user; the reading module is framework-free like the other data modules.

Size, roughly: 6 issuances a day × a few KB, plus a day of rows, is under 50 KB a day per place; a year is under 20 MB per place. Far inside Firestore's free tier for a handful of places; reads are the thing to watch, so a past day is read once and cached on the device like any other source.

### What the user sees

1. **Past days on the panels.** The day list and the span buttons let the user go back from today (how far: as far as the record goes, cap 30 days for v1; builder's call on the control). On a past day with a record, each weather panel draws the observed staircase as today's observed side, and the forecast as it was 24 hours ahead as a thinner line. The cursor's words give both: "Observed 12 mph from W · forecast 24 h ahead 18 mph". Tide panel: predicted and observed, as today.
2. **The dig-in view** ("Forecast against observed", a view in `src/ui/viewHistory.ts` like the month view): for the chosen spot, a value picker (wind first, then gusts, temperature, sky), and a plot of forecast minus observed for each hour of the last 30 days, one line per lead time. Wind compares speed and gusts in v1 (designer's call); a gust hidden by `shownGust` on either side counts as the wind's speed. Direction is drawn on the past-day panels (both arrows) but not given numbers; a circular difference is a later step. Under it the numbers per lead time: how many hours compared, the mean difference and the mean size of the difference, in the value's unit. Words, not grades.
3. **Where there is no record.** A spot without a station says why (as today). A spot with a station that is not yet recorded says so and when the record began elsewhere; a place whose last write is more than 3 hours old says "Recording paused since …".

Modules follow the house split: the arithmetic (pick an issuance for a lead, differences, the numbers) in a plain tested module, the words in a `*View.ts`, the components hold neither.

## Left to the builder

- The control for going back in time, and how past days sit in the 14-day list.
- Exact lead times, the dig-in plot's look, and whether sky compares as categories or percent (observed sky is a category, `skyPct` maps it).
- Batching and retry in the recorder; how a missed hour is filled (an observed hour can be written late from the station's reports while they last).
- Cache keys and staleness for history reads.

## Answered by the owner, 2026-10-29

1. The recorder is a scheduled GitHub Actions workflow, with the Firebase service-account key kept in 1Password and copied into a GitHub Actions secret with `op read … | gh secret set …`, never shown on screen.
2. Recorded: the three starting spots plus every signed-in user's spot that has a station, public under station and cell only, with the residual exposure accepted.

The owner added: a user should be able to keep a spot private or let it be available to everybody, public by default, set in a setting. That is put to the first user (below) before it is designed. Until he answers, v1 records every signed-in spot with a station, which is the public default.

## Open with the first user

1. Should each saved spot be public or private, public by default? And what does "public" mean to him: only that its forecast history is recorded and readable by anyone (it already is, under the station, with no name or point), or that the spot itself, its name and place, is listed for others to find? The second is a social feature, which the 2026-10-15 decisions rule out ("no social features ... nothing is to be designed for them"), so it would reopen that decision.
