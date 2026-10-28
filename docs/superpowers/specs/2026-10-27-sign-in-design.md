# Sign in and out. The first pull request of Stage B

Written 2026-10-27, after the spike passed on the owner's iPhone (its result is in `2026-10-18-stage-b-sign-in-plan.md`). The owner opted out of the design questions, so the choices below that the plan did not make are the writer's, marked "call".

## Intent

A user can sign in to Tideline with Google and sign out again, from a browser tab or from the home-screen app, and the app remembers it between opens. Nothing else changes: spots stay on the device until the second pull request, and signed out the app is exactly what it is today. This pull request puts the account in place so the next one has somewhere to put the spots.

## Goals

- Sign in by popup, as the spike showed works everywhere the first user opens the app.
- The signed-in state survives a reload and a reopen of the home-screen app, without the sign-in page.
- The forecast page pays nothing for sign-in until it is used: the Firebase SDK is loaded when "Sign in" is tapped, and at start-up only on a device that has signed in before.
- A failure says what it is, in words the first user can act on, and never blocks the forecast.

## Non-goals

- Moving spots into the account (pull request 2), the merge on first sign-in (3), offline and quota wording for the store (4).
- Redirect sign-in. The spike showed it works too; it is the fallback if a device ever refuses the popup, and is not built until one does.
- Apple or any other provider. Accounts, profiles, a settings screen. Anything social.

## Anti-goals

- A sign-in prompt. Nobody is asked to sign in; the button sits there until wanted.
- A redesign of the header. One row is added and nothing moves.
- Firebase anywhere in the components. The SDK stays behind one adapter.

## What the user sees

The forecast page's header today is the title "Tideline" and, under it, the spot's line (the subtitle and Edit). Under the spot's line a new **account row** is added, one line, in the caption's size and colour (`.install-hint` is the model), and it is always one line tall so the spot chips below it never move.

Signed out, the row is one text button:

> Sign in with Google

Signed in, the row is the email, muted, and a text button at the right:

> nlovejoy@me.com &nbsp;&nbsp; Sign out

A long email is cut with an ellipsis before it pushes "Sign out" off the line.

On day one signing in changes nothing else, which would puzzle the first user, so under the row, signed in only, a caption (call):

> Your spots stay on this device for now.

It goes in pull request 2.

While the SDK is loading after a tap, the button reads "Signing in…" and is disabled; after Google answers, the row shows the email. While the SDK is loading at start-up on a device that signed in before, the row shows "…" so the page does not flash "Sign in with Google" at someone who is signed in.

A failure is a line under the row, in the notice style, until the next tap:

| What happened | The words |
|---|---|
| The user closed Google's window (`auth/popup-closed-by-user`, `auth/cancelled-popup-request`) | nothing; the row goes back to the button |
| The browser blocked the window (`auth/popup-blocked`) | The sign-in window was blocked. Allow pop-ups for this site and try again. |
| No network (`auth/network-request-failed`) | Could not reach Google. Check the connection and try again. |
| The page's host is not authorised (`auth/unauthorized-domain`) | This address is not set up for sign-in. |
| Anything else | Sign-in did not finish. Try again. (`<code>`) |
| The build has no Firebase config | Sign-in is not set up in this build. |

The last two carry the code or the fact in the sentence on purpose: they are for whoever is working on the app, and a hidden button would make a misconfigured production look like a choice.

Sign-out never fails visibly; if the SDK throws, the row goes back to signed out anyway and the next open will say the truth.

The shared-spot screen, the add screen, the edit screen, the month view and the help sheet do not get the row. Sign-in lives on the forecast page only.

## How it is built

**Config** (`src/data/firebaseConfig.ts`, pure, tested): the three names `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` from `import.meta.env`, and `authDomain` from `VITE_FIREBASE_AUTH_DOMAIN` or, unset, the page's own host. The spike's `spikeConfig` is this module; it moves and keeps its tests. Missing names give `{ ok: false, missing }`, which the adapter words as "not set up in this build".

**The adapter** (`src/data/firebase.ts`, framework-free, the only file that imports `firebase/*`):

- `watchUser(listener)`: starts the SDK, calls `listener` with `{ email } | null` on each change, returns the way to stop. Firebase's own persistence (IndexedDB, falling back to local storage) keeps the user between opens; the adapter does not store the user itself.
- `signIn()`: `signInWithPopup` with `GoogleAuthProvider`. Throws the SDK's error; the view words it.
- `signOut()`.
- Every call imports `firebase/app` and `firebase/auth` dynamically on first use, so the SDK is a chunk of its own that the forecast page does not load. Vite does this from the dynamic import; nothing else is needed.

**Whether to load at start-up** (`src/ui/accountView.ts`, pure, tested): a flag `tideline:account:seen` in `localStorage`, written when a sign-in succeeds and removed on sign-out. Set, the app starts the adapter at once and shows "…" until it answers; unset, the adapter is not touched until a tap. The flag is a hint, never the truth: if Firebase has no user the row shows the button and the flag is removed. If the SDK's chunk cannot be fetched at start-up (offline, or a home-screen app left open past a deploy), the row goes back to the button and keeps the flag; the next tap tries again and words the failure. The words for every state and every error code are in this module, with a test for each row of the table above.

