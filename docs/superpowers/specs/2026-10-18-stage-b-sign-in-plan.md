# Stage B: sign-in and a user's own spots. The plan

Written 2026-10-18, after the owner relayed the brief's decisions and prompt-lab answered the stack questions (handoff channel `tideline-prompt-lab.md`, entries of 2026-10-17 and 2026-10-18). This is the plan to approve; the build spec follows the spike.

## What is decided

From the brief, settled with the first user in person on 2026-10-15 (recorded under Decisions in `CLAUDE.md`):

- Google sign-in only.
- Sign-in is needed only for a user's own spots. Everything else stays open: the three starting spots, the forecast, the month view, shared links.
- A phone's spots move to the account on first sign-in.
- Sharing stays a link that carries the exact coordinates, opens without an account, with no re-share controls and no revocation. There are no social features and no friend graph, and nothing is designed for them.
- Photos are roadmap, not this stage. No object storage.

Still open: the first user's opinion on the stack, asked through the ibuild4you handoff on 2026-10-18. Sign-in does not ship before he answers. The console work and the spike below do not ship anything, so they can go ahead.

## The stack, settled with prompt-lab

- **Firebase Auth** for Google sign-in and **Firestore** for spots, both called from the browser behind security rules. The app stays a static Vite page on Vercel with no server. This is how MusicForge, ibuild4you and invitekit already work; the Neon and Turso apps all sit behind server routes Tideline does not have.
- **One Firebase project for Tideline**, made by hand in the owner's Google Cloud account, as every app in the ecosystem has its own. One project is enough until previews write real data.
- **The auth handler served from our own domain.** WebKit partitions storage by top-level site, so a popup that returns through `<project>.firebaseapp.com` cannot read the state the SDK wrote on `tideline.ibuild4you.com` and fails with "missing initial state". All three Firebase apps fix it the same way: `authDomain` is the app's own host and Vercel rewrites `/__/auth/:path*` to `https://<project>.firebaseapp.com/__/auth/:path*`, ahead of any catch-all. MusicForge has the pattern (`frontend/src/authDomain.ts`, `frontend/vercel.json`) and a test that the rewrite comes first.
- **Popup sign-in**, as all three apps use. Redirect is the fallback if the spike says so.
- **Layout `users/{uid}/spots/{spotId}`**, owner-only read and write on the spots, a catch-all deny, nothing private on the parent document (rules do not cascade; MusicForge's `firestore.rules` has the comment). A later `sharedWith` field and a collection-group query would give account-based sharing from this layout, so it closes no door. Noted for the pull request as the decisions ask; not built.
- **Rules tested in the emulator**, copied whole from MusicForge's `rules-tests/` package: `@firebase/rules-unit-testing` on Vitest, `firebase emulators:exec --only firestore --project demo-tideline`, a separate CI job with Java 21. The `demo-` id keeps the emulator off the real project.
- **Config in Vercel env** (`VITE_FIREBASE_*`), with a committed example listing the names. Firebase's web config is not secret. No 1Password item until a server job needs a service account, which is a later stage.
- **Not Garm.** It answers roles between people and retires in January 2027.
- **Testing** in the app's own style: the merge and dedupe logic pure and tested on arrays; the Firestore adapter thin, covered by the emulator rules tests; the SDK mocked only for the sign-in button's states.

## The owner's console steps

In this order. Each is a few minutes. The handler URL registration is the one that must come before the auth domain switch, or every sign-in breaks (ibuild4you's preview bug of 2026-07-11, MusicForge's comment in capitals).

1. **Firebase project.** https://console.firebase.google.com, Add project. Pick the id with care: it goes into the rewrite destination `<id>.firebaseapp.com` and cannot change. Google Analytics off. The Spark plan is enough to start; note that ibuild4you hit Spark's 50,000 reads a day on 2026-05-12 and lost twelve hours because the quota error reported as an auth error. Tideline reads a handful of documents per open, so Spark holds for a long time, but the app must word a quota failure as what it is.
2. **Web app.** Project settings, Your apps, Add app, Web. Nickname "Tideline". No Firebase Hosting. Copy the config: `apiKey`, `authDomain`, `projectId`, `appId`. The rest is not needed.
3. **Google provider.** Build, Authentication, Get started, Sign-in method, Google, Enable. Set the support email. This creates an OAuth client in the Google Cloud project behind the scenes.
4. **Authorised domains.** Authentication, Settings, Authorised domains: add `tideline.ibuild4you.com`, and the spike's host from step 7 when there is one.
5. **The handler URL on the OAuth client.** https://console.cloud.google.com, the same project, APIs & Services, Credentials, the OAuth 2.0 client named "Web client (auto created by Google Service)". Under Authorised JavaScript origins add `https://tideline.ibuild4you.com`. Under Authorised redirect URIs add `https://tideline.ibuild4you.com/__/auth/handler`. Both; the origin alone is not enough. Add the spike's host the same way.
6. **Vercel env for the Tideline project**, Production and Preview: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` from step 2, and `VITE_FIREBASE_AUTH_DOMAIN` set to `tideline.ibuild4you.com` for Production. Nothing here is a secret, but it is still set in Vercel and not committed, so the repo stays free of project ids.
7. **A home for the spike.** Pull request previews need a Vercel sign-in, which an iPhone home-screen app cannot do. Two ways: turn Deployment Protection off for previews on the Tideline project for the spike's week, or make a second Vercel project from the same repo, `tideline-spike`, with no protection, at its own `.vercel.app` host. The second keeps production's settings untouched and is the one this plan assumes. Its host goes into steps 4 and 5 and its `VITE_FIREBASE_AUTH_DOMAIN` is that host.

## The spike: sign-in from the iPhone home screen

Nobody in the ecosystem has written down a sign-in from inside an iPhone home-screen web app with either flow. MusicForge's installed app is in use on an iPad, but whether sign-in was done in standalone mode is not recorded. The spike is the first evidence and it decides the build.

- **What it is.** A branch with the Firebase SDK, the same-site handler rewrite in a new `vercel.json`, and one throwaway page with a "Sign in with Google" button by popup, a second button by redirect, and a line that prints the signed-in email and whether the page is in standalone mode (`display-mode: standalone`). Nothing else of the app changes; the branch never merges.
- **The check, on the owner's iPhone.** Open the spike host in Safari, add it to the home screen, open it from there. Tap the popup button. Pass: Google's page appears, the account is chosen, control returns to the home-screen app and the email prints. Fail: the app is left behind, Safari opens, or the email never prints. Then the redirect button, same pass and fail. Also once in plain Safari, which should pass either way.
- **What it decides.** Popup passes: build with popup as the three apps do. Only redirect passes: build with redirect. Neither passes in standalone mode: sign-in is done in Safari and the home-screen app reads the session, which needs a design pass of its own before the spec.
- **Half a day**, plus the console steps.

## The build, after the spike and the first user's answer

Four pull requests, each reviewed and checked on production as the working agreement says. The spec that comes before the first of them names the words on every screen; this plan names the pieces.

1. **Sign in and out.** The Firebase adapter (`src/data/firebase.ts`, framework-free, the SDK loaded only when sign-in is touched so the forecast page does not pay for it), a "Sign in" button in the header and the signed-in email with "Sign out", the same-site handler rewrite, the env names in an example file, and a test that the rewrite sits ahead of any catch-all. No data moves yet.
2. **Spots in the account.** `users/{uid}/spots/{spotId}` with owner-only rules, the `rules-tests` package and its CI job, and the app reading and writing a signed-in user's spots there, with the device's cache of forecasts unchanged. Signed out, the app is exactly what it is today.
3. **The merge on first sign-in.** Each spot's document id is deterministic from its rounded coordinates (four decimals, about 11 m), so the upload is an idempotent set per spot: a second device lands the same spot on the same id and keeps the server's name, a spot with a different id is added, and the device's list is cleared only after every write succeeds, so a half-finished upload simply runs again. The three starting spots upload like any other, since after pull request 89 they are the user's. The logic is pure and tested on arrays, including duplicates and a second device.
4. **The edges.** What a signed-in user sees on a device with no network; a quota or permission failure worded as what it is, never as a sign-in failure; sign-out leaving the device's list empty and the three starting spots seeded again; and a shared link, which stays what it is today for everyone.

## Not in this stage

Apple or Facebook sign-in; account-based sharing, friends, anything social; photos and object storage; a server function of any kind; a preview Firebase project; forecast history (issue 11, which will want Neon or Turso behind a scheduled job with a freshness alarm, by prompt-lab's advice, and is a design of its own).

## Open

1. The first user's opinion on the stack. Through ibuild4you; sign-in does not ship before it.
2. The spike's result on the iPhone home screen.
3. Spark or Blaze. Spark to start, with the quota failure worded correctly; Blaze when reads grow or a server job comes.
