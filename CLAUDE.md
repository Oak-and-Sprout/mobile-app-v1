# CLAUDE.md — Sprout Track Mobile (mobile-app-v1)

Capacitor 8 shell (Vite + React 19 + TS + Tailwind v4) that wraps the remote
Sprout Track web app in the same webview ("architecture A"). The shell handles
pairing, saved families, credential storage, and biometric unlock; everything
else is the server's web UI. Spec: `docs/superpowers/specs/2026-07-20-capacitor-mobile-app-design.md`.

## ⚠️ Nested git repo — read before ANY commit

`sprout-track/` is a **separate git clone** of Oak-and-Sprout/sprout-track
(the server/web app). Its working branch is `feature/native-aware-layer`
(PR #234). **Never commit to its `main`** — this has gone wrong once already
because Bash cwd persists between calls and a commit landed in the inner repo.

Before every commit: `git rev-parse --show-toplevel` and `git branch --show-current`,
and confirm you're in the repo + branch you intend. The outer repo's work goes
on mobile-app-v1; server-side changes go on the sprout-track feature branch.

## Commands

- `npm test` — vitest (jsdom, colocated `*.test.ts(x)` files). Keep it green.
- `npm run dev` — shell in a browser.
- `npm run sync` — build + `cap sync` (run after changing web code or capacitor.config.ts).
- `npm run android` — needs `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"` if `java` isn't on PATH.
- `npx cap run ios` — full Xcode required; deps resolve via **SPM, not CocoaPods**.

In `sprout-track/`: `npm test` (706 tests, node env, `@/` alias), `npm run dev` (Next.js on :3000).

## Emulator/simulator networking (recurring gotcha)

- **Android emulator is NAT'd** (AndroidWifi, 10.x address). The Mac is
  `10.0.2.2`, *not* its LAN IP. Dev server address in-app:
  `http://10.0.2.2:3000/<family-slug>` (or `localhost:3000` after
  `adb reverse tcp:3000 tcp:3000`). The port is required — nothing answers on 80.
- **iOS Simulator shares the Mac's network**: `http://localhost:3000/<family-slug>` works directly.

## Networking model in the shell

`CapacitorHttp.enabled: true` in capacitor.config.ts patches `window.fetch`
to go through native HTTP. This is **load-bearing**: the shell's origin is
`capacitor://localhost` (iOS) / `https://localhost` (Android), so plain fetch
to user-entered servers dies on CORS and (for `http://` LAN hosts)
mixed-content. Don't remove it; be aware responses come from the native layer
(subtle differences vs browser fetch, e.g. no CORS preflights, cookie handling
is the native stack's).

`server.allowNavigation: ['*']` + `cleartext: true` let the webview navigate
to any user-entered server. iOS additionally has an ATS
`NSAllowsArbitraryLoads` exception in Info.plist.

## Server auth model (what the shell talks to)

- PIN login: `POST {base}/api/auth` with `{loginId?, securityPin, familySlug}`.
  `loginId` (2-digit) is optional — plain family PIN omits it.
- Account login: `POST {base}/api/accounts/login` with `{email, password}`.
- All API responses use envelope `{success, data?, error?}`. Login success
  data carries `token` (JWT, ~30 min) which the web app keeps in
  localStorage `authToken`; a rotating 7-day httpOnly `refreshToken` cookie
  (sameSite strict) backs auto-refresh.
- Lockout: 3 failed attempts / 5 min per IP → HTTP 429 with
  `data.remainingTime` seconds.
- Unauthenticated probe endpoints: `GET /api/deployment-config`,
  `GET /api/family/by-slug/{slug}`, `GET /api/auth/caretaker-exists?familySlug=`.

## Native detection & bridge

- The server detects the app by UA suffix `SproutTrackApp/<ver> (ios|android)`
  (set via `appendUserAgent` in capacitor.config.ts — keep version in sync).
- Bridge contract lives in `shared/bridge-contract.ts` and is **vendored** into
  `sprout-track/src/utils/bridge-contract.ts` with a drift test on the server
  side. Change one → change both, same commit set.
- Web → shell direction: the web app navigates back to the shell origin with a
  `?bridge-event=<encoded>` query param; `src/services/bridge-events.ts`
  decodes it at boot. Currently only `loggedOut` with reason `switch-family`
  maps to showing the server list — any other event falls through to
  `auto-open` (this is why a plain logout can bounce straight back into the
  webview when auto-open + saved creds are on).

## Known v0 seams (things that look like bugs and partly are)

- **Session handoff is incomplete**: `src/services/connect.ts` logs in from
  the shell (gets a JWT) but then just navigates to `{base}/{slug}/log-entry`
  — the token is never handed to the web app, so the user sees the web login
  screen again. Silent injection (getting the token into the web app's
  localStorage on the server origin) is the planned fix and needs cooperation
  from the server's native-aware layer.
- Biometric gate is JS-level (verify-then-read), not OS accessControl-backed
  Keychain — hardening is a follow-up.
- Push: server needs `FCM_SERVICE_ACCOUNT_JSON`; app side still needs
  `android/app/google-services.json` and the Firebase iOS SDK (raw APNs
  tokens are not accepted by FCM v1).

## Theme — two generations, don't mix them

- `src/index.css` currently carries the **old** emerald/Inter theme
  (`--color-brand: #0d9488` etc). This is being superseded.
- The design target is the **v1 storybook** theme in
  `docs/mockups/capacitor-app.html` (+ `capacitor-screens.jsx` for per-screen
  markup): paper `#f7f1e2`, card `#fffdf6`, ink `#26382f`, teal `#0c6b62`
  (deep `#0a544d`), apricot `#c2691e`, rust `#9e2b25`, line `#ddd2b8`;
  headings **Literata** (serif), body **Alegreya Sans**. Fonts must be
  bundled locally — the shell can't rely on Google Fonts CDN offline.
- `docs/mockups/v1-storybook/` is a local copy of the sprout-track.com landing
  site; its `art/` folder (teddy, butterfly, kitten, star, rocket svgs,
  logo.png) is the approved illustration set. `resources/` holds the app
  icon/splash sources for `@capacitor/assets`.

## Shell code map

- `src/App.tsx` — Screen union + launch effect. Careful invariants: the
  bridge-event param is read then stripped immediately (no reprocessing on
  remount); auto-open only fires if the user is still on `welcome`
  (screenRef guard against clobbering a user click during pending awaits).
- `src/services/connect.ts` — connect outcome machine
  (`navigated | needs-login | offline | locked`), deps injected for tests.
- `src/services/session.ts` — login POSTs, in-flight dedupe per server id.
- `src/services/server-registry.ts` — saved servers in Capacitor Preferences;
  invariant: **exactly one default** entry at all times.
- `src/services/credential-vault.ts` — creds in native biometric storage.
- `src/services/server-probe.ts` — pairing probes against the endpoints above.
- `src/screens/*` — one file per screen, colocated tests.

## Sprout-track repo conventions (when working in `sprout-track/`)

Its own CLAUDE.md governs; the ones that have bitten us:
- All user-facing strings through `t()`; run
  `node scripts/check-missing-translations.js` (11 locales).
- No Tailwind `dark:` classes — dark mode is `html.dark` CSS.
- Prisma must stay SQLite **and** Postgres compatible.
- Golden rule: family scoping only from `authContext.familyId`, never from
  request params.
- Tests in `tests/*.test.ts`, node environment.

## Workflow

Subagent-driven development (superpowers). Specs in `docs/superpowers/specs/`,
plans in `docs/superpowers/plans/`, progress ledger at
`.superpowers/sdd/progress.md` (each repo has its own). Every subagent prompt
must carry the nested-repo discipline guard from the top of this file.
