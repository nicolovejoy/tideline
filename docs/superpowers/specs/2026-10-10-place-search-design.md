# Place search design: add a spot by typing a place name

Date: 2026-10-10. Status: written on the owner's "carry on SDD" for issue #35, the second half of #4, with the decisions this spec makes listed at the end for review on the pull request. One of them, using OpenStreetMap's public Nominatim service, is a decision its usage policy says the application developer must make deliberately; it is the first item under Decisions.

Issue: https://github.com/nicolovejoy/tideline/issues/35

## Goal

On the add screen, type a place name, press Search, and the map pans there with the pin dropped, so the usual lookup runs. Today the only ways to place a pin are a tap on the map and the device's location; someone adding a beach two hundred miles away has to drag and zoom their way there. Nothing else about adding a spot changes: the pin, the name, the facts, the tides checkbox and Save work as they do now.

## What the user sees

1. **A search row** at the top of the add screen, above "Use my location": a text field with the label "Place" and a button "Search". The field is a search field (`type="search"`, so the keyboard's return key reads Search on a phone), with no autocomplete and no suggestions as the user types. Pressing return or the button searches; nothing happens until then. The button reads "Searching…" and is disabled while a search is in flight, and nothing is sent for a blank field.

2. **The answer**, as a line under the row, in a live region so a screen reader hears it:
   - Found: the place's full name as the geocoder gives it, "Santa Barbara, Santa Barbara County, California, United States", so the user can tell it from another Santa Barbara. The map pans and zooms to fit the place's extent, to no closer than about two miles across, and the pin drops at the place's own point. The pin's lookup runs as for a tap, and the facts fill in. If the name field is still empty, the place's short name, "Santa Barbara" or "Leadbetter Beach", is put in it, so a search needs nothing more than Save; a name the user has typed is left alone.
   - Nothing found: "No place by that name in the US." The map and the pin stay as they were.
   - The service could not be reached: "Couldn't reach the place search. Try again in a minute." The map and the pin stay as they were.
   - A second search replaces the line. A tap on the map after a search leaves the line as it is: it says what was searched for, and the pin is wherever the user last put it.

3. **Credit.** The map's corner credit reads "© OpenStreetMap contributors · Search by Nominatim", where today it reads "© OpenStreetMap contributors". That is the attribution Nominatim's policy asks for, in the place the map already credits its data.

4. **Everything else** is as it was: "Use my location", the map and its tap, the name, the facts, the checkbox, Save and Cancel.

## Data

### The geocoder

OpenStreetMap's Nominatim, at `https://nominatim.openstreetmap.org/search`, free with no key. One request:

    GET https://nominatim.openstreetmap.org/search?q={text}&format=jsonv2&countrycodes=us&limit=1

`countrycodes=us` keeps the answers to the US, which is all Tideline covers (NWS answers 404 anywhere else), so "Santa Barbara" cannot come back as the one in Honduras. The response is a JSON array of places, each with `lat` and `lon` as strings, `name`, `display_name` and `boundingbox` as four strings in the order south, north, west, east. An empty array means nothing found. Verified on 2026-10-10: the response carries `access-control-allow-origin: *` and the preflight allows GET, so the browser can call it directly, as it calls NOAA and NWS. A copy served from Nominatim's cache can lack the header on a plain request, which is why the first probe seemed to show no CORS; a browser's request, with an `Origin`, gets it.

Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/) asks for: no more than one request a second across all the app's users; a `Referer` or `User-Agent` that identifies the application; no autocomplete; visible attribution; and that the same query is not sent again and again. It also says the service may ask an app to switch provider at any time. How this spec meets each:

- **One a second.** Search runs only on submit, one at a time: the button is disabled while a search is in flight. A handful of people adding a spot now and then is far under the limit.
- **Identifying the app.** A browser sends the page's origin as the `Referer` on a cross-site request under the default referrer policy, and the page sets no stricter one. `User-Agent` cannot be set from a browser.
- **No autocomplete.** Nothing is sent as the user types.
- **Attribution.** The map's credit line, above.
- **No repeats.** The last few answers are kept for the life of the page, keyed by the query with its spaces collapsed and its case folded, so a resubmit of the same text does not ask again.
- **Switching provider.** The URL and the parser are the whole of `src/data/geocode.ts`; the add screen sees only a `Place`. Photon (https://photon.komoot.io, also OpenStreetMap data, with CORS, but no country filter) is the nearest substitute.

### The module

`src/data/geocode.ts` (framework-free):

- `interface Place { lat: number; lon: number; name: string; displayName: string; bounds: { south: number; north: number; west: number; east: number } }`.
- `searchUrl(query: string): string`, the request above with the query URL-encoded.
- `parsePlaces(json: unknown): Place[]`: the array parsed, strings to numbers, each entry checked for shape; an entry that fails is dropped, a response that is not an array throws.
- `fetchPlace(query: string): Promise<Place | null>`: the first place, or null for none. A non-OK response throws. Answers are kept in a module-level map for the life of the page, as above; a failure is not kept, so Try again asks again. The query is trimmed before it is sent; a blank query returns null without a request.

### The map

`SpotMap`'s `look` prop, today a `LatLon | null` that the map pans to at the opening zoom, becomes a `Look | null` where `Look = { lat: number; lon: number; bounds?: Bounds }`. With `bounds` the map fits them, to no closer than zoom 14 (about two miles across a phone's width); without, it pans to the point at the opening zoom as it does now for the device's location. The device's location keeps using the point form.

