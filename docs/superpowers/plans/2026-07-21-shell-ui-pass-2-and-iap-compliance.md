# Shell UI Pass 2 + In-App Payment Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the punch-list UI pass (splash, sign-in fork, account signup/verify/reset, native setup wizard, polish sweep, app icons) on the shell, and Apple/Google IAP compliance (external subscription management, "Exit to My Families") on the sprout-track server.

**Architecture:** The shell gains a splash + fork + four account screens + a 3-step wizard that drives the server's existing setup endpoints natively; post-auth routing is a pure service. The server gets a `openExternal` util (Capacitor Browser plugin with `window.open` fallback) and native-mode render branches in side-nav and account-manager. Bridge contract is untouched.

**Tech Stack:** Shell: Capacitor 8, Vite, React 19, TS, vitest/jsdom. Server: Next.js, vitest/node.

**Spec:** `docs/superpowers/specs/2026-07-21-shell-ui-pass-2-and-iap-compliance-design.md`

## Global Constraints

- **⚠️ Nested repo:** `sprout-track/` is a separate clone. Shell tasks commit to the OUTER repo on branch `feature/ui-pass-2`; server tasks (14–16) commit to `sprout-track/` on branch `feature/native-aware-layer`. Before EVERY commit run `git rev-parse --show-toplevel` and `git branch --show-current` and confirm both. Never commit to any `main`.
- Theme tokens (exact, already in `src/index.css` under `@theme` as `--color-*`): paper `#f7f1e2`, paper-2 `#efe6d0`, card `#fffdf6`, ink `#26382f`, body `#3d5044`, sub `#6b7a6c`, line `#ddd2b8`, teal `#0c6b62`, teal-deep `#0a544d`, apricot `#c2691e`, rust `#9e2b25`, hover `#f4edda`. Never invent new hues. Fonts: Literata (headings) + Alegreya Sans (body), already bundled via @fontsource.
- **No em dashes in any user-facing shell copy** — use ` - ` (space hyphen space). Curly apostrophes (`&rsquo;` in JSX text, `’`/’ in strings and test regexes).
- Copy in §8 of the spec is verbatim — do not paraphrase.
- Shell tests: `npm test` from repo root (vitest, jsdom, colocated `*.test.tsx?`). All 122 existing tests must stay green (updating asserts for renamed screens/copy is expected). Server tests: `npm test` inside `sprout-track/` (706+ tests, node env, tests live in `tests/*.test.ts`).
- Server repo rules: all user-facing strings through `t()` then run `node scripts/check-missing-translations.js`; no Tailwind `dark:` classes; keep changes minimal.
- SaaS base URL constant: `https://sprout-track.com`. External manage URL: `https://sprout-track.com/account`.

## File structure (shell)

- `src/lib/api-client.ts` — add `getJson`, token option (modify)
- `src/lib/slug.ts` — slug rules shared by wizard + screens (create)
- `src/services/account.ts` — register/status/resend/forgot/setup-status (create)
- `src/services/account-routing.ts` — post-auth routing + route→Screen mapping (create)
- `src/services/wizard.ts` — wizard server sequence (create)
- `src/services/session.ts` — surface `verified` from account envelope (modify)
- `src/components/BioCheck.tsx` — shared biometric checkbox (create)
- `src/screens/Splash.tsx`, `Fork.tsx`, `AccountSignUp.tsx`, `AccountVerify.tsx`, `AccountReset.tsx` (create); `AccountSignIn.tsx` (rework); `Welcome.tsx` (delete)
- `src/screens/wizard/` — `WizFrame.tsx`, `Step1Family.tsx`, `Step2Security.tsx`, `Step3Baby.tsx`, `Wizard.tsx` (create)
- `src/App.tsx` — Screen union + splash gating (modify)
- `src/index.css`, `src/components/Icons.tsx` — new classes/symbols (modify)
- `public/art/hero.jpg` — compressed splash hero (generated)

---

### Task 1: Branch, theme CSS, icons, hero asset, BioCheck

**Files:**
- Modify: `src/index.css` (append new classes), `src/components/Icons.tsx`
- Create: `src/components/BioCheck.tsx`, `src/components/BioCheck.test.tsx`, `public/art/hero.jpg`

**Interfaces:**
- Produces: CSS classes `.splash .fork-top .fork-logo .fork-bd .choice .ic-teal .ic-apr .fork-foot .reqs .auth-alt .legal .wiz-hd .wiz-brand .wiz-art .prog .wiz-step .wiz-meta .wiz-saved .wiz-bd .wiz-ft .slug-row .slug-note .slug-ok .slug-checking .ropt .ct-item .fi-err .m-scr.bleed`; icon symbols `i-mail i-user i-people i-chevr i-out i-ext i-key i-check i-chevd i-menu` and a replaced `i-gear`; component `BioCheck({ checked, onChange, what? })`.

- [ ] **Step 1: Create the branch (outer repo)**

```bash
cd /Users/johnoverton/Development/mobile-app-v1
git rev-parse --show-toplevel   # must print .../mobile-app-v1
git checkout -b feature/ui-pass-2
```

- [ ] **Step 2: Generate the hero asset**

```bash
sips -Z 1170 -s format jpeg -s formatOptions 70 \
  "docs/mockups/Sprout-track-design/uploads/photorealistic-lifestyle-photography--shot-on-35mm.png" \
  --out public/art/hero.jpg
ls -la public/art/hero.jpg
```
Expected: file ≤ ~300KB. If larger, re-run with `-s formatOptions 60`.

- [ ] **Step 3: Write the failing BioCheck test** (`src/components/BioCheck.test.tsx`)

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { BioCheck } from './BioCheck'

test('renders keychain copy with the secret name and toggles', () => {
  const onChange = vi.fn()
  render(<BioCheck checked={true} onChange={onChange} what="password" />)
  expect(screen.getByText('Unlock with Face ID next time')).toBeTruthy()
  expect(screen.getByText(/Your password lives in this phone’s secure keychain - a glance opens the book\./)).toBeTruthy()
  fireEvent.click(screen.getByRole('checkbox'))
  expect(onChange).toHaveBeenCalledWith(false)
})

