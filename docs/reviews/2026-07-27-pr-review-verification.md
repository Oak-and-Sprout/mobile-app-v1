# Verification of the 2026-07-27 agent review

Scope: sprout-track PR **#251** (`feat-icon-badges-in-timeline`) and PR **#234**
(`feature/native-aware-layer`). The outer `mobile-app-v1` repo has **no open PR** —
every reported finding lands in sprout-track.

Baseline at time of verification: `npm test` green in both repos
(sprout-track 951/951, shell 426/426).

> Note: the review's cited artifact `reviews/2026-07-27/review.md` does not exist in
> either working tree. The "5 medium, 10 low not shown" could not be checked.

## Accuracy scorecard

| # | Finding | Verdict | Notes |
|---|---------|---------|-------|
| 1 | PNG icons render at intrinsic size on Full Log | **Confirmed** | Severity if anything understated |
| 2 | PNG swap only sized for TimelineV2 | **Confirmed** | Same defect as #1, restated |
| 3 | Relock gate's 60s unlock window | **Confirmed** | Understated — should be HIGH |
| 4 | Reset/verify tokens moved to query string | **Confirmed** | Proposed fix is weaker than available |
| 5 | PWA docs describe pre-rewrite design | **Confirmed** | Worse than reported (3 stale claims) |
| 6 | Preferences route comments narrate review rounds | **Confirmed** | Cosmetic, accurate |
| 7 | Stale `caretakerId` survives family switch | **Confirmed, impact overstated** | No cross-family leak |
| 8 | Web-push throw skips native push in `timerCheck` | **Confirmed** | Under-scoped — two call sites, not one |
| 9 | Shell session fragment accepted on any family load | **Mechanically true, exploitability overstated** | |
| 10 | APNs opens a TLS connection per push | **Confirmed** | Provider JWT *is* cached; only the socket isn't |

**10/10 describe real code.** No hallucinated files, lines, or APIs. Two are
mis-severitised (one low, one high), one is two entries for one defect.

---

## Evidence

### #1 / #2 — PNG icons at intrinsic size (PR #251) — CONFIRMED

`src/components/Timeline/utils.tsx` adds:

```tsx
const pngIcon = (src: string) => (
  <img src={src} alt="" aria-hidden="true" className="timeline-png-icon" />
);
```

`.timeline-png-icon { width: 100%; height: 100%; object-fit: contain; }` lives in
`src/components/Timeline/timeline-activity-list.css`. That resolves only against a
parent with a resolved size. Three consumers call `getActivityIcon`:

| Consumer | Wrapper classes | Sized? |
|---|---|---|
| `Timeline/TimelineV2/TimelineV2ActivityList.tsx:304` | `.event-icon` → `width/height: 2.25rem` | yes |
| `Timeline/TimelineActivityList.tsx:414` (V1) | `flex-shrink-0 {bg} p-2 rounded-xl shadow-sm` | **no** |
| `FullLogTimeline/FullLogActivityList.tsx:46` | `flex-shrink-0 p-2 rounded-xl mr-4` | **no** |

Worse for Full Log: it imports only `full-log-timeline.css`, so
`.timeline-png-icon` isn't even guaranteed to be in scope on `/[slug]/full-log` —
the `<img>` falls back to raw intrinsic size (128–256 px) with no rule at all.

V1 Timeline is live, not dead code (`src/components/Timeline/index.tsx:330`).

Two things the review missed in the same PR:

- **`public/diaper-128.png` is 618 KB** (every other icon is 19–33 KB). It ships on
  the most common timeline row type.
- **19 of 21 lucide/lab imports in `utils.tsx` become dead** after the swap
  (everything except `Plus`/`Minus`). Bundle weight + lint noise.
- The PR is **not a draft**, yet every new comment and CSS block is prefixed
  `EXPLORATION:`.

### #3 — Relock gate's 60s window (PR #234) — CONFIRMED, under-severitised

`app/(app)/[slug]/client-layout.tsx:122`:

```ts
const unlockTime = localStorage.getItem('unlockTime');
const unlocked = !!unlockTime && Date.now() - parseInt(unlockTime) <= 60 * 1000;
return decideNativeRelock({ unlocked, native: isNativeApp(), ... });
```

The app's own definition of unlocked, at line 762, has no time window:

```ts
const newUnlockState = !!(authToken && (isAccountAuth || isSysAdmin || unlockTime));
```

