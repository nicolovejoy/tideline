# Edit and remove a saved spot, and the moon line

Date: 2026-10-12. Status: approved by the owner on 2026-10-12 as the first of three pieces of this stage, before anything was built. The decisions this spec makes beyond what he approved are listed at the end for review on the pull request.

Issue: https://github.com/nicolovejoy/tideline/issues/54

## Goal

In his session of 2026-10-11 the first user made a duplicate spot and could not fix it. A saved spot can be removed today, but only from a line of small text at the foot of its forecast, under the share link, and he did not find it. Nothing can be renamed or moved.

This piece gives a saved spot an edit screen, where its name and its pin can be changed and from which it can be removed. It also changes one line of words about the moon, which the first user chose on 2026-10-09.

## What the user sees

1. **"Edit" beside the name** at the top of a spot the user saved. The three built-in spots have no such button, and neither has a spot opened from a link and not yet saved.

2. **It opens the add screen as "Edit spot"**: the name is filled in, the map opens on the spot with the pin at it, and the lines under the name say what the spot has (its forecast cell, its height, its stations or why it has no tide), from what is saved. Nothing is looked up until the pin moves.

3. **Save with only the name changed** renames the spot where it stands in the row. Its saved data is kept, and nothing is fetched, so a rename works with no connection.

4. **Save with the pin moved** looks the new point up as a new pin's is, while the screen is open, and keeps the spot's place in the row. Everything saved for the old point is dropped and the forecast is fetched afresh. A spot that gains or loses its tide by the move says so in the lines under the name before it is saved, as a new pin does.

5. **Save with nothing changed** closes the screen.

6. **Cancel, or going back,** closes the screen and changes nothing.

7. **"Remove this spot" is at the foot of the edit screen**, with the question it asks today: "Remove Hendry's Beach?", "Yes, remove", "Keep". Removing shows Campus Point's forecast at the top of the page, as it does today. The line under the forecast goes: there is one place to remove a spot from.

8. **A spot that cannot be kept** because the device's storage is full says so on its screen, as a new spot does.

9. **The moon line** in tonight's strip reads "Moonrise 5:00 AM" whether the moon has risen or not. Today it reads "Rose 5:00 AM" or "Rises 5:00 AM". "No moonrise today" stays, and so does the flag "Moonrise near sunset: 6:12 PM".

## How it works

- **`src/ui/viewHistory.ts`**: `View` gains `'edit'`. The edit screen has an entry in the browser's history as the add screen has, so going back closes it and a reload opens it again on the spot that was on screen. If that spot is a built-in one, which a reload cannot normally find, the forecast is shown.
- **`src/data/savedSpots.ts`**: `replaceSpot(id, next)` writes the list with the spot of that id replaced where it stands, and says whether the list went in, as `addSpot` does.
- **`src/ui/addSpotView.ts`**, with tests:
  - words: the heading "Edit spot" and the button "Edit";
  - `pinMoved(spot, pin)`: whether the pin is somewhere else, comparing to four decimal places, which is how a spot's point is kept;
  - `edited(spot, name, pin, result)`: what Save would do, one of nothing, a rename, or a move, and the spot it would save;
  - `canSave` for an edit: a name, and either the pin where it was or a new point that was looked up.
- **`src/ui/AddSpot.tsx`** takes the spot being edited. With one, the name, the pin and the looked-up facts start from that spot, the map opens on it, and the foot of the screen has the remove line with its question, moved here from `SpotScreen.tsx`.
- **`src/App.tsx`**: the heading row of a saved spot has the Edit button, which opens the view. Saving an edit writes the list, keeps the choice of spot pointing at it, and closes the view. Removing does what it does today and closes the view.
- **`src/ui/SpotScreen.tsx`** loses the remove line and the `onRemove` it was given.
- **`src/ui/dayList.ts`**: `tonightWords` says `Moonrise ${time}`. It no longer needs the current time, so that argument and what passes it go.
- **`src/styles.css`**: the heading row.

A moved spot is saved under a new id, in the old one's place in the row. A request for the old point may still be on its way when the edit screen opens, and when it answers it saves what it fetched under the old id. With a new id that late answer cannot be drawn for the new point. The old id's saved data is dropped with `forgetSpot`.

Nothing new is fetched and nothing new is stored. Moving a pin makes the requests that dropping a new pin makes.

## Limits

- **The home-screen app keeps its own spots** (issue 45). A spot edited in Safari is not edited there.
- **A link already sent** carries the name and the point the spot had when it was sent. Editing the spot does not change the link, and opening that link on this device after a move shows the old point as a spot the device does not have.
- **A spot saved before spots had heights of their own** has none. Renaming it does not look one up; moving its pin does.

## Not in this change

- A warning when a new spot is put on top of one the device has. The first user's duplicate would have been caught by one, and it can follow if editing is not enough.
- Putting the spots in another order.
- Editing or removing the three built-in spots.

## The owner's check, on production after the merge

At https://tideline.ibuild4you.com on an iPhone, in a Safari tab:

1. Add a spot named "Test one" anywhere on the coast. Pass: its forecast shows, with "Edit" beside its name. Fail: no "Edit".
2. Tap "Edit", change the name to "Test two", tap "Save". Pass: the forecast shows at once under the new name, and the row of spots says "Test two". Fail: the old name anywhere, or a wait for data.
3. Tap "Edit", tap the map a few miles along the coast, wait for the lines under the name to change, tap "Save". Pass: the forecast is for the new point, and the caption under the tide names the station nearest to it. Fail: the old point's data.
4. Tap "Edit", then swipe back. Pass: the forecast, unchanged. Fail: Safari leaves Tideline.
5. Tap "Edit", scroll to the foot, tap "Remove this spot", then "Yes, remove". Pass: Campus Point's forecast, and "Test two" gone from the row. Fail: the spot still there.
6. Choose Campus Point and look at the strip at the top. Pass: the moon's line reads "Moonrise" and a time, or "No moonrise today". Fail: "Rose" or "Rises".
7. Choose Campus Point. Pass: no "Edit" beside its name.

## Decisions this spec makes

Approved by the owner on 2026-10-12:

1. **Edit is a button beside the spot's name**, and it opens the add screen with the spot filled in.
2. **Remove moves to the edit screen**, and the line under the forecast goes.
3. **The moon line says "Moonrise"** and the time, in both tenses. The first user's wording.

For review on the pull request:

4. **A rename keeps the spot's id and its saved data; a move gives it a new id.** The other choice, one id for the life of the spot, lets a late answer for the old point be drawn for the new one.
5. **A rename looks nothing up.** It works with no connection, and a spot with no height of its own stays without one.
6. **The edit screen is a view with an entry in the browser's history**, as the add screen is.
7. **Built-in spots cannot be edited.**
8. **No warning for a spot on top of another.**
