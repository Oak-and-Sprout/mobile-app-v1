# Sprout Track Mobile

Capacitor shell for the Sprout Track baby-tracking app. Wraps the remote web app
(sprout-track.com or a self-hosted instance) with native server management,
biometric credential storage, and — in later passes — keep-awake, camera, and push.

Design: `docs/superpowers/specs/2026-07-20-capacitor-mobile-app-design.md`
Plan:   `docs/superpowers/plans/2026-07-20-capacitor-shell-first-pass.md`

## Development

    npm install
    npm run dev        # shell in the browser
    npm test           # vitest
    npm run sync       # build + cap sync
    npm run android    # sync test browsers (below), then run on device/emulator
    npm run android:browsers   # just the test-browser sync

The Android build needs a Java runtime. If `java` isn't on your PATH, point
`JAVA_HOME` at Android Studio's bundled one (add to `~/.zshrc` to persist):

    export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

The shell UI follows the v1-storybook theme (`docs/mockups/capacitor-app.html`); fonts are
bundled via @fontsource (no network needed at runtime).

To test against a Sprout Track server running on your Mac (`npm run dev` in the
sprout-track repo), add the server in the app as `http://10.0.2.2:3000/<family-slug>`
— `10.0.2.2` is the emulator's alias for the host machine; cleartext http is enabled.

### Test browsers on the emulator

Some flows hand off to a real browser rather than staying in the app — most
importantly subscription management at `/account`, which the shell deliberately
does not claim as a deep link (App Store compliance). To exercise those, the
emulator needs browsers installed.

