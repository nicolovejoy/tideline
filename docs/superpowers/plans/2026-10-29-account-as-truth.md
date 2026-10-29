# Spots in the account, the account as truth: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in user's spots live in one Firestore document that every device of theirs draws from live, with the device's list a copy; signed out, nothing changes.

**Architecture:** A pure module `src/data/accountDoc.ts` turns the document into a list and a change into a merge write; `src/data/firebase.ts` stays the only file that imports Firebase and gains read, write, change and watch on `users/{uid}` with the full Firestore SDK and offline persistence; a hook `src/ui/useAccountSpots.ts` does the first-sign-in combine, subscribes, and reports whether writes are pending; `App.tsx` applies each change to the device as today and, when signed in, to the account too.

**Tech Stack:** Vite, React, strict TypeScript, Vitest; `firebase/firestore` (full); Firestore emulator for the rules.

**Spec:** `docs/superpowers/specs/2026-10-29-account-as-truth-design.md`

## Global Constraints

- Code style: no semicolons, single quotes, relative imports with `.ts`/`.tsx`, `import type`, no enums. `npm run lint` and `npm run build` pass before every commit.
- Tests run with `TZ=Asia/Tokyo`; nothing here touches time.
- Components hold no arithmetic, rules or wording. Words go in `src/ui/accountView.ts`.
- `src/data/firebase.ts` is the only file that imports Firebase. The SDK stays in the `firebase` chunk.
- The device's mark is `tideline:spots:account:v2`. The document's keys are exactly `spots` (map), `order` (list), `updatedAt`.
- Captions: "Your spots are kept in your account." and "Your spots are on this device. They go to your account when it can be reached."
- Branch: `feat/account-as-truth` from `main`. The branch `feat/spots-in-account` is left as it is and never merged; its commit `c5cacd0` (rules, emulator tests, CI job) is cherry-picked in Task 1.
- Commit trailer: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Commit messages in the repo's style: a sentence saying what the change does, no `feat:` prefix.

## Review Focus

