# Native Push Notifications and Nursery Wake — Design

**Date:** 2026-07-25
**Repos:** `mobile-app-v1` (shell) and `sprout-track` (`feature/native-aware-layer`, PR #234)
**Supersedes nothing.** Extends the native-aware layer documented in
`sprout-track/documentation/Architecture-Documentation/NativeAppIntegration.md`.

## 1. Goal

Finish the native app build with working push notifications on iOS and Android,
and make nursery mode's screen-wake behavior correct and automatic inside the
shell instead of exposing a browser-shaped toggle that reports
"Wake lock not supported".

## 2. Current state

Already built and merged on `feature/native-aware-layer`:

- `DeviceToken` model + migration `20260720201548_add_device_token`
- `POST` / `DELETE /api/notifications/device-tokens`, scoped from `authContext`
- `src/lib/notifications/fcmPush.ts` — FCM HTTP v1 via service-account JWT,
  with token lifecycle (`UNREGISTERED` → delete, transient → `failureCount++`)
- Send sites wired fire-and-forget beside web push: `activityHook.ts`,
  `timerCheck.ts` (feed/diaper timers, medicine timers)
- `src/utils/native-push.ts` — client registration after login, gated on
  `deployment-config.nativePushEnabled`
- `src/hooks/useWakeLock.ts` — prefers the `KeepAwake` plugin over
  `navigator.wakeLock`

Not built:

- Any push or keep-awake code in the shell. `@capacitor/push-notifications` and
  `@capacitor-community/keep-awake` are dependencies but nothing imports them.
- `android/app/google-services.json`, `POST_NOTIFICATIONS` in the manifest
- iOS Push Notifications capability, `UIBackgroundModes`, APNs credentials
- Notification tap handling

## 3. Problems this design fixes

1. **iOS is broken by construction.** `@capacitor/push-notifications` returns a
   raw APNs device token on iOS. `fcmPush.ts` sends via FCM v1, which accepts
   only FCM registration tokens. iOS devices would register tokens the server can
   never deliver to.
2. **Web push cannot substitute.** Apple exposes Web Push only to Safari 16.4+
   and Home Screen PWAs, never to `WKWebView`. The Android System WebView
   implements service workers but not the Push API or `Notification`. This is why
   `shouldRegisterServiceWorker` already returns `false` in the shell. There is
   no configuration that changes this.
3. **Multi-family token collision.** `DeviceToken.token` is `@unique` and `POST`
   upserts ownership from `authContext`. One phone with two families on the same
   server: opening family B re-owns the row and family A silently stops
   notifying.
4. **Registration depends on unverified bridge injection.** `native-push.ts`
   reaches for `getCapacitorPlugin('PushNotifications')` on the *remote* origin.
   `CLAUDE.md` states plainly that `isNativeApp() === true` with
   `getCapacitorPlugin(...) === null` is a real state.
5. **Nursery mode shows a dead control.** In the shell the wake-lock mechanism
   resolves to `none`, so `SettingsDrawer` renders a disabled card and
   `NurseryModeContainer`'s footer renders "WAKE LOCK NOT SUPPORTED".

## 4. Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **SaaS-only.** Native push runs on sprout-track.com. | Store binaries are bound to one Apple team and one Firebase project; a third-party self-hoster cannot push to them regardless of architecture. |
| D2 | **FCM for Android, direct APNs for iOS.** | Removes the Firebase iOS SDK — the highest-risk item in a Capacitor 8 / SPM project — and keeps Google out of the iOS delivery path. Cost is one server module mirroring an existing one. |
| D3 | **The shell owns permission, token acquisition, and registration.** | No dependence on bridge injection into remote origins. The JWT already exists at the exact point registration is needed. |
| D4 | **A device registers for every family it connects to.** | `@@unique([token, familyId])` instead of `@unique(token)`. A caregiver across two households gets both, instead of silently losing one. |
| D5 | **Soft pre-prompt before the OS prompt.** | iOS grants exactly one system prompt per install; after a denial the only recovery is iOS Settings. |
| D6 | **Native URL observation drives keep-awake and immersive mode.** | The shell's JS is not running once the WebView is on the remote server. Native code is the only actor that always exists. |
| D7 | **`DELETE /device-tokens` is unauthenticated, keyed on the exact token.** | The shell has no JWT when a family is removed, and acquiring one would fire a biometric prompt on a delete action. Routes are disabled entirely when native push is unconfigured. |
| D8 | **Notifications carry an allow-listed target route.** | A medicine-due notification should land on the medicine screen. The route is validated against a fixed list, never used raw. |
| D9 | **Universal / App Links claim `/setup/*`, `/verify*`, and `/passwordreset*`.** | The three links that mean "resume something in the app." `/account` is deliberately excluded to preserve IAP compliance, and root-level family slugs are deferred (§9.6). |
| D10 | **The shell gains a password-reset screen.** | Completes the reset flow in-app rather than bouncing to the browser, and is what makes `/passwordreset*` worth claiming. |

### D7 in detail

The device token is high-entropy and held only by the device that owns it.
Presenting it is self-authenticating for the single operation of deleting it.
The worst outcome for an attacker holding someone's FCM/APNs token is silencing
that person's own notifications — it grants no read or write access to family
data.

This is a deliberate, scoped exception to the family-scoping golden rule, which
governs access to *family data*. To bound it:

- Both device-token routes return **404** when neither transport is configured,
  so on self-hosted deployments the endpoints do not exist at all.
- `DELETE` requires an exact full-token match. No prefix, list, or wildcard form.
- `POST` remains `withAuthContext` and unchanged in its ownership rules.

## 5. Server architecture (`sprout-track`)

### 5.1 Transport split

`fcmPush.ts` currently owns both the send loop and the token lifecycle. Split so
each transport is a narrow unit and the shared policy lives in one place:

```
src/lib/notifications/
  nativePush.ts   NEW  sendToDeviceTokens() — query, dispatch by platform, lifecycle
  fcmPush.ts      MOD  reduced to sendOne(token, payload) → SendOutcome
  apnsPush.ts     NEW  sendOne(token, payload) → SendOutcome
```

```ts
export interface SendOutcome {
  success: boolean;
  /** True only for a definitive "this token is dead" response. */
  unregistered: boolean;
}
```

`nativePush.ts` keeps today's behavior verbatim:

- success → `failureCount: 0`, `lastSuccessAt: now`
- `unregistered` → delete **every** row carrying that token (D4 means a token can
  appear under more than one family)
- anything else → `failureCount: { increment: 1 }`, `lastFailureAt: now`

Unconfigured transports return `0` immediately with no network calls. A
deployment with FCM but not APNs delivers to Android and skips iOS rows.

The three call sites — `activityHook.ts` and `timerCheck.ts` (×2) — change their
import only. Their fire-and-forget `.catch(console.error)` shape is unchanged, so
a failing native transport still cannot delay or break web push.

### 5.2 `apnsPush.ts`

HTTP/2 to `api.push.apple.com` (or `api.sandbox.push.apple.com`) using
`node:http2`. Authorization is an ES256 JWT signed with the `.p8` key using
`jsonwebtoken` — already a dependency, so no new packages. The JWT is cached
in-process and refreshed on the same one-minute-before-expiry rule as the FCM
OAuth token. Apple rejects tokens refreshed more than once per 20 minutes, so the
cache is mandatory, not an optimization.

Request:

```
POST /3/device/<deviceToken>
  apns-topic: <APNS_BUNDLE_ID>
  apns-push-type: alert
  apns-priority: 10
  apns-collapse-id: <payload.tag>        # only when tag is present
  authorization: bearer <es256 jwt>

{ "aps": { "alert": { "title": ..., "body": ... }, "sound": "default" },
  ...payload.data }
```

`unregistered` is returned **only** on HTTP 410 with reason `Unregistered`,
mirroring the existing conservative FCM rule. A `400 BadDeviceToken` is logged as
a transient failure, not a deletion — it is far more often an
environment mismatch (see §11) than a genuinely dead token.

### 5.3 Schema change

```prisma
model DeviceToken {
  token String            // was: @unique
  ...
  @@unique([token, familyId])
}
```

One Prisma migration, generated for both providers per the dual-database
constraint. `POST`'s upsert moves from `where: { token }` to
`where: { token_familyId: { token, familyId } }`.

### 5.4 Route changes

Both handlers gain a guard that returns 404 when
`!isFcmConfigured() && !isApnsConfigured()`.

`DELETE` drops `withAuthContext` and deletes by exact token. It returns success
whether or not a row existed, so the response cannot be used to probe which
tokens are registered.

### 5.5 `GET /api/deployment-config`

```ts
nativePushEnabled: isFcmConfigured() || isApnsConfigured(),   // retained
nativePush: { ios: isApnsConfigured(), android: isFcmConfigured() },  // new
```

`nativePushEnabled` **must be retained**. App Store review latency guarantees
older shell builds will be in the field talking to an updated server, and those
builds know only the old flag.

### 5.6 Removals

`src/utils/native-push.ts` and its call site in
`app/(app)/[slug]/client-layout.tsx` are deleted — the shell owns this now (D3).
`tests/native-push.test.ts` goes with it.

The bridge contract's `registerPushToken` message becomes unused vocabulary. It
stays in place rather than forcing a contract version bump across both repos;
`NativeAppIntegration.md` already documents that the contract is the union of
both sides' vocabulary.

## 6. Shell architecture (`mobile-app-v1`)

### 6.1 `src/services/push.ts`

Dependency-injected in the same style as `connect.ts`, so every branch is
testable without a device.

| Export | Behavior |
|---|---|
| `permissionState()` | `checkPermissions()` → `'granted' \| 'denied' \| 'prompt'` |
| `requestPermission()` | Fires the OS prompt, returns the resulting state |
| `acquireToken()` | Attaches the `registration` listener **before** calling `register()`, resolves `{ token, platform }`, rejects on `registrationError` or timeout |
| `registerWith(baseUrl, jwt)` | `POST /api/notifications/device-tokens` |
| `unregisterFrom(baseUrl, token)` | `DELETE /api/notifications/device-tokens?token=` (unauthenticated per D7) |

The listener ordering in `acquireToken()` is load-bearing: `registration` is
emitted with `retainUntilConsumed: true` on Android but **not** on iOS, so an iOS
listener attached after `register()` loses the token silently.

`acquireToken()` must time out rather than hang. A device with no network, or an
APNs registration that never completes, must not leave a pending promise that
blocks anything.

### 6.2 Registration point

`connectToFamily` gains one non-blocking line after a successful login:

```ts
const result = await deps.login(entry, creds)
if (result.ok) {
  void deps.registerPush(entry, result.token)   // fire-and-forget
  deps.openUrl(sessionHandoffUrl(entry.baseUrl, result))
  return 'navigated'
}
```

`registerPush` checks the local opt-in state, checks `deployment-config` for the
running platform, acquires the token, and POSTs. **Every failure path is
swallowed.** Registration must never delay the handoff or change the
`ConnectOutcome`.

### 6.3 Family removal

`Families` (remove a family) and `Settings` (Clear this phone) call
`unregisterFrom(baseUrl, token)` for the affected entries. This is what closes
the privacy gap in D7: a caregiver who removes a household stops receiving its
notifications immediately, rather than waiting for the token to go stale.

### 6.4 Native configuration

**Android**
- `android/app/google-services.json` (gitignored; the existing `build.gradle`
  already applies the plugin conditionally when the file is present)
- `<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />`
- A monochrome notification icon and a default channel

**iOS**
- Push Notifications capability on the App ID and in the Xcode project
- `UIBackgroundModes: [remote-notification]` in `Info.plist`
- APNs auth key (`.p8`) registered to the App ID
- **No Firebase SDK, no `GoogleService-Info.plist`, no SPM Firebase dependency**

### 6.5 Password reset screen (D10)

`AccountReset.tsx` is the reset-*request* screen (email input). The shell has
nothing that consumes a reset token, so a `/passwordreset` deep link has nowhere
to land. New screen `src/screens/AccountResetConfirm.tsx`, themed to match the
existing account screens exactly — `Header` + `ErrBox` from `components/chrome`,
`f-grid` / `fl` / `fi` / `m-btn` / `auth-alt` classes, deps-injected like its
neighbours.

**Screen union:** `{ name: 'acct-reset-confirm'; token: string }`.

**Two new functions in `src/services/account.ts`**, matching the existing
envelope-unwrapping style:

| Function | Endpoint |
|---|---|
| `validateResetToken(base, token)` | `GET /api/accounts/reset-password?token=` → `{ valid, email? }` |
| `submitPasswordReset(base, token, password)` | `POST /api/accounts/reset-password` → `{ ok } \| { ok: false, error }` |

**States:**

| State | UI |
|---|---|
| Validating | Spinner while `validateResetToken` runs |
| Valid | The account's email as read-only context, a new-password field, and the `PW_REQS` checklist rendered exactly as `AccountSignUp` renders it |
| Invalid / expired | Explanation plus a button to `acct-reset` to request a fresh link |
| Submitted | Navigate to `acct-signin` with a notice |

**Error handling:** `400` mid-flow means the token expired between validation and
submission — fall back to the invalid state rather than showing a generic error.
`429` is the shared IP lockout and gets the same treatment as elsewhere in the
shell. Network failure keeps the entered password so it isn't retyped.

**`PW_REQS` moves out of `AccountSignUp.tsx`** into a shared module so the reset
screen doesn't import a screen from a screen. `AccountSignUp` keeps re-exporting
it, since its test imports it by name.

**Password rule divergence (observation, not in scope).** The shell's `PW_REQS`
mirrors the **register** endpoint exactly — 8+, lower, upper, number, and a
symbol from a fixed charset. The **reset-password** endpoint enforces only 8+
with a letter and a number. Reusing `PW_REQS` here is therefore strictly stricter
than the server, so nothing the client accepts can be server-rejected. The
underlying inconsistency — a user can reset to a password that registration would
have refused — is a server-side matter and is deliberately left alone.

**Stale saved credentials.** An account password stored in the shell's vault is
invalidated by a reset. This already degrades correctly: the next connect fails
authentication and `connectToFamily` returns `'needs-reauth'`, which routes to
the `ReAuth` screen and overwrites the stored credential only after a new one
verifies. No new handling is required.

### 6.6 Setup-link flow

`/setup/{token}` is an **admin-generated** family provisioning link
(`POST /api/family/create-setup-link`, system administrators only). It is a
different auth model from account signup: a 6-hex-character token in
`FamilySetup` with a stored password and a 7-day expiry.

The shell's `Wizard` steps are reusable — only the auth source and the finish
step differ. The server already exposes everything needed:

| Step | Endpoint |
|---|---|
| Validate | `POST /api/setup/validate-token` `{ token }` → `{ valid, requiresPassword }`; 404 invalid, 410 expired, 409 already used |
| Exchange | `POST /api/auth/token` `{ token, password }` → a 24-hour JWT carrying `isSetupAuth`; 401 on a wrong password |
| Create | `POST /api/setup/start` `{ name, slug, token, isNewFamily: true }` with that JWT |

`createFamily` in `src/services/wizard.ts` **already posts to
`/api/setup/start`** — setup mode only adds `token` and `isNewFamily` to the
body. `saveSecurity` and `saveBaby` work unchanged with the setup JWT.

Two things differ from account mode:

- **`linkAccountToCaretaker` is skipped.** There is no account to link.
- **Finishing stores a PIN credential, not account credentials.**
  `finishWizard` logs in with `AccountCreds` and saves `authType: 'ACCOUNT'`. A
  setup-mode sibling logs in with the caretaker/PIN credential the user just
  configured in step 2 and saves `authType: 'CARETAKER'` or `'SYSTEM'`.

New screen `src/screens/SetupLink.tsx` sits in front: it validates the token,
collects the setup password, exchanges it for the JWT, and hands off to `Wizard`
in setup mode. Invalid, expired, and already-used tokens each get their own
message rather than a generic failure.

**Note on scope.** Setup links are primarily a self-hosted admin path, and deep
links are only claimed for sprout-track.com — so this flow is reachable by deep
link only for setup links generated on the SaaS deployment. Pasting a setup link
into "Add a family" remains available everywhere.

## 7. Permission UX

New `src/screens/NotificationsIntro.tsx` in the shell's storybook theme, gated on
a Capacitor `Preferences` key `push-opt-in` with values
`unasked | granted | declined`.

**Timing: the launch *after* the first successful connect.** The shell cannot
observe "just after connecting" — `connectToFamily` hands the WebView to the
server and the shell's React tree stops running, so there is no moment after a
`'navigated'` outcome in which the shell can render anything. Instead
`connectToFamily` sets a `has-connected-once` preference, and the launch effect
in `App.tsx` shows the intro before auto-open or the families list when
`has-connected-once` is set and opt-in is still `unasked`. The user has therefore
used the app at least once before being asked, which is the point of the soft
pre-prompt.

Only "Turn on" reaches the OS prompt. "Not now" writes `declined` and is fully
recoverable from Settings — this is what protects the single iOS prompt (D5).

`Settings.tsx` gains a Notifications row reflecting **live OS state**, not the
stored preference:

| OS state | Row |
|---|---|
| `granted` | "On for this phone" |
| `prompt`, locally declined | Button that re-runs the intro |
| `denied` | "Turned off in iOS Settings" + link out via the existing `openExternal` pattern |

Reading live state matters because a user can revoke permission in OS settings
at any time, and a row driven by stored preference would then lie.

## 8. Notification tap

Send sites include `familySlug` and `route` in the notification `data` (plus
`babyId` where the site has one). `App.tsx` attaches
`pushNotificationActionPerformed` at boot, alongside the existing `bridge-event`
read.

| Case | Behavior |
|---|---|
| Cold start | The event is retained on both platforms, so the shell's listener receives it. Match `familySlug` against saved servers → boot into `{ name: 'connecting', entry, route }`. The biometric gate still applies. |
| Warm, already in that family | The OS foregrounds the app, which is already correct. No action. |
| Warm, in a *different* family | The shell's JS is not running, so no listener exists. The tap foregrounds the wrong family. |

The third case is an accepted limitation of the one-WebView architecture. It
affects only multi-family users and only while the app is warm. Resolving it
would require a second mechanism inside the web app, which is out of scope.

### 8.1 Routing to a screen (D8)

`sessionHandoffUrl` currently hardcodes `/${slug}/log-entry`. It gains an
optional route:

```ts
sessionHandoffUrl(baseUrl, result, route = 'log-entry')
```

**The route is validated against a fixed allow-list before use**, never taken raw
from the payload. This is a security requirement, not defensive style: the route
is concatenated into the URL that carries the session token in its
`#bridge-session=` fragment, so an unvalidated value is a token-redirection
primitive. An unrecognized route falls back to `log-entry`.

The allow-list and the notification-type → route mapping live in one shared,
unit-tested table.

## 9. Deep links (Universal Links / App Links)

### 9.1 Claimed paths (D9)

| Path | Lands on | Notes |
|---|---|---|
| `/setup/*` | Shell `SetupLink` → `Wizard` in setup mode | Admin-generated family setup links, §6.6 |
| `/verify*` | Shell `AccountVerify` | Requires the server change in §9.2 |
| `/passwordreset*` | Shell `AccountResetConfirm` | New screen, §6.5; requires the server change in §9.2 |

**`/account` and `/account/*` are deliberately not claimed.**
`MANAGE_SUBSCRIPTION_URL` points at `https://sprout-track.com/account`
specifically so `openExternal` pushes subscription management into the system
browser. Claiming it would bounce the user straight back into the app and defeat
the compliance rule `shell-chrome.ts` exists to enforce. This must be asserted by
a test over the claimed-path list, not merely documented.

Also unclaimed: `/`, `/features`, `/pricing`, `/privacy`, `/terms`, `/home`,
`/login`, `/family-select`, `/family-manager/*`.

### 9.2 Server: move account links off the hash

`app/api/utils/account-emails.ts` builds `${domainUrl}/#verify?token=` and
`${domainUrl}/#passwordreset?token=`. Universal and App Links match on **path**,
and the fragment is not part of matching — the path here is `/`, the marketing
homepage, which cannot be claimed.

- Add real routes `app/verify/page.tsx` and `app/passwordreset/page.tsx` that
  read `?token=` and render what the existing hash handlers render.
- Switch `sendVerificationEmail` to `${domainUrl}/verify?token=` and
  `sendPasswordResetEmail` to `${domainUrl}/passwordreset?token=`.
- **Keep both hash paths working**, unchanged and indefinitely — links already
  sitting in inboxes must not break.

### 9.3 Association files

Served by sprout-track as static, correctly-typed responses:

- `/.well-known/apple-app-site-association` — no file extension,
  `Content-Type: application/json`, served over HTTPS with no redirect. Uses the
  `components` form so path scope is expressed precisely.
- `/.well-known/assetlinks.json` — requires the **Play App Signing** SHA-256
  fingerprint from the Play Console, not the local upload key. Using the upload
  key is the single most common reason App Links silently fail to verify.

Both must be reachable unauthenticated and must not be caught by middleware.

### 9.4 App configuration

**iOS** — Associated Domains entitlement `applinks:sprout-track.com`. The
existing `AppDelegate.application(_:continue:restorationHandler:)` already
forwards to `ApplicationDelegateProxy`, so no delegate work is needed.

**Android** — intent filters with `android:autoVerify="true"` and explicit
`pathPrefix` entries on the existing `MainActivity`, which is already
`launchMode="singleTask"` (correct for this — the link arrives via `onNewIntent`
rather than a second activity instance).

**Asymmetry worth planning around:** iOS path scope lives in the server-served
AASA file and can change **without an app release**. Android path prefixes live
in the manifest and **cannot**. Android's patterns should therefore be set
slightly wider than iOS's, with the shell handing unmatched paths back to the
browser via `openExternal`.

### 9.5 Shell routing

`App.tsx` adds an `appUrlOpen` listener (`@capacitor/app`, already a dependency)
next to the notification listener. A single pure function owns the mapping:

```ts
export function screenForDeepLink(url: string): Screen | null
```

Returning `null` means "not ours" — the shell hands the URL to `openExternal` and
continues its normal boot. This keeps the whole route table unit-testable with no
device and no Capacitor.

Deep links and notification taps both resolve to a `Screen` before the launch
effect runs, and they share the existing `bootTarget` / `screenRef` guards in
`App.tsx` so a link can't clobber a user's in-flight tap during pending awaits.

### 9.6 Deferred: family slug links (`/{slug}`)

`sendFamilyWelcomeEmail` links to `${domainUrl}/${familySlug}`. Claiming it is
deferred: family slugs sit at the root alongside marketing routes, so iOS would
need an exclusion list that must track every future marketing page, and Android
App Links cannot express exclusions at all — it would have to claim `/*` and hand
back everything unmatched. The bounce is user-visible and the failure mode is an
app that intercepts the marketing site, which App Store review does flag.

Because iOS path scope is server-side, this can be revisited later without an app
release on that platform.

## 10. Nursery mode

### 10.1 Native URL observation (D6)

Once the WebView is on the remote server the shell's JS is gone, so keep-awake
and immersive mode are driven from native code that watches the WebView URL for
`/{slug}/nursery-mode`.

**iOS** — subclass `CAPBridgeViewController` (it is `open`, and
`capacitorDidLoad()` is the documented subclass hook):

```swift
class NurseryAwareViewController: CAPBridgeViewController {
  override func capacitorDidLoad() {
    // KVO on webView.url — WKWebView.url is KVO-compliant and updates on
    // history.pushState, so Next.js client-side navigation is observed.
  }
}
```

On entering: `UIApplication.shared.isIdleTimerDisabled = true` and
`setStatusBarVisible(false)` (already `open` on the base class). On leaving,
both are reverted. `Main.storyboard`'s `customClass` changes from
`CAPBridgeViewController` / module `Capacitor` to `NurseryAwareViewController` /
module `App`.

**Android** — `Bridge.setWebViewClient(BridgeWebViewClient)` is public, so
subclass it and call `super` in every override:

```java
bridge.setWebViewClient(new NurseryAwareWebViewClient(bridge));
```

The hook is **`doUpdateVisitedHistory`**, not `onPageStarted` — the latter does
not fire for `pushState` soft-navigation.

On entering: `FLAG_KEEP_SCREEN_ON` on the window, plus
`WindowInsetsControllerCompat(window, view).hide(systemBars())` with
`BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`. Reverted on leaving.

The path matcher is a shared, unit-testable rule: the second path segment equals
`nursery-mode`. It is expressed once per platform and covered by a native-side
test where the platform's test harness allows.

Because keep-awake and immersive are handled natively, the shell's
`@capacitor-community/keep-awake` dependency becomes unused and is removed.

### 10.2 Web-side changes (`sprout-track`)

New pure function in `src/utils/shell-chrome.ts`, tested like its neighbours:

```ts
export function nurseryDisplayControls(isNative: boolean): {
  showWakeLock: boolean;
  showFullscreen: boolean;
}
```

- `SettingsDrawer` — the wake-lock card and the Fullscreen card are not rendered
  in the shell.
- `NurseryModeContainer` — the footer's `wakeStatus` line and `nursery-dotlock`
  indicator are not rendered in the shell. This is the surface currently showing
  "WAKE LOCK NOT SUPPORTED".
- `useWakeLock` — skips its auto-acquire effect entirely in the shell, so no
  failed `navigator.wakeLock` call is attempted and nothing is logged.

`isNativeApp()` is read in a `useEffect` into state, never inline during render,
per the hydration rule in `CLAUDE.md`.

No web behavior changes. In a browser every control renders exactly as it does
today.

## 11. Operations

| Variable | Effect |
|---|---|
| `FCM_SERVICE_ACCOUNT_JSON` | Existing. Inline Firebase service-account JSON. Unset ⇒ Android native push disabled. |
| `APNS_AUTH_KEY` | New. Contents of the `.p8` APNs auth key. |
| `APNS_KEY_ID` | New. The key's 10-character identifier. |
| `APNS_TEAM_ID` | New. Apple Developer team identifier. |
| `APNS_BUNDLE_ID` | New. `apns-topic` header value — `com.sprouttrack.app`. |
| `APNS_PRODUCTION` | New. `'true'` ⇒ `api.push.apple.com`, otherwise the sandbox host. |

**`APNS_PRODUCTION` is the operational trap.** Only an Xcode-installed
development build mints *sandbox* device tokens. TestFlight builds are signed
with an App Store distribution profile (`aps-environment: production`) and so,
like App Store builds, mint *production* tokens — TestFlight is not sandbox.
A token minted under one environment returns `BadDeviceToken` against the
other host. This is why §5.2 does not delete on `BadDeviceToken`: during
rollout it will almost always mean the environment is misconfigured, not that
the device is gone.

All variables are documented in
`documentation/Admin-Documentation/environment-variables.md`, noting that native
push is a SaaS-only capability (D1) and that self-hosted deployments leave all of
them unset and are unaffected.

## 12. Testing

**Server** (`tests/*.test.ts`, node env, `@/` alias):

- `apnsPush` — JWT claim construction, header assembly, `apns-collapse-id` only
  when a tag is present, 410/`Unregistered` classification, `BadDeviceToken`
  classified transient, unconfigured no-op
- `nativePush` — dispatch by `platform`, all three lifecycle transitions, deletion
  across multiple family rows for one token, partial configuration (FCM without
  APNs)
- `device-tokens` route — composite-key upsert, 404 when unconfigured,
  unauthenticated DELETE by exact token, DELETE success when no row existed
- `shell-chrome` — `nurseryDisplayControls` both branches
- `deployment-config` — `nativePushEnabled` retained alongside `nativePush`
- `account-emails` — verification and reset emails use the `/verify?token=` and
  `/passwordreset?token=` path forms
- Notification-type → route mapping table, and every entry present in the
  allow-list

**Shell** (colocated `*.test.ts(x)`, vitest + jsdom):

- `push.ts` — every permission branch; `registration` listener attached before
  `register()`; timeout path; registration failure never changing
  `ConnectOutcome`
- `connect.ts` — `registerPush` invoked with the fresh JWT; a throwing
  `registerPush` still returns `'navigated'`
- `App.tsx` — tap routing to a matching saved server; unknown slug falls through
  to normal boot
- `Settings.tsx` — all three notification row states
- `NotificationsIntro.tsx` — shown once, `declined` recoverable
- `sessionHandoffUrl` — route allow-list enforced, unknown route falls back to
  `log-entry`
- `screenForDeepLink` — every claimed path resolves; **`/account` and
  `/account/*` resolve to `null`**; unknown paths resolve to `null`
- `AccountResetConfirm` — all four states; `400` mid-flow falls back to the
  invalid state rather than a generic error; `429` surfaces the lockout message;
  submit disabled until every `PW_REQS` rule passes; entered password survives a
  network failure
- `account.ts` — `validateResetToken` and `submitPasswordReset` envelope
  unwrapping, including malformed and non-200 responses

Both suites stay green: 706 (sprout-track) and 122 (shell).

Native code (§10.1) is not covered by either suite. The path-matching rule is the
only logic in it; everything else is two platform API calls. It is verified
manually on a device, and the manual check is recorded in the plan.

Association-file correctness (§9.3) cannot be unit-tested meaningfully — it is
verified against Apple's CDN and Android's verification status on a real device,
recorded as an explicit manual step in the plan.

## 13. Out of scope

- Native push for third-party self-hosted deployments (D1)
- Cross-family notification taps while the app is warm (§8)
- Deep links for root-level family slugs (§9.6)
- Aligning the server's reset-password rule with its register rule (§6.5)
- Per-device notification preferences in the shell — native push continues to
  inherit the server's existing `NotificationPreference` matching unchanged
- Rich notifications: images, actions, reply-inline
- `NotificationLog` entries for native sends; health remains observable through
  `failureCount` / `lastFailureAt` / `lastSuccessAt` and prefixed server logs

## 14. Verified facts behind this design

Confirmed by reading source in this repo and `node_modules`, not assumed:

- `@capacitor/push-notifications` emits `pushNotificationActionPerformed` with
  `retainUntilConsumed: true` on both platforms
  (`PushNotificationsHandler.swift:79`, `PushNotificationsPlugin.java:75`)
- The same plugin emits `registration` **without** retention on iOS
  (`PushNotificationsPlugin.swift:188`) but **with** retention on Android
  (`PushNotificationsPlugin.java:209`)
- `CAPBridgeViewController` is `open`; `capacitorDidLoad()` and
  `setStatusBarVisible(_:)` are `open`; `webView` is publicly readable
  (`CAPBridgeViewController.swift:5,164,237,11`)
- `Bridge.setWebViewClient(BridgeWebViewClient)` and `Bridge.getWebView()` are
  public (`Bridge.java:1456,511`)
- `android/app/build.gradle` already applies `com.google.gms.google-services`
  conditionally on `google-services.json` being present
- `Family.accountId` is `@unique` (one family per account) while `FamilyMember`
  is a join table, so one caretaker across several families is a supported state
- `connectToFamily` holds both a fresh JWT (`result.token`) and `entry.baseUrl`
  immediately before handoff (`src/services/connect.ts:54-57`)
- Account emails build hash-based URLs at the root path —
  `${domainUrl}/#verify?token=` and `${domainUrl}/#passwordreset?token=`
  (`app/api/utils/account-emails.ts:30,72`) — so neither is matchable by
  Universal or App Links as written
- `AccountReset.tsx` is the reset-*request* screen (email input only); the shell
  has no screen that consumes a reset token, which is why §6.5 adds one
- `app/api/accounts/reset-password/route.ts` already exposes both halves of the
  flow: `GET ?token=` → `{ valid, email? }` and `POST { token, password }`, with
  a shared IP lockout returning 429
- That route's `isValidPassword` requires only 8+ characters with a letter and a
  number, whereas `app/api/accounts/register/route.ts` additionally requires
  upper, lower, and a symbol — the shell's `PW_REQS` mirrors the *register* rule
- `AccountVerify.tsx` polls `fetchAccountStatus` every 5 s while telling the user
  to tap the emailed link and return, so verification already resolves without a
  deep link — the deep link improves it rather than enabling it
- `MainActivity` is already `launchMode="singleTask"`, so App Links arrive via
  `onNewIntent` rather than creating a second activity instance
- `MANAGE_SUBSCRIPTION_URL` is `https://sprout-track.com/account`, which is why
  §9.1 excludes that path