Download them from **[apkmirror.com](https://apkmirror.com)** — Firefox,
Waterfox, Chrome, Brave and anything else we've needed are all there — and drop
the downloads into an **`apks/`** folder at the repo root. That folder is
gitignored and **does not exist on a fresh clone**, so create it; the files run
to hundreds of MB and are never committed. Either apkmirror format works: a
plain universal `.apk`, or an `.apkm`/`.apks`/`.xapk` split bundle (unpacked
automatically to the base APK plus only the ABI and density splits your target
can use — installing every split at once conflicts).

The folder is the source of truth. `npm run android` scans it recursively and
brings each attached device in line with it:

| you do this in `apks/`          | next run does this on the device |
| ------------------------------- | -------------------------------- |
| add an APK                      | installs it                      |
| delete an APK                   | uninstalls it                    |
| swap in a newer download        | reinstalls it                    |
| move an APK between subfolders  | nothing — recognized as a move   |

State lives in `apks/manifest.json`, generated for you: a catalog of the folder
(package id, app label, version, size) plus, per device serial, what the folder
owns there. A package is only ever uninstalled if the manifest says the folder
owns it — either the script installed it, or it was already on the device while
its APK sat in `apks/` (adopted on the first sync). A browser with no APK in the
folder is never touched.

    npm run android:browsers -- --dry-run   # show the plan, touch nothing
    REINSTALL_TEST_BROWSERS=1 npm run android:browsers   # force reinstall
    SKIP_TEST_BROWSERS=1 npm run android                 # skip the sync entirely

This step never fails the build: a missing Android SDK, no attached device, or
no `apks/` folder just prints a warning and `cap run android` continues. If the
emulator wasn't running yet, start it and run `npm run android:browsers`.

Installing a browser does not make it the default — Chrome holds the browser
role on a Play-services image, so hand-off still opens Chrome. To point it
elsewhere:

    adb shell cmd role add-role-holder android.app.role.BROWSER org.mozilla.firefox

## App flows

- **Splash → fork**: on launch the splash screen shows for ~2.7s, then the app
  forks to either the "no saved families" onboarding path or, when at least one
  server/family is saved, the "My Families" list (with auto-open of the default
  family if that preference is on).
- **Account (email/password)**: sign-in and signup share a screen; signup shows
  a live password-requirements checklist as the user types. After signup the
  user lands on a verify-first screen that polls the server until the email is
  confirmed before proceeding. A separate reset-password flow is reachable from
  sign-in.
- **Native setup wizard** (creating a new family from the app): the wizard
  drives the server through `POST /api/setup/start`, then a security step
  whose call order depends on the chosen security mode, then `POST` the baby
  and link the caretaker:
  - Caretakers mode: `POST /api/caretaker` once per caretaker, then
    `PUT /api/settings` with `authType: 'CARETAKER'`, then
    `PUT update-setup-stage` to 2.
  - PIN mode: `PUT /api/settings` with `securityPin` and
    `authType: 'SYSTEM'`, then `PUT update-setup-stage` to 2 (no caretaker
    POSTs at all).

  Linking the account to a caretaker looks up the family's caretakers via
  `GET /api/caretaker?familyId=` (account-JWT accessible; ordered by name, so
  the wizard picks the lowest `loginId` rather than trusting list order) —
  not `GET /api/family/{id}/caretakers`, which is sysadmin-gated and 403s for
  account JWTs.

  It then **re-logs-in with the just-vaulted credentials** (rather than
  relying on the refresh-token cookie) so the shell doesn't depend on that
  cookie reaching the webview — see the refresh-cookie caveat below. Once
  login succeeds the family is saved to the server registry. If the wizard is
  interrupted, resuming reads `GET /api/family/setup-status`, which carries
  the auth type so the wizard resumes into the right security mode; if an
  older server doesn't report it, the resume falls back to assuming
  caretakers mode, which is safe because the caretaker-link step also falls
  back to the system caretaker when the family has none but the reserved
  `'00'` entry, so a pin-mode family guessed as caretakers still links
  correctly instead of failing. This fallback is genuinely reachable now
  that the caretaker lookup uses an account-accessible endpoint — before the
  endpoint fix above, the lookup 403'd before the fallback could ever run, so
  the claim was aspirational for every account-JWT caller.
- **Subscription management**: shown in-app as display-only (plan/status), no
  billing UI is rendered natively. Actually managing a subscription opens the
  system browser: the web app calls the `@capacitor/browser` plugin
  (`Browser.open`) when running inside the shell, falling back to
  `window.open(url, '_blank')` otherwise. That invocation lives server-side
  (sprout-track branch `feature/native-aware-layer`, PR #234); this repo's
  role is just to ship the plugin so the native call succeeds — see the device
  checklist for the manual verification steps (`docs/superpowers/device-test-2026-07-21.md`).

## iOS

The ios/ platform is generated and committed (requires full Xcode; dependencies
resolve via Swift Package Manager — no CocoaPods needed):

    npx cap run ios      # build and run on a simulator/device

Info.plist carries camera/photo-library/Face ID usage descriptions and an ATS
exception for plain-http LAN servers. The iOS Simulator reaches a server on
your Mac directly at `http://localhost:3000/<family-slug>` (no host alias needed).

## Known v0 limitations

- Silent session handoff passes the shell's login to the web app via a
  `#bridge-session=` fragment; it requires a server running the native-aware layer
  (sprout-track branch `feature/native-aware-layer`). Older servers ignore the
  fragment and show the web login once. The web session may also not auto-refresh
  past ~30 min (the shell's refresh cookie may not reach the webview); expiry then
  routes back through the shell, which re-logs-in with saved credentials.
- Native push requires the server to set `FCM_SERVICE_ACCOUNT_JSON`; the app
  skips the permission prompt when `/api/deployment-config` reports
  `nativePushEnabled: false`.
- Native push also needs the Firebase app config on the app side: Android requires
  `android/app/google-services.json` (not yet added); iOS will need the Firebase
  iOS SDK to obtain FCM-compatible tokens (the plugin's registration event yields
  APNs tokens, which the FCM v1 API does not accept).
- Bridge spike (spec §10 risk 3) still to be validated on-device: Capacitor bridge
  availability on arbitrary `allowNavigation` hosts.
- The biometric gate is enforced in the app layer (verify-then-return: prompt for
  biometrics, then read the stored credentials) rather than via OS-level Keychain/Keystore
  access control on the entry itself. Hardening to accessControl-backed storage (so the
  OS refuses to release the secret without a fresh biometric check) is a planned follow-up.
