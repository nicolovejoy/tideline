# Share a spot by link

Date: 2026-10-10. Status: written on the owner's "start on number seven", with the decisions this spec makes listed at the end for review on the pull request.

Issue: https://github.com/nicolovejoy/tideline/issues/7

## Goal

Any spot can be handed to someone as a link. Opening the link shows that spot, with everything a spot has, and the recipient can save a copy on their own device. No account, no server: the link itself carries the spot's name and coordinates, and nothing else.

## What the user sees

1. **A line to share with**, on every spot's screen, in the captions above "Remove this spot": a text button, "Share this spot". The built-in spots have it too.
   - Where the device has a share sheet (an iPhone), tapping it opens the sheet with the link and the spot's name. Closing the sheet without sharing says nothing.
   - Where it has none, the link is copied and the line says "Link copied."
   - Where it can do neither, the line shows the link itself after "Copy this link:", to be selected by hand.

2. **The link**: `https://tideline.ibuild4you.com/?name=Hendry%27s+Beach&at=34.4026%2C-119.7437`. The site's own address, the spot's name, and its latitude and longitude to four places (about 35 ft). The name comes first so the link ends in a digit: a name can end in a bracket or a full stop, which a message app may leave out of the link.

3. **Opening a link for a spot the device does not have.** The page opens on that spot and not on the last one chosen:
   - The heading is the spot's name. Under it a notice: "Shared with you. Not saved on this device.", with two buttons, "Save" and "Close". There is no row of spots.
   - While the point is looked up, as a pin on the add screen is: "Looking up the forecast and the nearest stations…". Then the spot's whole screen, as for any spot.
   - Outside the US: "NWS has no forecast here. Tideline covers the US." and Close. NWS not answering: "Couldn't reach the National Weather Service. Try again in a minute.", with "Try again" and Close.
   - **Save** keeps the spot on the device, as Save on the add screen does (and says so when the device's storage is full, as it does there), and the page becomes the ordinary one with the new spot chosen.
   - **Close** goes to the spot last chosen, and what was fetched for the shared spot is dropped from the device.
   - Either way the address goes back to `/`, so a reload does not ask again. Until then a reload shows the shared spot again.

4. **Opening a link for a spot the device already has** (a built-in or saved spot at the same point, to four places): that spot opens, as if chosen from the row, under the device's own name for it. No notice, no second copy, and the address goes back to `/`.

5. **A link that cannot be read** (no coordinates, or ones that are not a place on Earth): the app opens as it always does and says nothing. A link with coordinates and no name is a spot called "Shared spot".

## How it works

- **`src/ui/shareView.ts`**, a plain module with tests, holds all of it that can be tested without a browser:
  - `shareUrl(spot, origin)`: the link for a spot, from `URLSearchParams`, `name` then `at`.
  - `parseShareLink(search)`: `{ name, lat, lon } | null` from a page's query string. `at` must be two plain decimal numbers with a comma between, latitude within ±90 and longitude within ±180; both are rounded to four places. The name is trimmed and cut to the add screen's limit (`cleanName`), and a blank one becomes "Shared spot".
  - `spotAt(spots, point)`: the spot at that point to four places, or undefined.
  - `openedLink(search, spots)`: what the page was opened with: nothing, a spot the device has, or a point it does not.
  - `sharedSpotId(point)`: the id of a shared spot, made from its coordinates, so a reload before saving finds the data it fetched the first time and a spot saved from a link keeps that id.
  - The words.
- **`src/ui/ShareSpot.tsx`**: the button and its line. It tries `navigator.share`, then `navigator.clipboard.writeText`, then shows the link. A share sheet that is closed (`AbortError`) is not a failure.
- **`src/ui/SharedSpot.tsx`**: the screen for an opened link. It loads the station list and resolves the point with `resolveSpot`, exactly as the add screen does for a pin, and draws `SpotScreen` for the result.
- **`src/App.tsx`** reads the address once as it starts, and puts it back to `/` with `history.replaceState` when the link has been dealt with.

Nothing new is fetched from anywhere new. The link's point goes to the same three services a pin does: NWS, USGS, and the baked station list.

## Limits

These are the issue's, and they stand: anyone with the link can open it; a link cannot be taken back; and the recipient's copy is their own, so removing or re-adding the spot on one device changes nothing on another.

The link carries a name and a place. It says nothing about who made it.

## Not in this change

- **The home-screen app.** A link opens in Safari, and a home-screen app keeps its own storage, so a spot saved from a link in Safari may not be in the app. Issue #45.
- **Addresses for the month view, a day, or the add screen**, and the Safari back swipe that leaves the site from them. Issue #46.
- **A picture or a title of its own in a pasted link.** The preview a message app shows is the site's one preview, for every link: there is no server to draw another.

## Decisions this spec makes that the issue leaves open

1. **The link is a query string on the site's root**, not a path and not a fragment. A path needs a rewrite rule on the host. A fragment is kept off the server's logs, but a query string survives more of the things links get passed through.
2. **Name and coordinates only.** The forecast cell, the height and the stations are looked up when the link is opened, as for a new pin, so a link can never carry facts that have gone stale or were never true.
3. **Opening shows the spot without saving it.** Nothing goes into the saved list until Save.
4. **One spot per point.** A link to a point the device already has opens what is there, under the name it already has.
5. **Every spot can be shared**, the three built-in ones included.
6. **A link that cannot be read says nothing.** The app opens as usual.
7. **Views get no addresses here.** The comment on the issue leaves that to this change; it becomes issue #46.
8. **"Shareable publicly or with specific friends"**, the product rule, is met by who the link is sent to. There is no list of public spots.
