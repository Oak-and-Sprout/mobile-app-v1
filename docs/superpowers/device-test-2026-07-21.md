# Device test checklist, 2026-07-21

Manual pass for Task 13 (Browser plugin + icons + closing UI-pass-2 work).
Run on a real iOS device/simulator and a real Android device/emulator against
a local server (`npm run dev` in `sprout-track/`, branch `feature/native-aware-layer`).
Record results inline (pass/fail + notes) as you go; this file is meant to be
filled in by hand, not re-generated.

Networking reminders: Android emulator reaches the Mac at `10.0.2.2:3000`
(or `localhost:3000` after `adb reverse tcp:3000 tcp:3000`); iOS Simulator
reaches it directly at `localhost:3000`.

## 1. Bridge-injection spike (Capacitor Browser plugin)

This is the thing this task can’t verify from a laptop shell alone; it needs
real devices with remote devtools attached.

- [ ] Build and install the app with the new `@capacitor/browser` plugin
      (`npm run sync`, then `npx cap run ios` / `npx cap run android`, or open
      in Xcode/Android Studio and run).
- [ ] Open a family in-shell against the local server (add server as
      `http://10.0.2.2:3000/<family-slug>` on Android, `http://localhost:3000/<family-slug>`
      on iOS Simulator; a real device needs the Mac’s LAN IP instead of
      `localhost`).
- [ ] Attach remote devtools to the webview:
  - iOS: Safari → Develop menu → \<device/simulator name> → the webview’s page.
  - Android: Chrome → `chrome://inspect/#devices` → the webview’s page.
- [ ] In the devtools console, evaluate `window.Capacitor?.Plugins?.Browser`.
      Expected: an object (the plugin proxy), not `undefined`, on both
      platforms. Record what actually prints.
- [ ] From the account menu, open Account settings and go to the subscription
      section. Tap "Manage your subscription at sprout-track.com."
- [ ] Record which path fired on each platform:
  - Expected: `Capacitor.Plugins.Browser.open(...)` opens the system browser
    (Safari View Controller on iOS / Chrome Custom Tab on Android) as an
    in-app overlay, not a full app switch.
  - Fallback path (if the plugin isn’t detected by the web app for some
    reason): `window.open(url, '_blank')`, which on a Capacitor webview
    typically bounces out to the full system browser app instead.
  - iOS result: _____________________________________________
  - Android result: __________________________________________
- [ ] Confirm the webview itself never navigates to Stripe or a payment page
      (no in-app checkout UI) on either platform. This is the App Store /
      Play Store payments compliance boundary from PR #234, not optional.

## 2. Happy paths

### Splash → fork routing

- [ ] Fresh install, no saved families: splash screen shows for about 2.7s,
      then routes to the fork screen with no flash of the wrong screen.
- [ ] With at least one saved family and auto-open on: splash routes straight
      into that family’s webview instead of stopping at “My Families.”
- [ ] With at least one saved family and auto-open off: splash routes to
      "My Families" showing the saved server(s).

### Account signup + verify

- [ ] From the fork screen, choose the account path and sign up with a new
      email/password.
- [ ] Password checklist updates live as you type (length, character class
      requirements light up/gray out correctly, no stale state).
- [ ] After submitting, the verify-first screen appears and polls the server;
      confirm the email from a second device/tab and watch the screen advance
      on its own (no manual refresh needed).
- [ ] Sign in with a deliberately wrong password first, confirm the error
      reads like a person wrote it (no raw status code or stack trace).
- [ ] Exercise the reset-password flow from the sign-in screen end to end.

### Native setup wizard + caretaker link flow

- [ ] Start "Create a new family" from the fork/account flow.
- [ ] Step 1 (family): submit, confirm `POST /api/setup/start` fires (watch
      the network tab) and the wizard advances.
- [ ] Step 2 (security, "Who can open the book?"): submit the security step
      and confirm the network sequence matches the mode you tested:
      - Caretakers mode (a caretaker with ID+PIN): `POST caretaker` once per
        caretaker, then `PUT settings` (`authType: 'CARETAKER'`), then
        `PUT update-setup-stage` (stage 2).
      - PIN mode (a single family PIN, no caretaker ID): `PUT settings`
        (`securityPin` + `authType: 'SYSTEM'`), then `PUT update-setup-stage`
        (stage 2), with no `POST caretaker` call at all.
      Test both modes at least once; the order is not the same for each.
- [ ] Step 3 (baby): submit; confirm `POST baby` fires, then the caretaker
      lookup — `GET /api/caretaker?familyId=` (not
      `GET /api/family/{id}/caretakers`, which is sysadmin-gated and 403s for
      account JWTs) — then `link-caretaker`. In caretakers mode with more
      than one caretaker, confirm the account links to the one with the
      lowest login ID, not whichever one the list happens to return first
      (the endpoint orders by name).
- [ ] Confirm the wizard then **re-logs-in with the just-vaulted credentials**
      (a fresh `POST /api/auth` or `/api/accounts/login`, not a silent
      refresh) rather than depending on the refresh-token cookie, and that
      login succeeds without the user re-entering anything.
- [ ] Confirm the family is now saved and appears in "My Families."
- [ ] Kill the app mid-wizard (after step 1, before step 3) and relaunch;
      confirm resume reads `GET /api/family/setup-status` and drops the user
      back into the correct step for the security mode used (a PIN-mode
      family must resume into PIN mode, not caretakers mode). If you can
      simulate an older server that omits `authType`, confirm the wizard
      falls back to assuming caretakers mode rather than failing, since the
      caretaker-link step’s system-caretaker fallback makes that guess safe
      even for a pin-mode family. This fallback is genuinely exercisable now
      that the lookup uses the account-accessible endpoint above — with the
      old sysadmin-gated endpoint it 403'd before the fallback logic could
      ever run, so this checklist item could not previously pass for an
      account-JWT user.

## 3. Anti-slop 5-second check (per screen)

For each screen below: look at it for 5 seconds, then look away. Can you say
what it is and what to tap, without re-reading? Also confirm no purple/blue
gradients, no glassmorphism, no colored border strips, no emoji in UI copy,
and headings/body use Literata/Alegreya Sans (not a system-font fallback).

- [ ] Splash
- [ ] Fork (sign-in chooser)
- [ ] Add family / find-my-family
- [ ] Connecting (loading state)
- [ ] Account sign-in
- [ ] Account sign-up (with live password checklist)
- [ ] Account verify (polling state)
- [ ] Account reset
- [ ] Wizard step 1 (family)
- [ ] Wizard step 2 (security)
- [ ] Wizard step 3 (baby)
- [ ] My Families (including the biometric unlock prompt when opening a
      locked family)
- [ ] Settings
- [ ] Offline state

Note any screen that reads as generic AI-app output (unmodified component
defaults, invented colors, filler copy like "Supercharge" or "Seamlessly,"
em dashes in UI copy) rather than the Sprout Track storybook world.

## Sign-off

- [ ] iOS run completed, date: __________, device/simulator: __________
- [ ] Android run completed, date: __________, device/emulator: __________
- [ ] Any failures filed as follow-up issues (link them here): __________
