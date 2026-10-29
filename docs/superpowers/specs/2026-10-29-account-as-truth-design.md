# Spots in the account: the account is the truth

Replaces `2026-10-28-spots-in-account-design.md` and the branch `feat/spots-in-account`, which built a hand-written two-way mirror. That design and its branch were never merged, so the file named here is not on `main`. The owner decided on 2026-10-29 that the mirror was the wrong trade: 470 lines of sync logic to avoid 100 kB of SDK that does the same job.

## Intent

A signed-in user's spots follow them between devices. One person, two phones; nothing social (the Stage B decisions of 2026-10-18 stand).

## The model (owner)

- Signed out: the device's list in `localStorage`, exactly as today. Nothing changes for a user who never signs in.
- Signed in: the account's document in Firestore is the truth, and the screen draws from Firestore's live snapshot of it. A change is a write to Firestore. The SDK's offline persistence queues writes made offline and sends them when it can; the snapshot says whether anything is still pending.
- The device's list is kept as a copy of the latest snapshot while signed in, so a sign-out leaves the spots where they were and the page draws at once on the next open before the snapshot arrives.
- Conflicts: last writer wins per field. Spots are a map keyed by id, so two phones editing different spots merge, and a removal is a field delete that nothing resurrects.

## Where it lives

Firestore project `tideline-ibuild4you`, database `(default)` in `nam5`, one document `users/{uid}`:

```
spots:     map of id -> Spot (the saved-spot record, as `isSpot` accepts it)
order:     list of ids, the row's order, first to last
updatedAt: server timestamp
```

`order` is written whole on every change; `spots` is updated by field path (`spots.<id>` set or deleted) so unrelated edits merge. An id in `order` with no entry in `spots`, or the other way round, is tolerated on read: the list is `order`'s ids that have a spot, then any spot not in `order`. The rule that the last spot cannot be removed holds on each device as it does today.

## Rules

`firestore.rules`, as on the mirror branch, with the keys `spots`, `order`, `updatedAt`: read and write by the owner only, `spots` a map, `order` a list. The emulator tests in `rules-tests/` come across and are extended for the map and the order. The owner pastes the rules into the console before merging, as before.

## First sign-in on a device

The one moment with two lists. The device keeps the mark `tideline:spots:account:v1` with the uid it has been combined into.

- Mark is not this uid: read the account once. No document, or no spots: the device's list goes up as the account's. Otherwise combine with the account winning: the account's spots in its order, then the device's spots that match none of them, where a match is the same id or the same point to four decimals; the three starting spots are not added from the device, since the account's owner may have removed them. Write the result, set the mark, and start the snapshot.
- Mark is this uid: start the snapshot.

`combine` and `sameSpot` from the mirror branch's `accountSpots.ts` survive, with their tests. Nothing else of that module does: no unsent mark, no seen list, no send.

If the first read or write fails, the row says the spots are on this device, the snapshot is not started, and the next open tries again. The device's list stays as it was.

## Every moment after

- The snapshot's list replaces the screen's and the device's copy. If the chosen spot is gone, the first of the list is chosen. A view that is open stays open.
- Add, rename, move, remove: one write to Firestore (`spots.<id>` and `order`, in one `updateDoc`). The screen is not set from the write; it follows the snapshot, which fires at once from the local cache with `hasPendingWrites` true and again when the server confirms.
- Sign-out: stop the snapshot, keep the device's copy, clear the mark.
- A second account on the same device: its first sign-in combines the device's copy, the first account's spots among them, into the second. Known and accepted, as before.

## What the user sees

The row under the email, as on the mirror branch:

- "Your spots are kept in your account." when the snapshot has no pending writes.
- "Your spots are on this device. They go to your account when it can be reached." while it has, or when the first sign-in's read or write failed.

No spinner, no other new words. A permission or quota failure is not told apart in the words (deferred, as before).

## The code