1. A document the mirror branch wrote, with `spots` a list and no `order`: `toList` reads it in that order, and the first sign-in rewrites it as a map (Task 2 test "reads a list-shaped document").
2. An `order` naming an id with no spot, and a spot missing from `order`: the list is `order`'s ids that have a spot, then the rest (Task 2 test "tolerates order and spots disagreeing").
3. A snapshot with no spots (a document cleared by hand): the screen and the device keep what they have, since the last spot cannot be removed (Task 5 test "an empty list is ignored" in the hook's pure helper `listFromSnapshot`).
4. A Spot carrying an `undefined` field (an older saved spot with no `elevationFt` key): Firestore refuses `undefined`; `toDoc` and the changes drop it (Task 2 test "drops undefined fields").
5. IndexedDB refused (private window): the adapter falls back to the memory cache and the page still signs in and syncs (Task 4, code step; checked by hand in a private window at the end).

---

### Task 1: Branch, rules for the map and the order, emulator tests

**Files:**
- Modify: `firestore.rules`
- Modify: `rules-tests/spots.rules.test.ts`
- Carried across by cherry-pick: `.github/workflows/ci.yml`, `.gitignore`, `firebase.json`, `rules-tests/*`

**Interfaces:**
- Produces: the rules the owner pastes; `users/{uid}` with `spots` a map, `order` a list, `updatedAt`.

- [ ] **Step 1: Branch and cherry-pick**

```bash
git checkout -b feat/account-as-truth main
git cherry-pick c5cacd0
cd rules-tests && npm ci && cd ..
```

- [ ] **Step 2: Write the failing rules tests**

Replace the list-shaped documents in `rules-tests/spots.rules.test.ts` with `{ spots: { a: { id: 'a' } }, order: ['a'], updatedAt: serverTimestamp() }` and add:

```ts
test('spots must be a map and order a list', async () => {
  const alice = env.authenticatedContext('alice').firestore()
  await assertFails(setDoc(doc(alice, 'users/alice'), { spots: [{ id: 'a' }], order: [], updatedAt: serverTimestamp() }))
  await assertFails(setDoc(doc(alice, 'users/alice'), { spots: {}, order: 'a', updatedAt: serverTimestamp() }))
})
test('a merge that sets one spot and deletes another is allowed', async () => {
  const alice = env.authenticatedContext('alice').firestore()
  await setDoc(doc(alice, 'users/alice'), { spots: { a: { id: 'a' }, b: { id: 'b' } }, order: ['a', 'b'], updatedAt: serverTimestamp() })
  await assertSucceeds(setDoc(doc(alice, 'users/alice'), { spots: { b: deleteField(), c: { id: 'c' } }, order: ['a', 'c'], updatedAt: serverTimestamp() }, { merge: true }))
})
test('no other key', async () => { /* a document with `extra: 1` fails */ })
```

- [ ] **Step 3: Run them to see the new ones fail**

Run: `cd rules-tests && npm test`
Expected: the map test fails (a list is still allowed).

- [ ] **Step 4: Change the rules**

In `firestore.rules`: `hasOnly(['spots', 'order', 'updatedAt'])`, `request.resource.data.spots is map`, `request.resource.data.order is list`.

- [ ] **Step 5: Run the rules tests**

Run: `cd rules-tests && npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add firestore.rules rules-tests/spots.rules.test.ts
git commit -m "The account's spots are a map by id with an order list"
```

---

### Task 2: The document's shape and each change, pure

**Files:**
- Create: `src/data/accountDoc.ts`
- Test: `src/data/accountDoc.test.ts`

**Interfaces:**
- Produces:
  - `ACCOUNT_KEY = 'tideline:spots:account:v2'`; `readCombined(): string | null`; `writeCombined(uid: string): void`; `clearCombined(): void` (each wrapped in try/catch as `savedSpots.ts` does).
  - `sameSpot(a: Spot, b: Spot): boolean` (same id, or same lat and lon to four decimals).
  - `combine(account: Spot[], device: Spot[]): Spot[]`: the account's in its order, then the device's that match none, leaving out the device's spots whose id is one of `SPOTS` (from `src/spot.ts`).
  - `type AccountDoc = { spots: Record<string, Spot>; order: string[] }`
  - `toDoc(list: Spot[]): AccountDoc`
  - `toList(data: unknown): Spot[] | null`: null when `data` is not an object or has no `spots`; otherwise `order`'s ids that have a spot `isSpot` accepts, then the remaining accepted spots in the map's own order; a `spots` that is an array is read as the list, filtered by `isSpot`.
  - `type SpotChange = { set: Record<string, Spot>; remove: string[]; order: string[] }`
  - `addChange(list: Spot[], spot: Spot): SpotChange`
  - `replaceChange(list: Spot[], id: string, next: Spot): SpotChange`: `next` in `id`'s place in the order (at the end when `id` is absent); `id` in `remove` when `next.id` differs.
  - `removeChange(list: Spot[], id: string): SpotChange`
  - Every Spot put in a doc or a change goes through `JSON.parse(JSON.stringify(spot))` so `undefined` fields are gone.

- [ ] **Step 1: Write the failing tests**

With three spots `A`, `B`, `C` built from a helper that satisfies `isSpot` (copy the shape `savedSpots.test.ts` uses), and `CAMPUS` being `SPOTS[0]`:

```ts
test('sameSpot by id or by point to four decimals', ...)   // id equal; lat 34.40621 vs 34.40624 equal; 34.4062 vs 34.4063 not
test('combine keeps the account first and adds the device's others', () => expect(combine([A], [B, A])).toEqual([A, B]))
test('combine does not add a starting spot from the device', () => expect(combine([A], [CAMPUS, B])).toEqual([A, B]))
test('toDoc and toList round-trip in order', () => expect(toList(toDoc([B, A]))).toEqual([B, A]))
test('toList is null with no document or no spots', ...)   // null; {}; { updatedAt: 1 }
test('tolerates order and spots disagreeing', () => expect(toList({ spots: { a: A, c: C }, order: ['c', 'zzz'] })).toEqual([C, A]))
test('reads a list-shaped document', () => expect(toList({ spots: [A, 7, B] })).toEqual([A, B]))
test('drops undefined fields', () => expect('elevationFt' in toDoc([{ ...A, elevationFt: undefined } as Spot]).spots[A.id]).toBe(false))
test('addChange', () => expect(addChange([A], B)).toEqual({ set: { [B.id]: B }, remove: [], order: [A.id, B.id] }))
test('replaceChange renames in place', () => expect(replaceChange([A, B], A.id, { ...A, name: 'x' })).toEqual({ set: { [A.id]: { ...A, name: 'x' } }, remove: [], order: [A.id, B.id] }))
test('replaceChange moves under a new id in place', () => expect(replaceChange([A, B], A.id, C)).toEqual({ set: { [C.id]: C }, remove: [A.id], order: [C.id, B.id] }))
test('replaceChange of an absent id adds at the end', ...)
test('removeChange', () => expect(removeChange([A, B], A.id)).toEqual({ set: {}, remove: [A.id], order: [B.id] }))
test('the mark is read, written and cleared', ...)        // localStorage, as savedSpots.test.ts does
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/data/accountDoc.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/data/accountDoc.ts`**

A header comment: the document's shape and the device's mark; nothing here touches the network or the SDK.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/data/accountDoc.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/accountDoc.ts src/data/accountDoc.test.ts
git commit -m "The account document's shape, each change to it, and the device's mark"
```

---

### Task 3: The first sign-in, pure

**Files:**
- Modify: `src/data/accountDoc.ts`
- Test: `src/data/accountDoc.test.ts`

**Interfaces:**
- Produces:
  - `type SpotStore = { read(uid: string): Promise<unknown>; write(uid: string, doc: AccountDoc): Promise<void>; change(uid: string, change: SpotChange): Promise<void>; watch(uid: string, onData: (data: unknown, pending: boolean) => void, onError: (error: unknown) => void): () => void }`
  - `openAccount(uid: string, store: SpotStore, device: () => Spot[]): Promise<boolean>`: when the mark is `uid`, resolves true at once with no store call. Otherwise reads; writes `toDoc(list)` where `list` is the device's when the account has no list or an empty one, else `combine(account, device())`; sets the mark; resolves true. Resolves false, mark unchanged, when the read or the write throws. Never throws.

- [ ] **Step 1: Write the failing tests**

With a fake store recording `written: AccountDoc[]` and a `read` that returns a given value or throws:

```ts
test('openAccount with the mark set reads nothing', ...)                // true; store.read not called
test('openAccount with no document writes the device list', ...)       // written[0] equals toDoc([A, B]); mark is uid
test('openAccount combines with the account winning', ...)             // account [C], device [CAMPUS, A] → written toDoc([C, A])
test('openAccount rewrites a list-shaped document as a map', ...)      // read returns { spots: [C] } → written[0].spots is { [C.id]: C }
test('openAccount is false and leaves the mark when the read fails', ...)
test('openAccount is false and leaves the mark when the write fails', ...)
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/data/accountDoc.test.ts -t openAccount`
Expected: FAIL.

- [ ] **Step 3: Implement `openAccount` and `SpotStore` in `src/data/accountDoc.ts`**

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/data/accountDoc.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/accountDoc.ts src/data/accountDoc.test.ts
git commit -m "What a device does with its spots the first time it signs in to an account"
```

---

### Task 4: The adapter, the uid, and the captions

**Files:**
- Modify: `src/data/firebase.ts`
- Modify: `src/ui/accountView.ts`, `src/ui/accountView.test.ts`, `src/ui/useAccount.ts`, `src/ui/feedbackView.test.ts` (the `Account` type gains `uid`; the mirror branch's diff of these four files, `git diff main..feat/spots-in-account -- <files>`, is the change to make)
- Modify: `src/data/savedSpots.ts`, `src/data/savedSpots.test.ts` (add `replaceSavedSpots(spots: Spot[]): boolean`, from the mirror branch's diff: writes the list and marks it seeded)
- Modify: `CLAUDE.md` Commands section is already right (`cd rules-tests && npm test`); nothing to do here.

**Interfaces:**
- Consumes: `SpotStore`, `AccountDoc`, `SpotChange` from Task 3.
- Produces:
  - `export const spotStore: SpotStore` in `src/data/firebase.ts`.
  - `AccountUser = { uid: string; email: string | null }`; `Account`'s `in` variant carries `uid`.
  - `spotsCaption(pending: boolean): string` in `src/ui/accountView.ts`: `WORDS.spotsUnsent` when pending, else `WORDS.spotsKept`.
  - `replaceSavedSpots(spots: Spot[]): boolean` in `src/data/savedSpots.ts`.

- [ ] **Step 1: Write the failing tests** for `spotsCaption` (two cases) in `accountView.test.ts` and `replaceSavedSpots` (writes the list, marks seeded, false when storage throws) in `savedSpots.test.ts`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/ui/accountView.test.ts src/data/savedSpots.test.ts`

- [ ] **Step 3: Implement the words, the uid and `replaceSavedSpots`** from the mirror branch's diffs.

- [ ] **Step 4: Implement `spotStore` in `src/data/firebase.ts`**

`ready()` also imports `firebase/firestore` and makes the db once: `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })` inside a try; on a throw, `initializeFirestore(app, { localCache: memoryLocalCache() })`. (`initializeFirestore` throws if called twice for one app; keep the db on `Ready` and make it once with the auth.) Type imports from `firebase/firestore`, as the auth's are from `firebase/auth`.

- `read`: `getDoc(doc(db, 'users', uid))`, `snap.exists() ? snap.data() : null`.
- `write`: `setDoc(ref, { ...doc, updatedAt: serverTimestamp() })`.
- `change`: `setDoc(ref, { spots: { ...change.set, ...Object.fromEntries(change.remove.map((id) => [id, deleteField()])) }, order: change.order, updatedAt: serverTimestamp() }, { merge: true })`.
- `watch`: `onSnapshot(ref, { includeMetadataChanges: true }, (snap) => onData(snap.exists() ? snap.data() : null, snap.metadata.hasPendingWrites), onError)`; starts after `ready()` resolves; returns a function that stops it whether or not the SDK has loaded, in the shape of `watchUser`. A `NotConfigured` or failed load calls `onError`.

- [ ] **Step 5: Run tests, lint, build**

Run: `npm test && npm run lint && npm run build`
Expected: PASS; the build log's `firebase` chunk line. Note its gzipped size (was 84.95 kB with lite) for the pull request.

- [ ] **Step 6: Commit**

```bash
git add src/data/firebase.ts src/ui/accountView.ts src/ui/accountView.test.ts src/ui/useAccount.ts src/ui/feedbackView.test.ts src/data/savedSpots.ts src/data/savedSpots.test.ts
git commit -m "Read, write, change and watch the account's spots in Firestore"
```

---

### Task 5: The hook and the app

**Files:**
- Create: `src/ui/useAccountSpots.ts`
- Create: `src/ui/accountSpots.ts` (pure helper), Test: `src/ui/accountSpots.test.ts`
- Modify: `src/App.tsx`, `src/ui/Account.tsx`

**Interfaces:**
- Consumes: `openAccount`, `toList`, `addChange`, `replaceChange`, `removeChange`, `clearCombined` (Tasks 2 and 3); `spotStore` (Task 4); `readSavedSpots`, `replaceSavedSpots`.
- Produces:
  - `listFromSnapshot(data: unknown): Spot[] | null` in `src/ui/accountSpots.ts`: `toList(data)`, but null when the list is empty (the screen keeps what it has).
  - `useAccountSpots(args: { uid: string | null; onList: (spots: Spot[]) => void }): { active: boolean; pending: boolean; apply: (change: SpotChange) => void }`.

- [ ] **Step 1: Write the failing test** `an empty list is ignored` and `a list is passed through` for `listFromSnapshot`; run; implement; run.

- [ ] **Step 2: Implement `useAccountSpots`**

One effect on `uid`:
- `uid` null: nothing to do; the cleanup of the last run already stopped the watch. Clear the mark when the previous run had a uid (keep the last uid in a ref): sign-out clears it, a page that starts signed out does not.
- `uid` set: `openAccount(uid, spotStore, readSavedSpots).then((ok) => { if (stopped) return; if (!ok) { setFailed(true); return } unsubscribe = spotStore.watch(uid, (data, pending) => { const list = listFromSnapshot(data); if (list) { replaceSavedSpots(list); onList(list) } setPending(pending); setActive(true) }, () => setFailed(true)) })`. Cleanup: `stopped = true; unsubscribe?.()`; reset `active`, `pending`, `failed`.
- `apply(change)`: when `active`, `spotStore.change(uid, change).catch((error) => console.error(error))`.
- Returns `pending: pending || failed`. `onList` is read through a ref so the effect does not rerun on each render, as `useSpotSync` did.

- [ ] **Step 3: Wire `App.tsx`**

- `const uid = account.account.kind === 'in' ? account.account.uid : null`
- `const accountSpots = useAccountSpots({ uid, onList: (list) => { setSpots(list); setSpot((prev) => { const same = list.find((s) => s.id === prev.id); if (same) return same; writeSpot(list[0]); return list[0] }) } })`. Not `selectSpot`: that closes the view.
- `saveSpot`: after today's device write, `accountSpots.apply(addChange(spots, next))`. `editSpot`: `accountSpots.apply(replaceChange(spots, spot.id, next))`. `removeSpot`: `accountSpots.apply(removeChange(spots, spot.id))`. `apply` is a no-op when not active, so no branch in the app.
- `<Account {...account} pending={accountSpots.pending} />`; `Account.tsx` renders `spotsCaption(pending)` as the mirror branch did with `unsent`.

- [ ] **Step 4: Run tests, lint, build**

Run: `npm test && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 5: Browser check, signed out, headless**

`npm run dev`, headless Edge with Playwright: the forecast draws, the spot row has three spots, Edit opens, a spot is added and removed, and no request goes to `firestore.googleapis.com` (read the network log). Screenshot under `.playwright-mcp/`. The signed-in path is the owner's production check; say so in the report.

- [ ] **Step 6: Commit**

```bash
git add src/ui/useAccountSpots.ts src/ui/accountSpots.ts src/ui/accountSpots.test.ts src/App.tsx src/ui/Account.tsx
git commit -m "A signed-in user's spots follow the account's document"
```

---

### Task 6: Docs and the pull request

**Files:**
- Modify: `CLAUDE.md` (Status: the "Then the spots in the account" sentence describes the mirror; rewrite it for this design. Stack: the Firestore sentences in the sign-in paragraph, lite → full with persistence, the chunk's new size. Next Steps: pull request 2's sentence.)
- Modify: `docs/superpowers/specs/2026-10-28-spots-in-account-design.md`: one line at the top, "Superseded by `2026-10-29-account-as-truth-design.md`."
- Add: `docs/superpowers/specs/2026-10-29-account-as-truth-design.md`, `docs/superpowers/plans/2026-10-29-account-as-truth.md` (this plan).

- [ ] **Step 1: Edit CLAUDE.md and the old spec; commit the docs**

- [ ] **Step 2: Push and open the pull request**

Body: the model in four lines, the chunk's size before and after, the note that a second account on one device combines the first's spots in, the owner's step (paste the rules, Publish, before merging) with the console URL, and the production check from the spec, verbatim. Say "Part of Stage B", not "closes". End with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

- [ ] **Step 3: Wait for CI**

Run: `gh pr checks --watch`
Expected: `CI` and `rules` both pass.
