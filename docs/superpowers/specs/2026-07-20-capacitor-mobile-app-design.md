# Sprout Track Mobile App — Architecture Design (First Pass)

**Date:** 2026-07-20
**Status:** Approved design, pending implementation plan
**Repos involved:** `mobile-app-v1` (this repo, the Capacitor app) and the Sprout Track web app (reference build explored at `~/Development/docker_builds/sprout-track_old`; changes land in the active sprout-track repo)

## 1. Goal and scope

A Capacitor mobile app (iOS + Android, one codebase) that wraps the Sprout Track web app and adds native capabilities the web cannot provide:

- Works against both deployment modes: **SaaS** (`sprout-track.com`, email/password accounts, Stripe billing) and **self-hosted** (custom base URL, family slug + PIN login).
- **Multiple saved servers/families** with quick switching (e.g., a caretaker helping two families, or SaaS + self-hosted side by side).
- **Permanent credential storage** in OS secure storage, with automatic session re-establishment (token refresh or full re-login) and optional **biometric unlock**.
- **Screen wake** (keep-awake) in nursery mode.
- **Camera** for photos attached to log entries.
- **Push notifications in v1** (native FCM/APNs channel; effectively SaaS-only at launch — see §7).
- **Online-only v1**: no offline logging or caching; a friendly retry screen when the server is unreachable.
- Shell visual theme follows the marketing landing page: cream/white surfaces + emerald/teal brand (see §8).

Out of scope for v1: offline mode, in-app billing changes, tablet-optimized layouts, widgets/watch apps.

## 2. Chosen architecture: thin native shell + remote webview

Three approaches were considered:

- **A. Native shell + remote webview (chosen).** A small bundled web app (the *shell*) handles server management, credentials, and biometrics, then navigates the same webview to the remote Sprout Track origin. The existing web UI runs unmodified except for a small "native-aware" layer.
- **B. Dedicated mobile frontend.** A new bundled SPA talking to the API cross-origin. Best native UX and store compliance, but requires rebuilding the entire UI (log entry, calendar, reports, photos, nursery mode) plus CORS/auth changes server-side. Rejected for v1 scope; remains the escape path if Apple review forces more native UI.
- **C. Fixed-origin webview** (`server.url = sprout-track.com`). Simplest, but the origin is fixed at build time — incompatible with multi-server/self-hosted support. Rejected.

Why A works with this codebase (facts verified in the sprout-track source):

- The app's primary auth is a **JWT Bearer token in `localStorage`** auto-attached by a global fetch interceptor (`src/context/family.tsx`), not a session cookie — webview-friendly.
- The one cookie dependency — the httpOnly, `sameSite: strict`, rotating 7-day **`refreshToken` cookie** — behaves correctly because the webview loads the real server origin (same-origin semantics preserved).
- All API calls are **relative** (`/api/...`), and there are **no websockets** (real-time = web push + polling).
- Family access is slug-routed (`/{slug}/...`), and `GET /api/family/by-slug/{slug}`, `GET /api/auth/caretaker-exists`, and `GET /api/deployment-config` are **unauthenticated** — enabling a pre-login native pairing flow.

### Structure

```
┌─ Capacitor App ─────────────────────────────┐
│ Bundled shell (Vite + React + TS, local)    │
│  • Saved servers & families (registry)      │
│  • Pairing: sprout-track.com or custom URL  │
│  • Biometric gate / Keychain credentials    │
│  • Session injector → auto-login            │
│        │ navigates same webview to…         │
│        ▼                                    │
│ Remote Sprout Track web app                 │
│  (https://sprout-track.com or custom host)  │
│  • Existing UI and session machinery as-is  │
│  • Native-aware layer: bridge detection →   │
│    keep-awake, camera, push, logout events  │
└─────────────────────────────────────────────┘
```

`capacitor.config.ts` uses the bundled shell as the app origin with `server.allowNavigation: ['*']` so user-entered hosts can load in the same webview with the Capacitor bridge available. **This bridge-on-remote-origin behavior is the load-bearing assumption and is validated by a spike in week one on both platforms** (see §10, risk 3).

### Repo layout (`mobile-app-v1`)

```
mobile-app-v1/
├── capacitor.config.ts
├── ios/  android/              # generated native projects
├── src/                        # bundled shell
│   ├── screens/                # Welcome, AddServer, ServerList, Unlock, Settings, Offline
│   ├── services/               # server-registry, credential-vault, session-injector, bridge-host
│   └── theme/                  # cream/emerald tokens (from home.css)
├── shared/bridge-contract.ts   # typed messages, shared with the sprout-track repo
└── docs/superpowers/specs/     # design docs
```

Native plugins: `@capacitor/preferences`, secure storage (Keychain/Keystore), biometric auth, keep-awake, `@capacitor/camera`, `@capacitor/push-notifications`, `@capacitor/network`, `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/app`.

## 3. Shell UX and multi-server management

**First launch — welcome screen with two paths:**

