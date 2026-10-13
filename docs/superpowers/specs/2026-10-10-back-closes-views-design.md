# Back closes the month view and the add screen

Date: 2026-10-10. Status: written on the owner's "get going on our roadmap", with the decisions this spec makes listed at the end for review on the pull request.

Issue: https://github.com/nicolovejoy/tideline/issues/46

## Goal

In a Safari tab, a back swipe from the month view or the add screen returns to the forecast. Today it leaves the site, because neither view writes a history entry. Since share by link, a Safari tab is where everyone who is sent a spot meets the app.

This is the smaller of the issue's two answers: history entries only. No view gets an address of its own.

## What the user sees

1. **Going back from the month view** (a swipe, the browser's back button, or Android's) shows the forecast, exactly as "Back to forecast" does: today on the panels, the cursor at rest, the top of the page, and the day's heading in focus.

2. **Going back from the add screen** shows the screen it was opened from, exactly as Cancel does.

3. **The view's own way out leaves nothing behind.** After "Back to forecast", Cancel or Save, one back swipe leaves the site, as it would have before the view was opened. There is no swipe that seems to do nothing.

4. **Forward works as a browser's forward does.** After going back from the month view, forward opens it again.

5. **A reload keeps the view.** Reloading on the month view opens the month view (on this month), and going back from it still shows the forecast. The same goes for the add screen.

6. **One view at a time.** The add screen opened from the month view takes the month view's place in the history, so going back from it shows the forecast, as Cancel always has.

7. **A spot opened from a link** has a month view like any other, and going back from it shows the shared spot's forecast with the link still in the address. Save or Close from its month view puts the address back to `/` as before, and going back after that leaves the site.

8. **Choosing a spot from the row** shows that spot's forecast, whichever view was up.

Nothing else is added to the history: not a chosen day, not a step from one month to the next.

## How it works

- **`src/ui/viewHistory.ts`**, a plain module with tests. It holds which view is up (`'month'`, `'add'` or none) and keeps the browser's history in step. The browser is handed in as four members of `window.history`, so the tests use a stand-in and need no browser.
  - `viewOf(state)`: the view a history entry's state stands for. A view's entry carries `{ tidelineView: 'month' }` or `{ tidelineView: 'add' }`; any other state is the forecast.
  - `createViewStore(pages)` gives:
    - `current()`: the view on screen, read from the entry the page started on, so a reload opens the view it was on.
    - `open(view)`: pushes an entry for the view at the address the page already has. Where a view's entry is already on top it is replaced, not added to.
    - `close()`: shows the forecast at once and asks the browser to go back, which takes the view's entry off. The browser answers a moment later.
    - `arrived(state)`: called on the browser's `popstate`. The view becomes whatever the entry arrived at says.
    - `clearAddress(path)`: puts the address back to `/`. Where a view is being left it also cleans the entry underneath once the browser has arrived there, so a link is left on neither.
    - An `open` asked for while the browser is still going back waits for it to arrive.
- **`src/ui/useView.ts`**: the one store for the page, made on `window.history`, with the `popstate` listener and a React hook, `useView()`, over `useSyncExternalStore`. It also sets `history.scrollRestoration` to `manual`.
- **`src/App.tsx`** reads the add screen from the store instead of its own state, and closes any view when a spot is chosen, saved or closed.
- **`src/ui/SpotScreen.tsx`** reads the month view from the store. The forecast is put back to today as the month view opens, so every way out of it finds the forecast the same; focus and scroll are set when the month view is seen to have gone.

Nothing is fetched, nothing is stored on the device, and no address changes.

## Limits

- A view's entry is the app's only while the app made it in this tab. A tab whose history was cleared underneath it has nothing to go back to, and going back leaves the site, as today.
- The home-screen app has no back swipe. Nothing changes there.
- After a reload on a view, the view's own button still asks the browser to go back. In Chromium that stays within the page. If a browser loads the page afresh there, the forecast is drawn again from saved data.

## Not in this change

- **Addresses for views**, so that a link can open a month or a day. The issue's larger answer. It needs its own decisions: what a reload shows, and what a shared link should and should not carry. It becomes a new issue.

## Decisions this spec makes that the issue leaves open

1. **History entries only.** No new addresses.
2. **Going back does what the view's own button does.** From the month view that is today, the cursor at rest, the top of the page and focus on the day's heading; from the add screen it is what Cancel does. The other choice was to land where the page was scrolled to when the view opened.
3. **The view's own button takes its entry off the history**, by asking the browser to go back. So there is never a back swipe that does nothing, and forward opens the view again.
4. **A reload on a view opens that view.** The other choice, opening on the forecast, leaves an entry behind that a back swipe then has to get through.
5. **One entry for whichever view is up.** The add screen opened from the month view replaces its entry.
6. **The app says where the page is scrolled to** (`history.scrollRestoration = 'manual'`). Left to the browser, where the page lands after going back differs between browsers. A side effect: a reload starts at the top of the page.
7. **A chosen day and a month step put nothing in the history.**
8. **Choosing the spot already on screen from the row closes the month view too.** Before, only another spot did.
9. **Issue 46 is closed by this.** Addresses for views are filed as a new issue.
