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

- Session handoff is v0: the shell verifies and stores credentials (and seeds the
  server's refresh cookie via native HTTP), but the web app may still show its own
  login screen until the sprout-track native-aware layer ships (follow-up plan).
- Bridge spike (spec §10 risk 3) still to be validated on-device: Capacitor bridge
  availability on arbitrary `allowNavigation` hosts.