- **"Use Sprout Track"** → server = `https://sprout-track.com`. Existing users sign in (shell-assisted account login); new users are sent to the web app for registration, Stripe checkout, and family setup, all unchanged. The shell learns the resulting family slug by reading `localStorage.accountUser` / `selectedFamily` from the webview via the bridge.
- **"Connect to my own server"** → URL entry. The shell accepts a base URL or a full family URL (`https://host/smith-family`) and:
  1. Probes `GET {base}/api/deployment-config` to confirm a Sprout Track instance (and read mode/feature flags).
  2. Resolves the family via `GET /api/family/by-slug/{slug}` (prompting for the slug if not in the URL).
  3. Reads auth type from `GET /api/auth/caretaker-exists?familySlug=...` to render PIN-only (SYSTEM) vs. loginId + PIN (CARETAKER) entry.

**Server registry** (Capacitor Preferences, non-secret): entries `{ id, baseUrl, familySlug, familyName, deploymentMode, authType, lastUsedAt, isDefault }`. The main screen lists all saved families; tap to connect, edit to remove. One default entry gets a fast path: app launch → biometric gate (if enabled) → straight into that family, skipping the list.

**Cleartext hosts:** `http://` LAN servers are allowed (Android `usesCleartextTraffic`, iOS ATS exception) with a one-time "connection is not encrypted" warning at save time.

**Returning to the shell:** the native-aware layer adds a "Switch family" item to the web app's side-nav when running natively; the shell also intercepts webview landings on the marketing home or login pages after logout and shows the server list instead.

## 4. Auth, credential persistence, and biometrics

**Storage split:**

