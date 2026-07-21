# Shell UI Pass 2 + In-App Payment Compliance — Design

**Date:** 2026-07-21
**Repos:** `mobile-app-v1` (shell) + nested `sprout-track` clone (server changes land on
`feature/native-aware-layer`, PR #234 — never its `main`)
**PRD:** `docs/mockups/Sprout-track-design/capacitor-shell-punch-list.html` (v1.1)
**Mockups (source of truth for layout/copy/states):**
`docs/mockups/Sprout-track-design/capacitor-app.html`, `capacitor-screens.jsx`,
`capacitor-wizard.jsx`, `capacitor-app.jsx`

## 1. Overview

Second UI/functionality pass on the Capacitor shell, scoped by the punch list:

- **Shell:** animated splash, two-card sign-in fork, full account flow (sign-in rework,
  create account, email-verification gate, password reset), native 3-step family setup
  wizard for accounts, polish sweep on existing screens, app icons.
- **Server (PR #234):** side-nav in-shell footer becomes a single "Exit to My Families";
  subscription management is display-only in-app with an external system-browser link
  (Apple/Google IAP compliance); the side-nav trial box loses its in-app "Buy Now".

The bridge contract is **unchanged** — "Exit to My Families" reuses the existing
`loggedOut { reason: 'switch-family' }` event, and the session-handoff fragment stays as
shipped. The drift test continues to guard the vendored copy.

## 2. Decisions (made during brainstorming)

1. **Native wizard, not a webview.** The wizard is re-implemented in the shell against the
   server's existing endpoints (no new server endpoints). Full storybook theming; the
   mockup `capacitor-wizard.jsx` prescribes every control.
2. **Re-login instead of refresh-token.** After the wizard completes, the shell logs in
   again with the vaulted email/password to obtain a JWT carrying the new
   `familyId`/`familySlug`, instead of `POST /api/auth/refresh-token`. This removes any
   dependency on the httpOnly `refreshToken` cookie surviving the CapacitorHttp stack.
3. **Verify-first signup.** After account creation the shell holds at a "check your email"
   screen and only enters the wizard once the account is verified (polling
   `GET /api/accounts/status`). Applies equally to a later sign-in with an unverified,
   family-less account.
4. **External browser = bridge + fallback.** The web app opens subscription management via
   `getCapacitorPlugin('Browser')?.open({ url })` and falls back to
   `window.open(url, '_blank')`. The shell adds `@capacitor/browser`. A device spike is
   the first implementation task (see §10).
5. **Trial box in-shell:** keep the trial-ends date, replace "Buy Now" with the same
   external manage link.
6. **App icons included** in this pass (P2 rides along).

## 3. Shell — screens & routing

### 3.1 Screen union (App.tsx)

```
splash | fork | acct-signin | acct-signup | acct-verify | acct-reset
| wizard (resume?: {familyId, stage, familyName?, slug?})
| add-family (prefillInput?) | families (toast?, notice?) | settings
| offline (entry) | connecting (entry)
```

`welcome` and the old `account-signin` are replaced by `fork` / `acct-signin`.

### 3.2 Splash (new)

- Native Capacitor splash stays flat paper `#f7f1e2` (already configured); the React
  `Splash` screen renders on top as the initial screen.
- Visuals per mockup: bundled hero photo with Ken Burns zoom (scale 1.09 → 1 over ~6.5s
  ease-out), cream radial + linear gradient overlay, circle-badge logo pop-in
  (scale .6 → 1, overshoot), "Sprout Track" wordmark (Literata 33px) and kicker
  "THE SHAREABLE BABY TRACKER" (apricot, letterspaced caps) rising staggered
  (~280ms / ~500ms delays).
- Timing: ~2.15s hold → 550ms fade-out with 16px upward drift → route.
- Hero asset: a compressed derivative of
  `docs/mockups/Sprout-track-design/uploads/photorealistic-lifestyle-photography--shot-on-35mm.png`
  (6.3MB original) bundled at `public/art/hero.jpg` — target ≤300KB at ~1170px wide,
  crop/position `60% 30%` as in the mockup CSS.
- Routing after splash (existing boot logic, gated until splash completes): no saved
  families → fork; saved families → My Families; auto-open enabled → straight into
  connecting the starred family. Bridge-event boot actions (`reconnect`,
  `show-server-list`) still take precedence over auto-open, after the splash.

### 3.3 Fork (replaces Welcome)

- Top ~176px: same hero + cream gradient fading into paper, circle logo overlapping the
  fold. Headline "Everyone you love, *on the same page.*" + "How do you sign in to your
  family?".
- Two choice cards (copy verbatim, §8): account → `acct-signin`; family link →
  `add-family`. No "I run my own server" button; no hosted/self-hosted mention here.
- Footnote: "Either way, your sign-in stays in this phone's secure keychain."
- "Add a family" from My Families navigates to the fork (not directly to add-family).

### 3.4 Account flow

**Sign-in (`acct-signin`, rework of the current AccountSignIn):** title "Welcome back.",
email + password, `BioCheck` checkbox (default on, copy per §8), links "New here? Start
your free trial" → `acct-signup` and "Forgot your password? Reset it" → `acct-reset`.
Errors: wrong credentials ("That email and password didn't match. Give it another look
and try again."), locked (429 copy), unreachable.

**Create account (`acct-signup`):** first/last name, email, password with live 5-rule
checklist (8+ chars, a number, a lowercase letter, a symbol, an uppercase letter — pill
turns teal per rule met; matches the server's register validation). Button disabled until
all pass + valid email + names present. Legal line; "Already have an account? Sign in."
Submits `POST /api/accounts/register { email, password, firstName, lastName }`, then
auto-login (`POST /api/accounts/login`) → `acct-verify`. Register rate-limit (5/24h/IP)
and duplicate-email errors surface inline.

**Verify (`acct-verify`, new screen — not in the mockup set, styled like AcctReset):**
"Check your email." copy explaining the verification link; polls
`GET /api/accounts/status` (bearer token) every ~5s while visible; "Resend the email"
button → `POST /api/accounts/resend-verification`; when `verified` flips true → routing
(§3.5). Back returns to sign-in without losing the account.

**Reset (`acct-reset`):** email field → "Email me the link" →
`POST /api/accounts/forgot-password { email }` → toast
"Reset link sent to {email} - it works for one hour." and return to sign-in. (The server
always answers success — no enumeration.)

### 3.5 Post-auth routing (single function, unit-tested)

After any successful account login (sign-in or post-signup), with
`user { verified, hasFamily, familySlug? }`:

1. `hasFamily` → `GET /api/family/setup-status` (bearer):
   - `setupStage >= 3` → save family to device (deploymentMode `saas`, authType
     `ACCOUNT`), vault credentials, My Families with saved toast (existing pass-1 path).
   - `setupStage < 3` → `wizard` resumed at `currentStage` (2 or 3), with
     `familyData` from setup-status seeding the frame's "✓ saved" markers.
2. No family:
   - `verified` → `wizard` at step 1.
   - not verified → `acct-verify` (which re-runs this routing when verified).

Credentials are held in memory through signup/verify/wizard and vaulted only when the
family is saved to the device (existing behavior for sign-in with a family).

## 4. Shell — setup wizard

Files: `src/screens/wizard/` (WizFrame + 3 step screens mirroring `capacitor-wizard.jsx`
markup: progress bar, "STEP n OF 3", saved-note check, art sprite per step
teddy/star/kitten) + `src/services/wizard.ts` (deps-injected API sequence, unit-tested).

**Commit-as-you-go:** each Next persists to the server; a saved stage cannot be revisited
— steps 2/3 show "✓ Family saved" / "✓ Security saved" instead of Back. Cancel (step 1
only) → home + toast "Setup paused - sign back in anytime to finish." Resume lands on the
lowest unsaved stage (§3.5).

### Step 1 — Create your family

- Family name; slug auto-generated from name (`slugify`) until manually touched; typed
  spaces auto-hyphenate; regenerate button → `GET /api/family/generate-slug`.
- Live URL preview "Your family will live at `sprout-track.com/{slug}`".
- Client validation mirrors `app/api/utils/slug-validation.ts`: `^[a-z0-9-]+$`, 3–50
  chars, reserved list (account, api, coming-soon, family-manager, family-select, setup,
  sphome, login, auth, context, globals, layout, metadata, page, template, features,
  home, pricing, privacy, terms, health, logs, maintenance, status, update, uptime,
  version).
- Debounced (~500ms) availability via unauthenticated `GET /api/family/by-slug/{slug}`:
  `success:true` + data ⇒ taken; `success:false` (200) ⇒ free; 400 ⇒ invalid/reserved.
  Three UI states: checking / free (teal check) / error box.
- Next → `POST /api/setup/start { name, slug }` (bearer) → `Family` row; keep
  `familyId`. Server side-effects (account path): settings + system caretaker created,
  `account.familyId` linked, 14-day trial in SaaS mode. HTTP 409 → "Another family
  already lives at /{slug} - try a different one."

### Step 2 — Security ("Who can open the book?")

- Radio cards: **One shared family PIN** vs **Caretakers with their own PINs** (default
  caretakers).
- Shared PIN: PIN + confirm, 6–10 digits, digits-only input →
  `PUT /api/settings?familyId={id} { securityPin, authType: 'SYSTEM' }`.
- Caretakers: 2-digit login ID with live validation (digits only, `00` reserved,
  duplicate check), name, PIN 6–10 digits, optional type. First caretaker forced Admin;
  for account users prefilled name from the account, type "Account Owner", CTA "Create my
  profile". Later caretakers get a Role select (User default / Admin). Rows list
  name/role chip/type chip/ID/remove. On Next: `POST /api/caretaker?familyId={id}` per
  caretaker, then `PUT /api/settings?familyId={id} { authType: 'CARETAKER' }`.
- Both paths finish with `PUT /api/family/update-setup-stage { setupStage: 2, familyId }`.
- Next enabled when PIN valid+matching or ≥1 caretaker.

### Step 3 — Add your baby

- First name, last name, birth date, gender — all required. Gender maps to
  `'MALE' | 'FEMALE'` ("Boy"/"Girl" labels).
- Gentle nudges: feed warning default `02:00`, diaper default `03:00`, `hh:mm` validated
  inline.
- Feed timer counts from start/end of feeding; feed-type checkboxes (Breast feeds,
  Breast milk bottles, Formula bottles, Other bottles, Food — all default checked;
  all-checked persists as `feedTimerTypes: null`, else a JSON array).
- Complete Setup → busy "Planting your sprout…" →
  `POST /api/baby?familyId={id}` (server promotes `setupStage` to 3), then account link:
  shared-PIN mode → `GET /api/caretaker/system?familyId={id}` →
  `POST /api/accounts/link-caretaker { caretakerId }`; caretaker mode → first non-`00`
  caretaker from `GET /api/family/{familyId}/caretakers` → same link call.
- Then **re-login** with the held credentials (fresh JWT carries `familySlug`), save
  family to device (starred if first), vault credentials, My Families with toast
  "Welcome home - {family} is set up and saved to this phone."
- Wizard API errors surface in an ErrBox on the current step; the step's Next re-runs
  only the failed remainder (idempotent-by-construction: each sub-call is retried only if
  it hasn't succeeded).

## 5. Shell — polish sweep & assets

- **Copy sweep (anti-slop §12: no em dashes):** every existing screen's em-dash copy
  becomes " - " per the updated mockups (Offline, AddFamily helper/warning text,
  Settings, Connecting, clear-all confirm, toasts).
- **Settings:** toggle copy → "Open my starred family automatically" with the ★ glyph and
  starred family name; keychain section → "Your sign-ins stay put" / "Saved PINs and
  passwords…"; clear-all body → "Removes every saved family and sign-in…".
- **Families:** header gear becomes a real gear icon (mockup `i-gear`), not the sun/rays
  glyph.
- **Connecting:** subline → "signing you in with your saved credentials" (drop the
  PIN/account distinction).
- **AddFamily:** label "Server address" → "Family link"; helper "The same address you'd
  open in a browser - hosted or self-hosted."; credential helper "Same {ID and PIN|PIN}
  as the website - we check it with your server, then keep it safe here."; biometric
  checkbox extracted as shared `BioCheck` component (used by add-family + account
  screens).
- **App icons:** generate iOS/Android icons + splash via `@capacitor/assets` from the
  square mark at `public/sprout-track-square-1024.png` (already in repo); splash
  background `#f7f1e2`. In-app branding keeps the circle badge `logo.png` (no shadows or
  rings).
- **New dependency:** `@capacitor/browser` (registered so `Capacitor.Plugins.Browser`
  exists inside the webview).

## 6. Server (sprout-track, PR #234 branch)

All user-facing strings via `t()`; run `node scripts/check-missing-translations.js`.
Native detection uses the existing `isNativeApp()` from `src/utils/native-app.ts`.

### 6.1 `src/utils/external-link.ts` (new)

`openExternal(url: string): void` — `getCapacitorPlugin<{ open(opts: { url: string }): Promise<void> }>('Browser')`
when native and present, else `window.open(url, '_blank', 'noopener')`. Pure logic
extracted for unit tests (`tests/external-link.test.ts`).

### 6.2 side-nav (`src/components/ui/side-nav/index.tsx`)

- In-shell (`isNativeApp()`): footer renders Settings + one **"Exit to My Families"**
  button (door/out icon) wired to the existing switch-family exit path
  (`onSwitchFamily` prop → `navigateToShell({ type: 'loggedOut', reason: 'switch-family' })`);
  the separate Switch Family and Logout buttons are not rendered. Web mode unchanged.
- Trial box in-shell: keep the "Trial Version / Ending {date}" info; replace the
  "Buy Now" PaymentModal button with
  "Manage your subscription at sprout-track.com" (external-link icon) →
  `openExternal('https://sprout-track.com/account')`. PaymentModal is not mounted
  in-shell.

### 6.3 account-manager (`AccountSettingsTab.tsx`)

In-shell, the Subscription section renders display-only:

- Status line: state dot + Active/Trial/Expired + renewal/end date + price (existing
  `subscriptionView` data).
- Note: "Subscriptions are managed on the web, not in this app."
- Button: "Manage your subscription at sprout-track.com" (external-link icon) →
  `openExternal(...)`.
- Not rendered in-shell: Start/Renew/Manage PaymentModal triggers, reactivate flow,
  Payment history. Web mode unchanged.

### 6.4 Verified unchanged

Header "Hi, {name}" pop-down Log out already exits to My Families in-shell via the
existing `loggedOut` handling — covered by a regression check, not new code.

## 7. Error handling

- Shell account/wizard calls go through the existing envelope parsing
  (`{ success, data?, error? }`); 429 → locked copy with `remainingTime`; network throw →
  unreachable copy; envelope `success:false` → the server's `error` string when
  user-appropriate, else the screen's canned copy.
- Verify polling backs off silently on network errors (keeps polling); resend errors
  surface inline.
- Wizard: each stage's failure leaves the user on that stage with an ErrBox; already-
  persisted stages are never re-run (§4).

## 8. Copy inventory (verbatim, from punch list §11)

| Where | Copy |
|---|---|
| Fork headline | Everyone you love, *on the same page.* / How do you sign in to your family? |
| Fork card 2 | Family link shared with you? - Sign in here with the family link and your family PIN or personal caretaker PIN. |
| Keychain footnote | Either way, your sign-in stays in this phone's secure keychain. |
| Find button | Find my family / Knocking on the door… |
| Biometric checkbox | Unlock with {Face ID\|Touch ID} next time - Your {PIN\|password} lives in this phone's secure keychain - a glance opens the book. |
| Wizard step 2 title | Who can open the book? |
| Wizard finishing | Planting your sprout… → Welcome home - {family} is set up and saved to this phone. |
| Offline | Can't reach your server. - …Everything already logged is safe - we just can't say hello. |
| Clear-all confirm | This clears the book from this phone - the server keeps everything. Sure? |
| Subscription note (in-app) | Subscriptions are managed on the web, not in this app. / Manage your subscription at sprout-track.com |

Curly apostrophes throughout (`&rsquo;` / U+2019); no em dashes anywhere in shell copy.

## 9. Testing

- **Shell (vitest/jsdom, colocated):** every new/changed screen gets rendering +
  interaction tests; `src/services/wizard.ts` gets the deepest coverage (full endpoint
  sequences for both security modes, resume from stage 2/3, 409 slug conflict, link-
  caretaker selection, re-login token swap, error-per-stage); post-auth routing function
  covered for all four branches; splash routing gated correctly (auto-open fires only
  after splash). Keep 122 existing tests green — update the ones asserting old copy.
- **Server (vitest/node, `tests/`):** `external-link` behavior (native vs web),
  extracted render-decision helpers for side-nav footer and subscription section
  (pure functions taking `{ isNative, accountStatus }` → what to show), bridge-contract
  drift test untouched.
- **Device spike (first implementation task):** on iOS Simulator + Android emulator
  against the local server, confirm whether the Capacitor bridge (and Browser plugin) is
  injected into remote `allowNavigation` pages. Record the result in the plan; if absent,
  `openExternal` falls back to `window.open` and we verify what the webview does with
  `_blank` on each platform.

## 10. Risks

1. **Bridge injection on remote hosts unproven** — mitigated by the spike + fallback
   (§6.1, §9).
2. **CapacitorHttp cookie behavior** — avoided for the wizard by the re-login decision
   (§2.2).
3. **Hero asset weight** — a compressed derivative is bundled; the 6.3MB original stays
   in `docs/mockups/` only.
4. **Register rate-limit (5/24h/IP)** during testing — use the local server for flow
   testing.

## 11. Out of scope (v1 roadmap, in priority order)

1. **Push assets — NEXT after this pass:** `android/app/google-services.json`, Firebase
   iOS SDK via SPM, server `FCM_SERVICE_ACCOUNT_JSON`; end-to-end push verification.
2. OS accessControl-backed Keychain vault hardening.
3. Shell dark mode (deliberate design later; webview dark belongs to the web app).
4. FCM robustness batch + DELETE `/api/notifications/device-tokens` on real logout.
5. Nursery mode / photos PRDs (separate mockups, separate passes).

**Permanently out of scope:** the mockup's demo webview + tweaks panel (mockup-only
affordances).
