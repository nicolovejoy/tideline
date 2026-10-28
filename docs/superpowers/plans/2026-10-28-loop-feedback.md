# Feedback through Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A floating "Feedback" button on the forecast and the shared-spot screen opens a sheet that posts a note to ibuild4you's Loop.

**Architecture:** ibuild4you's `payload.ts` and `capture.ts` are copied into `src/data/feedback/`; a small sender in `src/data/loop.ts` posts the payload with the fetch handed in; every word and the rules that pick them are in `src/ui/feedbackView.ts`; the sheet is a view in `src/ui/viewHistory.ts`, drawn by `src/ui/FeedbackSheet.tsx`, as the help sheet is.

**Tech Stack:** Vite, React 19, strict TypeScript, plain CSS, Vitest (Node, no DOM).

**Spec:** `docs/superpowers/specs/2026-10-28-loop-feedback-design.md`

## Global Constraints

- Code style: no semicolons, single quotes, relative imports carry their `.ts`/`.tsx` extension, type-only imports use `import type`, no enums. `npm run lint` (oxlint, then Prettier check) must pass; `npm run format` rewrites.
- Components hold no arithmetic, no rules and no wording. Words live in `src/ui/feedbackView.ts`.
- Endpoint `https://ibuild4you.com/api/feedback`; slug `tideline`. No env variable.
- Body cap 5,000 characters (`MAX_FEEDBACK_BODY_CHARS`). Send timeout 15 seconds.
- No new colour: the sheet and button use the existing tokens in `src/styles.css`; `src/chart/contrast.test.ts` stays as it is and passes.
- A check never posts to the real endpoint: browser checks intercept `https://ibuild4you.com/api/feedback`.
- Browser checks run headless Playwright with Edge (`channel: 'msedge'`); screenshots under `.playwright-mcp/`.
- Node 24: `source ~/.nvm/nvm.sh && nvm use` in a fresh shell.
- Each commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Offline or no answer: the note the user wrote stays in the box and the offline sentence shows. (Task 2 maps a rejected fetch to `unreachable`; Task 4's browser check aborts the route and checks the box still holds the text.)
2. A 429 without a usable `Retry-After` (missing, `abc`, a date): the sentence without a time, not "NaN minutes". (Task 2 parses only whole seconds; Task 3 tests `retryAfter: null`.)
3. Signed in with no email on the account (`{ kind: 'in', email: null }`): the field starts empty, not "null". (Task 3 test.)
4. Two taps on Send: one POST. (Task 4 disables Send while sending; the browser check counts requests.)
5. The sheet opened on a shared spot's screen and closed: the shared spot is still up, and the note carried the `?name=…&at=…` address. (Task 4 browser check.)

---

### Task 1: Loop's payload and capture, copied in

**Files:**
- Create: `src/data/feedback/payload.ts` (from `~/src/ibuild4you/lib/feedback/payload.ts`)
- Create: `src/data/feedback/capture.ts` (from `~/src/ibuild4you/lib/feedback/capture.ts`)
- Test: `src/data/feedback/payload.test.ts`

**Interfaces:**
- Produces: `type FeedbackType = 'bug' | 'idea' | 'other'`, `MAX_FEEDBACK_BODY_CHARS`, `FeedbackInput`, `FeedbackContext`, `FeedbackPayload`, `ValidationResult`, `validateFeedbackInput(input: FeedbackInput): ValidationResult`, `buildFeedbackPayload(input, ctx, capture?, identityAssertion?): FeedbackPayload` from `payload.ts`; `PageCapture`, `buildPageCapture(doc: Document, loc: { pathname: string }): PageCapture` from `capture.ts`. Same names and shapes as upstream.

- [ ] **Step 1: Copy both files.** Keep their logic and comments as upstream. In `payload.ts` replace `import type { FeedbackType } from '@/lib/types'` with `export type FeedbackType = 'bug' | 'idea' | 'other'`, and `import { normalizeEmail } from '@/lib/email/normalize'` with `const normalizeEmail = (e?: string | null) => (e ?? '').trim().toLowerCase()`; import `PageCapture` as `import type { PageCapture } from './capture.ts'`. Add a two-line comment at the top of each saying it is copied from ibuild4you's `lib/feedback/` and where the wire contract is (`~/src/ibuild4you/lib/feedback/README.md`), so a later copy is a diff. Run `npm run format`.

- [ ] **Step 2: Write the failing tests** in `payload.test.ts` (Vitest `describe`/`test`, as `src/ui/accountView.test.ts`):
  - `validateFeedbackInput({ projectId: 'tideline', type: 'bug', body: '   ' })` is `{ ok: false, field: 'body', … }`.
  - A body of 5,001 characters fails on `body`; 5,000 passes.
  - `submitterEmail: 'nope'` fails on `submitterEmail`; `''` and `'  '` pass.
  - `buildFeedbackPayload({ projectId: ' tideline ', type: 'idea', body: '  hi  ', submitterEmail: ' A@B.co ' }, { pageUrl: 'https://tideline.ibuild4you.com/?name=X&at=1,2', userAgent: 'UA', viewport: '390x844', renderedAt: 1000 })` equals `{ projectId: 'tideline', type: 'idea', body: 'hi', submitterEmail: 'a@b.co', pageUrl: 'https://tideline.ibuild4you.com/?name=X&at=1,2', userAgent: 'UA', viewport: '390x844', website: '', _ts: 1000 }`: the query is kept.
  - With `submitterEmail: ''` the payload has no `submitterEmail` key; with a capture `{ v: 1, route: '/', title: 'Tideline', outline: 'h1: Tideline' }` it carries `capture`.

- [ ] **Step 3: Run** `npx vitest run src/data/feedback/payload.test.ts`. Expected: PASS (the copy is the implementation; a failure means the copy or the inlining is wrong).

- [ ] **Step 4: Run** `npm run lint && npm run build`. Expected: both clean; `capture.ts` type-checks under strict mode (fix only typing, not behaviour).

- [ ] **Step 5: Commit** `git add src/data/feedback && git commit -m "Copy Loop's payload and page capture from ibuild4you"` with the trailer.

### Task 2: Sending a note

**Files:**
- Create: `src/data/loop.ts`
- Test: `src/data/loop.test.ts`

**Interfaces:**
- Consumes: `FeedbackPayload` from `src/data/feedback/payload.ts`.
- Produces:
  - `export const LOOP = { endpoint: 'https://ibuild4you.com/api/feedback', projectId: 'tideline' } as const`
  - `export type SendResult = { kind: 'sent' } | { kind: 'refused'; status: number; retryAfter: number | null } | { kind: 'unreachable' }` (`retryAfter` in seconds)
  - `export async function sendFeedback(payload: FeedbackPayload, fetchImpl: typeof fetch = fetch): Promise<SendResult>`

- [ ] **Step 1: Write the failing tests** with a stand-in fetch (`vi.fn` resolving `new Response(...)`):
  - It posts once to `LOOP.endpoint`, method `POST`, header `Content-Type: application/json`, body `JSON.stringify(payload)`, with a `signal`.
  - 201 `{"id":"x"}` → `{ kind: 'sent' }`; 200 `{"ok":true}` (the honeypot) → `{ kind: 'sent' }`.
  - 429 with `Retry-After: 120` → `{ kind: 'refused', status: 429, retryAfter: 120 }`; with no header, with `abc`, and with `Wed, 21 Oct 2026 07:28:00 GMT` → `retryAfter: null`.
  - 404 → `{ kind: 'refused', status: 404, retryAfter: null }`; 500 → status 500.
  - A fetch that rejects (`new TypeError('Failed to fetch')`, and a `DOMException` named `TimeoutError`) → `{ kind: 'unreachable' }`.

- [ ] **Step 2: Run** `npx vitest run src/data/loop.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement** `sendFeedback` in `src/data/loop.ts`: `signal: AbortSignal.timeout(TIMEOUT)` with `const TIMEOUT = 15_000`, as `src/data/usgs.ts` does; `Retry-After` counts only when it is all digits. A header comment in the voice of `src/data/usgs.ts` says what Loop is and links the wire contract.

- [ ] **Step 4: Run** `npx vitest run src/data/loop.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** `git add src/data/loop.ts src/data/loop.test.ts && git commit -m "Send a note to Loop and say what came of it"` with the trailer.

### Task 3: The sheet's words, and the sheet as a view

**Files:**
- Create: `src/ui/feedbackView.ts`
- Test: `src/ui/feedbackView.test.ts`
- Modify: `src/ui/viewHistory.ts:1-9` (the comment, `View`, `VIEWS`)
- Modify: `src/ui/viewHistory.test.ts` (next to the `'help'` case at line 53)

**Interfaces:**
- Consumes: `SendResult` from `src/data/loop.ts`; `ValidationResult`, `FeedbackType` from `src/data/feedback/payload.ts`; `Account` from `src/ui/accountView.ts`.
- Produces:
  - `export const WORDS` (`as const`) with exactly: `button: 'Feedback'`, `title: 'Send feedback'`, `close: 'Close'`, `bodyLabel: 'What happened, or what would help'`, `emailLabel: 'Email, if you would like an answer'`, `emailHint: 'Signed in, this is filled in for you.'`, `capture: 'Include an outline of this screen'`, `captureMore: 'What is sent'`, `address: "The page's address goes with it, and for a shared spot that is its name and place."`, `send: 'Send'`, `sending: 'Sending…'`, `sent: 'Sent. Thank you.'`, `another: 'Send another'`.
  - `export const TYPES: readonly { value: FeedbackType; words: string }[]` = Bug, Idea, Other in that order.
  - `export function failureWords(result: SendResult, online: boolean): string | null` — null for `sent`.
  - `export function invalidWords(result: ValidationResult): string | null` — null for `ok`.
  - `export function initialEmail(account: Account): string`
  - `'feedback'` added to `View` and `VIEWS`.

- [ ] **Step 1: Write the failing tests.**
  - `failureWords({ kind: 'unreachable' }, false)` is `'Could not reach the feedback service. Check the connection and try again.'`; with `true`, `'Could not reach the feedback service. Try again in a moment.'`.
  - 429 with `retryAfter` 120 → `'Too many notes from here. Try again in 2 minutes.'`; 121 → `'… in 3 minutes.'`; 30 and 60 → `'… in 1 minute.'`; `null` → `'Too many notes from here. Try again later.'`.
  - 404 → `'Feedback is not set up for Tideline yet.'`; 400 and 500 → `'Could not send. Try again.'`; `sent` → `null`.
  - `invalidWords` for field `body` → `'Write a note first.'` (the too-long case cannot happen, the box caps it, so the same sentence); `submitterEmail` → `'That email does not look right.'`; `projectId` and `type` → `'Could not send. Try again.'`; `{ ok: true }` → `null`.
  - `initialEmail({ kind: 'in', email: 'a@b.co' })` is `'a@b.co'`; `{ kind: 'in', email: null }`, `{ kind: 'out' }`, `{ kind: 'loading', tapped: false }`, `{ kind: 'failed', words: 'x' }` are `''`.
  - `viewHistory.test.ts`: `viewOf(entryFor('feedback'))` is `'feedback'`.

- [ ] **Step 2: Run** `npx vitest run src/ui/feedbackView.test.ts src/ui/viewHistory.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** `src/ui/feedbackView.ts` with the words above and the three functions; add `'feedback'` to `View`, `VIEWS` and the comment at the top of `viewHistory.ts`.

- [ ] **Step 4: Run** `npm test`. Expected: all pass.

- [ ] **Step 5: Commit** `git add src/ui/feedbackView.ts src/ui/feedbackView.test.ts src/ui/viewHistory.ts src/ui/viewHistory.test.ts && git commit -m "The feedback sheet's words and its place in the history"` with the trailer.

### Task 4: The button, the sheet, and the docs

**Files:**
- Create: `src/ui/FeedbackButton.tsx`, `src/ui/FeedbackSheet.tsx`
- Modify: `src/ui/Account.tsx` (takes the hook's result as props instead of calling `useAccount()`)
- Modify: `src/App.tsx` (calls `useAccount()` once; passes it to `<Account>`; draws the button and the sheet)
- Modify: `src/styles.css` (after the `.sheet-section` rules near line 366; the foot padding)
- Modify: `CLAUDE.md` (Status, Stack, the plain-modules list, Next Steps)

**Interfaces:**
- Consumes: everything from Tasks 1 to 3; `openView`, `closeView`, `useView` from `src/ui/useView.ts`; `useAccount` from `src/ui/useAccount.ts`.
- Produces: `FeedbackButton({ onOpen }: { onOpen: () => void })`; `FeedbackSheet({ email, onClose }: { email: string; onClose: () => void })`; `Account(props: ReturnType<typeof useAccount>)`.

- [ ] **Step 1: The account hook moves up.** `Account` takes `{ account, signIn, signOut, warm }` as props, nothing else in it changes. `App` calls `useAccount()` at the top and passes it on.

- [ ] **Step 2: `FeedbackSheet.tsx`.** Shape and behaviour as `src/ui/HelpSheet.tsx` (backdrop, `role="dialog"`, `aria-modal`, heading focused, Escape and backdrop close, body not scrolling), with `data-loop-redact=""` on the backdrop. State: type (`'bug'`), body, email (from the `email` prop at mount), honeypot, capture ticked, status `'idle' | 'sending' | 'sent'`, the sentence shown. `renderedAt` is `Date.now()` at mount. On Send: `invalidWords(validateFeedbackInput(…))`, and if there is a sentence show it and stop; otherwise `buildFeedbackPayload` with `pageUrl: window.location.href`, `userAgent: navigator.userAgent`, `viewport: \`${window.innerWidth}x${window.innerHeight}\``, `buildPageCapture(document, window.location)` when ticked, and the honeypot's value as `website`; `sendFeedback`; then `failureWords(result, navigator.onLine)`. The body is cleared only on sent. Send is `disabled` while sending. The note's `<textarea>` has `maxLength={MAX_FEEDBACK_BODY_CHARS}`. The type buttons use `aria-pressed` and the span buttons' look (`.span-choice`); the inputs use the `.field` styles; the honeypot is the upstream widget's off-screen `website` input with `tabIndex={-1}`, `autoComplete="off"`, `aria-hidden="true"`. "What is sent" is a `<details>` whose `<pre>` is filled from `buildPageCapture` when opened. The email hint shows only when `email` was `''` at mount. Every string from `WORDS` and `TYPES`.

- [ ] **Step 3: `FeedbackButton.tsx` and `App.tsx`.** The button: `type="button"`, class `feedback-button`, `data-loop-redact=""`, text `WORDS.button`, `onClick={onOpen}`. In `App`, the forecast branch draws `<FeedbackButton>` when `view === null` and `<FeedbackSheet>` when `view === 'feedback'`; the shared-spot branch draws the same two the same way. `onOpen` is `() => openView('feedback')`, `onClose` is `closeView`, `email` is `initialEmail(account)`.

- [ ] **Step 4: Styles.** `.feedback-button`: `position: fixed`, `right: max(1rem, env(safe-area-inset-right))`, `bottom: max(1rem, env(safe-area-inset-bottom))`, `z-index: 5` (under the backdrop's 10), `min-height: 44px`, pill radius, `border: 1px solid var(--sea)`, `background: var(--ground)`, `color: var(--ink)`, a `:focus-visible` outline as `.text-button`'s. Pad the bottom of `main` by the button's height so the build stamp is clear of it. The form's controls stack with a gap, full width of the sheet; the error sentence uses `.notice`.

- [ ] **Step 5: Run** `npm run lint && npm test && npm run build`. Expected: clean, all pass (contrast test included).

- [ ] **Step 6: Browser check**, headless Playwright with Edge against `npm run dev`, every POST to `https://ibuild4you.com/api/feedback` routed to a stand-in, screenshots under `.playwright-mcp/`:
  1. Phone width 390×844 on `/`: the button at the bottom right; scrolled to the end, the build stamp is not under it. Tap it: the sheet, Bug pressed, the email field empty with the hint.
  2. Send with an empty note: "Write a note first." and no request.
  3. Write "Loop smoke test", wait 2 seconds, the route answering 201: one request whose JSON has `projectId: 'tideline'`, `type: 'bug'`, `body: 'Loop smoke test'`, `website: ''`, a `capture` with no "Loop smoke test" in its outline; the sheet says "Sent. Thank you.". Double-click Send on a second note with a route that waits 1 second: one request.
  4. Route aborted (`route.abort('internetdisconnected')`): the "Could not reach…" sentence and the note still in the box. Route answering 429 with `Retry-After: 120`: "Try again in 2 minutes.".
  5. Escape closes the sheet; going back (`page.goBack()`) after opening it closes it and the page is still Tideline. Opening the month view: no button.
  6. `/?name=Hendry%27s+Beach&at=34.4026%2C-119.7437`: the shared screen has the button; a sent note's `pageUrl` carries `name=` and `at=`; after Close the shared screen is still up.
  7. Width 1,200: the button clear of the 14-day column's rows' text at the end of the page.

- [ ] **Step 7: CLAUDE.md.** Status: one sentence after the sign-in sentence, "Then feedback through ibuild4you's Loop (2026-10-28): …" naming the button, the sheet, `src/data/loop.ts`, `src/ui/feedbackView.ts`, and the spec and plan paths. Stack: "The browser calls NOAA and NWS directly" gains "and ibuild4you's Loop for feedback". Add `src/data/loop.ts`, `src/data/feedback/payload.ts` and `src/ui/feedbackView.ts` to the plain-modules list, and `capture.ts` to the untested-by-design list in Next Steps. Under Data sources, a short **ibuild4you Loop** entry: the endpoint, the slug, CORS open, the honeypot and the 2-second-to-24-hour `_ts` window, 20 an hour per IP, the inbox URL.

- [ ] **Step 8: Run** `npm run lint`. Expected: clean.

- [ ] **Step 9: Commit** `git add -A src CLAUDE.md && git commit -m "A Feedback button and sheet that send a note through Loop"` with the trailer.