`updateUnlockTimer` (line 327) rewrites `unlockTime` on every click/keydown/
mousemove/touchstart, and logout removes it (lines 380, 1072). So `unlockTime`'s
*presence* is the signal; its *age* is not. The 60s check is a mount-time heuristic
for "was this tab just unlocked" that was fine as the seed for `isUnlocked` (line 97,
pre-existing on `main`) because the effect at 741 immediately corrects it — but the
relock gate reads it **once, synchronously, and acts irreversibly**
(`navigateToShell({ type: 'sessionExpired' })`).

Failure path: user with a perfectly valid session, app idle >60s, WebView reloads
(push-notification tap, Android WebView eviction and restore, deep link) →
`unlocked === false` → bounce to the shell. With the 15s loop guard, a repeat lands
on the web login inside the app — the exact outcome `native-relock.ts` exists to
prevent.

`tests/native-relock.test.ts` covers only the pure `decideNativeRelock`, which takes
`unlocked` as an *input*. The bug is entirely in the caller, so the suite is green.

The reviewer's proposed fix is implementable as stated: every input
(`authToken`, `isAccountAuth`/`isSysAdmin` from the JWT payload, `unlockTime`) is
readable synchronously at mount.

### #4 — Tokens moved into the query string (PR #234) — CONFIRMED

`app/api/utils/account-emails.ts`:

```diff
-  const verificationUrl = `${domainUrl}/#verify?token=${token}`;
+  const verificationUrl = verificationLink(domainUrl, token);   // `${domainUrl}/verify?token=${token}`
```

`app/verify/page.tsx:19` and `app/passwordreset/page.tsx:19` both read
`searchParams.get('token')`. The fragment form never reached the server; the query
form lands in access logs, proxy logs, browser history, and any outbound `Referer`
from those pages.

The stated motive is sound — Universal/App Links match on **path**, and a fragment
isn't part of the match. But the motive only requires moving `verify` from the
fragment into the path. **`/verify#token=…` satisfies App Links and keeps the token
off the wire.** The reviewer's fix (`history.replaceState` + log scrubbing) is
strictly weaker: the token still reaches the server and any proxy in front of it.

### #5 — PWA docs stale (PR #234) — CONFIRMED, worse than reported

`documentation/Architecture-Documentation/PWAAndNotifications.md` line 7 makes two
now-false claims, and lines 144/251 make a third:

| Line | Claim | Reality |
|---|---|---|
| 7 | "wake lock uses the `KeepAwake` plugin" | Plugin removed from the shell entirely; nursery wake is native URL observation (`NurseryAwareViewController.swift` / `NurseryAwareWebViewClient.java`) |
| 7, 134, 142 | "a second **FCM** channel" | Android is FCM; iOS is **direct APNs, no Firebase** |
| 144, 251 | `src/utils/native-push.ts` | File does not exist (confirmed) |

Line 181 also documents `chooseWakeLockMechanism()` picking `KeepAwake` — a branch
that can no longer be reached because the shell no longer injects that plugin.

### #6 — Review-round narration in comments (PR #234) — CONFIRMED, cosmetic

