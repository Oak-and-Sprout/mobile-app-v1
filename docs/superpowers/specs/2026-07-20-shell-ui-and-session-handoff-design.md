# Shell UI Pass + Silent Session Handoff — Design

**Date:** 2026-07-20
**Status:** Approved by John
**Repos:** mobile-app-v1 (shell) + nested `sprout-track/` clone, branch `feature/native-aware-layer` (PR #234)

## 1. Goal

Bring the Capacitor shell up to the v1-storybook design in
`docs/mockups/capacitor-app.html` / `capacitor-screens.jsx` (full mockup
structure, not just a restyle), fix the two functional gaps found in device
testing — the shell's login token is never handed to the web app, and logging
out bounces the user straight back into the webview — and add a proper
connecting/loading screen.

Decisions locked with John:
- **Scope:** full mockup structure (three-path Welcome + new account sign-in screen).
- **Server-side handoff change:** lands on the existing `feature/native-aware-layer` branch (PR #234).
- **Logout handling:** by reason — user-initiated → families list; expiry-type → reconnect.

## 2. Theme foundation

Replace the emerald/Inter theme in `src/index.css` with the storybook palette
as Tailwind v4 `@theme` tokens. Exact values (from the mockup's `:root`):

| Token | Value | | Token | Value |
|---|---|---|---|---|
| `--color-paper` | `#f7f1e2` | | `--color-teal` | `#0c6b62` |
| `--color-paper2` | `#efe6d0` | | `--color-teal-deep` | `#0a544d` |
| `--color-card` | `#fffdf6` | | `--color-apricot` | `#c2691e` |
| `--color-ink` | `#26382f` | | `--color-rust` | `#9e2b25` |
| `--color-body` | `#3d5044` | | `--color-rust-bg` | `#f7e5dc` |
| `--color-sub` | `#6b7a6c` | | `--color-rust-line` | `#e3bcab` |
| `--color-line` | `#ddd2b8` | | `--color-hover` | `#f4edda` |

Fonts:
- **Literata** (serif) — headings; **Alegreya Sans** — body/UI.
- Bundled locally as woff2 (latin subset, the weights the mockup uses:
  Literata 400–800 + italic; Alegreya Sans 400/500/700/800 + italic 400) with
  `@font-face` declarations. **No Google Fonts CDN** — the shell must render
  with no network.

Native chrome:
- Status bar: dark text over paper (`@capacitor/status-bar`, style Light
  background `#f7f1e2`).
- Native splash: background `#f7f1e2`; regenerate splash/icon via
  `@capacitor/assets` from `resources/` with that background color.

Assets: copy `docs/mockups/v1-storybook/art/{teddy,butterfly,kitten,star}.svg`
and `logo.png` into a new `public/` folder (Vite copies `public/` into
`dist/`, so they ship in the app bundle).

## 3. Screens (full mockup structure)

`docs/mockups/capacitor-screens.jsx` is the authoritative reference for
markup structure, styling, and **copy — including the friendly error strings
in its `ERR_TEXT` map**. Screens are rebuilt in the shell's existing
one-file-per-screen pattern with colocated tests. Screen union in
`src/App.tsx` grows to:

`welcome | account-signin | add-family | families | settings | offline | connecting`

(`add-family` renames `add-server`; `families` renames `server-list`.)

### Welcome
Teddy art, kick "Sprout Track", headline "The family page, *in your pocket.*",
lede per mockup. Three buttons:
1. **Sign in with my account** → `account-signin`
2. **Join with a family link** → `add-family` prefilled `sprout-track.com/`
3. **I run my own server** → `add-family` empty
Assurance line: "Works the same for hosted and self-hosted families."

### AccountSignIn (new)
Email + password against `https://sprout-track.com/api/accounts/login`
(fixed host — this path is SaaS-only). Biometric opt-in checkbox (default
on). On success: save/refresh a server entry for the account's family
(baseUrl `https://sprout-track.com`, slug from the login response), store
credentials `{type:'account', email, password}` in the vault, toast
"Saved — {name} is on this phone now.", land on `families`. Errors: wrong
credentials ("That email and password didn't match…"), `locked` (429),
`unreachable`. Footer: "New here? Start your trial at sprout-track.com —
then come back and sign in."

### AddFamily (restyled AddServer)
Two-step flow per mockup:
1. Address input (`myhost.com/smith-family`) → "Find my family" runs the
   existing probe. Errors from `ERR_TEXT`: invalid address, missing slug,
   family not found, not a Sprout server, unreachable.
2. Located: family card (avatar initial; teal avatar + "Hosted" chip when
   host matches sprout-track.com, apricot + "Self-hosted" otherwise),
   cleartext warning box for `http://`, then the credentials group. Which
   credential form shows (PIN / Login ID + PIN / email+password) follows
   what the probe reports (existing `caretaker-exists` / deployment-config
   logic). Biometric opt-in checkbox. "Verify & save" performs a real login
   before saving (existing behavior), storing creds in the vault.

### Families (restyled ServerList)
Mockup family cards: avatar initial, name + "Opens first" chip on the
default, host + "opened {relative time}" line, Face ID glyph when biometrics
enabled, star button to set default (exactly-one-default invariant
unchanged), X to remove, dashed "Add a family" button, kitten empty state,
gear → settings. Tapping a card runs the connect flow (below). Toasts per
mockup for save/remove/clear.

### Settings
- "Open my family automatically" switch (existing auto-open preference),
  description names the current default family.
- Info section "Your PINs stay put" (shield icon).
- "Clear this phone" (rust) with inline two-step confirm; clears registry +
  vault, lands on `welcome`.
- Footer: "Sprout Track Mobile v0.1.0 / The tracker itself lives on your server."

### Offline
Kitten art, "Can't reach your server.", body per mockup, Try again (retry
callback) + Switch family.

### Connecting (new — the loading screen)
Shown while `connectToFamily` runs (today the shell shows nothing). Pulsing
`logo.png`, "Opening {family}…", subline "{host} · signing you in with your
saved PIN" (account creds: "…with your account"), bouncing dots, butterfly/
teddy sprites as background accents echoing the landing hero. Biometric
prompting remains the OS-native sheet on top of this screen (no fake
BioSheet from the mockup).

## 4. Silent session handoff

Mechanism: **URL fragment** (never sent to the server, strippable client-side
before render). Alternatives rejected: query param (leaks token into server
logs), cookie injection (fragile across the CapacitorHttp/webview cookie
jars).

### Bridge contract (both copies, same commit set)
Extend in `shared/bridge-contract.ts` AND the vendored
`sprout-track/src/utils/bridge-contract.ts` (drift test keeps them
identical):

```ts
| { type: 'sessionInjected'; slug: string; token: string; caretakerId?: string }
```

Validator: `slug` and `token` strings, `caretakerId` string when present.
Still contract v1 — the change is additive and nothing consumed the old
shape.

### Shell side (`src/services/connect.ts` + `session.ts`)
`loginWithCredentials` already returns the JWT; it additionally surfaces
`caretakerId` when the login response envelope includes `data.id`. On
success, `connectToFamily` navigates to:

```
{baseUrl}/{slug}/log-entry#bridge-session=<encodeURIComponent(encodeMessage({type:'sessionInjected', slug, token, caretakerId?}))>
```

### Server side (nested clone, `feature/native-aware-layer`)
A consumer in the native-aware layer (new `src/utils/native-session.ts`,
wired into `client-layout.tsx` boot before the unlock check):
- Runs only when `isNativeApp()` and `location.hash` starts with
  `#bridge-session=`.
- Decodes via the vendored `decodeMessage`; on a valid `sessionInjected`
  whose `slug` matches the current family slug: write localStorage
  `authToken`, `unlockTime` (= now), and `caretakerId` when present, then
  strip the fragment with `history.replaceState` and proceed unlocked. The
  app fetches `authLifeSeconds` / `idleTimeSeconds` itself as the login
  components do.
- Invalid/mismatched/missing fragment: strip it and fall through to the
  normal login UI (never a hard error).
- All strings via `t()` if any user-facing copy is added (expected: none).

### Known caveat (documented in README)
The httpOnly `refreshToken` cookie set during the shell's native-layer login
may not land in the webview's cookie jar, so the injected web session may not
auto-refresh past ~30 min. Acceptable: expiry then triggers the reconnect
path below, which logs in again with vault credentials.

## 5. Logout handling by reason

Web-side reasons (already in the code): `logout-user` (default),
`switch-family`, `logout-idle`, `logout-refresh-failed`, `logout-jwt-error`;
plus the distinct `sessionExpired` bridge event.

`bootActionFromSearch` returns one of three actions:

| Incoming event | Boot action |
|---|---|
| `loggedOut` reason `switch-family` or `logout-user` | `show-server-list` — families list, **no auto-open** |
| `loggedOut` reason `logout-idle` / `logout-refresh-failed` / `logout-jwt-error`, or `sessionExpired` | `reconnect` — rerun `connectToFamily` for that family (includes the biometric prompt when enabled, so the idle lock is not silently bypassed); on failure fall back to families list |
| `loggedOut` with any unknown reason | `show-server-list` (safe default) |
| No bridge event | `auto-open` (unchanged launch behavior) |

`reconnect` needs to know *which* family: the shell matches the webview's
referrer-less return by using the most-recently-touched server entry
(registry already tracks `touchServer`); if none, fall back to the families
list.

## 6. Testing

Shell (vitest, jsdom, colocated):
- `bridge-events`: mapping table above, including unknown reasons and the
  no-event case.
- `connect`: fragment construction (encoding, caretakerId optional),
  connecting-screen outcome wiring, reconnect fallback.
- Screens: render/interaction tests updated for new markup and copy; new
  tests for AccountSignIn and Connecting.
- Contract: existing encode/decode tests extended for the new
  `sessionInjected` shape.

Server side (`sprout-track/tests`, node env):
- `native-session` consumer: valid fragment injects + strips; slug mismatch,
  malformed payload, and non-native UA all no-op with fragment stripped only
  in the native case; drift test still green.
- Full suite stays green (706 baseline).

## 7. Branching & delivery

- **mobile-app-v1:** feature branch (e.g. `feature/ui-pass`) off `main` —
  theme, screens, connect/logout changes, contract copy, assets, README
  caveat. Merge per finishing-a-development-branch flow.
- **sprout-track (nested clone):** commits on `feature/native-aware-layer`,
  pushed to update PR #234 — vendored contract update + `native-session`
  consumer + tests. **Never on its `main`** (see CLAUDE.md repo discipline).
- The shell's fragment handoff degrades gracefully against servers without
  the consumer (fragment ignored → web login shows once), so merge order is
  flexible.

## 8. Out of scope

- OS accessControl-backed Keychain hardening (existing follow-up).
- Push assets (google-services.json, Firebase iOS SDK).
- Dark mode for the shell (storybook theme is single-scheme paper).
- The mockup's fake webview/demo screens and tweaks panel.
