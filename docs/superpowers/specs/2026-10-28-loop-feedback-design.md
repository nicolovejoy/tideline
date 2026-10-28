# Feedback through Loop

Asked for by Nico on 2026-10-28, and set out by ibuild4you the same day in the handoff `ibuild4you-tideline.md` ("how to add Loop feedback to Tideline"). Loop is ibuild4you's feedback channel: a form in the host app posts to `https://ibuild4you.com/api/feedback`, the note lands in the inbox at https://ibuild4you.com/admin/feedback, and from there Nico turns it into a GitHub issue in one click. The slug is `tideline` (Nico, 2026-10-28; ibuild4you creates the project). Nico added `nicolovejoy/tideline` to the scope of the `ibuild4you-feedback-to-issues` token the same day.

Nico chose on 2026-10-28: a floating button; the page's full address goes with a note, query included; the email field is shown. He asked whether sending should need sign-in. It does not: the Stage B decision of 2026-10-18 keeps everything but a user's own spots open, and a signed-in email is no more verified at Loop than a typed one, since only a server can sign the token Loop trusts (below). Signed in, the field is filled in with the account's email.

## What the user sees

A pill-shaped "Feedback" button floats at the bottom right of the window, clear of the home indicator, outlined in sea-green as the "?" is, over whatever is under it. It is on the forecast and on the screen a shared link opens. It is not on the month view, the add screen, the edit screen or under the help sheet (see "Where the button is" below).

Tapping it slides up a sheet, as the "?" sheet does: the heading "Send feedback", Close, then:

- Three buttons, Bug, Idea and Other, one pressed; Bug at first.
- A box for the note, labelled "What happened, or what would help", up to 5,000 characters.
- A field labelled "Email, if you would like an answer". Signed in, it holds the account's email, and can be changed or cleared. Signed out it is empty, with the line "Signed in, this is filled in for you." under it.
- A box, ticked, "Include an outline of this screen", and under it "What is sent", which opens to show the outline: the headings, button and field names on the page, never what was typed.
- The line "The page's address goes with it, and for a shared spot that is its name and place."
- Send. While it is sending it says "Sending…" and cannot be pressed again.

Sent, the sheet says "Sent. Thank you." with "Send another", which brings back an empty note. A note that could not be sent stays in the box, with one sentence above Send:

- Offline, or no answer in 15 seconds: "Could not reach the feedback service. Check the connection and try again." (offline) or "Could not reach the feedback service. Try again in a moment." (online).
- Too many from this connection (429): "Too many notes from here. Try again in 3 minutes.", from `Retry-After` rounded up to whole minutes ("1 minute" for one), or without the time when there is none.
- Unknown project (404): "Feedback is not set up for Tideline yet."
- Anything else: "Could not send. Try again."
- Before sending, an empty note: "Write a note first."; an email without the shape of one: "That email does not look right."

Close, a tap on the shaded page behind, Escape or going back closes the sheet, as the help sheet's do. A reload with the sheet up brings it back, empty.

## Where the button is

`'feedback'` is a view in `src/ui/viewHistory.ts`, as `'help'` is, so the sheet has one history entry and going back closes it. The store keeps one entry for whichever view is up: a view opened over another takes the other's place, so the sheet opened over the month view would close the month view, and over the add screen would lose the pin. So the button is shown only where no view is up: the forecast and the shared spot's screen. Notes about the month view are written from the forecast. A sheet that stacks over a view is a change to the store, and not in this.

## What is sent

The wire contract is ibuild4you's, in `~/src/ibuild4you/lib/feedback/README.md`:

- `projectId` `tideline`, `type`, `body` (trimmed), `submitterEmail` (lowercased, left out when empty).
- `pageUrl` `window.location.href`, query included; `userAgent`; `viewport` as `390x844`.
- `website` empty: the honeypot. Tideline's sheet has the hidden field the widget has.
- `_ts`, when the sheet was opened. The server refuses a note under 2 seconds or over 24 hours old.
- `capture`, the outline, when the box is ticked. The sheet and the button carry `data-loop-redact`, so they leave themselves out of it.
- No `identityAssertion`: it needs a server to sign it with a secret, and Tideline has none. A later issue if it is wanted.

A 201, or the 200 the honeypot gets, is sent. Nothing about a note is kept on the device.

## How it is built

- `src/data/feedback/payload.ts` and `src/data/feedback/capture.ts`, copied from ibuild4you's `lib/feedback/`, in this repo's style. `FeedbackType` and `normalizeEmail` are inlined in `payload.ts`, as the handoff says; nothing else about them changes, so a later copy diffs cleanly. The widget component is not copied: its Tailwind classes and its words are rewritten here.
- `src/data/loop.ts`: the endpoint and the slug, and `sendFeedback`, which posts a payload and says sent, refused with its status and `Retry-After`, or unreachable. The fetch is handed in, so it is tested with a stand-in.
- `src/ui/feedbackView.ts`: every word above, and the rules that pick them: the failure sentence, the validation sentence, the email to start with.
- `src/ui/FeedbackSheet.tsx`, the sheet, and `src/ui/FeedbackButton.tsx`, the button. `src/App.tsx` puts both on the forecast and the shared screen.
- The account: `useAccount()` moves from `Account.tsx` up to `App.tsx`, which hands it to the account row and the email to the sheet, so one watcher serves both. The row's behaviour does not change. The hook now also runs while the add, edit and shared screens are up, where before the row was not mounted; on a device that has signed in it no longer starts over each time the forecast comes back.
- Styles in `src/styles.css`: the button fixed at the bottom right inside the safe areas; the page's foot padded so the build stamp is not under it; the sheet's form in the page's tokens, no new colour, so `src/chart/contrast.test.ts` is unchanged.

`capture.ts` walks the DOM, and the tests run in Node with no DOM, so it is untested here by design, as `browserEnv` is; ibuild4you tests it. The sheet and the button are checked in a headless browser with the POST intercepted, so a check never sends a note to the real inbox.

## Checks

After the merge, on production, ibuild4you's step 6: on https://tideline.ibuild4you.com, Feedback, Bug, "Loop smoke test", Send. Pass: "Sent. Thank you.", and a row at https://ibuild4you.com/admin/feedback with the slug `tideline`, the page's address and a Safari or Chrome user agent. A 404 means the project is not made yet on ibuild4you's side. The result is posted in the handoff.

## Not in this

Verified identity (`identityAssertion`), a sheet over the month view or the add screen, keeping a draft, and screenshots.