`app/api/notifications/preferences/route.ts:8-19` contains a 12-line "Correction: an
earlier version of this comment (and this task's commit message / report) claimed …"
paragraph. Line 176 defers a live concurrency caveat to "the task report" — an
artifact not in the repo. Also a typo at 175: `applicationlevel`.

### #7 — Stale `caretakerId` (PR #234) — CONFIRMED, impact overstated

`src/utils/native-session.ts:39`:

```ts
if (decoded.msg.caretakerId) env.storage.setItem('caretakerId', decoded.msg.caretakerId);
```

The shell genuinely omits the field on account login
(`mobile-app-v1/src/services/connect.ts:31` spreads it conditionally), so switching
family A (PIN) → family B (account) on the same server leaves A's `caretakerId` in
localStorage. Six readers exist, including `useNurserySettings.ts:45` and
`ActivityTileGroup/index.tsx:172`.

But the review's "posted as the owner of nursery/tile settings" overstates it:
`app/api/nursery-mode-settings/route.ts` scopes by `authContext.familyId` and uses
`caretakerId` only as a **key inside that family's settings JSON**. Result is an
orphaned settings key and settings that appear to reset once a real `caretakerId`
lands — not a cross-family read or write. Correctness bug, one-line fix, not a
security issue.

### #8 — Web-push throw blocks native push (PR #234) — CONFIRMED, under-scoped

`src/lib/notifications/push.ts:74-76` — the initializer sits **outside** the try:

```ts
if (!isWebPushInitialized()) {
  await initializeWebPush();   // throws: 'VAPID keys are not configured.'
}
try { /* … */ }
```

So `sendNotificationWithLogging` propagates. Two call sites `await` it bare before
the native dispatch:

- `timerCheck.ts:294` (feed/diaper) — no try/catch at all
- `timerCheck.ts:696` (medicine) — inside a `try` whose `catch` also swallows
  `notificationsSent++`

The review cited only the first. `activityHook.ts:337` already uses the correct
shape (`.catch()` on an un-awaited promise), which is the pattern to copy.

Consequence on a deployment with no VAPID keys — plausible for an app-first
install — is that **native timer push never fires, on every pass**, silently.

### #9 — Fragment accepted on any family page load (PR #234) — mechanically true

`native-session.ts:33` validates only that `decoded.msg.slug` equals the first path
segment; the attacker controls both. `bridge-contract.ts` is unsigned JSON. So an
in-shell navigation to `https://server/{slug}/…#bridge-session=…` does replace the
session.

Bounding it: the payload must carry a **server-issued JWT**, so this is session
*fixation* (victim logs into attacker's family), not forgery or escalation. The
delivery vector is narrow — `screenForDeepLink()` claims only `/setup/*`, `/verify*`,
`/passwordreset*`, so no OS-level link routes a family URL into the app; it needs a
link the victim taps inside an already-loaded family page. Real hardening target,
not an urgent one. The proposed nonce also has a bootstrap problem: the shell can't
write to the server origin's localStorage, so the nonce has to ride the URL too.

### #10 — APNs connection per push (PR #234) — CONFIRMED

`apnsPush.ts:122` `http2.connect(host)` per `sendOne`, closed on `end`/`error`. Full
TLS handshake per notification; with the every-minute timer cron this is steady
churn against an endpoint Apple documents as expecting long-lived connections.

The provider JWT **is** already cached (`providerToken()`, lines 83-94, with
`TOKEN_TTL_MS`) — so the reviewer correctly scoped this to the socket only.

---

## Proposed plans — top 5

Ordered by user-visible impact. Each is independent.

### Plan 1 — Size the PNG icons at the component (PR #251) · blocker

**Why first:** breaks `/[slug]/full-log` layout for every user, web and app, on a
non-draft PR.

1. Move sizing off `.event-icon` and onto the element that owns it:
   ```tsx
   const pngIcon = (src: string) => (
     <img src={src} alt="" aria-hidden="true" width={36} height={36}
          className="timeline-png-icon h-9 w-9 object-contain" />
   );
   ```
   `width`/`height` attributes also kill layout shift before CSS lands.
2. Reduce `.timeline-png-icon` in `timeline-activity-list.css` to the timeline-only
   concerns (the `:has()` transparent-box rule); drop `width/height: 100%`.
3. Delete the 19 now-dead lucide/lab imports from `utils.tsx`.
4. Re-encode `public/diaper-128.png` to match its siblings (~20 KB).
5. Strip the `EXPLORATION:` prefixes from comments and CSS, or mark the PR draft.
6. **Verify:** load `/[slug]/full-log`, V1 timeline, and TimelineV2 side by side —
   this is a visual regression that no unit test will catch. Screenshot each.

Risk: low. Contained to one component + one stylesheet.

### Plan 2 — Make the relock gate use the app's own unlock definition (PR #234) · high

**Why:** bounces valid sessions out of the app on any resume >60s idle — including
the push-notification tap flow the same PR was built to enable.

1. Extract the shared computation as a pure function so it's testable in the node-env
   suite, e.g. `src/utils/session-state.ts`:
   ```ts
   export function isSessionUnlocked(s: {
     authToken: string | null; unlockTime: string | null;
   }): boolean
   ```
   decoding `isAccountAuth` / `isSysAdmin` from the JWT payload with the same
   `atob(split('.')[1])` shape already used at lines 178, 433, 482, 548, 749.
2. Call it from the `relockDecision` initializer (line 122) instead of the 60s window.
3. Leave the `isUnlocked` seed at line 97 alone — it's pre-existing `main` behavior
   and self-corrects via the effect at 741. Changing it is a separate decision.
4. Tests (`tests/native-relock.test.ts` + a new `tests/session-state.test.ts`):
   valid PIN session with a 10-minute-old `unlockTime` → `'app'`, not
   `'return-to-shell'`; account-auth token with no `unlockTime` at all → `'app'`;
   no `authToken` → `'return-to-shell'` in native.
5. Consider folding the 5+ duplicated JWT-decode blocks in `client-layout.tsx` onto
   the new helper — optional, separable, and it's the reason this drifted.

Risk: medium. It loosens a security gate, so the test for "no `authToken` still
bounces" is the one that matters. Worth manual verification on device: background
the app 5 minutes, tap a push, confirm it lands in the app.

### Plan 3 — Stop web push from blocking native push (PR #234) · high

**Why:** silent total failure of native timer push on any deployment where web-push
init throws.

1. In `timerCheck.ts`, change both sites (~294 and ~696) to the shape
   `activityHook.ts:337` already uses — fire the web-push promise with its own
   `.catch()`, don't `await` it ahead of the native dispatch.
2. At line 696, also move `notificationsSent++` out from behind the web-push `try`
   so an unrelated web-push failure stops under-counting.
3. Defence in depth: move `await initializeWebPush()` in `push.ts:74-76` **inside**
   the existing try, so `sendNotification` returns `{success:false}` instead of
   throwing. This makes the whole family of call sites fail soft and gets the failure
   into `NotificationLog` where it's diagnosable.
4. Tests (`tests/native-push-dispatch.test.ts`): mock `sendNotificationWithLogging`
   to reject; assert `sendToDeviceTokens` was still called, for both timer paths.

Risk: low. Behavior only changes on the error path.

### Plan 4 — Keep reset/verify tokens out of the query string (PR #234) · medium

**Recommendation: reject the reviewer's fix, take the stronger one.**
`history.replaceState` cleans the address bar but the token has already reached the
server, the reverse proxy, and their logs. Use `/verify#token=…` — path-based
(satisfies App Links / AASA) *and* fragment-carried (never sent to the server).

1. `account-emails.ts` — `${domainUrl}/verify#token=${token}`, same for
   `/passwordreset`.
2. `app/verify/page.tsx`, `app/passwordreset/page.tsx` — read the token from
   `window.location.hash` in an effect instead of `searchParams`, then
   `history.replaceState` to drop it (Plan-4-and-the-reviewer's-fix combined).
3. **Shell:** `src/services/deep-links.ts:50-53` reads
   `parsed.searchParams.get('token')` — must read the fragment too. Universal Links
   and App Links both preserve the fragment, but this needs device verification, not
   just a unit test.
4. Keep the existing `?token=` readers as a fallback for links already in inboxes
   (same reasoning as the retained legacy `/#verify` handlers).
5. Tests: `tests/account-email-links.test.ts` for the new URL shape; a shell test in
   `deep-links.test.ts` for the fragment form.

Risk: medium — touches a flow that's hard to test end to end, and the shell change
can only be truly verified on a device. If that verification isn't affordable before
ship, the honest fallback is the reviewer's original mitigation plus a note.

### Plan 5 — Reuse one APNs HTTP/2 session per host (PR #234) · medium

1. Module-level `Map<host, ClientHttp2Session>` in `apnsPush.ts`. `getSession(host)`
   returns a live session or connects; delete the entry on `close`, `error`,
   `goaway`, and `socket` timeout so the next send reconnects.
2. Move `client.setTimeout` to the session (idle reaper, e.g. 5 min) and keep
   `req.setTimeout(10_000)` per request — the existing per-request timeout is
   correct and must survive.
3. `finish()` must no longer `client.close()`/`destroy()`; only the request ends.
   This is where a naive edit will break the current double-resolve guard — the
   `settled` flag stays, the socket teardown moves out.
4. Tests: extend `tests/apns-push.test.ts` — two sequential `sendOne` calls issue one
   `http2.connect`; a session `error` between them forces a reconnect.

Risk: medium — connection-lifecycle bugs are the classic source of "works in test,
hangs in prod". If sprout-track is ever deployed serverless, the win largely
evaporates (no process reuse); worth confirming the deployment target before
spending the effort.

---

## Cheap extras (bundle into any of the above)

- **#7** — one line in `native-session.ts:39`:
  `else env.storage.removeItem('caretakerId');` plus a test case.
- **#5** — rewrite the three stale rows of `PWAAndNotifications.md` to match
  `NativeAppIntegration.md`; drop the dead `KeepAwake` branch note at line 181.
  Also update `mobile-app-v1/CLAUDE.md`, which still lists
  `ios/App/App/GoogleService-Info.plist` as vestigial-but-present.
- **#6** — cut lines 8-19 of `preferences/route.ts` down to the live constraint; move
  the race caveat from "the task report" into the code comment; fix
  `applicationlevel`.

## Deferred

- **#9** — worth a design note, not a patch, this pass. If it gets picked up, the
  cheapest real mitigation is refusing the fragment when a valid `authToken` for a
  *different* family is already present, rather than a nonce the shell can't
  bootstrap.