- `firebase/firestore` (full, not lite) with `initializeFirestore` and `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`, in the `firebase` chunk. The adapter in `src/data/firebase.ts` stays the only file that imports Firebase: `read(uid)`, `write(uid, doc)`, `update(uid, changes)`, `watch(uid, onList, onError)` returning an unsubscribe. The chunk grows by about 100 kB gzipped; the build log says by how much and the pull request records it.
- A pure module `src/data/accountDoc.ts`: the document's shape to and from a list (`toList`, `toDoc`), the update for each change (`addUpdate`, `renameUpdate`, `moveUpdate`, `removeUpdate`), `combine`, `sameSpot`, the mark. All tested.
- A hook `src/ui/useAccountSpots.ts`: the first-sign-in step, the subscription, the pending flag. It owns no list arithmetic. Checked in a browser.
- `App.tsx` routes add, edit and remove to the hook when signed in and to `savedSpots.ts` when not. The hook also keeps the device's copy in step.
- `savedSpots.ts` gains `replaceSavedSpots` (from the mirror branch).
- `useAccount.ts` carries the uid (from the mirror branch).

## Calls made after the builder check (the designer's, not the owner's)

- Every write is `setDoc` with `merge: true` and `deleteField()` for a removal, never `updateDoc`, so a document that is missing is made by the first change and the rules need only one `write` clause.
- The device's mark is `tideline:spots:account:v2`. A device that carried the mirror branch's v1 mark combines again, and a document the mirror branch wrote in list shape (`spots` a list) is read by `toList` as a list in that order and rewritten as a map by the first sign-in's `setDoc`. The owner has nothing to delete by hand.
- The new spot is chosen at once, as today. The snapshot's rule, "first of the list when the chosen spot is gone", runs only against a snapshot that lacks the chosen id, and the local write is in the next snapshot, so it never flips the user off a spot they just added or moved.
- A write the server rejects is reverted by the snapshot and logged to the console. No words for it; deferred with the quota and permission words.
- The caption follows `hasPendingWrites` alone. A snapshot from the cache with nothing pending is the account's list, and "kept in your account" is true.
- `toDoc` drops `undefined` fields (Firestore refuses them); `toList` keeps only entries `isSpot` accepts and drops the rest, so one damaged entry never stops the list from drawing.
- Persistence is tried and, where IndexedDB refuses it, the memory cache is used, so a private window still works and only loses queued offline writes on reload. No change to `vercel.json`: Firestore is called directly with CORS, as auth is.

## Not in this pull request

- A quota or permission failure worded as itself.
- Anything on the shared-spot screen.
- Ids from coordinates.

## Owner's steps

1. Before merging: paste `firestore.rules` into https://console.firebase.google.com/project/tideline-ibuild4you/firestore/rules and Publish.
2. After merging, the production check.

## The production check, after the merge

At https://tideline.ibuild4you.com, pass or fail per step:

1. In Safari on the iPhone, signed in already: the caption under the email says "Your spots are kept in your account." and the spot row is as it was.
2. In https://console.firebase.google.com/project/tideline-ibuild4you/firestore/data: a document under `users` with a `spots` map and an `order` list holding those spots.
3. In Safari, add a spot (search "Hendry's Beach", Save). Open the home-screen app, signing in if asked. Pass: Hendry's Beach is in its row within a second or two.
4. In the home-screen app, remove Hendry's Beach. Rename another spot. Switch back to Safari. Pass: Hendry's Beach is gone and the rename shows.
5. In Safari, remove the renamed spot. Switch to the home-screen app. Pass: it is gone there too (the removal that the mirror design could have undone).
6. Turn on Airplane Mode, add a spot in the home-screen app. Pass: the caption says the spots are on this device. Turn Airplane Mode off. Pass: within a few seconds the caption is back to "kept in your account", and Safari shows the new spot.
7. Sign out. Pass: the spots stay.
