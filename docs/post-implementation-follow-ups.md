# Manual Follow-Ups — Native Push, Deep Links, Nursery Wake

**Created:** 2026-07-27
**Applies to:** `mobile-app-v1` branch `feature/native-push-and-deep-links` and
`sprout-track` branch `feature/native-aware-layer`
**Design:** `docs/superpowers/specs/2026-07-25-native-push-and-nursery-wake-design.md`

Everything in the code is done and tested (947 server tests, 426 shell tests).
The items below are the things a machine can't do — they need a human with
access to Apple's developer portal, Google Play Console, Firebase, and the
production server.

Nothing here is optional if you want push and deep links to work. Several fail
**silently** if skipped, which is why each item has a "how to prove it worked"
step. Do those; don't assume.

## Order to do these in

Some depend on others. This order avoids backtracking:

1. **§4 Firebase / `google-services.json`** — needed before any Android push works
2. **§1 Xcode capabilities + APNs key** — needed before any iOS push works
3. **§5 `APNS_PRODUCTION`** — depends on the key from §1
4. **§2 `rootDomain`** — decides the values used in §3
5. **§3 `.well-known` files** — needs §2's answer and §4's Play fingerprint
6. **§6 On-device nursery check** — needs a build on a device, so it comes last

A note on §3: the Play App Signing fingerprint doesn't exist until you've
uploaded at least one build to the Play Console. If you haven't yet, do a first
internal-testing upload, then come back.

---

## 1. Xcode: signing, Push, and Associated Domains

**Why it matters.** Two things the CLI can't do. First, iOS won't deliver push
to an app whose App ID lacks the Push Notifications capability — the OS refuses
to issue a device token at all. Second, Universal Links only work if the App ID
has Associated Domains enabled. Both live in Apple's developer portal, and Xcode
is what reconciles your local project with it.

The entitlements file is already committed at `ios/App/App/App.entitlements`,
and `project.pbxproj` already points at it. What's missing is the portal side.

### Steps

1. Open the project:
   ```bash
   cd /Users/johnoverton/Development/mobile-app-v1
   npx cap open ios
   ```
   That opens `ios/App/App.xcworkspace` in Xcode.

2. In the left file navigator, click the blue **App** project icon at the top,
   then select the **App** target, then the **Signing & Capabilities** tab.

3. Confirm **Automatically manage signing** is ticked and your Team is selected.
   Bundle Identifier must read `com.sprouttrack.app`.

4. Click **+ Capability** (top-left of that tab). Add **Push Notifications**.
   Then click **+ Capability** again and add **Associated Domains**.

5. Under Associated Domains you should see `applinks:sprout-track.com` already
   populated from the committed entitlements file. If the box is empty, type it
   in exactly — no `https://`, no trailing slash.

6. Xcode will contact Apple and update the App ID. Watch for a yellow warning
   triangle in that tab; if one appears, click it and let Xcode fix the issue.

### Create the APNs key (if you don't have one yet)

This is what the *server* uses to send. It's separate from the app's signing.

1. Go to <https://developer.apple.com/account/resources/authkeys/list>
2. Click **+**, name it something like "Sprout Track Push", tick
   **Apple Push Notifications service (APNs)**, click Continue then Register.
3. **Download the `.p8` file. Apple lets you download it exactly once.** Store it
   in your password manager.
4. Note the **Key ID** shown on that page (10 characters).
5. Your **Team ID** is at <https://developer.apple.com/account> under Membership
   Details (10 characters).