test('defaults the secret name to PIN', () => {
  render(<BioCheck checked={false} onChange={() => {}} />)
  expect(screen.getByText(/Your PIN lives in this phone’s secure keychain/)).toBeTruthy()
})
```

- [ ] **Step 4: Run it — expect FAIL** (`npm test -- BioCheck`)

- [ ] **Step 5: Implement** (`src/components/BioCheck.tsx`)

```tsx
export function BioCheck({
  checked, onChange, what = 'PIN',
}: { checked: boolean; onChange: (v: boolean) => void; what?: string }) {
  return (
    <label className="fcheck">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span><b>Unlock with Face ID next time</b><small>Your {what} lives in this phone&rsquo;s secure keychain - a glance opens the book.</small></span>
    </label>
  )
}
```

- [ ] **Step 6: Add icon symbols** — in `src/components/Icons.tsx`, REPLACE the existing `i-gear` symbol (sun/rays glyph) with the real cog, and add the new symbols inside `<defs>`:

```tsx
<symbol {...STROKE} strokeWidth={1.6} id="i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /></symbol>
<symbol {...STROKE} id="i-mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7.5l9 6 9-6" /></symbol>
<symbol {...STROKE} id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" /></symbol>
<symbol {...STROKE} id="i-people" viewBox="0 0 24 24"><circle cx="9" cy="9" r="3.2" /><path d="M3.5 19.5c.7-3.2 2.7-4.8 5.5-4.8s4.8 1.6 5.5 4.8M17 6.7a2.8 2.8 0 0 1 0 5.6M18.5 15c1.8.6 2.9 1.9 3.4 4" /></symbol>
<symbol {...STROKE} id="i-chevr" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></symbol>
<symbol {...STROKE} id="i-chevd" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></symbol>
<symbol {...STROKE} id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" /></symbol>
<symbol {...STROKE} id="i-out" viewBox="0 0 24 24"><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M15 8l4 4-4 4M19 12h-9" /></symbol>
<symbol {...STROKE} id="i-ext" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></symbol>
<symbol {...STROKE} id="i-key" viewBox="0 0 24 24"><circle cx="7.5" cy="15.5" r="3.5" /><path d="M10.5 13L20 4M16.5 5.5L19 8" /></symbol>
<symbol {...STROKE} id="i-check" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></symbol>
```

- [ ] **Step 7: Append CSS to `src/index.css`** (adapted from `docs/mockups/Sprout-track-design/capacitor-app.html` — token names use the file's existing `--color-*` convention; check the file and match it exactly):

```css
/* --- splash --- */
.splash{position:absolute;inset:0;z-index:60;overflow:hidden;background:var(--color-paper);transition:opacity .55s ease}
.splash .bg{position:absolute;inset:-5%;background:url('/art/hero.jpg') 60% 30%/cover no-repeat;animation:kburns 6.5s ease-out forwards}
.splash .grad{position:absolute;inset:0;background:radial-gradient(90% 70% at 85% 10%,rgba(239,228,200,.75) 0%,rgba(247,241,226,.55) 60%),linear-gradient(rgba(247,241,226,.6),rgba(247,241,226,.82))}
.splash .ct{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding-bottom:34px;transition:transform .55s ease}
.splash .ct img{width:92px;height:92px;border-radius:50%;animation:spop .75s cubic-bezier(.18,.9,.32,1.35) both}
.splash .wm{font-family:'Literata',Georgia,serif;font-weight:700;font-size:33px;letter-spacing:-.01em;color:var(--color-ink);margin-top:16px;animation:srise .6s .28s ease both}
.splash .tag{font-weight:800;font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--color-apricot);margin-top:7px;animation:srise .6s .5s ease both}
.splash.out{opacity:0}.splash.out .ct{transform:translateY(-16px)}
@keyframes kburns{from{transform:scale(1.09)}to{transform:none}}
@keyframes spop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
@keyframes srise{from{opacity:0;transform:translateY(13px)}to{opacity:1;transform:none}}
/* --- fork --- */
.m-scr.bleed{padding-top:0}
.fork-top{height:calc(env(safe-area-inset-top,0px) + 176px);flex-shrink:0;position:relative;background-image:radial-gradient(90% 70% at 85% 10%,rgba(239,228,200,.7),rgba(247,241,226,.5) 60%),linear-gradient(rgba(247,241,226,.4),var(--color-paper)),url('/art/hero.jpg');background-repeat:no-repeat;background-size:auto,auto,cover;background-position:center,center,60% 30%}
.fork-logo{position:absolute;left:50%;bottom:-30px;transform:translateX(-50%);width:62px;height:62px;border-radius:50%}
.fork-bd{flex:1;overflow-y:auto;padding:44px 22px 46px;text-align:center}
.fork-bd h1{font-family:'Literata',Georgia,serif;font-size:24px;color:var(--color-ink);letter-spacing:-.01em}
.fork-bd h1 em{font-style:italic;color:var(--color-teal)}
.fork-bd .sub{font-size:15px;color:var(--color-sub);margin:6px 0 22px;text-wrap:pretty}
.choice{display:flex;gap:13px;align-items:center;width:100%;text-align:left;background:var(--color-card);border:1px solid var(--color-line);border-radius:16px;padding:16px 15px;box-shadow:0 12px 26px -20px rgba(58,48,24,.5);cursor:pointer;font-family:inherit;transition:border-color .12s;margin-bottom:12px}
.choice:hover{border-color:#c9bd9e}
.choice .ic{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;flex-shrink:0}
.ic-teal{background:#cfe5df;color:var(--color-teal-deep)}.ic-apr{background:#f5dcc4;color:#8a4a12}
.choice .t{flex:1;min-width:0}
.choice .t b{font-family:'Literata',Georgia,serif;font-size:16.5px;font-weight:600;color:var(--color-ink);display:block}
.choice .t span{font-size:13.5px;color:var(--color-sub);line-height:1.35;display:block;margin-top:1px;text-wrap:pretty}
.choice>svg{color:#c9bd9e;flex-shrink:0}
.fork-foot{font-size:13px;color:var(--color-sub);margin-top:12px}
/* --- password reqs + auth links --- */
.reqs{display:grid;grid-template-columns:1fr 1fr;gap:5px 12px;margin-top:9px;font-size:12.5px;color:var(--color-sub)}
.reqs span{display:flex;gap:7px;align-items:center}
.reqs i{width:15px;height:15px;border:1.5px solid var(--color-line);border-radius:50%;flex-shrink:0;display:grid;place-items:center;font-style:normal;font-size:9px;line-height:1;color:transparent;transition:.15s}
.reqs .ok{color:var(--color-teal);font-weight:600}
.reqs .ok i{background:var(--color-teal);border-color:var(--color-teal);color:#fff}
.auth-alt{text-align:center;font-size:14px;color:var(--color-sub);line-height:1.8}
.legal{font-size:12.5px;color:var(--color-sub);text-align:center;text-wrap:pretty}
/* --- wizard --- */
.wiz-hd{padding:calc(env(safe-area-inset-top,0px) + 18px) 22px 0;flex-shrink:0;position:relative}
.wiz-brand{display:flex;align-items:center;gap:9px;font-family:'Literata',Georgia,serif;font-weight:700;font-size:17px;color:var(--color-ink)}
.wiz-brand img{width:26px;height:26px;border-radius:50%}
.wiz-art{position:absolute;right:18px;top:calc(env(safe-area-inset-top,0px) + 94px);pointer-events:none;z-index:1;opacity:.9}
.prog{height:5px;background:#e4d9bf;border-radius:99px;margin:13px 0 7px;overflow:hidden}
.prog i{display:block;height:100%;background:var(--color-teal);border-radius:99px;transition:width .45s ease}
.wiz-step{font-size:12px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:var(--color-apricot)}
.wiz-meta{display:flex;justify-content:space-between;align-items:center}
.wiz-saved{font-size:12px;font-weight:700;color:var(--color-teal);display:inline-flex;gap:5px;align-items:center}
.wiz-bd{flex:1;overflow-y:auto;padding:6px 22px 20px;min-height:0}
.wiz-bd h2{font-family:'Literata',Georgia,serif;font-size:22px;color:var(--color-ink);margin:6px 0 3px;letter-spacing:-.01em}
.wiz-bd .intro{font-size:14.5px;color:var(--color-sub);margin-bottom:16px;text-wrap:pretty}
.wiz-ft{display:flex;gap:10px;padding:12px 22px calc(env(safe-area-inset-bottom,0px) + 18px);border-top:1px dashed var(--color-line);flex-shrink:0;background:var(--color-paper)}
.wiz-ft .m-btn{flex:1;width:auto}
.slug-row{display:flex;gap:8px}
.slug-row .fi{flex:1;font-family:ui-monospace,SFMono-Regular,monospace;font-size:14.5px}
.slug-row button{width:47px;border:1.5px solid var(--color-line);background:var(--color-card);border-radius:11px;color:var(--color-teal);display:grid;place-items:center;cursor:pointer;flex-shrink:0}
.slug-row button:hover{border-color:var(--color-teal)}
.slug-note code,.slug-ok code{background:var(--color-hover);border:1px solid var(--color-line);border-radius:6px;padding:1px 6px;font-size:12px;font-family:ui-monospace,monospace}
.slug-note code{color:var(--color-ink)}
.slug-ok{display:flex;gap:7px;align-items:center;font-size:13.5px;color:var(--color-teal);font-weight:600}
.slug-ok code{color:var(--color-teal-deep)}
.slug-checking{display:flex;gap:9px;align-items:center;font-size:13.5px;color:var(--color-sub)}
.slug-checking .dots i{width:6px;height:6px}
.ropt{display:flex;gap:11px;align-items:flex-start;border:1.5px solid var(--color-line);border-radius:13px;padding:12px 13px;cursor:pointer;background:var(--color-card);transition:border-color .12s,box-shadow .12s}
.ropt input{accent-color:var(--color-teal);width:17px;height:17px;margin-top:2px;flex-shrink:0}
.ropt.on{border-color:var(--color-teal);box-shadow:0 0 0 3px rgba(12,107,98,.12)}
.ropt b{font-weight:700;font-size:15px;color:var(--color-ink);display:block}
.ropt small{font-size:13px;color:var(--color-sub);text-wrap:pretty}
.ct-item{display:flex;gap:9px;align-items:center;background:var(--color-card);border:1px solid var(--color-line);border-radius:12px;padding:9px 12px}
.ct-item .nm{font-weight:700;font-size:15px;color:var(--color-ink);flex:1;min-width:0}
.ct-item .meta{font-size:12.5px;color:var(--color-sub);flex-shrink:0}
.fi-err{font-size:12.5px;color:var(--color-rust);margin-top:4px}
```

- [ ] **Step 8: Run all tests** (`npm test`) — expected: all pass (BioCheck new, nothing else touched behavior).

- [ ] **Step 9: Commit** (verify repo/branch first per Global Constraints)

```bash
git add src/index.css src/components/Icons.tsx src/components/BioCheck.tsx src/components/BioCheck.test.tsx public/art/hero.jpg
git commit -m "feat: pass-2 theme foundation - splash/fork/wizard CSS, icon set, hero asset, BioCheck"
```

---

### Task 2: Polish sweep on existing screens

**Files:**
- Modify: `src/screens/AddFamily.tsx` (+`.test.tsx`), `Families.tsx` (+`.test.tsx`), `Settings.tsx` (+`.test.tsx`), `Connecting.tsx` (+`.test.tsx`), `Offline.tsx` (+`.test.tsx`)

**Interfaces:**
- Consumes: `BioCheck` from Task 1.
- Produces: AddFamily no longer supports account sign-in (accounts go through the fork); all copy em-dash-free.

Apply these exact copy changes (update the colocated tests' assertions to match — the em dash `—` becomes ` - ` everywhere):

**AddFamily.tsx** (also structural):
1. Delete the account path: remove `useAccount`, `email`, `password` state; remove the `enableAccounts` checkbox block and the email/password branch; creds are always `{ type: 'pin', ... }`; `canVerify` becomes `located?.authType === 'CARETAKER' ? loginId !== '' && pin !== '' : pin !== ''`; drop `authType: useAccount ? 'ACCOUNT' : located.authType` in favor of `authType: located.authType`.
2. Label `Server address` → `Family link`; helper → `The same address you&rsquo;d open in a browser - hosted or self-hosted.`
3. ERROR_TEXT `'missing-slug'` → `'Add your family’s name to the end - like myhost.com/smith-family.'`; `locked` → `'Too many tries - the server is taking a breather. Try again in a few minutes.'`; `'save-failed'` → `'Login worked but saving the family failed - try again.'`
4. Warn copy → `Heads up - this connection isn&rsquo;t encrypted. Fine on your home network, risky on public Wi-Fi.`
5. Sign-in helper → `` Same {located.authType === 'CARETAKER' ? 'ID and PIN' : 'PIN'} as the website - we check it with your server, then keep it safe here. ``
6. Replace the inline biometric `<label className="fcheck">…</label>` with `<BioCheck checked={biometric} onChange={setBiometric} />`.

**Families.tsx:** `LOCKED_COPY` → `'Too many tries - the server is taking a breather. Try again in a few minutes.'`

**Settings.tsx:**
- Toggle title → `Open my starred family automatically`; body → `Skip the list - the family marked with <Ic id="i-starf" s={13} style={{ color: 'var(--color-apricot)', verticalAlign: -1 }} /> {defName ? <>(<b style={{ fontWeight: 700 }}>{defName}</b>)</> : ''} opens the moment the app does. Your unlock is still the gate.`; the switch `aria-label` → `Open my starred family automatically`.
- Keychain section: `<h3>Your sign-ins stay put</h3>`; body → `Saved PINs and passwords live in this phone&rsquo;s secure keychain and never leave it. Remove a family and its sign-in goes with it.`
- Clear section body → `Removes every saved family and sign-in from this phone. Your family&rsquo;s data stays safe on the server.`; confirm line → `This clears the book from this phone - the server keeps everything. Sure?`

**Connecting.tsx:** replace the `how` ternary with the single string `signing you in with your saved credentials` (delete the `how` variable, inline the copy: `{host} · signing you in with your saved credentials`).

**Offline.tsx:** body → `{entry.familyName}&rsquo;s server isn&rsquo;t answering right now. Everything already logged is safe - we just can&rsquo;t say hello.`

- [ ] **Step 1:** Update the test assertions first (AddFamily.test.tsx: delete the account-path tests, fix copy regexes; others: fix copy). Run `npm test` — expect FAIL.
- [ ] **Step 2:** Apply the changes above. Run `npm test` — expect PASS (all files).
- [ ] **Step 3:** Commit: `git add -u src/screens && git commit -m "feat: punch-list polish sweep - copy, gear icon usage, AddFamily family-link flow"`

---

### Task 3: api-client token support, slug lib, account service

**Files:**
- Modify: `src/lib/api-client.ts`
- Create: `src/lib/slug.ts`, `src/lib/slug.test.ts`, `src/services/account.ts`, `src/services/account.test.ts`

**Interfaces (Produces — later tasks depend on these exact signatures):**

```ts
// api-client.ts
export async function postJson(url: string, body: unknown, opts?: { token?: string }): Promise<HttpResponse>
export async function getJson(url: string, opts?: { token?: string }): Promise<HttpResponse>

// slug.ts
export const RESERVED_URLS: readonly string[]
export function slugify(s: string): string
export function validateSlug(slug: string): { ok: true } | { ok: false; error: string }
export function titleFromSlug(slug: string): string
export const digitsOnly: (v: string, max: number) => string

// account.ts
export const SAAS_BASE = 'https://sprout-track.com'
export type RegisterResult = { ok: true } | { ok: false; error: 'rate-limited' | 'unreachable' | 'rejected'; message?: string }
export async function registerAccount(base: string, args: { email: string; password: string; firstName: string; lastName: string }, post?: typeof postJson): Promise<RegisterResult>
export interface AccountStatus { verified: boolean; hasFamily: boolean; familySlug?: string; firstName?: string }
export async function fetchAccountStatus(base: string, token: string, get?: typeof getJson): Promise<AccountStatus | null>
export async function resendVerification(base: string, email: string, post?: typeof postJson): Promise<boolean>
export async function requestPasswordReset(base: string, email: string, post?: typeof postJson): Promise<boolean>
export interface SetupStatus { setupStage: number; currentStage: 2 | 3; familyId: string; familyName: string; familySlug: string }
export async function fetchSetupStatus(base: string, token: string, get?: typeof getJson): Promise<SetupStatus | null>
```

- [ ] **Step 1: Failing tests** — `src/lib/slug.test.ts`:

```ts
import { expect, test } from 'vitest'
import { slugify, validateSlug, titleFromSlug, digitsOnly } from './slug'

test('slugify lowercases, strips apostrophes, hyphenates', () => {
  expect(slugify("The O'Brien Family!")).toBe('the-obrien-family')
  expect(slugify('  Sprout  Test  ')).toBe('sprout-test')
})
test('validateSlug enforces charset, length, reserved list', () => {
  expect(validateSlug('smith-family')).toEqual({ ok: true })
  expect(validateSlug('')).toEqual({ ok: false, error: 'Your family needs a link - type one or tap the suggest button.' })
  expect(validateSlug('Smith!')).toEqual({ ok: false, error: 'Links can only use lowercase letters, numbers, and hyphens.' })
  expect(validateSlug('ab')).toEqual({ ok: false, error: 'Links need at least 3 characters.' })
  expect(validateSlug('a'.repeat(51))).toEqual({ ok: false, error: 'Links max out at 50 characters.' })
  expect(validateSlug('api')).toEqual({ ok: false, error: 'The system uses /api for itself - pick something else.' })
})
test('titleFromSlug and digitsOnly', () => {
  expect(titleFromSlug('smith-family')).toBe('Smith Family')
  expect(digitsOnly('1a2b3c4d5e6f7', 6)).toBe('123456')
})
```

`src/services/account.test.ts` (representative — cover every function):

```ts
import { expect, test, vi } from 'vitest'
import { registerAccount, fetchAccountStatus, resendVerification, requestPasswordReset, fetchSetupStatus } from './account'

test('registerAccount posts and maps success', async () => {
  const post = vi.fn().mockResolvedValue({ status: 200, body: { success: true, data: { success: true, requiresVerification: true } } })
  const r = await registerAccount('https://x.com', { email: 'a@b.com', password: 'Pw1!aaaa', firstName: 'A', lastName: 'B' }, post)
  expect(r).toEqual({ ok: true })
  expect(post).toHaveBeenCalledWith('https://x.com/api/accounts/register',
    { email: 'a@b.com', password: 'Pw1!aaaa', firstName: 'A', lastName: 'B' })
})
test('registerAccount maps 429, rejection message, and network error', async () => {
  expect(await registerAccount('https://x.com', args(), vi.fn().mockResolvedValue({ status: 429, body: { success: false } })))
    .toEqual({ ok: false, error: 'rate-limited' })
  expect(await registerAccount('https://x.com', args(), vi.fn().mockResolvedValue({ status: 400, body: { success: false, error: 'An account with this email already exists' } })))
    .toEqual({ ok: false, error: 'rejected', message: 'An account with this email already exists' })
  expect(await registerAccount('https://x.com', args(), vi.fn().mockRejectedValue(new TypeError('net'))))
    .toEqual({ ok: false, error: 'unreachable' })
  function args() { return { email: 'a@b.com', password: 'p', firstName: 'A', lastName: 'B' } }
})
test('fetchAccountStatus passes token and maps fields; null on failure', async () => {
  const get = vi.fn().mockResolvedValue({ status: 200, body: { success: true, data: { verified: true, hasFamily: true, familySlug: 'fs', firstName: 'Jo' } } })
  expect(await fetchAccountStatus('https://x.com', 'tok', get))
    .toEqual({ verified: true, hasFamily: true, familySlug: 'fs', firstName: 'Jo' })
  expect(get).toHaveBeenCalledWith('https://x.com/api/accounts/status', { token: 'tok' })
  expect(await fetchAccountStatus('https://x.com', 'tok', vi.fn().mockResolvedValue({ status: 401, body: null }))).toBeNull()
  expect(await fetchAccountStatus('https://x.com', 'tok', vi.fn().mockRejectedValue(new Error('net')))).toBeNull()
})
test('resendVerification and requestPasswordReset post email, return envelope success', async () => {
  const post = vi.fn().mockResolvedValue({ status: 200, body: { success: true, data: { success: true } } })
  expect(await resendVerification('https://x.com', 'a@b.com', post)).toBe(true)
  expect(post).toHaveBeenCalledWith('https://x.com/api/accounts/resend-verification', { email: 'a@b.com' })
  expect(await requestPasswordReset('https://x.com', 'a@b.com', post)).toBe(true)
  expect(post).toHaveBeenLastCalledWith('https://x.com/api/accounts/forgot-password', { email: 'a@b.com' })
  expect(await resendVerification('https://x.com', 'a@b.com', vi.fn().mockRejectedValue(new Error()))).toBe(false)
})
test('fetchSetupStatus maps familyData; null on failure', async () => {
  const get = vi.fn().mockResolvedValue({ status: 200, body: { success: true, data: { setupStage: 2, currentStage: 3, familyData: { id: 'f1', name: 'Smith', slug: 'smith' } } } })
  expect(await fetchSetupStatus('https://x.com', 'tok', get))
    .toEqual({ setupStage: 2, currentStage: 3, familyId: 'f1', familyName: 'Smith', familySlug: 'smith' })
  expect(get).toHaveBeenCalledWith('https://x.com/api/family/setup-status', { token: 'tok' })
  expect(await fetchSetupStatus('https://x.com', 'tok', vi.fn().mockRejectedValue(new Error()))).toBeNull()
})
```

- [ ] **Step 2:** Run — expect FAIL (modules missing).
- [ ] **Step 3: Implement.** `api-client.ts` — extend `postJson` with `opts: { token?: string } = {}` adding `Authorization: Bearer ${opts.token}` to headers when present (both native and fetch paths), and add `getJson` mirroring it with GET (`CapacitorHttp.get` / `fetch` with `Accept: application/json`, same JSON-parse-or-null behavior as postJson's fetch path). `slug.ts`:

```ts
export const RESERVED_URLS = ['account','api','coming-soon','family-manager','family-select','setup','sphome','login','auth','context','globals','layout','metadata','page','template','features','home','pricing','privacy','terms','health','logs','maintenance','status','update','uptime','version'] as const

export function slugify(s: string): string {
  return s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function validateSlug(slug: string): { ok: true } | { ok: false; error: string } {
  if (!slug.trim()) return { ok: false, error: 'Your family needs a link - type one or tap the suggest button.' }
  if (!/^[a-z0-9-]+$/.test(slug)) return { ok: false, error: 'Links can only use lowercase letters, numbers, and hyphens.' }
  if (slug.length < 3) return { ok: false, error: 'Links need at least 3 characters.' }
  if (slug.length > 50) return { ok: false, error: 'Links max out at 50 characters.' }
  if ((RESERVED_URLS as readonly string[]).includes(slug.toLowerCase())) {
    return { ok: false, error: `The system uses /${slug} for itself - pick something else.` }
  }
  return { ok: true }
}

export function titleFromSlug(slug: string): string {
  return slug.split(/[-_]/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

export const digitsOnly = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max)
```

`account.ts` — each function follows the same envelope pattern as `session.ts` (`{ success, data }`, try/catch → failure value). `registerAccount` maps: thrown → `unreachable`; 429 → `rate-limited`; `envelope.success && data.success !== false` → ok; otherwise `rejected` with `envelope.error ?? data.message` as `message` when it's a string. Status/setup-status return `null` unless HTTP 200 + `success:true` + required fields present. `fetchSetupStatus` reads `data.setupStage` (number), `data.currentStage`, `data.familyData.{id,name,slug}`.

- [ ] **Step 4:** `npm test` — expect PASS (including untouched session tests: `postJson`'s new optional param is backward compatible).
- [ ] **Step 5:** Move `titleFromSlug` out of `src/screens/AccountSignIn.tsx` — import it from `../lib/slug` there and delete the local copy. Run `npm test`.
- [ ] **Step 6:** Commit: `git add src/lib src/services/account.ts src/services/account.test.ts src/screens/AccountSignIn.tsx && git commit -m "feat: account service, slug lib, authed api-client helpers"`

---

### Task 4: session `verified` + post-auth routing service

**Files:**
- Modify: `src/services/session.ts`, `src/services/session.test.ts`, `src/services/credential-vault.ts` (one type alias)
- Create: `src/services/account-routing.ts`, `src/services/account-routing.test.ts`

**Interfaces:**
- Consumes: `fetchSetupStatus`, `AccountStatus` (Task 3); `fetchFamilyBySlug` (`server-probe.ts`); `saveServer` (`server-registry.ts`); `CredentialVault`.
- Produces:

```ts
// credential-vault.ts
export type AccountCreds = Extract<StoredCredentials, { type: 'account' }>

// session.ts LoginResult ok-variant gains:  verified?: boolean   (from data.user.verified, account envelope only)

// account-routing.ts
export interface WizardResume { familyId: string; stage: 2 | 3; familyName: string; slug: string }
export type PostLoginRoute =
  | { kind: 'saved'; toast: string }
  | { kind: 'wizard'; resume?: WizardResume }
  | { kind: 'verify' }
  | { kind: 'error'; message: string }
export interface AccountRoutingDeps {
  fetchSetupStatus: typeof fetchSetupStatus
  fetchFamilyBySlug: typeof fetchFamilyBySlug
  saveServer: typeof saveServer
  vault: Pick<CredentialVault, 'store'>
}
export async function routeAfterAccountLogin(args: {
  base: string; token: string; creds: AccountCreds; biometric: boolean
  familySlug?: string; verified: boolean
}, deps: AccountRoutingDeps): Promise<PostLoginRoute>
// Maps a non-error route to a Screen (type-only import of Screen from '../App'):
export function screenForRoute(route: Exclude<PostLoginRoute, { kind: 'error' }>, ctx: { token: string; creds: AccountCreds; biometric: boolean; firstName?: string }): Screen
```

Routing logic (spec §3.5): `familySlug` present → `fetchSetupStatus`; null result → `{ kind: 'error', message: 'Signed in, but we couldn’t check your family’s setup - try again.' }`; `setupStage >= 3` → resolve display name via `fetchFamilyBySlug(base, slug)` falling back to `titleFromSlug`, then `saveServer({ baseUrl: base, familySlug, familyName, deploymentMode: 'saas', authType: 'ACCOUNT' })` + `vault.store(saved.id, creds, { biometric })` → `{ kind: 'saved', toast: 'Saved - {name} is on this phone now.' }` (save/store failure → error `'Login worked but saving the family failed - try again.'`); `setupStage < 3` → `{ kind: 'wizard', resume: { familyId, stage: currentStage, familyName, slug } }`. No familySlug → `verified ? { kind: 'wizard' } : { kind: 'verify' }`.

`screenForRoute`: `saved` → `{ name: 'families', toast }`; `wizard` → `{ name: 'wizard', token, creds, biometric, resume, firstName }`; `verify` → `{ name: 'acct-verify', token, creds, biometric }`. (These Screen members are added in Task 6 — this file compiles once Task 6 lands; Tasks 4+5+6 are committed in dependency order but the type-only forward reference means Task 4's `screenForRoute` tests use a structural expectation, not the App type. To keep Task 4 self-contained, have `screenForRoute` return the object literals typed as `Screen` via `as` only in Task 6 — in Task 4 declare the return type as the structural union `{ name: 'families'; toast?: string } | { name: 'wizard'; ... } | { name: 'acct-verify'; ... }` and switch it to `Screen` in Task 6.)

`session.ts`: in the ok-return, add `...(typeof data.user?.verified === 'boolean' ? { verified: data.user.verified } : {})` and the `user` envelope type gains `verified?: boolean`.

- [ ] **Step 1: Failing tests.** Session: extend the existing nested-envelope test's mock with `verified: false` in `user` and expect `verified: false` in the result; add nothing else. Routing (`account-routing.test.ts`):

```ts
import { expect, test, vi } from 'vitest'
import { routeAfterAccountLogin } from './account-routing'

const creds = { type: 'account' as const, email: 'a@b.com', password: 'pw' }
const base = 'https://sprout-track.com'

function deps(over: Partial<Parameters<typeof routeAfterAccountLogin>[1]> = {}) {
  return {
    fetchSetupStatus: vi.fn().mockResolvedValue({ setupStage: 3, currentStage: 3, familyId: 'f1', familyName: 'Smith', familySlug: 'smith' }),
    fetchFamilyBySlug: vi.fn().mockResolvedValue({ name: 'Smith Family', slug: 'smith', isActive: true }),
    saveServer: vi.fn().mockResolvedValue({ id: 'srv1' }),
    vault: { store: vi.fn().mockResolvedValue(undefined) },
    ...over,
  }
}

test('complete family: saves, vaults, returns saved toast', async () => {
  const d = deps()
  const r = await routeAfterAccountLogin({ base, token: 't', creds, biometric: true, familySlug: 'smith', verified: true }, d)
  expect(r).toEqual({ kind: 'saved', toast: 'Saved - Smith Family is on this phone now.' })
  expect(d.saveServer).toHaveBeenCalledWith({ baseUrl: base, familySlug: 'smith', familyName: 'Smith Family', deploymentMode: 'saas', authType: 'ACCOUNT' })
  expect(d.vault.store).toHaveBeenCalledWith('srv1', creds, { biometric: true })
})
test('incomplete family: wizard resume at currentStage', async () => {
  const d = deps({ fetchSetupStatus: vi.fn().mockResolvedValue({ setupStage: 1, currentStage: 2, familyId: 'f1', familyName: 'Smith', familySlug: 'smith' }) })
  expect(await routeAfterAccountLogin({ base, token: 't', creds, biometric: false, familySlug: 'smith', verified: true }, d))
    .toEqual({ kind: 'wizard', resume: { familyId: 'f1', stage: 2, familyName: 'Smith', slug: 'smith' } })
})
test('no family, verified → wizard; unverified → verify', async () => {
  expect(await routeAfterAccountLogin({ base, token: 't', creds, biometric: true, verified: true }, deps())).toEqual({ kind: 'wizard' })
  expect(await routeAfterAccountLogin({ base, token: 't', creds, biometric: true, verified: false }, deps())).toEqual({ kind: 'verify' })
})
test('setup-status failure and save failure surface errors', async () => {
  expect((await routeAfterAccountLogin({ base, token: 't', creds, biometric: true, familySlug: 's', verified: true },
    deps({ fetchSetupStatus: vi.fn().mockResolvedValue(null) }))).kind).toBe('error')
  expect((await routeAfterAccountLogin({ base, token: 't', creds, biometric: true, familySlug: 'smith', verified: true },
    deps({ saveServer: vi.fn().mockRejectedValue(new Error()) }))).kind).toBe('error')
})
test('name falls back to titleFromSlug when by-slug fails', async () => {
  const d = deps({ fetchFamilyBySlug: vi.fn().mockRejectedValue(new Error()) })
  expect(await routeAfterAccountLogin({ base, token: 't', creds, biometric: true, familySlug: 'smith', verified: true }, d))
    .toEqual({ kind: 'saved', toast: 'Saved - Smith is on this phone now.' })
})
```

- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement per interfaces above. **Step 4:** `npm test` — PASS.
- [ ] **Step 5:** Commit: `git add -A src/services && git commit -m "feat: post-auth account routing + verified flag from login envelope"`

---

### Task 5: Splash and Fork screens

**Files:**
- Create: `src/screens/Splash.tsx`, `src/screens/Splash.test.tsx`, `src/screens/Fork.tsx`, `src/screens/Fork.test.tsx`

**Interfaces:**
- Produces: `Splash({ onDone })` — calls `onDone` once ~2.7s after mount; `Fork({ navigate })` — navigates to `{ name: 'acct-signin' }` / `{ name: 'add-family', prefillInput: '' }`.

- [ ] **Step 1: Failing tests.** Splash (fake timers):

```tsx
import { render, screen, act } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import Splash from './Splash'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('renders brand, fades out at 2150ms, fires onDone at 2700ms', () => {
  const onDone = vi.fn()
  const { container } = render(<Splash onDone={onDone} />)
  expect(screen.getByText('Sprout Track')).toBeTruthy()
  expect(screen.getByText('The shareable baby tracker')).toBeTruthy()
  act(() => vi.advanceTimersByTime(2149))
  expect(container.querySelector('.splash.out')).toBeNull()
  expect(onDone).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(1))
  expect(container.querySelector('.splash.out')).toBeTruthy()
  act(() => vi.advanceTimersByTime(551))
  expect(onDone).toHaveBeenCalledOnce()
})
```

Fork:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import Fork from './Fork'

test('renders headline, two choice cards, keychain footnote', () => {
  render(<Fork navigate={() => {}} />)
  expect(screen.getByText(/Everyone you love,/)).toBeTruthy()
  expect(screen.getByText('How do you sign in to your family?')).toBeTruthy()
  expect(screen.getByText('With my Sprout Track account')).toBeTruthy()
  expect(screen.getByText('Family link shared with you?')).toBeTruthy()
  expect(screen.getByText(/Either way, your sign-in stays in this phone’s secure keychain\./)).toBeTruthy()
})
test('cards navigate to acct-signin and add-family', () => {
  const navigate = vi.fn()
  render(<Fork navigate={navigate} />)
  fireEvent.click(screen.getByText('With my Sprout Track account'))
  expect(navigate).toHaveBeenCalledWith({ name: 'acct-signin' })
  fireEvent.click(screen.getByText('Family link shared with you?'))
  expect(navigate).toHaveBeenCalledWith({ name: 'add-family', prefillInput: '' })
})
```

- [ ] **Step 2:** Run — FAIL. **Step 3: Implement.**

`Splash.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'

const HOLD_MS = 2150
const FADE_MS = 550

export default function Splash({ onDone }: { onDone: () => void }) {
  const [out, setOut] = useState(false)
  const cb = useRef(onDone)
  cb.current = onDone
  useEffect(() => {
    const a = setTimeout(() => setOut(true), HOLD_MS)
    const b = setTimeout(() => cb.current(), HOLD_MS + FADE_MS)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [])
  return (
    <div className={'splash' + (out ? ' out' : '')}>
      <div className="bg" /><div className="grad" />
      <div className="ct">
        <img src="/logo.png" alt="" />
        <div className="wm">Sprout Track</div>
        <div className="tag">The shareable baby tracker</div>
      </div>
    </div>
  )
}
```

`Fork.tsx` (markup mirrors the mockup's `Fork`):

```tsx
import type { Screen } from '../App'
import { Ic } from '../components/Icons'

export default function Fork({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <div className="m-scr bleed">
      <div className="fork-top"><img className="fork-logo" src="/logo.png" alt="" /></div>
      <div className="fork-bd">
        <h1>Everyone you love, <em>on the same page.</em></h1>
        <p className="sub">How do you sign in to your family?</p>
        <button className="choice" onClick={() => navigate({ name: 'acct-signin' })}>
          <span className="ic ic-teal"><Ic id="i-user" s={22} /></span>
          <span className="t"><b>With my Sprout Track account</b><span>Email &amp; password. New here? This creates your account too.</span></span>
          <Ic id="i-chevr" s={18} />
        </button>
        <button className="choice" onClick={() => navigate({ name: 'add-family', prefillInput: '' })}>
          <span className="ic ic-apr"><Ic id="i-key" s={22} /></span>
          <span className="t"><b>Family link shared with you?</b><span>Sign in here with the family link and your family PIN or personal caretaker PIN.</span></span>
          <Ic id="i-chevr" s={18} />
        </button>
        <p className="fork-foot">Either way, your sign-in stays in this phone&rsquo;s secure keychain.</p>
      </div>
    </div>
  )
}
```

Note: `Screen` doesn't include `acct-signin` until Task 6. In this task, type the prop structurally: `{ navigate: (s: { name: 'acct-signin' } | { name: 'add-family'; prefillInput?: string }) => void }`. Task 6 switches it to `Screen`. The tests above work unchanged.

- [ ] **Step 4:** `npm test` — PASS. **Step 5:** Commit: `git add src/screens/Splash* src/screens/Fork* && git commit -m "feat: splash and sign-in fork screens"`

---

### Task 6: App shell rework — Screen union, splash gating, fork wiring

**Files:**
- Modify: `src/App.tsx`, `src/App.test.tsx`, `src/screens/Fork.tsx` (prop type → `Screen`), `src/screens/Settings.tsx` (clearAll → fork), `src/screens/Families.tsx` (Add a family → fork), `src/screens/AddFamily.tsx` (back target → fork), `src/screens/AccountSignIn.tsx` (back target → fork), `src/services/account-routing.ts` (screenForRoute returns `Screen`)
- Delete: `src/screens/Welcome.tsx`, `src/screens/Welcome.test.tsx`

**Interfaces:**
- Produces the final Screen union (all later tasks rely on these exact member shapes):

```ts
import type { AccountCreds } from './services/credential-vault'
import type { WizardResume } from './services/account-routing'

export type Screen =
  | { name: 'splash' }
  | { name: 'fork' }
  | { name: 'acct-signin'; notice?: string }
  | { name: 'acct-signup' }
  | { name: 'acct-verify'; token: string; creds: AccountCreds; biometric: boolean }
  | { name: 'acct-reset' }
  | { name: 'wizard'; token: string; creds: AccountCreds; biometric: boolean; resume?: WizardResume; firstName?: string }
  | { name: 'add-family'; prefillInput?: string }
  | { name: 'families'; toast?: string; notice?: string }
  | { name: 'settings' }
  | { name: 'offline'; entry: ServerEntry }
  | { name: 'connecting'; entry: ServerEntry }
```

- [ ] **Step 1: Update App.test.tsx first** (FAIL): initial render shows the splash (`.splash` present); after `vi.advanceTimersByTime(2700)` with no saved servers → Fork headline visible; with saved servers → families list; with servers + auto-open → connecting; with `?bridge-event=` show-server-list → families; reconnect → connecting. Boot resolution BEFORE splash completion must not swap the screen early (assert `.splash` still present at 2000ms even when listServers resolved immediately).

- [ ] **Step 2: Rework `src/App.tsx`:**

```tsx
export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'splash' })
  const bootTarget = useRef<Screen | null>(null)
  const splashDone = useRef(false)

  useEffect(() => {
    const bootAction = bootActionFromSearch(window.location.search)
    stripBridgeEvent()
    const applyBootTarget = (target: Screen) => {
      bootTarget.current = target
      if (splashDone.current) setScreen(s => (s.name === 'splash' ? target : s))
    }
    void (async () => {
      const servers = await listServers()
      if (servers.length === 0) return applyBootTarget({ name: 'fork' })
      if (bootAction === 'show-server-list') return applyBootTarget({ name: 'families' })
      if (bootAction === 'reconnect') {
        const recent = servers.find(e => e.lastUsedAt !== null)
        return applyBootTarget(recent ? { name: 'connecting', entry: recent } : { name: 'families' })
      }
      const def = await getDefaultServer()
      const autoOpen = def ? await isAutoOpenEnabled() : false
      applyBootTarget(def && autoOpen ? { name: 'connecting', entry: def } : { name: 'families' })
    })()
  }, [])

  const handleSplashDone = () => {
    splashDone.current = true
    const target = bootTarget.current
    if (target) setScreen(s => (s.name === 'splash' ? target : s))
  }

  return (
    <div className="m-root" data-testid="app-root">
      <IconDefs />
      {screen.name === 'splash' && <Splash onDone={handleSplashDone} />}
      {screen.name === 'fork' && <Fork navigate={setScreen} />}
      {screen.name === 'acct-signin' && <AccountSignIn navigate={setScreen} notice={screen.notice} />}
      {screen.name === 'families' && <Families navigate={setScreen} toast={screen.toast} notice={screen.notice} />}
      {screen.name === 'add-family' && <AddFamily navigate={setScreen} prefillInput={screen.prefillInput} />}
      {screen.name === 'settings' && <Settings navigate={setScreen} />}
      {screen.name === 'offline' && <Offline navigate={setScreen} entry={screen.entry} />}
      {screen.name === 'connecting' && <Connecting entry={screen.entry} navigate={setScreen} />}
    </div>
  )
}
```

(`acct-signup`/`acct-verify`/`acct-reset`/`wizard` render lines are added by Tasks 8/9/10/12. AccountSignIn gains a `notice?: string` prop here — render `{notice && <Toast message={notice} />}` at the end of its root div; the Task 7 rework keeps it. Splash edge: if a splash finishes before boot resolves, `bootTarget` is null and the splash overlay has already faded — render-wise `screen` is still `'splash'`, which renders `Splash` again. Prevent re-running: keep the faded splash mounted (it's visually empty at opacity 0) — acceptable, boot resolves within ms of listServers; the later `applyBootTarget` swaps the screen.)

- [ ] **Step 3:** Retarget navigation: `Settings.clearAll` → `navigate({ name: 'fork' })`; `Families` "Add a family" button → `navigate({ name: 'fork' })`; `AddFamily` back → `hasFamilies ? { name: 'families' } : { name: 'fork' }`; `AccountSignIn` back → `{ name: 'fork' }`; `Fork` prop type → `Screen`; `screenForRoute` return type → `Screen`. Delete `Welcome.tsx` + its test. Update the touched tests.

- [ ] **Step 4:** `npm test` — all PASS. **Step 5:** Commit: `git add -A src && git commit -m "feat: splash-gated boot, fork routing, full pass-2 screen union"`

---

### Task 7: AccountSignIn rework

**Files:**
- Modify: `src/screens/AccountSignIn.tsx`, `src/screens/AccountSignIn.test.tsx`

**Interfaces:**
- Consumes: `routeAfterAccountLogin`, `screenForRoute`, `AccountRoutingDeps` (Task 4); `BioCheck`; `SAAS_BASE` (Task 3); existing `loginWithCredentials`.
- Produces: `AccountSignIn({ navigate, notice?, deps? })` where deps = `{ login: typeof loginWithCredentials } & AccountRoutingDeps`.

Rework the screen: title `Welcome back.`; intro `Sign in to your family&rsquo;s page with your sprout-track.com account.`; email/password fields (ids `aiEm`/`aiPw`); `<BioCheck checked={biometric} onChange={setBiometric} what="password" />`; ERROR_TEXT `invalid` → `That email and password didn’t match. Give it another look and try again.`, `locked` → `Too many tries - the server is taking a breather. Try again in a few minutes.`, `unreachable` unchanged but with ` - ` if it had an em dash; button busy copy `Checking with Sprout Track…`; below the button:

```tsx
<div className="auth-alt">
  New here? <button className="m-link" onClick={() => navigate({ name: 'acct-signup' })}>Start your free trial</button><br />
  Forgot your password? <button className="m-link" onClick={() => navigate({ name: 'acct-reset' })}>Reset it</button>
</div>
```

Sign-in handler: on `result.ok`, call `routeAfterAccountLogin({ base: SAAS_BASE, token: result.token, creds, biometric, familySlug: result.familySlug || undefined, verified: result.verified ?? true }, deps)`; `route.kind === 'error'` → `setError(route.message)`; else `navigate(screenForRoute(route, { token: result.token, creds, biometric }))`. (Note `verified ?? true`: an old server whose envelope lacks `user.verified` must not strand users on the verify screen.) The old no-family guard (`NO_FAMILY_TEXT`) is deleted — no-family now routes to the wizard.

- [ ] **Step 1:** Rewrite the test file (FAIL first): renders new copy + links; link clicks navigate to `acct-signup`/`acct-reset`; successful login with family → navigates to families toast (mock deps end-to-end through routeAfterAccountLogin by stubbing the routing deps); login without family + verified → wizard screen object with token/creds/biometric; without family + `verified: false` → acct-verify; login error shows ERROR_TEXT; `notice` prop renders a Toast.
- [ ] **Step 2:** Implement; `npm test` PASS.
- [ ] **Step 3:** Commit: `git add src/screens/AccountSignIn* && git commit -m "feat: account sign-in rework with signup/reset links and post-auth routing"`

---

### Task 8: AccountSignUp screen

**Files:**
- Create: `src/screens/AccountSignUp.tsx`, `src/screens/AccountSignUp.test.tsx`
- Modify: `src/App.tsx` (add render line)

**Interfaces:**
- Consumes: `registerAccount`, `SAAS_BASE` (3); `loginWithCredentials`; `routeAfterAccountLogin`/`screenForRoute` + `AccountRoutingDeps` (4); `BioCheck`.
- Produces: `AccountSignUp({ navigate, deps? })`, deps = `{ register: typeof registerAccount; login: typeof loginWithCredentials } & AccountRoutingDeps`. Exports `PW_REQS: ReadonlyArray<readonly [string, (p: string) => boolean]>`.

```tsx
export const PW_REQS = [
  ['8+ characters', (p: string) => p.length >= 8],
  ['A number', (p: string) => /\d/.test(p)],
  ['A lowercase letter', (p: string) => /[a-z]/.test(p)],
  ['A symbol', (p: string) => /[^A-Za-z0-9\s]/.test(p)],
  ['An uppercase letter', (p: string) => /[A-Z]/.test(p)],
] as const
```

Markup mirrors the mockup `AcctSignUp`: Header `Create your account.` (back → `acct-signin`); intro `14 days free, no card needed.`; first/last name row (ids `suF`/`suL`), email `suE`, password `suP` with the `.reqs` checklist (`<span className={fn(pw) ? 'ok' : ''}><i>✓</i>{label}</span>`); `BioCheck what="password"`; submit disabled until all reqs pass + `/.+@.+\..+/` email + both names; busy copy `Planting your account…`, idle `Start my free trial`; legal line `By signing up you agree to our Terms and Privacy Policy.`; auth-alt `Already have an account? <button class m-link>Sign in</button>`.

Submit: `register` → failure: `rate-limited` → `Too many tries - the server is taking a breather. Try again in a few minutes.`, `unreachable` → the standard unreachable copy, `rejected` → `message ?? 'That didn’t work - check your details and try again.'`. Success → `login` with the same email/password → on ok, route exactly as Task 7 (pass `firstName` into `screenForRoute` ctx so the wizard can prefill); login failure after successful register → error `Account created - but signing in failed. Try signing in.`

- [ ] **Step 1:** Failing tests: checklist pills flip class as password grows; button disabled/enabled boundary; successful signup+login navigates to `acct-verify` (unverified account); register rejection shows server message; App renders the screen for `{ name: 'acct-signup' }`.
- [ ] **Step 2:** Implement + App render line `{screen.name === 'acct-signup' && <AccountSignUp navigate={setScreen} />}`.
- [ ] **Step 3:** `npm test` PASS. Commit: `git add src/screens/AccountSignUp* src/App.tsx src/App.test.tsx && git commit -m "feat: create-account screen with live password checklist"`

---

### Task 9: AccountVerify screen

**Files:**
- Create: `src/screens/AccountVerify.tsx`, `src/screens/AccountVerify.test.tsx`
- Modify: `src/App.tsx` (render line)

**Interfaces:**
- Consumes: `fetchAccountStatus`, `resendVerification`, `SAAS_BASE` (3); `routeAfterAccountLogin`/`screenForRoute` + deps (4).
- Produces: `AccountVerify({ navigate, token, creds, biometric, deps?, pollMs = 5000 })`, deps = `{ fetchAccountStatus: typeof fetchAccountStatus; resendVerification: typeof resendVerification } & AccountRoutingDeps`.

Behavior: on mount and every `pollMs`, `fetchAccountStatus(SAAS_BASE, token)`; when `status?.verified` → clear the interval and `routeAfterAccountLogin({ base, token, creds, biometric, familySlug: status.familySlug, verified: true }, deps)` → error → inline ErrBox; else `navigate(screenForRoute(route, { token, creds, biometric, firstName: status.firstName }))`. Null statuses are ignored (keep polling). Resend button → `resendVerification(SAAS_BASE, creds.email)` → inline note `Sent - check your inbox.` on true, ErrBox `Couldn’t resend just now - try again in a minute.` on false.

Markup (voice-consistent, no mockup screen exists): Header `Check your email.` (back → `acct-signin`); body:

```tsx
<div className="f-grid">
  <p className="fh" style={{ marginTop: 0 }}>We sent a verification link to <b>{creds.email}</b>. Tap it, then come back here - we&rsquo;ll notice the moment you&rsquo;re verified.</p>
  <div className="slug-checking"><span className="dots" style={{ margin: 0 }}><i></i><i></i><i></i></span>Waiting for your click…</div>
  {note && <p className="slug-ok"><Ic id="i-check" s={15} />{note}</p>}
  {error && <ErrBox>{error}</ErrBox>}
  <button className="m-btn ghost" disabled={busy} onClick={() => void resend()}>Resend the email</button>
</div>
```

- [ ] **Step 1:** Failing tests (fake timers): poll fires at pollMs intervals; verified status with familySlug routes through to `families` (stub routing deps); verified without family → wizard; resend success shows note; unmount clears the interval (no act warnings).
- [ ] **Step 2:** Implement + App render line passing `token/creds/biometric` from the screen object.
- [ ] **Step 3:** `npm test` PASS. Commit: `git add src/screens/AccountVerify* src/App.tsx src/App.test.tsx && git commit -m "feat: email-verification wait screen with status polling"`

---

### Task 10: AccountReset screen

**Files:**
- Create: `src/screens/AccountReset.tsx`, `src/screens/AccountReset.test.tsx`
- Modify: `src/App.tsx` (render line)

**Interfaces:**
- Consumes: `requestPasswordReset`, `SAAS_BASE` (3).
- Produces: `AccountReset({ navigate, deps? })`, deps = `{ requestPasswordReset: typeof requestPasswordReset }`.

Markup mirrors mockup `AcctReset`: Header `Reset your password.` (back → `acct-signin`); intro `We&rsquo;ll email you a link. It works for one hour.`; email field id `rsE`; button `Email me the link` disabled when empty/busy; auth-alt `Remembered it? <m-link>Back to sign in</m-link>`. Submit → `requestPasswordReset` → regardless of true/false (server never discloses), navigate `{ name: 'acct-signin', notice: `Reset link sent to ${email} - it works for one hour.` }`; only a thrown/`false` network-level failure shows ErrBox `Can’t reach Sprout Track right now. Check your connection.` — return value `false` still navigates (envelope always succeeds; `false` means non-200/network, so: `true` → navigate with notice, `false` → ErrBox).

- [ ] **Step 1:** Failing tests: renders copy; successful send navigates to acct-signin with the notice string; failed send shows ErrBox and stays.
- [ ] **Step 2:** Implement + App render line. **Step 3:** `npm test` PASS. Commit: `git add src/screens/AccountReset* src/App.tsx src/App.test.tsx && git commit -m "feat: password reset screen"`

---

### Task 11: Wizard service

**Files:**
- Create: `src/services/wizard.ts`, `src/services/wizard.test.ts`

**Interfaces:**
- Consumes: `postJson`, `getJson` (3); `validateSlug` (3); `loginWithCredentials`; `saveServer`; `CredentialVault`; `AccountCreds`.
- Produces:

```ts
export interface WizardCaretaker { loginId: string; name: string; type: string; role: 'ADMIN' | 'USER'; securityPin: string }
export type SecurityConfig = { mode: 'pin'; securityPin: string } | { mode: 'caretakers'; caretakers: WizardCaretaker[] }
export const FEED_TYPE_OPTIONS: ReadonlyArray<{ label: string; category: string }> // Breast feeds→BREAST, Breast milk bottles→BOTTLE_BREAST_MILK, Formula bottles→BOTTLE_FORMULA, Other bottles→BOTTLE_OTHER, Food→FOOD
export interface BabyConfig {
  firstName: string; lastName: string; birthDate: string; gender: 'MALE' | 'FEMALE'
  feedWarningTime: string; diaperWarningTime: string
  feedTimerFrom: 'start' | 'end'; feedTimerCategories: string[]  // all 5 selected → sent as null
}
export class WizardError extends Error { constructor(public kind: 'slug-taken' | 'unreachable' | 'rejected', message?: string) }
export async function checkSlugAvailability(base: string, slug: string, get?: typeof getJson): Promise<'free' | 'taken' | 'invalid'>
export async function suggestSlug(base: string, get?: typeof getJson): Promise<string | null>
export async function createFamily(base: string, token: string, args: { name: string; slug: string }, post?: typeof postJson): Promise<{ familyId: string }>
export async function saveSecurity(base: string, token: string, familyId: string, config: SecurityConfig, post?: typeof postJson): Promise<void>
export async function saveBabyAndLink(base: string, token: string, familyId: string, baby: BabyConfig, mode: 'pin' | 'caretakers', deps?: { post: typeof postJson; get: typeof getJson }): Promise<void>
export interface FinishDeps { login: typeof loginWithCredentials; saveServer: typeof saveServer; vault: Pick<CredentialVault, 'store'> }
export async function finishWizard(base: string, creds: AccountCreds, familyName: string, biometric: boolean, deps?: FinishDeps): Promise<{ toast: string }>
```

Endpoint mapping (all errors: thrown network → `WizardError('unreachable')`; envelope failure → `WizardError('rejected', envelope.error)` unless specified):
- `checkSlugAvailability`: `GET {base}/api/family/by-slug/{slug}` unauthenticated — 200+`success:true` → `'taken'`; 200+`success:false` → `'free'`; 400 → `'invalid'`; throw → WizardError unreachable.
- `suggestSlug`: `GET {base}/api/family/generate-slug` → `data.slug` string or null on any failure.
- `createFamily`: `POST {base}/api/setup/start` body `{ name, slug }` with token → `data.id` as familyId; HTTP 409 → `WizardError('slug-taken')`.
- `saveSecurity` pin mode: `PUT`-semantics via CapacitorHttp — **note the server uses PUT for settings/update-setup-stage**; extend `api-client.ts` in this task with `export async function putJson(url, body, opts?)` (same shape as postJson with `CapacitorHttp.put` / `method: 'PUT'`). Calls: `PUT {base}/api/settings?familyId={id}` `{ securityPin, authType: 'SYSTEM' }`; caretakers mode: for each caretaker `POST {base}/api/caretaker?familyId={id}` `{ loginId, name, type, role, securityPin, familyId }`, then `PUT {base}/api/settings?familyId={id}` `{ authType: 'CARETAKER' }`. Both: `PUT {base}/api/family/update-setup-stage` `{ setupStage: 2, familyId }`.
- `saveBabyAndLink`: `POST {base}/api/baby?familyId={id}` body `{ firstName, lastName, birthDate, gender, feedWarningTime, diaperWarningTime, feedTimerFrom, feedTimerTypes, familyId }` where `feedTimerTypes = baby.feedTimerCategories.length === FEED_TYPE_OPTIONS.length ? null : JSON.stringify(baby.feedTimerCategories)`. Then link: `mode === 'pin'` → `GET {base}/api/caretaker/system?familyId={id}` → `data.id`; else `GET {base}/api/family/{familyId}/caretakers` → first entry with `loginId !== '00'` → its `id`. Then `POST {base}/api/accounts/link-caretaker` `{ caretakerId }`. Link failures are non-fatal for pin mode is NOT true — treat all link failures as `WizardError('rejected')` so the UI can retry the step.
- `finishWizard`: `login({ id: `${base}|account`, baseUrl: base, familySlug: '' }, creds)` → `!ok || !familySlug` → `WizardError('rejected', 'relogin')`; `saveServer({ baseUrl: base, familySlug, familyName, deploymentMode: 'saas', authType: 'ACCOUNT' })` → `vault.store(saved.id, creds, { biometric })` → `{ toast: `Welcome home - ${familyName} is set up and saved to this phone.` }`.

- [ ] **Step 1:** Failing tests — cover: availability three-state; createFamily happy + 409; saveSecurity pin sequence (assert exact URLs/bodies/order via a recording mock); saveSecurity caretakers sequence with 2 caretakers; saveBabyAndLink pin path (system caretaker) and caretakers path (skips `00`); feedTimerTypes null when all categories; finishWizard happy path asserts toast + vault.store args; finishWizard login-failure throws WizardError. Use the mock style of `session.test.ts` (plain `vi.fn()` post/get recording calls).
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement (`putJson` added to api-client with a small test alongside the existing patterns). **Step 4:** `npm test` PASS.
- [ ] **Step 5:** Commit: `git add src/services/wizard* src/lib/api-client.ts && git commit -m "feat: wizard server sequence service + putJson"`

---

### Task 12: Wizard screens + wiring

**Files:**
- Create: `src/screens/wizard/WizFrame.tsx`, `Step1Family.tsx`, `Step2Security.tsx`, `Step3Baby.tsx`, `Wizard.tsx`, `Wizard.test.tsx`, `Step1Family.test.tsx`, `Step2Security.test.tsx`, `Step3Baby.test.tsx`
- Modify: `src/App.tsx` (render line)

**Interfaces:**
- Consumes: everything from Task 11; `validateSlug`, `slugify`, `digitsOnly` (3); `Screen` member `{ name: 'wizard'; token; creds; biometric; resume?; firstName? }`.
- Produces: `Wizard({ navigate, token, creds, biometric, resume?, firstName?, deps? })` — deps bundles all Task-11 functions + `FinishDeps` for tests.

Structure: `Wizard.tsx` owns the state machine (`step`, `familyId`, `familyName`, `busy`, `error`) and calls the service; step components are presentational (props in, callbacks out) mirroring `docs/mockups/Sprout-track-design/capacitor-wizard.jsx` markup exactly (WizFrame with logo brand + `.prog` bar + `Step {n} of 3` + `wiz-saved` note + art sprite rotate; footers per mockup). Key behaviors, all from the mockup and spec §4:

- Initial state from `resume`: `resume` present → `step = resume.stage`, `familyId = resume.familyId`, `familyName = resume.familyName`; else `step = 1`.
- Step 1: name → auto-slug until touched (`slugify`), spaces → hyphens on direct edit, regen button → `suggestSlug` (fallback `${slugify(name) || 'sprout'}-${100–999}` locally when null); debounced 500ms `checkSlugAvailability` rendering checking/free/error states (`validateSlug` runs client-side first); Next enabled when name + free + valid; Next → `createFamily` → busy `Saving your family…`; `slug-taken` → ErrBox `Another family already lives at /{slug} - try a different one.`; Cancel (`m-btn ghost`, step 1 only): navigate to `{ name: 'families', toast: 'Setup paused - sign back in anytime to finish.' }` when the device has saved families, else `{ name: 'fork' }` (no toast slot there — plain navigation). Detect via the same `listServers`-based `hasFamilies` pattern AddFamily uses.
- Step 2 (per mockup `capacitor-wizard.jsx` lines 125–179): radio `ropt` cards (caretakers default); pin mode 6–10 digit PIN + confirm via `digitsOnly(v, 10)`; caretaker form with live `idErr` (`Digits only.` / `00 is reserved for the system.` / `ID {id} is taken.`), addCt validation errors (`Pick a free two-digit ID, 01–99.` / `Give this caretaker a name.` / `PINs are 6–10 digits.`); first caretaker prefilled `{ name: firstName ?? '', type: firstName ? 'Account Owner' : '' , role: 'Admin' }`, CTA `Create my profile` when `firstName`; roles select from the second caretaker. Next → `saveSecurity` → busy `Saving security…`.
- Step 3 (mockup lines 181–212): baby fields, Boy/Girl → `MALE`/`FEMALE`; hh:mm inline validation `Use hh:mm, like 02:00.`; feed-timer-from select mapping `Start of feeding` → `'start'`, `End of feeding` → `'end'`; `FEED_TYPE_OPTIONS` checkboxes all default checked. Complete → `saveBabyAndLink` then `finishWizard` → busy `Planting your sprout…` → `navigate({ name: 'families', toast })`.
- Every `WizardError` lands in an ErrBox on the current step; the button retries the whole step handler (service calls are safe to re-run: caretaker duplicates would 4xx → surfaced; acceptable v1 behavior, document in code comment).
- Saved-note per mockup: step 2 shows `Family saved`, step 3 `Security saved`.

- [ ] **Step 1:** Failing tests. Step components: render + validation behaviors (slug states with fake timers; caretaker idErr cases; step-3 required-field gating). `Wizard.test.tsx` integration with stubbed deps: fresh run walks 1→2→3→families toast asserting service call order and args; resume at stage 2 skips createFamily and shows `Family saved`; resume at stage 3 goes straight to baby; slug-taken error stays on step 1.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement all files + App render line `{screen.name === 'wizard' && <Wizard navigate={setScreen} token={screen.token} creds={screen.creds} biometric={screen.biometric} resume={screen.resume} firstName={screen.firstName} />}`.
- [ ] **Step 4:** `npm test` PASS. **Step 5:** Commit: `git add src/screens/wizard src/App.tsx src/App.test.tsx && git commit -m "feat: native 3-step family setup wizard"`

---

### Task 13: Browser plugin, app icons, README, device checklist

**Files:**
- Modify: `package.json` (deps), `README.md`, `resources/` (icon source), native projects via `cap sync` / assets generate
- Create: `docs/superpowers/device-test-2026-07-21.md`

- [ ] **Step 1:** `npm install @capacitor/browser` (Capacitor 8-compatible major).
- [ ] **Step 2:** App icons: `cp public/sprout-track-square-1024.png resources/icon-only.png`, then `npx @capacitor/assets generate --iconBackgroundColor '#f7f1e2' --splashBackgroundColor '#f7f1e2'`. Verify: `ls android/app/src/main/res/mipmap-xxxhdpi/` (new timestamps) and `ls ios/App/App/Assets.xcassets/AppIcon.appiconset/ | head`.
- [ ] **Step 3:** `npm run sync` — expected: clean build, Browser plugin listed for ios+android in the sync output.
- [ ] **Step 4:** README: update the flows section — splash → fork routing, account signup/verify/reset, native wizard (endpoint sequence summary + re-login rationale), external-browser subscription note. Keep the existing refresh-cookie caveat.
- [ ] **Step 5:** Write `docs/superpowers/device-test-2026-07-21.md` — the manual device checklist (spec §9): bridge-injection spike steps (open a family in-shell against local server, in Safari/Chrome devtools check `window.Capacitor?.Plugins?.Browser`, tap Manage subscription, record which path opened the system browser on iOS + Android), plus splash/fork/wizard/signup happy paths and the §12 anti-slop 5-second check per screen.
- [ ] **Step 6:** `npm test` (all green), commit: `git add -A && git commit -m "feat: browser plugin, square app icons, README + device checklist"` (verify repo/branch first; `git status` must show no `sprout-track/` paths).

---

### Task 14 (server): shell-chrome helpers + external-link util + translations

**⚠️ Repo:** work in `/Users/johnoverton/Development/mobile-app-v1/sprout-track`, branch `feature/native-aware-layer`. Verify with `git rev-parse --show-toplevel` / `git branch --show-current` before committing. Never touch `main`.

**Files:**
- Create: `src/utils/external-link.ts`, `src/utils/shell-chrome.ts`, `tests/external-link.test.ts`, `tests/shell-chrome.test.ts`
- Modify: `src/localization/translations/en.json` (+ script-run fills other locales)

**Interfaces:**
- Consumes: `isNativeApp`, `getCapacitorPlugin` from `src/utils/native-app.ts`.
- Produces:

```ts
// external-link.ts
export const MANAGE_SUBSCRIPTION_URL = 'https://sprout-track.com/account'
export function openExternal(url: string): void

// shell-chrome.ts
export type SideNavFooterButton = 'switch-family' | 'settings' | 'logout' | 'exit-to-families'
export function sideNavFooterButtons(isNative: boolean): SideNavFooterButton[]
export function trialCtaMode(isNative: boolean): 'payment-modal' | 'external'
export interface ShellSubscriptionControls { showPaymentActions: boolean; showPaymentHistory: boolean; showExternalManage: boolean; showWebNote: boolean }
export function shellSubscriptionControls(isNative: boolean, kind: 'lifetime' | 'trial' | 'active' | 'expired' | 'none', hasFamily: boolean): ShellSubscriptionControls
```

- [ ] **Step 1: Failing tests.** `tests/shell-chrome.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { sideNavFooterButtons, trialCtaMode, shellSubscriptionControls } from '@/src/utils/shell-chrome'

describe('sideNavFooterButtons', () => {
  it('web: switch-family, settings, logout', () => {
    expect(sideNavFooterButtons(false)).toEqual(['switch-family', 'settings', 'logout'])
  })
  it('shell: settings + single exit', () => {
    expect(sideNavFooterButtons(true)).toEqual(['settings', 'exit-to-families'])
  })
})

describe('trialCtaMode', () => {
  it('is payment-modal on web, external in shell', () => {
    expect(trialCtaMode(false)).toBe('payment-modal')
    expect(trialCtaMode(true)).toBe('external')
  })
})

describe('shellSubscriptionControls', () => {
  it('web keeps all payment surfaces', () => {
    expect(shellSubscriptionControls(false, 'active', true))
      .toEqual({ showPaymentActions: true, showPaymentHistory: true, showExternalManage: false, showWebNote: false })
  })
  it.each(['trial', 'active', 'expired'] as const)('shell + %s: display-only with external manage', (kind) => {
    expect(shellSubscriptionControls(true, kind, true))
      .toEqual({ showPaymentActions: false, showPaymentHistory: false, showExternalManage: true, showWebNote: true })
  })
  it('shell + lifetime or no family: no external manage', () => {
    expect(shellSubscriptionControls(true, 'lifetime', true).showExternalManage).toBe(false)
    expect(shellSubscriptionControls(true, 'trial', false).showExternalManage).toBe(false)
  })
})
```

`tests/external-link.test.ts`: follow the environment-stubbing style of the existing `tests/native-app*.test.ts` (stub `window`/`navigator` on `globalThis`, restore after). Cases: native UA + `window.Capacitor.Plugins.Browser` present → `Browser.open({ url })` called, `window.open` NOT called; native UA without the plugin → falls back to `window.open(url, '_blank', 'noopener')`; non-native → `window.open` directly.

- [ ] **Step 2:** Run `npm test -- external-link shell-chrome` — FAIL. **Step 3:** Implement:

```ts
// src/utils/external-link.ts
import { getCapacitorPlugin, isNativeApp } from './native-app';

interface BrowserPlugin { open(options: { url: string }): Promise<void>; }

export const MANAGE_SUBSCRIPTION_URL = 'https://sprout-track.com/account';

/**
 * Opens a URL outside the webview. Inside the native shell the Capacitor
 * Browser plugin (injected on allowNavigation hosts) opens the system
 * browser; anywhere else — including a shell whose bridge didn't inject —
 * fall back to window.open, which the shell's webview hands to the OS.
 */
export function openExternal(url: string): void {
  const browser = isNativeApp() ? getCapacitorPlugin<BrowserPlugin>('Browser') : null;
  if (browser) { void browser.open({ url }); return; }
  window.open(url, '_blank', 'noopener');
}
```

`shell-chrome.ts` exactly per the interfaces (shellSubscriptionControls: web → all true except external/note; shell → actions/history false, `manageable = hasFamily && (kind === 'trial' || kind === 'active' || kind === 'expired')` drives both external + note).

- [ ] **Step 4:** Add translation keys to `en.json`: `"Exit to My Families"`, `"Subscriptions are managed on the web, not in this app."`, `"Manage your subscription at sprout-track.com"`. Run `node scripts/check-missing-translations.js`. Best-effort translate the new keys in the other locale files (per repo CLAUDE.md).
- [ ] **Step 5:** Full `npm test` — PASS. Commit (in sprout-track, on feature/native-aware-layer): `git add src/utils/external-link.ts src/utils/shell-chrome.ts tests/external-link.test.ts tests/shell-chrome.test.ts src/localization/translations && git commit -m "feat: shell chrome helpers + external browser opener for IAP compliance"`

---

### Task 15 (server): side-nav — Exit to My Families + trial CTA swap

**⚠️ Repo:** `sprout-track/`, branch `feature/native-aware-layer` (verify before commit).

**Files:**
- Modify: `src/components/ui/side-nav/index.tsx`
- Modify: `tests/` — extend `tests/shell-chrome.test.ts` only if new pure logic is extracted (default: none needed)

**Interfaces:**
- Consumes: `sideNavFooterButtons`, `trialCtaMode` (Task 14); `openExternal`, `MANAGE_SUBSCRIPTION_URL` (14); `isNativeApp` (`src/utils/native-app.ts`); existing props `onSwitchFamily`, `onLogout`, `onSettingsClick`.

Changes (hydration-safe: `const [inShell, setInShell] = useState(false)` + `useEffect(() => setInShell(isNativeApp()), [])`):

1. Imports: add `ExternalLink` to the lucide-react import; add `import { isNativeApp } from '@/src/utils/native-app';`, `import { openExternal, MANAGE_SUBSCRIPTION_URL } from '@/src/utils/external-link';`, `import { sideNavFooterButtons, trialCtaMode } from '@/src/utils/shell-chrome';`.
2. Footer block (currently ~lines 645-671) — drive from the helper:

```tsx
{/* Footer with Theme Toggle, Settings and Logout / shell Exit */}
<div className={cn(sideNavStyles.footer, "side-nav-footer")}>
  <ThemeToggle className="mb-2" />
  {sideNavFooterButtons(inShell).map((btn) =>
    btn === 'switch-family' ? (onSwitchFamily ? (
      <FooterButton key={btn} icon={<ArrowLeftRight aria-hidden="true" />} label={t('Switch Family')} onClick={onSwitchFamily} />
    ) : null)
    : btn === 'settings' ? (
      <FooterButton key={btn} icon={<Settings aria-hidden="true" />} label={t('Settings')} onClick={onSettingsClick} />
    ) : btn === 'logout' ? (
      <FooterButton key={btn} icon={<LogOut aria-hidden="true" />} label={t('Logout')} onClick={onLogout} />
    ) : (
      <FooterButton key={btn} icon={<LogOut aria-hidden="true" />} label={t('Exit to My Families')} onClick={onSwitchFamily ?? onLogout} />
    )
  )}
</div>
```

3. Trial box "Buy Now" button (~lines 557-564): replace with

```tsx
{trialCtaMode(inShell) === 'external' ? (
  <Button
    size="sm"
    className="w-full"
    variant="outline"
    onClick={() => openExternal(MANAGE_SUBSCRIPTION_URL)}
  >
    <ExternalLink className="h-3 w-3 mr-1" aria-hidden="true" />
    {t('Manage your subscription at sprout-track.com')}
  </Button>
) : (
  <Button
    size="sm"
    className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white"
    onClick={() => setShowPaymentModal(true)}
  >
    <CreditCard className="h-3 w-3 mr-1" aria-hidden="true" />
    {t('Buy Now')}
  </Button>
)}
```

4. PaymentModal mount (~line 603): add `!inShell &&` to its condition so Stripe never mounts in-shell.

- [ ] **Step 1:** Make the edits. **Step 2:** `npm test` — all pass (node-env suite; component untested directly, helpers covered in Task 14). `npx tsc --noEmit` if the repo has a typecheck script; otherwise `npm run build` is NOT required — rely on `npm run lint` if present.
- [ ] **Step 3:** Run `node scripts/check-missing-translations.js` (no new keys expected — added in Task 14; confirm clean).
- [ ] **Step 4:** Commit: `git add src/components/ui/side-nav/index.tsx && git commit -m "feat: in-shell side-nav - Exit to My Families, external subscription CTA"`

---

### Task 16 (server): account-manager — display-only subscription in shell

**⚠️ Repo:** `sprout-track/`, branch `feature/native-aware-layer` (verify before commit). After this task's review passes, push the branch to update PR #234.

**Files:**
- Modify: `src/components/account-manager/AccountSettingsTab.tsx`

**Interfaces:**
- Consumes: `shellSubscriptionControls` (14); `openExternal`, `MANAGE_SUBSCRIPTION_URL` (14); `isNativeApp`; existing `subscriptionView` (`getSubscriptionView`), `accountStatus.hasFamily`, `setShowPaymentModal`, `setShowPaymentHistory`.

Changes (same hydration-safe `inShell` state pattern as Task 15; imports: `ExternalLink` from lucide-react, the three utils):

1. Compute once above the JSX: `const shellControls = shellSubscriptionControls(inShell, subscriptionView.kind, accountStatus.hasFamily);`
2. Wrap every payment action in the Subscription section with `!shellControls.showPaymentActions ? null : (…)` — concretely: the no-family `Upgrade Plan` button, the trial `Start my subscription` button, the active branch's `Renew Subscription`/`Manage billing` buttons, and the expired alertbox's `Renew for $2.99/month` button. Status lines, dates, and the expired alertbox text stay for every mode.
3. Wrap the `Payment history` button's condition: `{!inShell && (accountStatus.subscriptionActive || accountStatus.planType) && (…)}`.
4. After the subscription-kind branches (just before the Payment history block), add:

```tsx
{shellControls.showWebNote && (
  <p className="sb-status-sub" style={{ marginTop: 6 }}>
    {t('Subscriptions are managed on the web, not in this app.')}
  </p>
)}
{shellControls.showExternalManage && (
  <button type="button" className="sb-btn sb-sm" onClick={() => openExternal(MANAGE_SUBSCRIPTION_URL)}>
    <ExternalLink size={15} strokeWidth={1.8} />
    {t('Manage your subscription at sprout-track.com')}
  </button>
)}
```

5. Gate the `PaymentModal` and `PaymentHistory` component mounts (wherever they render in this file or are triggered from it) with `!inShell &&`.

- [ ] **Step 1:** Make the edits. **Step 2:** `npm test` — pass; `node scripts/check-missing-translations.js` clean.
- [ ] **Step 3:** Commit: `git add src/components/account-manager/AccountSettingsTab.tsx && git commit -m "feat: display-only subscription section inside the native shell"`
- [ ] **Step 4 (after review):** `git push origin feature/native-aware-layer` (updates PR #234).

---

## Final: whole-branch review + merge

After Task 16: run the final whole-branch review (both repos — shell diff `merge-base main HEAD` on `feature/ui-pass-2`; sprout-track diff of the new commits on `feature/native-aware-layer`), fix findings, then superpowers:finishing-a-development-branch for the shell branch. The device checklist (`docs/superpowers/device-test-2026-07-21.md`) is handed to John — the Browser-plugin spike result decides nothing in code (fallback ships either way) but must be recorded there.