| Store | Contents | Notes |
|---|---|---|
| OS secure storage (Keychain / Keystore), one entry per saved family | `{ type: 'pin', loginId?, securityPin }` or `{ type: 'account', email, password }` | Root of trust. Survives token expiry, the 7-day refresh window, and server restarts (Sprout Track's token blacklist and lockout state are in-memory). Biometric access control on the entry when biometrics are enabled. |
| Webview storage (per origin, untouched) | `authToken` (JWT, ~30 min), `refreshToken` cookie, `unlockTime`, `caretakerId` / `accountUser`, `authLifeSeconds`, `idleTimeSeconds` | The web app's existing session machinery — fetch-interceptor 401 → refresh → retry, proactive refresh near expiry — keeps working unmodified. |

**Session injector flow** (on family select or app launch to default family):

1. Load the server origin in the webview.
2. Via the bridge, check for a live session: valid unexpired `authToken`, else attempt `POST /api/auth/refresh-token` (uses the same-origin refresh cookie).
3. If dead, replay stored credentials **from within the webview context** — `POST /api/auth` `{ loginId?, securityPin, familySlug }` or `POST /api/accounts/login` `{ email, password }` — so the server sets the refresh cookie same-origin; then write the localStorage keys the web app expects.
4. Navigate to `/{slug}/log-entry` and emit `sessionInjected(slug)`.

Replay is **single-flight** to avoid tripping the server's 3-attempts-per-IP / 5-minute lockout.

**Auto re-login mid-use:** when the web app's own refresh fails, the native-aware layer emits `sessionExpired()` over the bridge instead of redirecting to the login page; the shell silently re-runs the injector. This is the "refresh automatically" behavior.

**Biometrics:** offered per family after the first successful login. Enabled → the Keychain entry requires user presence (Face ID / Touch ID / fingerprint, OS passcode fallback) before decryption; app launch and family switches prompt. Declined → credentials stored without the biometric flag. "Don't remember me" → only the registry entry is stored; the web login screen appears each visit.

**Preserved behaviors:** IP-lockout 429s surface as a countdown (no retries); the PIN users' idle timeout stays intact — idle logout just becomes an instant biometric re-entry.

## 5. Native bridge contract

Detection: custom user-agent suffix `SproutTrackApp/{version} ({ios|android})` plus the Capacitor global. The web app gains one module (`src/utils/native-bridge.ts` in the sprout-track repo) that no-ops in normal browsers.

Contract lives in `shared/bridge-contract.ts` (typed, versioned — the web app ignores messages above its known version and reports its version at handshake):

| Direction | Message | Purpose |
|---|---|---|
| web → native | `keepAwake(on: boolean)` | Nursery mode enter/exit; native keep-awake replaces `navigator.wakeLock`. |
| web → native | `capturePhoto()` → image | Native camera/photo-library UI feeding the existing photo upload path. |
| web → native | `sessionExpired()` / `loggedOut(reason)` | Shell decides: auto re-login or return to server list. |
| web → native | `registerPushToken(jwt)` | Trigger native push registration bound to the current session (see §7). |
| native → web | `sessionInjected(slug)` | Injector handoff complete. |
| native → web | `appResumed()` | Web app re-checks token expiry immediately on foreground (its 1 s expiry timer suspends in background webviews). |

**Sprout Track web-app changes** (all small, all gated behind native detection):

1. `src/hooks/useWakeLock.ts` — branch to bridge `keepAwake` when native.
2. Photo capture entry points — offer `capturePhoto()` when native.
3. `src/utils/session-timeout.ts` logout paths — emit bridge events instead of redirecting when native.
4. Side-nav — "Switch family" item when native.
5. Login success hooks — call `registerPushToken`.
6. Suppress PWA install prompts and service-worker registration when native (SW caching can conflict with shell navigation and is unneeded in-app).

## 6. Error handling (online-only v1)

- **Unreachable/offline:** shell-owned themed screen with retry and "switch family"; triggered by connection-probe failure, webview navigation error, or `@capacitor/network` reporting offline. The webview never shows a raw browser error page.
- **Family gone:** `by-slug` 404 or deactivated family → error badge on the registry entry, with re-pair or remove actions. Transient failures (5xx/network) are not treated as "family not found," mirroring the web app's retry logic.
- **Credential replay 401** (PIN/password changed server-side): clear that family's vault entry, show the web login screen, re-offer "remember + biometrics" on success.
- **Lockout 429:** countdown UI; no automatic retries.
- **SaaS account expired/closed:** handled entirely by the web app's existing soft-expiration and billing screens; the shell stays out of billing.

## 7. Push notifications (v1)

Native channel added beside the existing VAPID web push subsystem (`/api/notifications/*`).

**Backend (sprout-track repo):**
- `DeviceToken` table: `{ token, platform, caretakerId?, accountId?, familyId, createdAt, lastSeenAt }`.
- `POST` / `DELETE /api/notifications/device-token` (auth-wrapped; family scoping from auth context only).
- Send path via **FCM** (covers Android natively and iOS via APNs), invoked wherever web push is sent today.
- `GET /api/deployment-config` gains `nativePushEnabled` (true when FCM env credentials are configured).

**App:** `@capacitor/push-notifications`; permission requested after first successful login (not first launch); token registered through the `registerPushToken` bridge flow; notification taps deep-link to the correct family/screen via the shell.

**Scope:** v1 push is effectively **sprout-track.com only**. Self-hosted instances can opt in by configuring their own FCM credentials (env-driven); when `nativePushEnabled` is false the app treats push as unavailable for that server and skips the permission prompt.

## 8. Theming and assets

Shell adopts the landing-page theme (extracted from `app/home/home.css`, `app/globals.css`, `public/manifest.json`):

- **Brand:** teal `#0d9488` → emerald `#059669` gradient (logo, CTAs); hover `#0f766e` / `#047857`; deep accent `#065f46`.
- **Cream/light base:** `#ffffff` surfaces, `#f9fafb` section backgrounds, mint tints `#ecfdf5` / `#a7f3d0`; gray text scale `#111827`–`#6b7280`.
- **Dark mode:** follows OS setting; surfaces `#111827` / `#1f2937`, accent `#5eead4` — matching the web app's class-based dark theme.
- **Font:** Inter, bundled with the shell.
- **Icons/splash:** generated from `public/sprout-1024.png` with `@capacitor/assets`; splash on brand teal or cream; status bar tinted; native theme color `#0d9488` (matches the PWA manifest).

## 9. Testing

- **Unit (Vitest):** shell services — server registry, URL parsing/validation, credential-vault wrapper, bridge message codec.
- **Integration (Playwright + Docker):** run the real Sprout Track app via its docker-compose; exercise pairing, PIN and account login, session injection, refresh, and lockout flows against it in a browser build of the shell.
- **Contract test (sprout-track repo):** asserts the web side sends/handles exactly the messages declared in `shared/bridge-contract.ts`.
- **Manual device matrix:** written per-platform checklist for biometrics, keep-awake (nursery mode), camera capture/upload, push delivery and deep links, cleartext LAN hosts, app backgrounding/resume.

## 10. Risks

1. **Apple App Review 4.2 (minimal functionality).** Webview wrappers can be rejected. Mitigation: genuine native features (biometrics, camera, push, keep-awake, multi-server management) and a native first-run experience. Contingency: migrate more UI native (Approach B path).
2. **In-app purchase rules.** SaaS subscription signup via Stripe inside the app may trigger Apple IAP requirements. V1 keeps registration/billing on the website per current App Store external-link/reader rules at submission time; re-verify the rules before submission.
3. **Bridge availability on arbitrary user-entered hosts.** `allowNavigation: ['*']` + bridge injection on remote origins must be validated on both platforms in a week-one spike. Fallback: user-agent detection plus a `postMessage` bridge installed by shell script injection.
4. **Server in-memory state.** IP lockout and the token blacklist reset on server restart and aren't shared across instances. Consequences for the app: persisted refresh tokens remain valid across restarts (stateless JWT), and credential replay must single-flight to avoid the 3-attempt lockout.

## 11. Decisions log

| Decision | Choice |
|---|---|
| Platforms | iOS + Android from the start |
| Offline | Online-only v1; retry screen; offline logging deferred |
| Push | In v1; FCM/APNs; SaaS-only at launch, self-hosted opt-in via own FCM credentials |
| Camera | Photos attached to log entries (native capture feeding existing upload) |
| Multi-server | Multiple saved servers/families with switching |
| Architecture | A: thin native shell + remote webview (B and C rejected — see §2) |