### The add screen

`AddSpot` gains the search row and a `search` state: idle, searching, found with its place, none, or failed. Submit trims the field, and does nothing for a blank; otherwise it sets searching, calls `fetchPlace`, and on an answer drops the pin at the place (through the same `dropPin` a tap uses, so the lookup runs and the old facts clear), sets `look` to the place with its bounds, and fills the name if it is empty. A search that lands after the screen has gone is ignored, as the other requests are.

## Rules, in plain modules

- `src/data/geocode.ts`: the URL, the parser, the fetch with its memory.
- `src/ui/addSpotView.ts`: the words (`WORDS.placeLabel` "Place", `WORDS.search` "Search", `WORDS.searching` "Searching…", `WORDS.noPlace`, `WORDS.searchFailed`), the credit (`MAP.attribution` with Nominatim appended), `searchLine(state): string | null` giving the line under the row for each state, `suggestedName(typed: string, place: Place): string` giving the typed name if it is not blank, else the place's name cut to `NAME_MAX`, and `normalizeQuery(text): string` for the memory's key (trim, collapse runs of spaces, lower case) if it is not kept inside `geocode.ts`.
- `src/ui/SpotMap.tsx`: the `Look` type and the fit.

Components (`AddSpot.tsx`, `SpotMap.tsx`) hold no arithmetic and no wording, and are checked in a browser.

## Testing

Fixtures recorded on 2026-10-10, in `src/data/__fixtures__/`:

- `nominatim-santa-barbara.json`: the answer to "Santa Barbara" with `countrycodes=us&limit=5`: the city, the county, and Hatch, New Mexico (a fuzzy match), 3 places.
- `nominatim-leadbetter-beach.json`: the answer to "Leadbetter Beach", 1 place of type beach.

Nothing found is `[]`, inline in the test. Tests run with `TZ=Asia/Tokyo`, which does not matter here: nothing in this feature is a time.

- `geocode.test.ts`: `searchUrl` encodes the query and carries the four parameters; `parsePlaces` on both fixtures gives the right first place with numbers, its bounds in the right order, and name and display name; an entry missing a field is dropped; a non-array throws. `fetchPlace`: the first place from the Santa Barbara fixture; null for `[]`; a 503 throws; two calls with the same query, differently spaced and cased, fetch once; a failed call is not remembered, so the next call fetches again; a blank query fetches nothing and gives null.
- `addSpotView.test.ts`: `searchLine` for each state; `suggestedName` keeps a typed name, uses the place's name for a blank one, cuts at 40; the attribution names Nominatim.
- The browser check, by the implementer with Playwright at phone width: type "Leadbetter Beach", press return; the line names the beach, the map zooms in on it, the pin is down, the facts fill in with Santa Barbara as the station, the name field reads "Leadbetter Beach"; Save. Type "xqzv nowhere zz": the no-place line. Type "Santa Barbara" with a name already typed: the typed name stays. The pull request lists the same steps for the owner's phone.

## Out of scope

- A list of several results to choose from: the top one is shown; a more exact query ("Santa Barbara CA", a street address, a ZIP code: Nominatim takes all three) picks another.
- Searching from the spot screen, outside the add screen.
- A proxy or server-side cache for the geocoder (the policy suggests one "if at all possible"; #10 is where a server goes).
- Editing a saved spot (remove and add again, as before).

## Decisions this spec makes that the issue leaves open

1. **OpenStreetMap's public Nominatim service.** Its usage policy says use is permitted only where the application developer has made a deliberate, informed decision to use it and is responsible for complying, and that the service may ask an app to switch at any time. The issue proposed it and this spec builds on it, but the decision is the owner's: merging the pull request is making it. The policy is at https://operations.osmfoundation.org/policies/nominatim/ and the section above says how each requirement is met. The alternative with no such policy is Photon by komoot, at the cost of the US filter; the swap is one file.
2. **The top result only**, not a list of five. Simpler on a phone, and a longer query disambiguates.
3. **The search row sits above "Use my location"**, so the three ways to place a pin read top to bottom: type a place, use my location, tap the map.
4. **The place's short name is put into an empty name field.** A typed name is never overwritten.
5. **The map fits the place's extent, no closer than about two miles across.** A city shows whole; a beach shows its surroundings.
6. **The credit goes in the map's corner**, after OpenStreetMap's, not as a line of its own under the search row.
7. **Answers are remembered for the life of the page**, not saved on the device: the policy asks that the same query is not resent, and a page's worth of memory does that without another storage key.