Those three values become `APNS_AUTH_KEY` (the file's contents),
`APNS_KEY_ID`, and `APNS_TEAM_ID` on the server. `APNS_BUNDLE_ID` is
`com.sprouttrack.app`. The Team ID is also `APPLE_TEAM_ID`, used by the server
to build the Apple App Site Association file in §3.

### Verify the Release build resolves correctly

`App.entitlements` has `aps-environment` set to `development`. That's correct for
the checked-in file — Xcode substitutes `production` automatically when you
archive. Confirm it rather than trusting it:

1. **Product → Archive** (with "Any iOS Device" selected as the destination).
2. When the Organizer opens, right-click the archive → **Show in Finder**.
3. Right-click the `.xcarchive` → **Show Package Contents** →
   `Products/Applications/App.app`.
4. In Terminal:
   ```bash
   codesign -d --entitlements :- /path/to/App.app
   ```

**Done when:** that output shows `<key>aps-environment</key><string>production</string>`
and an `associated-domains` array containing `applinks:sprout-track.com`.

---

## 2. Confirm the production root domain

**Why it matters.** This is the single highest-risk item on the list, because
getting it wrong makes **every deep link silently dead** and there is no error
message anywhere.

Universal Links and App Links match on the exact hostname. The app claims
`sprout-track.com`. If your production site actually serves on
`www.sprout-track.com` — or if the apex redirects to `www` — then iOS and Android
will never match a link, and every reset/verify/setup email link opens the
browser instead of the app. Everything will look like it "just didn't work."

### Where to check

`rootDomain` is **a database row, not a config file** — it lives in the
`AppConfig` table and is edited from the app's admin settings UI
(`src/components/forms/AppConfigForm/index.tsx`). It's what
`app/api/utils/account-emails.ts` uses to build the links in verification and
password-reset emails.

1. Check the value in production:
   ```bash
   # against the production database
   npx prisma studio
   ```
   Open the `AppConfig` table and read `rootDomain`. Or query directly:
   ```sql
   SELECT "rootDomain", "enableHttps" FROM "AppConfig";
   ```

2. Check what the site actually canonicalises to:
   ```bash
   curl -sI https://sprout-track.com | head -n 5
   curl -sI https://www.sprout-track.com | head -n 5
   ```
   Look at the status line. A `301`/`308` with a `Location:` header tells you
   which form is canonical.

### If it's `www` (or anything other than `sprout-track.com`)

Five places must change together, or deep links stay broken:

| File | Repo | What to change |
|---|---|---|
| `ios/App/App/App.entitlements` | shell | `applinks:sprout-track.com` |
| `android/app/src/main/AndroidManifest.xml` | shell | `android:host="sprout-track.com"` |
| `src/services/deep-links.ts` | shell | the `HOST` constant |
| `src/services/account.ts` | shell | `SAAS_BASE` |
| `AppConfig.rootDomain` | server DB | the email link domain |

Then re-run `npm run sync` and rebuild both apps.

**Done when:** `rootDomain` in the database, the four shell constants, and the
hostname your site actually serves on are all the same string, and that hostname
serves the `.well-known` files in §3 without a redirect.

---

## 3. Publish and verify the two association files

**Why it matters.** These files are how Apple and Google verify that your app is
allowed to claim links on your domain. Both platforms fetch them from your
server. If either is wrong, that platform's deep links silently don't work.

The routes are already implemented and will serve automatically once deployed:
- `sprout-track/app/.well-known/apple-app-site-association/route.ts`
- `sprout-track/app/.well-known/assetlinks.json/route.ts`

Both read values from environment variables that must be set in production.

### 3a. Set the two environment variables

| Variable | Value | Where to get it |
|---|---|---|
| `APPLE_TEAM_ID` | Your 10-character Apple Team ID | <https://developer.apple.com/account> → Membership Details |
| `ANDROID_CERT_SHA256` | The **Play App Signing** SHA-256 fingerprint | See below — **not** your local upload key |

**The Play fingerprint is the one people get wrong.** Google re-signs your app
with their own key when it goes through Play. The fingerprint that matters is
theirs, not the keystore on your machine.

1. Go to <https://play.google.com/console> and select the app.
2. Left sidebar: **Test and release → Setup → App integrity**
   (older console: **Release → Setup → App signing**).
3. Under **App signing key certificate**, copy the **SHA-256 certificate
   fingerprint**. It looks like `AB:CD:EF:...` with colons — copy it exactly,
   colons included.

> If the app has never been uploaded to Play, this section won't exist yet. Do a
> first internal-testing upload, then come back.

### 3b. Verify both files are served correctly

After deploying, from any machine:

```bash
curl -i https://sprout-track.com/.well-known/apple-app-site-association
curl -i https://sprout-track.com/.well-known/assetlinks.json
```

Check all four of these on the AASA response:

- Status is **`200`** — not `301`, not `308`. **Apple's CDN does not follow
  redirects.** If you get a redirect, that's a fail even though a browser would
  follow it happily.
- `Content-Type:` is **`application/json`**
- The URL has **no `.json` extension** on the Apple one — it's
  `apple-app-site-association` with no extension, which is why it's implemented
  as a route rather than a static file
- The body's `appIDs` reads `<YOUR_TEAM_ID>.com.sprouttrack.app` — if you see the
  literal string `TEAMID`, `APPLE_TEAM_ID` isn't set in production

For `assetlinks.json`, confirm `sha256_cert_fingerprints` contains the Play
fingerprint and isn't an empty string.

### 3c. Confirm Android actually verified the link

Install the app on a device, then:

```bash
adb shell pm get-app-links com.sprouttrack.app
```

**Done when:** you see `sprout-track.com: verified`. If it says `legacy_failure`
or `verification_failure`, the `assetlinks.json` fingerprint doesn't match the
signing key of the installed build.

You can also paste your domain into Apple's validator:
<https://branch.io/resources/aasa-validator/>

---

## 4. Supply `google-services.json` (Android only)

**Why it matters.** Without this file the Firebase SDK can't register the device
with FCM, so Android never gets a push token and never receives a notification.
`android/app/build.gradle` applies the Google Services plugin **conditionally on
this file existing**, so its absence isn't a build error — it's a silent
no-push.

It's gitignored on purpose (it identifies your Firebase project).

### Steps

1. Go to <https://console.firebase.google.com> and open (or create) the Sprout
   Track project.
2. **Project settings** (gear icon) → **General** → scroll to **Your apps**.
3. If there's no Android app, click the Android icon and register one with
   package name exactly `com.sprouttrack.app`.
4. Download **`google-services.json`**.
5. Put it at:
   ```
   /Users/johnoverton/Development/mobile-app-v1/android/app/google-services.json
   ```
6. Rebuild:
   ```bash
   cd /Users/johnoverton/Development/mobile-app-v1 && npm run sync
   ```

### While you're in Firebase — the server credential

The server needs a service account to *send*:

1. **Project settings → Service accounts → Generate new private key**.
2. That downloads a JSON file. Its **entire contents** become the
   `FCM_SERVICE_ACCOUNT_JSON` environment variable on the server (one line, or
   properly escaped — the code parses it with `JSON.parse`).

### Do NOT add `GoogleService-Info.plist`

iOS uses **direct APNs** — there is no Firebase SDK in the iOS project, and
`Package.swift` has no Firebase dependency. Adding that file would do nothing
and would be misleading. The `.gitignore` entry for it is annotated as a safety
net only.

**Done when:** `npm run sync` succeeds with the file present, and a debug build
on a real Android device receives a test notification (Firebase Console →
Messaging → Send test message, pasting the device's FCM token).

---

## 5. Set `APNS_PRODUCTION` correctly

**Why it matters.** This is the most likely reason iOS push will appear broken
after launch, and it fails **completely silently**.

Apple runs two entirely separate push environments. A device token minted in one
is meaningless in the other — sending to the wrong one returns `BadDeviceToken`
and nothing arrives. Because the code (correctly) treats `BadDeviceToken` as a
*transient* error rather than a dead token, you get no deletion, no alert, just
a slowly climbing `failureCount` column and silence.

### The rule

| How the app was installed | Environment | `APNS_PRODUCTION` |
|---|---|---|
| Xcode direct install (development build) | **sandbox** | unset or `false` |
| **TestFlight** | **production** | **`true`** |
| App Store | **production** | **`true`** |

**TestFlight is production.** This is the counter-intuitive part and the reason
this item exists — TestFlight builds are signed with an App Store distribution
profile, which carries `aps-environment: production`. People assume "beta = test
= sandbox" and lose a week to it.

So: the moment you push a build to TestFlight, the production server must have
`APNS_PRODUCTION=true`.

### Full APNs environment block

```bash
APNS_AUTH_KEY="-----BEGIN PRIVATE KEY-----\n...contents of the .p8...\n-----END PRIVATE KEY-----"
APNS_KEY_ID=ABC1234567          # 10 chars, from the Keys page
APNS_TEAM_ID=TEAM123456         # 10 chars, from Membership Details
APNS_BUNDLE_ID=com.sprouttrack.app
APNS_PRODUCTION=true            # true for TestFlight and App Store
```

If you're testing against a local Xcode build at the same time, that's a
different server environment — you can't serve both from one deployment.

**Done when:** a TestFlight build receives a real notification. If it doesn't,
check the server logs for `[APNs] send failed (400)` with `BadDeviceToken` —
that's this exact problem.

---

## 6. On-device nursery mode check

**Why it matters.** The nursery screen-wake is the one piece of this work with
**no automated test coverage**, and it can't have any — it's native Swift and
Java observing WebView URL changes, driven by a web app running on a remote
origin. The unit tests cover the path-matching function; nothing covers whether
the OS actually keeps the screen on.

It's also the piece with no fallback. The web-side controls were deliberately
removed inside the app (they showed "WAKE LOCK NOT SUPPORTED"), so if the native
code doesn't fire, nursery mode has **no** keep-awake at all.

### Setup

```bash
cd /Users/johnoverton/Development/mobile-app-v1
npx cap run ios        # or: npm run android
```

Then connect to a family and open nursery mode.

> Reminder from `CLAUDE.md`: the Android emulator is NAT'd — the Mac is
> `10.0.2.2`, not its LAN IP. Use `http://10.0.2.2:3000/<family-slug>`. The iOS
> Simulator shares the Mac's network, so `http://localhost:3000/<slug>` works.
>
> Screen-dimming behaviour is only meaningful on a **real device** — simulators
> don't sleep the way hardware does. Do the final pass on hardware.

### Checklist — run on both iOS and Android

- [ ] **Entering nursery mode:** the status bar hides (iOS) / status and
      navigation bars hide (Android)
- [ ] **Screen stays awake:** leave it untouched past the device's normal
      auto-lock. Set Settings → Display → Auto-Lock to 30 seconds first so this
      takes half a minute rather than five.
- [ ] **Exiting nursery mode** (the "Exit" button): bars come back, and the
      screen resumes dimming normally afterward
- [ ] **No state stacking:** enter and exit three or four times in a row, then
      leave the app idle on a normal screen. It should dim. If it doesn't, the
      keep-awake flag is leaking.
- [ ] **Settings drawer inside the app** shows **no** "Screen wake lock" card and
      **no** "Fullscreen" card, and the footer shows no "WAKE LOCK NOT SUPPORTED"
- [ ] **Same page in a desktop browser** still shows both cards working normally
      — this proves the native-aware gating didn't leak into the web experience
- [ ] **Backgrounding:** enter nursery, background the app, return. Bars should
      still be hidden and the screen still awake.

**Done when:** every box is ticked on both platforms, on real hardware.

---

## Quick reference — all environment variables

Set on the **production server** (`sprout-track`):

| Variable | Purpose | From |
|---|---|---|
| `FCM_SERVICE_ACCOUNT_JSON` | Android push sending | Firebase → Service accounts (§4) |
| `APNS_AUTH_KEY` | iOS push sending | The `.p8` file's contents (§1) |
| `APNS_KEY_ID` | iOS push sending | Apple → Keys (§1) |
| `APNS_TEAM_ID` | iOS push sending | Apple → Membership (§1) |
| `APNS_BUNDLE_ID` | iOS push sending | `com.sprouttrack.app` |
| `APNS_PRODUCTION` | iOS environment | `true` for TestFlight/App Store (§5) |
| `APPLE_TEAM_ID` | Builds the AASA file | Same as `APNS_TEAM_ID` (§3) |
| `ANDROID_CERT_SHA256` | Builds `assetlinks.json` | Play Console → App integrity (§3) |

Files that live outside git:

| File | Location | §|
|---|---|---|
| `google-services.json` | `android/app/` | §4 |
| The APNs `.p8` key | Password manager — Apple allows one download | §1 |

Native push is **SaaS-only**. Self-hosted deployments leave every one of these
unset; the device-token routes return 404 and nothing else changes for them.

---

## Known follow-ups (not blocking)

Recorded during implementation, safe to ship without:

- **`Step2Security` has no "can't remove the last admin" guard.** Add caretaker A
  (forced admin), add B, remove A, and you're left with a non-admin. Pre-existing;
  affects the account signup flow too, not just setup links. The setup flow now
  refuses to advance in that state, so it isn't reachable there.
- **`nativeOwnerKey` can under-collapse across auth shapes.** A web subscription
  stamped under PIN auth and a native preference stamped under account auth for
  the same person produce different dedupe keys, so one device could receive two
  pushes. Narrow — the common path stamps both ids.
- **Native preference creation has a find-then-write race.** Two concurrent PUTs
  could double-create a row. Not expressible as a DB constraint across nullable
  columns on either provider; the per-owner dedupe removes the visible symptom.
- **Deep links with a claimed path but an unrecognised shape are dropped**, not
  handed to the browser (e.g. `/verify` with no `?token=`). The AASA patterns
  `/verify*` and `/passwordreset*` are unbounded prefixes, so a future
  `/verify-email-changed` route would become a dead link the day it ships. Worth
  tightening the server AASA and the Android manifest together at some point.
