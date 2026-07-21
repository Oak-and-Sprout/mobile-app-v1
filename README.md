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
    npm run android    # run on Android device/emulator (needs Android SDK)

The Android build needs a Java runtime. If `java` isn't on your PATH, point
`JAVA_HOME` at Android Studio's bundled one (add to `~/.zshrc` to persist):

    export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

The shell UI follows the v1-storybook theme (`docs/mockups/capacitor-app.html`); fonts are
bundled via @fontsource (no network needed at runtime).

To test against a Sprout Track server running on your Mac (`npm run dev` in the
sprout-track repo), add the server in the app as `http://10.0.2.2:3000/<family-slug>`
— `10.0.2.2` is the emulator's alias for the host machine; cleartext http is enabled.

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