An iPhone home-screen app has storage of its own, apart from Safari's, so a sign-in in Safari does not sign in the home-screen app and the other way round. Each signs in once and then remembers; the flag and Firebase's persistence are per app, as the saved spots already are.

**The hook** (`src/ui/useAccount.ts`, checked in a browser like the other hooks): state `{ kind: 'out' } | { kind: 'loading' } | { kind: 'in', email } | { kind: 'failed', words }` plus `signIn` and `signOut`, built on the adapter and `accountView`.

**The component** (`src/ui/Account.tsx`): arranges the hook's state into the row. No words of its own.

**The same-site handler** (`vercel.json`, tested in `src/data/vercel.test.ts`): `/__/auth/:path*` rewritten to `https://tideline-ibuild4you.firebaseapp.com/__/auth/:path*`. `main` has no `vercel.json` today, so this is the whole file; the test still asserts the rewrite sits ahead of any catch-all, for the day one is added. The spike's file and test, moved. Production's `VITE_FIREBASE_AUTH_DOMAIN` is `tideline.ibuild4you.com`, set on 2026-10-27, and that host is on Firebase's authorised domains and on the OAuth client with its handler URL.

**Where sign-in does not work, on purpose.** A pull request preview's host is not authorised and never will be (previews need a Vercel sign-in and are not where checks run), so a preview's button says "This address is not set up for sign-in." CI's build has no env and needs none: the config is read when the page runs, not when it is built. The dev server has the rewrite as a Vite proxy, `server.proxy['/__/auth']` to the Firebase host with `changeOrigin`, so `localhost:5173` is same-site too; `localhost` is on Firebase's authorised domains by default, whatever the port.

**The env example**: `.env.tpl` at the root, the owner's convention for a committed env file, with the four names, the project id and auth domain filled in (they are public and already in `vercel.json` and CLAUDE.md), the key and app id empty, and a comment that none is a secret and where each comes from. `.gitignore` ignores `.env*`, so it gains `!.env.tpl`. A developer copies it to `.env.local`, which stays ignored, and fills the two from the Vercel project's variables. The dev server then signs in with the real project through the proxy above.

**Styles**: `.account` row and `.account-email` in `src/styles.css`, in the caption's size and `--muted`, the button a `.text-button`. The contrast test covers nothing new since no colour is new.

**What is not touched**: `viewHistory` (no new view), the cache, saved spots, the build stamp, the help sheet.

## Tests

- `firebaseConfig.test.ts`: the three names, the host fallback, the override, the missing list (the spike's tests).
- `accountView.test.ts`: the words for each state; each error code's sentence; the flag read, write and remove with a stand-in storage; the start-up rule (flag set → load; unset → wait).
- `vercel.test.ts`: the rewrite exists, matches a `firebaseapp.com` host, and sits ahead of any catch-all.
- The adapter is not unit-tested: it is thin, and the SDK is real only in a browser. The spike was its test. The hook and the component are checked in a browser, as the others are.
- The SDK: `firebase` 13 (the spike's `^13.1.0`), modular imports from `firebase/app` and `firebase/auth` only, the SDK's default persistence (IndexedDB, falling back on its own). It is on the spike branch only; this pull request adds it to `main`.

## The production check, on the owner's iPhone, after the merge

All at https://tideline.ibuild4you.com, as the working agreement says.

1. Open the site in Safari. Under the spot's name, a line "Sign in with Google". The forecast draws as before. Pass: the Network tab, or the build's size, shows no firebase chunk loaded.
2. Tap it. Google's chooser; pick the account. Pass: the line becomes the email with "Sign out", and under it "Your spots stay on this device for now."
3. Reload. Pass: "…" for a moment, then the email, with no Google page.
4. Open the home-screen app. It has storage of its own, so it says "Sign in with Google". Tap it. Pass: Google's chooser over the app, and back in the app with the email, as the spike did. Close the app and open it again. Pass: the email, with no Google page.
5. Tap "Sign out". Pass: the line is "Sign in with Google" again; the spots are untouched.
6. Turn on Airplane Mode, tap "Sign in with Google". Pass: "Could not reach Google. Check the connection and try again." and the forecast still on screen.

## Calls made here, for the owner to check while reading

- The row's place: under the spot's line, above the chips, one line tall. Not in the title line, where a long email would fight the title.
- The button's words: "Sign in with Google", not "Sign in", since Google is the only way and the word prepares the user for Google's page.
- The day-one caption "Your spots stay on this device for now." and its removal in pull request 2.
- No sign-in on the shared-spot screen.
- The error sentences, and that the last two name the code or the missing config.
- The start-up flag `tideline:account:seen`, so a device that never signed in never loads the SDK.
- No redirect code.
- Each iPhone app, Safari and the home-screen one, signs in once of its own; the flag that loads the SDK at start-up is per app too.
- A preview says sign-in is not set up for its address, and that is left so.
- The dev server gets a Vite proxy for the handler path rather than a cross-site auth domain.
- A failed SDK load at start-up falls back to the button and keeps the flag.
