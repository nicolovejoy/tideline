# Sunset and moonrise from the spot's own height

Date: 2026-10-10. Status: written on the owner's "get going on our roadmap", with the decisions this spec makes listed at the end for review on the pull request. Decision 1 is also a question for the first user.

Issue: https://github.com/nicolovejoy/tideline/issues/9

## Goal

From high up the horizon is lower, so the sun sets later and the moon rises earlier than an almanac says. The first user asked for sun and moon times to count the spot's elevation, after launch. From La Cumbre Peak, at 3,997 ft, sunset is 6 to 7 minutes later and moonrise 6 to 7 minutes earlier than the times the app shows today.

## What the user sees

1. **At La Cumbre Peak the times move.** On 10 October 2026 sunset is 6:37 PM where it was 6:31 PM, and moonrise 6:59 AM where it was 7:05 AM. Everything that shows a sunset or a moonrise shows the new time: tonight's strip, the 14-day list, the month view, and the lines across the panels. The flag for a moonrise within 2 hours of sunset is worked out from the new times.

2. **A caption says so**, under the weather's caption on the spot's screen and under the caption of the month view:

   "Sun and moon: times as seen from 3,997 ft, over a sea-level horizon. Hills in the way are not counted."

3. **Everywhere else nothing changes and nothing is said.** That is: a spot under 100 ft; a spot with no height of its own (Campus Point and Gaviota State Park, and any spot saved before spots had heights); and a spot that is not near the sea.

## The rule

A spot's sun and moon times are worked out from its own height when both of these hold:

- the spot's own height is known and is 100 ft or more;
- a tide station is within 25 miles, which is how the app already tells the coast.

Otherwise they are worked out for a level horizon, as now, and as almanacs and weather sites do.

**Why only near the sea.** The question is "height above what?". From 4,000 ft the horizon is about 77 miles away, and what lowers it is how far the spot stands above the ground out there. Near the sea that ground is the sea, so the spot's height above sea level is the height that counts. Inland it may be a plain as high as the spot: Denver stands at 5,280 ft on ground that is 5,280 ft all the way to its horizon, and counting its height would show a sunset 7 minutes late, where the mountains to its west in fact make it early. The app has no map of the ground, so it counts a height only where the sea is near.

**Why 100 ft.** Times are shown to the minute. On 10 October 2026 at this latitude a height of 21 ft moves sunset by 26 seconds, 100 ft by 57 seconds, 300 ft by 1 minute 39 seconds, 1,000 ft by 3 minutes and 3,997 ft by 6 minutes. Under 100 ft a spot keeps the times of the beach beside it, which are the Naval Observatory's.

## How it works

- **`src/data/horizon.ts`**, a plain module with tests: `seenFromFt(spot)` gives the height in feet that the times are worked out from, or 0 for a level horizon. It reads the spot's own height and the distance to its tide station, and nothing else.
- **`src/data/astro.ts`**: `dayAstro` places the observer at that height and tells `astronomy-engine` that the observer stands that far above the ground it looks out over (the last argument of `SearchRiseSet`). The library lowers the horizon by the dip and allows for the thinner air. At 0 nothing changes, so every existing test against the Naval Observatory stands as it is.
- **`src/ui/captions.ts`**: `sunCaption(spot)` gives the caption, or null where the horizon is level.
- **`src/ui/SpotScreen.tsx`** and **`src/ui/MonthView.tsx`** show the caption where there is one.

Nothing new is fetched and nothing new is stored. The height is the one USGS gave when the spot was added, or La Cumbre Peak's 3,997 ft.

## What it was checked against

- **The Naval Observatory's API is no reference for a height.** Asked for La Cumbre Peak on 2026-10-10 with `height=0` and with `height=1218` it gave the same times, 18:31 and 07:05. The existing tests go on checking level-horizon times against it.
- **The geometry.** From 1,218 m the horizon is about 1.2° below level. At this latitude the sun and the moon cross that in 6 to 7 minutes, a little more at the solstices, when they meet the horizon at more of a slant.
- **`astronomy-engine` 2.1.19, at La Cumbre Peak:**

  | Date | Sunset, level | Sunset, 3,997 ft | Later by | Moonrise earlier by |
  |---|---|---|---|---|
  | 2026-10-10 | 6:30:30 PM | 6:36:31 PM | 6 min 1 s | 6 min 22 s |
  | 2026-12-21 | 4:52:28 PM | 4:59:13 PM | 6 min 45 s | 7 min 14 s |
  | 2027-03-20 | 7:10:30 PM | 7:16:28 PM | 5 min 58 s | 6 min 18 s |
  | 2027-06-21 | 8:14:40 PM | 8:21:34 PM | 6 min 54 s | 6 min 39 s |

## Limits

- **Hills are not counted.** In summer the sun sets from La Cumbre Peak behind higher mountains to the northwest, and the time shown will be late. Issue 9 names terrain as related and harder; it is a separate issue if it is wanted.
- **One of the two is usually over land.** On this coast the sun sets over the sea and the moon rises over land. Both are worked out from the same height.
- **The height is the ground's at the pin**, as USGS gives it, not the eye of someone standing there.
- **A spot saved before spots had heights of their own** has none, and stays at a level horizon until it is removed and added again.

## Not in this change

- Terrain on the horizon.
- Heights for inland spots.
- Heights of their own for Campus Point and Gaviota State Park. Both are beaches.
- Anything on the add screen. The spot's screen says it once the spot is saved.

## Decisions this spec makes that the issue leaves open

1. **A height is counted only near the sea** (a tide station within 25 miles). The other choices were everywhere, which is simple and wrong on every high plain, and nowhere until the ground can be read. **This one is the first user's to confirm:** he asked for the elevation to be counted and has not been asked what it should be counted above.
2. **Under 100 ft nothing is counted.** It would move a time by under a minute, and beaches would stop agreeing with each other and with the Observatory.
3. **A spot with no height of its own stays at a level horizon.** The forecast cell's average is not used in its place, as it is for the tide rule: it puts a beach under hills hundreds of feet up, which here would be minutes of error.
4. **Sunset and moonrise both use the height**, though one of them is usually over land.
5. **A caption says so where a height is counted, and nothing is said where it is not.**
6. **The wording of the caption**, above.
7. **The moonrise flag uses the new times.**
8. **No row says how much its time moved.** The caption says what the times are; the data stays plain.
