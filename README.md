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

## iOS (not yet generated)

Requires full Xcode and CocoaPods (or Capacitor SPM support):

    sudo gem install cocoapods   # or: brew install cocoapods
    npm i @capacitor/ios
    npx cap add ios
    npx @capacitor/assets generate --ios
    npx cap run ios

## Known v0 limitations

- Silent session handoff requires a Sprout Track server running the native-aware
  layer (sprout-track branch `feature/native-aware-layer`); older servers fall
  back to showing the web login screen once.
- Native push requires the server to set `FCM_SERVICE_ACCOUNT_JSON`; the app
  skips the permission prompt when `/api/deployment-config` reports
  `nativePushEnabled: false`.
- Bridge spike (spec §10 risk 3) still to be validated on-device: Capacitor bridge
  availability on arbitrary `allowNavigation` hosts.
- The biometric gate is enforced in the app layer (verify-then-return: prompt for
  biometrics, then read the stored credentials) rather than via OS-level Keychain/Keystore
  access control on the entry itself. Hardening to accessControl-backed storage (so the
  OS refuses to release the secret without a fresh biometric check) is a planned follow-up.
