# Shell UI Pass + Silent Session Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Capacitor shell to the v1-storybook design (full mockup structure incl. account sign-in and a connecting screen), hand the shell's login token to the web app via a URL fragment, and route logouts by reason.

**Architecture:** The shell keeps its screen-per-file React structure; the mockup's CSS is ported into `src/index.css` as plain component classes so screens can mirror the mockup markup (`docs/mockups/capacitor-screens.jsx`) nearly verbatim. Connecting becomes a real screen that owns the `connectToFamily` call. The handoff extends the `sessionInjected` bridge message with the JWT and is consumed by a new pure helper in the sprout-track native-aware layer.

**Tech Stack:** Vite + React 19 + TS + Tailwind v4 (tokens only; layout via ported CSS), vitest/jsdom, @fontsource packages, Capacitor 8. Server side: Next.js in the nested `sprout-track/` clone, vitest node env.

**Spec:** `docs/superpowers/specs/2026-07-20-shell-ui-and-session-handoff-design.md`

## Global Constraints

- **Repo discipline:** Tasks 1–12 commit ONLY to mobile-app-v1 on branch `feature/ui-pass`. Tasks 13–14 commit ONLY to the nested clone `/Users/johnoverton/Development/mobile-app-v1/sprout-track` on branch `feature/native-aware-layer`. Before EVERY commit run `git rev-parse --show-toplevel` and `git branch --show-current` and verify both. NEVER commit to any `main`.
- Theme tokens exactly: paper `#f7f1e2`, paper2 `#efe6d0`, card `#fffdf6`, ink `#26382f`, body `#3d5044`, sub `#6b7a6c`, line `#ddd2b8`, teal `#0c6b62`, teal-deep `#0a544d`, apricot `#c2691e`, rust `#9e2b25`, rust-bg `#f7e5dc`, rust-line `#e3bcab`, hover `#f4edda`.
- Fonts: Literata (headings) + Alegreya Sans (body) via `@fontsource/*` npm packages. NO Google Fonts CDN, no external URLs in CSS.
- User-facing copy comes verbatim from `docs/mockups/capacitor-screens.jsx` (including the `ERR_TEXT` strings, flattened to plain text).
- Bridge contract: `shared/bridge-contract.ts` (shell) and `sprout-track/src/utils/bridge-contract.ts` (vendored) must stay byte-identical logic-wise; each repo's change is its own commit but the shapes must match.
- `npm test` green in the touched repo before every commit. Sprout-track baseline: 706 passing.
- Sprout-track conventions: tests in `tests/*.test.ts` (node env, `@/` alias), no Tailwind `dark:` classes, user-facing strings via `t()` (the consumer adds none).

---

### Task 1: Branch, theme foundation, fonts, art assets

**Files:**
- Create: `public/art/teddy.svg`, `public/art/butterfly.svg`, `public/art/kitten.svg`, `public/art/star.svg`, `public/logo.png` (copies)
- Modify: `src/index.css` (full rewrite), `src/main.tsx` (font imports), `index.html` (viewport-fit), `package.json` (fontsource deps)

**Interfaces:**
- Consumes: nothing.
- Produces: CSS classes used by all later screen tasks (`m-scr`, `m-hd`, `m-iconbtn`, `m-bd`, `m-btn` [+ `ghost` / `danger` / `solid` / `sm`], `m-link`, `fl`, `fi`, `fh`, `f-grid`, `f-2`, `fgroup`, `fcheck`, `m-err`, `m-warn`, `fam-card`, `fam-av` [+ `apr`], `chip`, `c-teal`, `c-apr`, `fam-row`, `rowbtn` [+ `star`, `on`, `x`], `sect`, `sect-hd`, `swrow`, `sw` [+ `on`], `wel`, `center-scr`, `dots`, `pulse-logo`, `m-toast`, `empty`, `sprite`); assets at `/art/*.svg` and `/logo.png`.

- [ ] **Step 1: Create the branch**

```bash
cd /Users/johnoverton/Development/mobile-app-v1
git rev-parse --show-toplevel   # must print /Users/johnoverton/Development/mobile-app-v1
git checkout -b feature/ui-pass
```

- [ ] **Step 2: Install fonts and copy assets**

```bash
npm install @fontsource/literata @fontsource/alegreya-sans
mkdir -p public/art
cp docs/mockups/v1-storybook/art/{teddy,butterfly,kitten,star}.svg public/art/
cp docs/mockups/v1-storybook/logo.png public/
```

- [ ] **Step 3: Add font imports to `src/main.tsx`** (at the top, before `./index.css`)

```ts
import '@fontsource/literata/400.css'
import '@fontsource/literata/600.css'
import '@fontsource/literata/700.css'
import '@fontsource/literata/400-italic.css'
import '@fontsource/alegreya-sans/400.css'
import '@fontsource/alegreya-sans/500.css'
import '@fontsource/alegreya-sans/700.css'
import '@fontsource/alegreya-sans/800.css'
import './index.css'
```

- [ ] **Step 4: Ensure `index.html` viewport meta has `viewport-fit=cover`**

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

- [ ] **Step 5: Rewrite `src/index.css`**

Replace the whole file with the ported mockup CSS (safe-area-aware, fonts local):

```css
@import "tailwindcss";

@theme {
  --color-paper: #f7f1e2;
  --color-paper2: #efe6d0;
  --color-card: #fffdf6;
  --color-ink: #26382f;
  --color-body: #3d5044;
  --color-sub: #6b7a6c;
  --color-line: #ddd2b8;
  --color-teal: #0c6b62;
  --color-teal-deep: #0a544d;
  --color-apricot: #c2691e;
  --color-rust: #9e2b25;
  --color-rust-bg: #f7e5dc;
  --color-rust-line: #e3bcab;
  --color-hover: #f4edda;
  --font-sans: "Alegreya Sans", Georgia, serif;
  --font-serif: "Literata", Georgia, serif;
}

html, body, #root { height: 100%; }
body {
  font-family: "Alegreya Sans", Georgia, serif;
  font-size: 16px;
  line-height: 1.45;
  background: var(--color-paper);
  color: var(--color-body);
  -webkit-font-smoothing: antialiased;
}

/* ---- app frame ---- */
.m-root { position: relative; height: 100%; overflow: hidden; background: var(--color-paper); }
.m-scr { position: absolute; inset: 0; display: flex; flex-direction: column; background: var(--color-paper); animation: scrIn .24s ease; }
@keyframes scrIn { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: none; } }
.m-hd { display: flex; align-items: center; gap: 6px; padding: calc(env(safe-area-inset-top, 0px) + 18px) 14px 8px; flex-shrink: 0; }
.m-hd h1 { font-family: "Literata", Georgia, serif; font-size: 23px; font-weight: 700; color: var(--color-ink); flex: 1; letter-spacing: -.01em; }
.m-iconbtn { width: 38px; height: 38px; border: none; background: transparent; border-radius: 11px; display: grid; place-items: center; color: var(--color-sub); cursor: pointer; flex-shrink: 0; }
.m-iconbtn:hover { background: var(--color-hover); color: var(--color-ink); }
.m-bd { flex: 1; overflow-y: auto; padding: 8px 22px calc(env(safe-area-inset-bottom, 0px) + 70px); min-height: 0; }

/* ---- buttons ---- */
.m-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; width: 100%; border: none; cursor: pointer; font-family: inherit; font-weight: 700; font-size: 16.5px; border-radius: 13px; padding: 14px 22px; background: var(--color-teal); color: #fdfaf0; transition: background .15s; }
.m-btn:hover { background: var(--color-teal-deep); color: #fff; }
.m-btn:disabled { opacity: .55; cursor: default; }
.m-btn.ghost { background: transparent; color: var(--color-ink); border: 1.5px solid var(--color-line); }
.m-btn.ghost:hover { border-color: var(--color-teal); color: var(--color-teal); background: transparent; }
.m-btn.danger { background: transparent; border: 1.5px solid var(--color-rust-line); color: var(--color-rust); }
.m-btn.danger:hover { background: var(--color-rust-bg); border-color: var(--color-rust); }
.m-btn.danger.solid { background: var(--color-rust); border: none; color: #fdf3ec; }
.m-btn.sm { width: auto; padding: 9px 16px; font-size: 14.5px; border-radius: 10px; }
.m-link { background: none; border: none; font-family: inherit; font-weight: 700; font-size: 15px; color: var(--color-teal); cursor: pointer; }
.m-link:hover { color: var(--color-teal-deep); text-decoration: underline; }

/* ---- forms ---- */
.fl { display: block; font-weight: 700; font-size: 14.5px; color: var(--color-ink); margin-bottom: 6px; }
.fl small { font-weight: 500; color: var(--color-sub); }
.fi { width: 100%; font-family: inherit; font-size: 16px; color: var(--color-ink); background: #fffdf6; border: 1.5px solid var(--color-line); border-radius: 11px; padding: 12px 14px; transition: border-color .12s, box-shadow .12s; }
.fi::placeholder { color: #a89d82; }
.fi:focus { outline: none; border-color: var(--color-teal); box-shadow: 0 0 0 3px rgba(12,107,98,.14); }
.fh { font-size: 13px; color: var(--color-sub); margin-top: 5px; text-wrap: pretty; }
.f-grid { display: grid; gap: 15px; }
.f-2 { display: grid; grid-template-columns: 1fr 1.6fr; gap: 12px; }
.fgroup { margin-top: 2px; padding-top: 14px; border-top: 1px dashed var(--color-line); }
.fgroup > b { font-family: "Literata", Georgia, serif; font-size: 16px; color: var(--color-ink); display: block; }
.fgroup > .fh { margin: 1px 0 13px; }
.fcheck { display: flex; gap: 10px; align-items: flex-start; font-size: 15px; color: var(--color-body); cursor: pointer; }
.fcheck input { width: 17px; height: 17px; accent-color: var(--color-teal); margin-top: 2px; flex-shrink: 0; }
.fcheck b { color: var(--color-ink); font-weight: 700; display: block; }
.fcheck span small { display: block; font-size: 13px; color: var(--color-sub); }

/* ---- notice boxes ---- */
.m-err { border: 1.5px solid var(--color-rust-line); background: var(--color-rust-bg); color: #7c352a; border-radius: 12px; padding: 11px 14px; font-size: 14.5px; display: flex; gap: 9px; align-items: flex-start; text-wrap: pretty; }
.m-err svg { color: var(--color-rust); flex-shrink: 0; margin-top: 1px; }
.m-warn { border: 1.5px solid #e8cba4; background: #f8ecd7; color: #8a4a12; border-radius: 12px; padding: 11px 14px; font-size: 14px; display: flex; gap: 9px; align-items: flex-start; text-wrap: pretty; }
.m-warn svg { flex-shrink: 0; margin-top: 1px; }

/* ---- family cards ---- */
.fam-card { display: flex; gap: 13px; align-items: center; width: 100%; text-align: left; background: var(--color-card); border: 1px solid var(--color-line); border-radius: 16px; padding: 14px 15px; box-shadow: 0 12px 26px -20px rgba(58,48,24,.5); font-family: inherit; cursor: pointer; transition: border-color .12s; }
.fam-card:hover { border-color: #c9bd9e; }
.fam-av { width: 44px; height: 44px; border-radius: 50%; background: #cfe5df; color: var(--color-teal-deep); font-family: "Literata", Georgia, serif; font-weight: 700; font-size: 19px; display: grid; place-items: center; flex-shrink: 0; }
.fam-av.apr { background: #f5dcc4; color: #8a4a12; }
.fam-card .t { flex: 1; min-width: 0; }
.fam-card .nm { font-family: "Literata", Georgia, serif; font-weight: 600; font-size: 17px; color: var(--color-ink); display: flex; gap: 7px; align-items: center; }
.fam-card .host { font-size: 13.5px; color: var(--color-sub); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chip { display: inline-block; font-size: 11.5px; font-weight: 700; border-radius: 99px; padding: 2px 9px; letter-spacing: .02em; white-space: nowrap; }
.c-teal { background: #cfe5df; color: #0a544d; }
.c-apr { background: #f5dcc4; color: #8a4a12; }
.fam-row { display: flex; gap: 6px; align-items: center; margin-bottom: 11px; }
.fam-row .fam-card { flex: 1; min-width: 0; width: auto; }
.rowbtn { width: 34px; height: 34px; border: none; background: transparent; border-radius: 9px; display: grid; place-items: center; color: #c9bd9e; cursor: pointer; flex-shrink: 0; }
.rowbtn:hover { background: var(--color-hover); color: var(--color-sub); }
.rowbtn.star.on { color: var(--color-apricot); }
.rowbtn.x:hover { color: var(--color-rust); }

/* ---- settings ---- */
.sect { padding: 19px 0; border-bottom: 1px dashed var(--color-line); }
.sect:last-child { border-bottom: none; }
.sect-hd { display: flex; align-items: center; gap: 9px; margin-bottom: 6px; }
.sect-hd svg { color: var(--color-teal); flex-shrink: 0; }
.sect-hd h3 { font-family: "Literata", Georgia, serif; font-size: 17.5px; color: var(--color-ink); flex: 1; }
.sect p { font-size: 14.5px; color: var(--color-body); text-wrap: pretty; }
.swrow { display: flex; gap: 14px; align-items: flex-start; }
.swrow .t { flex: 1; }
.swrow > .t > b { font-weight: 700; font-size: 15.5px; color: var(--color-ink); display: block; }
.sw { width: 47px; height: 28px; border-radius: 99px; background: #d8cbab; border: none; position: relative; cursor: pointer; transition: background .18s; flex-shrink: 0; margin-top: 2px; }
.sw i { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fffdf6; box-shadow: 0 1px 3px rgba(58,48,24,.35); transition: left .18s; }
.sw.on { background: var(--color-teal); }
.sw.on i { left: 22px; }

/* ---- welcome ---- */
.wel { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 40px 30px calc(env(safe-area-inset-bottom, 0px) + 60px); position: relative; }
.wel .kick { font-weight: 800; font-size: 12.5px; letter-spacing: .15em; text-transform: uppercase; color: var(--color-apricot); }
.wel h1 { font-family: "Literata", Georgia, serif; font-size: 28px; line-height: 1.16; color: var(--color-ink); margin: 10px 0 12px; text-wrap: pretty; }
.wel h1 em { font-style: italic; color: var(--color-teal); }
.wel .lede { font-size: 16px; text-wrap: pretty; color: var(--color-body); }
.wel .btns { display: flex; flex-direction: column; gap: 11px; width: 100%; margin-top: 26px; }
.wel .assure { font-size: 13px; color: var(--color-sub); margin-top: 14px; }

/* ---- centered screens (offline, connecting) ---- */
.center-scr { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 0 34px calc(env(safe-area-inset-bottom, 0px) + 50px); }
.center-scr h2 { font-family: "Literata", Georgia, serif; font-size: 24px; color: var(--color-ink); margin: 16px 0 8px; text-wrap: pretty; }
.center-scr p { font-size: 15.5px; text-wrap: pretty; }
.center-scr .btns { display: flex; flex-direction: column; gap: 11px; width: 100%; margin-top: 24px; }
.dots { display: flex; gap: 6px; margin-top: 18px; }
.dots i { width: 8px; height: 8px; border-radius: 50%; background: var(--color-teal); opacity: .35; animation: dotp 1.1s infinite; }
.dots i:nth-child(2) { animation-delay: .18s; }
.dots i:nth-child(3) { animation-delay: .36s; }
@keyframes dotp { 0%, 60%, 100% { opacity: .35; transform: none; } 30% { opacity: 1; transform: translateY(-4px); } }
.pulse-logo { width: 66px; height: 66px; border-radius: 50%; animation: lp 1.6s ease infinite; }
@keyframes lp { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.07); } }

/* ---- toast, empty state, art sprites ---- */
.m-toast { position: absolute; left: 50%; bottom: calc(env(safe-area-inset-bottom, 0px) + 52px); transform: translateX(-50%); background: var(--color-ink); color: #f7f1e2; font: 600 13.5px "Alegreya Sans", sans-serif; padding: 10px 18px; border-radius: 99px; box-shadow: 0 14px 34px -12px rgba(20,30,25,.5); z-index: 50; animation: tup .25s ease; max-width: 86%; text-align: center; }
@keyframes tup { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }
.empty { text-align: center; padding: 34px 20px; color: var(--color-sub); font-size: 14.5px; }
.empty b { display: block; font-family: "Literata", Georgia, serif; color: var(--color-body); font-size: 16.5px; margin: 10px 0 2px; }
.empty img { margin: 0 auto; }
.sprite { position: absolute; pointer-events: none; user-select: none; }
```

- [ ] **Step 6: Verify tests and build still pass**

Run: `npm test && npm run build`
Expected: all suites pass (styling change only; existing tests assert text/roles, not classes), build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: storybook theme foundation — tokens, ported CSS, local fonts, art assets"
```

---

### Task 2: Shared components (icons, chrome, toast) + relative-time helper

**Files:**
- Create: `src/components/Icons.tsx`, `src/components/chrome.tsx`, `src/components/Toast.tsx`, `src/lib/relative-time.ts`
- Test: `src/lib/relative-time.test.ts`, `src/components/chrome.test.tsx`

**Interfaces:**
- Produces:
  - `IconDefs(): JSX` — hidden `<svg>` symbol defs, mounted once in App.
  - `Ic({ id, s = 18, style }: { id: string; s?: number; style?: React.CSSProperties })` — `<svg><use href="#id"/></svg>`.
  - `Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode })`.
  - `ErrBox({ children })` — `role="alert"` error box; `WarnBox({ children })` — warning box.
  - `Toast({ message }: { message: string })` — presentational pill.
  - `formatLastOpened(iso: string, now?: Date): string` — `'today, 2:14 pm'` | `'yesterday'` | weekday (`'Tuesday'`) within 6 days | `'Jul 3'` otherwise.

- [ ] **Step 1: Write failing tests**

`src/lib/relative-time.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatLastOpened } from './relative-time'

const NOW = new Date('2026-07-20T15:00:00')

describe('formatLastOpened', () => {
  it('formats same-day as today with time', () => {
    expect(formatLastOpened('2026-07-20T14:14:00', NOW)).toBe('today, 2:14 pm')
  })
  it('formats yesterday', () => {
    expect(formatLastOpened('2026-07-19T09:00:00', NOW)).toBe('yesterday')
  })
  it('formats within six days as weekday', () => {
    expect(formatLastOpened('2026-07-14T09:00:00', NOW)).toBe('Tuesday')
  })
  it('formats older dates as short month + day', () => {
    expect(formatLastOpened('2026-07-03T09:00:00', NOW)).toBe('Jul 3')
  })
})
```

`src/components/chrome.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { Header, ErrBox } from './chrome'

describe('chrome', () => {
  it('Header renders title and fires onBack', async () => {
    const onBack = vi.fn()
    render(<Header title="Settings" onBack={onBack} />)
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
  })
  it('ErrBox renders an alert', () => {
    render(<ErrBox>bad news</ErrBox>)
    expect(screen.getByRole('alert')).toHaveTextContent('bad news')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/relative-time.test.ts src/components/chrome.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/lib/relative-time.ts`:

```ts
const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function formatLastOpened(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const dayDiff = Math.round((startOfDay(now) - startOfDay(then)) / DAY_MS)
  if (dayDiff === 0) {
    const time = then
      .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      .toLowerCase()
    return `today, ${time}`
  }
  if (dayDiff === 1) return 'yesterday'
  if (dayDiff <= 6) return then.toLocaleDateString('en-US', { weekday: 'long' })
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
```

`src/components/Icons.tsx` (symbols ported from the mockup's `<defs>` — only the ids the shell uses):

```tsx
import type { CSSProperties } from 'react'

const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export function IconDefs() {
  return (
    <svg style={{ display: 'none' }} aria-hidden="true">
      <defs>
        <symbol {...STROKE} id="i-back" viewBox="0 0 24 24"><path d="M19 12H5m6-6l-6 6 6 6" /></symbol>
        <symbol {...STROKE} id="i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" /></symbol>
        <symbol {...STROKE} id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></symbol>
        <symbol {...STROKE} id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
        <symbol {...STROKE} id="i-alert" viewBox="0 0 24 24"><path d="M12 4.5L21 20H3zM12 10.5v4M12 17.3h.01" /></symbol>
        <symbol {...STROKE} id="i-shield" viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></symbol>
        <symbol {...STROKE} strokeWidth={1.6} id="i-face" viewBox="0 0 24 24"><path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" /><path d="M8.6 9.5v1.4M15.4 9.5v1.4M12 9.5v3.2a1 1 0 0 1-1 1M9 16.2c.9.9 1.9 1.3 3 1.3s2.1-.4 3-1.3" /></symbol>
        <symbol {...STROKE} id="i-star" viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.8L12 16.9l-5.3 2.7 1.1-5.8-4.3-4.1 5.9-.8z" /></symbol>
        <symbol fill="currentColor" id="i-starf" viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.8L12 16.9l-5.3 2.7 1.1-5.8-4.3-4.1 5.9-.8z" /></symbol>
        <symbol {...STROKE} id="i-refresh" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 3.5V8h-4.5" /></symbol>
      </defs>
    </svg>
  )
}

export function Ic({ id, s = 18, style }: { id: string; s?: number; style?: CSSProperties }) {
  return <svg width={s} height={s} style={style} aria-hidden="true"><use href={`#${id}`} /></svg>
}
```

`src/components/chrome.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Ic } from './Icons'

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="m-hd">
      {onBack && (
        <button className="m-iconbtn" aria-label="Back" onClick={onBack}><Ic id="i-back" s={20} /></button>
      )}
      <h1 style={onBack ? undefined : { paddingLeft: 8 }}>{title}</h1>
      {right}
    </div>
  )
}

export function ErrBox({ children }: { children: ReactNode }) {
  return <div className="m-err" role="alert"><Ic id="i-alert" s={17} /><span>{children}</span></div>
}

export function WarnBox({ children }: { children: ReactNode }) {
  return <div className="m-warn"><Ic id="i-alert" s={17} /><span>{children}</span></div>
}
```

`src/components/Toast.tsx`:

```tsx
export default function Toast({ message }: { message: string }) {
  return <div className="m-toast" role="status">{message}</div>
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/relative-time.test.ts src/components/chrome.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: shared UI components (icons, header, notice boxes, toast) and relative-time helper"
```

---

### Task 3: App shell rework — new Screen union, renames, Connecting screen

**Files:**
- Modify: `src/App.tsx` (rewrite), `src/App.test.tsx`
- Rename: `src/screens/AddServer.tsx` → `src/screens/AddFamily.tsx`, `src/screens/AddServer.test.tsx` → `src/screens/AddFamily.test.tsx`, `src/screens/ServerList.tsx` → `src/screens/Families.tsx`, `src/screens/ServerList.test.tsx` → `src/screens/Families.test.tsx`
- Create: `src/screens/Connecting.tsx`, `src/screens/Connecting.test.tsx`, stub `src/screens/AccountSignIn.tsx`
- Modify: `src/screens/Families.tsx`, `src/screens/Offline.tsx`, `src/screens/Settings.tsx`, `src/screens/Welcome.tsx` (Screen-name references only — full restyles come in Tasks 4–9)

**Interfaces:**
- Consumes: `connectToFamily(entry) => Promise<'navigated'|'needs-login'|'offline'|'locked'>` (Task 10 modifies internals, signature unchanged); `Header`/`Ic`/`IconDefs`/`Toast` from Task 2.
- Produces (all later tasks depend on this union):

```ts
export type Screen =
  | { name: 'welcome' }
  | { name: 'account-signin' }
  | { name: 'add-family'; prefillInput?: string }
  | { name: 'families'; toast?: string; notice?: string }
  | { name: 'settings' }
  | { name: 'offline'; entry: ServerEntry }
  | { name: 'connecting'; entry: ServerEntry }
```

Connecting owns running the connect flow; ServerList/App no longer call `connectToFamily` directly — they navigate to `{ name: 'connecting', entry }`.

- [ ] **Step 1: Rename files**

```bash
git mv src/screens/AddServer.tsx src/screens/AddFamily.tsx
git mv src/screens/AddServer.test.tsx src/screens/AddFamily.test.tsx
git mv src/screens/ServerList.tsx src/screens/Families.tsx
git mv src/screens/ServerList.test.tsx src/screens/Families.test.tsx
```

Inside the renamed files update: component names (`AddServer`→`AddFamily`, `ServerList`→`Families`), `AddServerDeps`→`AddFamilyDeps`, prop `prefillBaseUrl`→`prefillInput`, and every `navigate({ name: 'server-list' })`→`{ name: 'families' }`, `{ name: 'add-server' }`→`{ name: 'add-family' }`. In `Families.tsx`, replace the `open` function body: it now just navigates —

```tsx
function open(entry: ServerEntry) {
  navigate({ name: 'connecting', entry })
}
```

(delete the `viaRetry` machinery and the `connect` prop). In `Offline.tsx` change props to `{ navigate, entry }: { navigate: (s: Screen) => void; entry: ServerEntry }` and the Retry button to `onClick={() => navigate({ name: 'connecting', entry })}`, Switch family to `navigate({ name: 'families' })`. Update the renamed test files' imports and screen-name literals the same way; in `Families.test.tsx` replace connect-outcome tests (offline/locked paths) with an assertion that clicking a family card calls `navigate` with `{ name: 'connecting', entry }` — outcome handling now lives in Connecting's tests.

- [ ] **Step 2: Write failing test for Connecting**

`src/screens/Connecting.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Connecting from './Connecting'
import type { ServerEntry } from '../services/server-registry'

const entry: ServerEntry = {
  id: 'e1', baseUrl: 'https://track.example.com', familySlug: 'smith-family',
  familyName: 'Smith Family', deploymentMode: 'selfhosted', authType: 'SYSTEM',
  lastUsedAt: null, isDefault: true,
}

describe('Connecting', () => {
  it('shows family name and host while connecting', () => {
    render(<Connecting entry={entry} navigate={vi.fn()} connect={() => new Promise(() => {})} />)
    expect(screen.getByText('Opening Smith Family…')).toBeInTheDocument()
    expect(screen.getByText(/track\.example\.com/)).toBeInTheDocument()
    expect(screen.getByText(/saved PIN/)).toBeInTheDocument()
  })

  it('mentions the account for ACCOUNT entries', () => {
    render(<Connecting entry={{ ...entry, authType: 'ACCOUNT' }} navigate={vi.fn()} connect={() => new Promise(() => {})} />)
    expect(screen.getByText(/your account/)).toBeInTheDocument()
  })

  it('navigates to offline on offline outcome', async () => {
    const navigate = vi.fn()
    render(<Connecting entry={entry} navigate={navigate} connect={vi.fn().mockResolvedValue('offline')} />)
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'offline', entry }))
  })

  it('returns to families with a notice when locked', async () => {
    const navigate = vi.fn()
    render(<Connecting entry={entry} navigate={navigate} connect={vi.fn().mockResolvedValue('locked')} />)
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'families', notice: 'locked' }))
  })

  it('stays put on navigated (webview is taking over)', async () => {
    const navigate = vi.fn()
    const connect = vi.fn().mockResolvedValue('navigated')
    render(<Connecting entry={entry} navigate={navigate} connect={connect} />)
    await waitFor(() => expect(connect).toHaveBeenCalled())
    expect(navigate).not.toHaveBeenCalled()
  })

  it('only runs connect once across re-renders', async () => {
    const connect = vi.fn().mockResolvedValue('navigated')
    const { rerender } = render(<Connecting entry={entry} navigate={vi.fn()} connect={connect} />)
    rerender(<Connecting entry={entry} navigate={vi.fn()} connect={connect} />)
    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1))
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/screens/Connecting.test.tsx`
Expected: FAIL — `./Connecting` not found.

- [ ] **Step 4: Implement `src/screens/Connecting.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import type { Screen } from '../App'
import { connectToFamily, type ConnectOutcome } from '../services/connect'
import type { ServerEntry } from '../services/server-registry'

export default function Connecting({
  entry, navigate, connect = connectToFamily,
}: {
  entry: ServerEntry
  navigate: (s: Screen) => void
  connect?: (entry: ServerEntry) => Promise<ConnectOutcome>
}) {
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    void (async () => {
      const outcome = await connect(entry)
      if (outcome === 'offline') navigate({ name: 'offline', entry })
      else if (outcome === 'locked') navigate({ name: 'families', notice: 'locked' })
      // 'navigated' and 'needs-login' both mean the webview is navigating away — keep showing.
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const host = new URL(entry.baseUrl).host
  const how = entry.authType === 'ACCOUNT' ? 'signing you in with your account' : 'signing you in with your saved PIN'
  return (
    <div className="m-scr">
      <div className="center-scr">
        <img className="pulse-logo" src="/logo.png" alt="" />
        <h2>Opening {entry.familyName}…</h2>
        <p style={{ color: 'var(--color-sub)', fontSize: 14.5 }}>{host} · {how}</p>
        <div className="dots"><i></i><i></i><i></i></div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create the AccountSignIn stub** (Task 5 fills it in)

`src/screens/AccountSignIn.tsx`:

```tsx
import type { Screen } from '../App'
import { Header } from '../components/chrome'

export default function AccountSignIn({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <div className="m-scr">
      <Header title="Sign in to Sprout Track" onBack={() => navigate({ name: 'welcome' })} />
    </div>
  )
}
```

- [ ] **Step 6: Rewrite `src/App.tsx`**

```tsx
import { useEffect, useState } from 'react'
import Welcome from './screens/Welcome'
import Families from './screens/Families'
import AddFamily from './screens/AddFamily'
import AccountSignIn from './screens/AccountSignIn'
import Offline from './screens/Offline'
import Connecting from './screens/Connecting'
import Settings, { isAutoOpenEnabled } from './screens/Settings'
import { IconDefs } from './components/Icons'
import { getDefaultServer, listServers, type ServerEntry } from './services/server-registry'
import { bootActionFromSearch, stripBridgeEvent } from './services/bridge-events'

export type Screen =
  | { name: 'welcome' }
  | { name: 'account-signin' }
  | { name: 'add-family'; prefillInput?: string }
  | { name: 'families'; toast?: string; notice?: string }
  | { name: 'settings' }
  | { name: 'offline'; entry: ServerEntry }
  | { name: 'connecting'; entry: ServerEntry }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'welcome' })

  useEffect(() => {
    // A `?bridge-event=` param means the web app handed control back to the shell.
    // Read it before the async work below and strip it immediately so it isn't
    // reprocessed on a later remount.
    const bootAction = bootActionFromSearch(window.location.search)
    stripBridgeEvent()

    void (async () => {
      const servers = await listServers()
      if (servers.length === 0) return // stay on welcome
      // Every setScreen below only applies while still on welcome — a user click
      // that navigated away during the awaits must not be clobbered.
      const ifWelcome = (next: Screen) => setScreen(s => (s.name === 'welcome' ? next : s))
      if (bootAction === 'show-server-list') return ifWelcome({ name: 'families' })
      if (bootAction === 'reconnect') {
        // listServers() sorts most-recently-used first; the entry we just left is at the top.
        const recent = servers.find(e => e.lastUsedAt !== null)
        return ifWelcome(recent ? { name: 'connecting', entry: recent } : { name: 'families' })
      }
      const def = await getDefaultServer()
      const autoOpen = def ? await isAutoOpenEnabled() : false
      if (def && autoOpen) ifWelcome({ name: 'connecting', entry: def })
      else ifWelcome({ name: 'families' })
    })()
  }, [])

  return (
    <div className="m-root" data-testid="app-root">
      <IconDefs />
      {screen.name === 'welcome' && <Welcome navigate={setScreen} />}
      {screen.name === 'account-signin' && <AccountSignIn navigate={setScreen} />}
      {screen.name === 'families' && <Families navigate={setScreen} toast={screen.toast} notice={screen.notice} />}
      {screen.name === 'add-family' && <AddFamily navigate={setScreen} prefillInput={screen.prefillInput} />}
      {screen.name === 'settings' && <Settings navigate={setScreen} />}
      {screen.name === 'offline' && <Offline navigate={setScreen} entry={screen.entry} />}
      {screen.name === 'connecting' && <Connecting entry={screen.entry} navigate={setScreen} />}
    </div>
  )
}
```

Note: `bootActionFromSearch` still returns only `'auto-open' | 'show-server-list'` until Task 11 — the `'reconnect'` branch is written now (TypeScript narrows fine because Task 11 widens the union; if `tsc` complains about an impossible comparison before Task 11, type the const as `string` locally: `const bootAction: string = bootActionFromSearch(...)` and remove the widening in Task 11). `Families` gains `toast`/`notice` props — add them to its signature now (`{ navigate, toast, notice }: { navigate: (s: Screen) => void; toast?: string; notice?: string }`), rendering `{toast && <Toast message={toast} />}` and mapping `notice === 'locked'` to the existing locked copy in place of the old `setNotice` state (full restyle lands in Task 7).

- [ ] **Step 7: Update `src/App.test.tsx`**

Update screen-name expectations (`server-list`→families heading, etc.). Replace assertions that auto-open calls `connectToFamily` with assertions that the Connecting screen appears (`Opening … …` text). Where tests previously mocked `connectToFamily` via module mock, keep the module mock — Connecting imports the same function.

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS (all files updated consistently).

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: rework app shell — new screen union, connecting screen owns connect flow"
```

---

### Task 4: Welcome restyle

**Files:**
- Modify: `src/screens/Welcome.tsx`, `src/screens/Welcome.test.tsx` (create if missing)

**Interfaces:**
- Consumes: Screen union from Task 3.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test** (`src/screens/Welcome.test.tsx`)

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import Welcome from './Welcome'

describe('Welcome', () => {
  it('offers the three entry paths', async () => {
    const navigate = vi.fn()
    render(<Welcome navigate={navigate} />)
    expect(screen.getByText(/The family page,/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Sign in with my account' }))
    expect(navigate).toHaveBeenCalledWith({ name: 'account-signin' })

    await userEvent.click(screen.getByRole('button', { name: 'Join with a family link' }))
    expect(navigate).toHaveBeenCalledWith({ name: 'add-family', prefillInput: 'sprout-track.com/' })

    await userEvent.click(screen.getByRole('button', { name: 'I run my own server' }))
    expect(navigate).toHaveBeenCalledWith({ name: 'add-family' })
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/screens/Welcome.test.tsx` → FAIL.

- [ ] **Step 3: Implement `src/screens/Welcome.tsx`**

```tsx
import type { Screen } from '../App'

export default function Welcome({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <div className="m-scr">
      <div className="wel">
        <img className="sprite" src="/art/butterfly.svg" alt="" width="56" style={{ top: 86, right: 26, transform: 'rotate(10deg)' }} />
        <img src="/art/teddy.svg" alt="" width="108" style={{ marginBottom: 18 }} />
        <span className="kick">Sprout Track</span>
        <h1>The family page, <em>in your pocket.</em></h1>
        <p className="lede">Pair this phone with your family once — after that it&rsquo;s one tap and a glance to get back to the book.</p>
        <div className="btns">
          <button className="m-btn" onClick={() => navigate({ name: 'account-signin' })}>Sign in with my account</button>
          <button className="m-btn ghost" onClick={() => navigate({ name: 'add-family', prefillInput: 'sprout-track.com/' })}>Join with a family link</button>
          <button className="m-btn ghost" onClick={() => navigate({ name: 'add-family' })}>I run my own server</button>
        </div>
        <p className="assure">Works the same for hosted and self-hosted families.</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests** — `npm test` → PASS (App.test.tsx may reference old Welcome copy; update those assertions).

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: welcome screen — storybook design with three entry paths"`

---

### Task 5: AccountSignIn screen

**Files:**
- Modify: `src/screens/AccountSignIn.tsx` (replace stub)
- Test: `src/screens/AccountSignIn.test.tsx`

**Interfaces:**
- Consumes: `loginWithCredentials(target, creds)` (session.ts), `fetchFamilyBySlug(baseUrl, slug)` (server-probe.ts), `saveServer(entry)` (server-registry.ts), `CredentialVault.store(id, creds, { biometric })`, `Header`/`ErrBox` (chrome).
- Produces: on success navigates `{ name: 'families', toast: 'Saved — {name} is on this phone now.' }`.

Login target host is fixed: `https://sprout-track.com`. The login response's `familySlug` identifies the account's family; the family name comes from `fetchFamilyBySlug` (fall back to the slug title-cased if that call fails — the login already succeeded).

- [ ] **Step 1: Write the failing tests** (`src/screens/AccountSignIn.test.tsx`)

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import AccountSignIn from './AccountSignIn'

function makeDeps(overrides = {}) {
  return {
    login: vi.fn().mockResolvedValue({ ok: true, token: 't', familySlug: 'sprout-test' }),
    fetchFamilyBySlug: vi.fn().mockResolvedValue({ name: 'Sprout Test', slug: 'sprout-test', isActive: true }),
    saveServer: vi.fn().mockResolvedValue({ id: 'id1' }),
    vault: { store: vi.fn().mockResolvedValue(undefined) },
    ...overrides,
  }
}

async function fillAndSubmit() {
  await userEvent.type(screen.getByLabelText('Email'), 'me@example.com')
  await userEvent.type(screen.getByLabelText('Password'), 'hunter22')
  await userEvent.click(screen.getByRole('button', { name: 'Sign me in' }))
}

describe('AccountSignIn', () => {
  it('logs in against sprout-track.com, saves the family, navigates with a toast', async () => {
    const deps = makeDeps()
    const navigate = vi.fn()
    render(<AccountSignIn navigate={navigate} deps={deps} />)
    await fillAndSubmit()
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({
      name: 'families', toast: 'Saved — Sprout Test is on this phone now.',
    }))
    expect(deps.login).toHaveBeenCalledWith(
      { id: 'https://sprout-track.com|account', baseUrl: 'https://sprout-track.com', familySlug: '' },
      { type: 'account', email: 'me@example.com', password: 'hunter22' },
    )
    expect(deps.saveServer).toHaveBeenCalledWith({
      baseUrl: 'https://sprout-track.com', familySlug: 'sprout-test',
      familyName: 'Sprout Test', deploymentMode: 'saas', authType: 'ACCOUNT',
    })
    expect(deps.vault.store).toHaveBeenCalledWith('id1',
      { type: 'account', email: 'me@example.com', password: 'hunter22' }, { biometric: true })
  })

  it('shows the mismatch error on bad credentials', async () => {
    const deps = makeDeps({ login: vi.fn().mockResolvedValue({ ok: false, error: 'invalid' }) })
    render(<AccountSignIn navigate={vi.fn()} deps={deps} />)
    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent(/didn’t match/)
  })

  it('shows the lockout error on 429', async () => {
    const deps = makeDeps({ login: vi.fn().mockResolvedValue({ ok: false, error: 'locked' }) })
    render(<AccountSignIn navigate={vi.fn()} deps={deps} />)
    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent(/taking a breather/)
  })

  it('disables submit until both fields are filled', () => {
    render(<AccountSignIn navigate={vi.fn()} deps={makeDeps()} />)
    expect(screen.getByRole('button', { name: 'Sign me in' })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/screens/AccountSignIn.test.tsx` → FAIL.

- [ ] **Step 3: Implement `src/screens/AccountSignIn.tsx`**

```tsx
import { useState } from 'react'
import type { Screen } from '../App'
import { Header, ErrBox } from '../components/chrome'
import { CredentialVault, createVault, type StoredCredentials } from '../services/credential-vault'
import { fetchFamilyBySlug } from '../services/server-probe'
import { saveServer } from '../services/server-registry'
import { loginWithCredentials } from '../services/session'

const SAAS_BASE = 'https://sprout-track.com'

export interface AccountSignInDeps {
  login: typeof loginWithCredentials
  fetchFamilyBySlug: typeof fetchFamilyBySlug
  saveServer: typeof saveServer
  vault: Pick<CredentialVault, 'store'>
}

const defaultDeps = (): AccountSignInDeps => ({
  login: loginWithCredentials, fetchFamilyBySlug, saveServer, vault: createVault(),
})

const ERROR_TEXT: Record<string, string> = {
  invalid: 'That email and password didn’t match. Give it another look and try again.',
  locked: 'Too many tries — the server is taking a breather. Try again in a few minutes.',
  unreachable: 'Can’t reach that server. Check the address and your connection.',
  'save-failed': 'Login worked but saving the family failed — try again.',
}

function titleFromSlug(slug: string): string {
  return slug.split(/[-_]/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

export default function AccountSignIn({
  navigate, deps: depsOverride,
}: {
  navigate: (s: Screen) => void
  deps?: Partial<AccountSignInDeps>
}) {
  const [deps] = useState<AccountSignInDeps>(() => ({ ...defaultDeps(), ...depsOverride }))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [biometric, setBiometric] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    setError(null)
    setBusy(true)
    try {
      const creds: StoredCredentials = { type: 'account', email, password }
      const result = await deps.login({ id: `${SAAS_BASE}|account`, baseUrl: SAAS_BASE, familySlug: '' }, creds)
      if (!result.ok) {
        setError(ERROR_TEXT[result.error])
        return
      }
      const slug = result.familySlug
      let name = titleFromSlug(slug)
      try {
        name = (await deps.fetchFamilyBySlug(SAAS_BASE, slug)).name
      } catch { /* login already succeeded; slug-derived name is fine */ }
      try {
        const saved = await deps.saveServer({
          baseUrl: SAAS_BASE, familySlug: slug, familyName: name,
          deploymentMode: 'saas', authType: 'ACCOUNT',
        })
        await deps.vault.store(saved.id, creds, { biometric })
        navigate({ name: 'families', toast: `Saved — ${name} is on this phone now.` })
      } catch {
        setError(ERROR_TEXT['save-failed'])
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="m-scr">
      <Header title="Sign in to Sprout Track" onBack={() => navigate({ name: 'welcome' })} />
      <div className="m-bd">
        <div className="f-grid">
          <p className="fh" style={{ marginTop: 0 }}>The same account you use on sprout-track.com — your family comes with it, no address to type.</p>
          <div>
            <label className="fl" htmlFor="acEm">Email</label>
            <input className="fi" id="acEm" type="email" autoCapitalize="none" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="fl" htmlFor="acPw">Password</label>
            <input className="fi" id="acPw" type="password" placeholder="Your password"
              value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <label className="fcheck">
            <input type="checkbox" checked={biometric} onChange={e => setBiometric(e.target.checked)} />
            <span><b>Unlock with Face ID next time</b><small>Your password lives in this phone&rsquo;s secure keychain — a glance opens the book.</small></span>
          </label>
          {error && <ErrBox>{error}</ErrBox>}
          <button className="m-btn" disabled={busy || !email || !password} onClick={() => void signIn()}>
            {busy ? 'Checking with Sprout Track…' : 'Sign me in'}
          </button>
          <p className="fh" style={{ textAlign: 'center' }}>New here? Start your trial at sprout-track.com — then come back and sign in.</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests** — `npm test` → PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: account sign-in screen for sprout-track.com"`

---

### Task 6: AddFamily restyle (two-step mockup flow + friendly copy)

**Files:**
- Modify: `src/screens/AddFamily.tsx` (rewrite render + copy; keep probe/verify logic and `AddFamilyDeps`), `src/screens/AddFamily.test.tsx`

**Interfaces:**
- Consumes: probe/login/save/vault deps as today (unchanged signatures).
- Produces: navigates `{ name: 'families', toast: 'Saved — {name} is on this phone now.' }` on success.

Copy (verbatim, replaces `ERROR_TEXT`):

```ts
const ERROR_TEXT: Record<string, string> = {
  'invalid-url': 'That doesn’t look like an address. Try something like myhost.com/smith-family.',
  'missing-slug': 'Add your family’s name to the end — like myhost.com/smith-family.',
  'family-not-found': 'No family by that name on this server. Check the spelling?',
  'not-sprout-track': 'We reached it, but it isn’t a Sprout Track server.',
  unreachable: 'Can’t reach that server. Check the address and your connection.',
  invalid: 'That PIN didn’t work. Give it another look and try again.',
  locked: 'Too many tries — the server is taking a breather. Try again in a few minutes.',
  'save-failed': 'Login worked but saving the family failed — try again.',
}
```

- [ ] **Step 1: Update the tests first** (`src/screens/AddFamily.test.tsx`)

Adjust existing assertions to the new copy and structure. Key new/changed cases (keep the existing deps-mocking pattern in the file):

```tsx
// Button labels change:
//   'Find family'  -> 'Find my family'
//   located card shows family name, host, and a chip
it('shows the located family card with host and deployment chip', async () => {
  // deps mocked as today: probeDeployment -> { deploymentMode: 'selfhosted', enableAccounts: false, ... },
  // fetchFamilyBySlug -> { name: 'Smith Family', slug: 'smith-family', isActive: true }, fetchAuthType -> 'SYSTEM'
  // after typing 'track.example.com/smith-family' and clicking 'Find my family':
  expect(await screen.findByText('Smith Family')).toBeInTheDocument()
  expect(screen.getByText('track.example.com')).toBeInTheDocument()
  expect(screen.getByText('Self-hosted')).toBeInTheDocument()
})

it('warns about cleartext http addresses', async () => {
  // locate 'http://10.0.2.2:3000/smith-family' with same mocks
  expect(await screen.findByText(/isn’t encrypted/)).toBeInTheDocument()
})

it('navigates to families with a toast after verify & save', async () => {
  // after successful locate + PIN entry + 'Verify & save':
  expect(navigate).toHaveBeenCalledWith({ name: 'families', toast: 'Saved — Smith Family is on this phone now.' })
})
```

Also update the error-copy assertions (`family not found`→`No family by that name…`, etc.).

- [ ] **Step 2: Run to verify failures** — `npx vitest run src/screens/AddFamily.test.tsx` → FAIL on copy/structure.

- [ ] **Step 3: Rewrite the render** (logic — `locate`, `verifyAndSave`, state — stays; `verifyAndSave` success line becomes `navigate({ name: 'families', toast: `Saved — ${located.family.name} is on this phone now.` })`). Full JSX:

```tsx
const cleartext = located?.baseUrl.startsWith('http://') ?? false
const hosted = located ? new URL(located.baseUrl).host.endsWith('sprout-track.com') : false
const host = located ? new URL(located.baseUrl).host : ''
const canVerify = useAccount ? email !== '' && password !== ''
  : located?.authType === 'CARETAKER' ? loginId !== '' && pin !== '' : pin !== ''

return (
  <div className="m-scr">
    <Header title="Connect to a family" onBack={() => navigate({ name: 'welcome' })} />
    <div className="m-bd">
      <div className="f-grid">
        <div>
          <label className="fl" htmlFor="addr">Server address</label>
          <input className="fi" id="addr" value={input} autoCapitalize="none" spellCheck="false"
            placeholder="myhost.com/smith-family"
            onChange={e => { setInput(e.target.value); setLocated(null); setError(null) }} />
          <p className="fh">Your family&rsquo;s link — the same one you&rsquo;d open in a browser.</p>
        </div>
        {!located && (
          <button className="m-btn" disabled={busy || input.trim() === ''} onClick={() => void locate()}>
            {busy ? 'Knocking on the door…' : 'Find my family'}
          </button>
        )}
        {error && !located && <ErrBox>{error}</ErrBox>}
        {located && <>
          <div className="fam-card" style={{ cursor: 'default' }}>
            <div className={'fam-av' + (hosted ? '' : ' apr')}>{located.family.name[0]}</div>
            <div className="t">
              <div className="nm">{located.family.name}</div>
              <div className="host">{host}</div>
            </div>
            <span className={'chip ' + (hosted ? 'c-teal' : 'c-apr')}>{hosted ? 'Hosted' : 'Self-hosted'}</span>
          </div>
          {cleartext && <WarnBox>Heads up — this connection isn&rsquo;t encrypted. Fine on your home network, risky on public Wi-Fi.</WarnBox>}
          <div className="fgroup">
            <b>How you sign in</b>
            <p className="fh">{useAccount ? 'The account you use on sprout-track.com.' : 'Same PIN as the website — we check it with your server, then keep it safe here.'}</p>
            {located.config.enableAccounts && (
              <label className="fcheck" style={{ marginBottom: 13 }}>
                <input type="checkbox" checked={useAccount} onChange={e => setUseAccount(e.target.checked)} />
                <span><b>Sign in with my Sprout Track account</b></span>
              </label>
            )}
            {useAccount ? (
              <div className="f-grid">
                <div><label className="fl" htmlFor="em">Email</label>
                  <input className="fi" id="em" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
                <div><label className="fl" htmlFor="pw">Password</label>
                  <input className="fi" id="pw" type="password" placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)} /></div>
              </div>
            ) : located.authType === 'CARETAKER' ? (
              <div className="f-2">
                <div><label className="fl" htmlFor="lid">Login ID</label>
                  <input className="fi" id="lid" inputMode="numeric" maxLength={2} placeholder="11" value={loginId} onChange={e => setLoginId(e.target.value)} /></div>
                <div><label className="fl" htmlFor="pin">PIN</label>
                  <input className="fi" id="pin" type="password" inputMode="numeric" maxLength={10} placeholder="••••••" value={pin} onChange={e => setPin(e.target.value)} /></div>
              </div>
            ) : (
              <div><label className="fl" htmlFor="pin">Family PIN</label>
                <input className="fi" id="pin" type="password" inputMode="numeric" maxLength={10} placeholder="••••••" value={pin} onChange={e => setPin(e.target.value)} /></div>
            )}
          </div>
          <label className="fcheck">
            <input type="checkbox" checked={biometric} onChange={e => setBiometric(e.target.checked)} />
            <span><b>Unlock with Face ID next time</b><small>Your PIN lives in this phone&rsquo;s secure keychain — a glance opens the book.</small></span>
          </label>
          {error && <ErrBox>{error}</ErrBox>}
          <button className="m-btn" disabled={busy || !canVerify} onClick={() => void verifyAndSave()}>
            {busy ? 'Checking with your server…' : 'Verify & save'}
          </button>
        </>}
      </div>
    </div>
  </div>
)
```

(`error` state now stores the final display string: `setError(ERROR_TEXT[kind] ?? ERROR_TEXT.unreachable)` as before. Import `Header`, `ErrBox`, `WarnBox` from `../components/chrome`. Back from a families-populated state should go to families: change `onBack` to `() => navigate(cameFrom)` is NOT needed — mockup always backs to the previous list when families exist; keep it simple: `onBack={() => navigate({ name: 'welcome' })}` when reached from welcome is indistinguishable, so instead back navigates to `{ name: 'families' }` — Families falls back to welcome instantly when empty via App boot; simpler and matches the mockup's `onBack={() => setScreen(families.length ? 'families' : 'welcome')}`. Use: `onBack={() => navigate({ name: 'families' })}` and in `Families`, when the list loads empty AND there's no toast, render the empty state rather than bouncing — the mockup shows an empty families list with "Pair one and it'll live right here", which covers it.)

- [ ] **Step 4: Run tests** — `npm test` → PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: add-family screen — two-step storybook flow with friendly errors"`

---

### Task 7: Families restyle + vault biometric flag

**Files:**
- Modify: `src/screens/Families.tsx` (rewrite render), `src/screens/Families.test.tsx`, `src/services/credential-vault.ts` (+`isBiometric`), `src/services/credential-vault.test.ts`

**Interfaces:**
- Consumes: `listServers`, `removeServer`, `setDefaultServer`, `formatLastOpened`, `Toast`, `Ic`, `Header`.
- Produces: `CredentialVault.isBiometric(serverId: string): Promise<boolean>` (reads the record's `biometric` flag without triggering identity verification).

- [ ] **Step 1: Write failing vault test** (append to `src/services/credential-vault.test.ts`, using the file's existing fake-backend pattern)

```ts
it('isBiometric reports the stored flag without verifying identity', async () => {
  const vault = new CredentialVault(backend)
  await vault.store('s1', { type: 'pin', loginId: null, securityPin: '111111' }, { biometric: true })
  await vault.store('s2', { type: 'pin', loginId: null, securityPin: '222222' }, { biometric: false })
  expect(await vault.isBiometric('s1')).toBe(true)
  expect(await vault.isBiometric('s2')).toBe(false)
  expect(await vault.isBiometric('missing')).toBe(false)
})
```

- [ ] **Step 2: Run to verify failure**, then implement in `CredentialVault`:

```ts
async isBiometric(serverId: string): Promise<boolean> {
  const raw = await this.backend.get(keyFor(serverId))
  if (!raw) return false
  try {
    return Boolean((JSON.parse(raw) as VaultRecord).biometric)
  } catch {
    return false
  }
}
```

- [ ] **Step 3: Update `src/screens/Families.test.tsx`** — new assertions:

```tsx
// 'Opens first' chip on the default entry; 'not opened yet' / formatted last-opened line;
// empty state copy 'No families on this phone yet.'; dashed 'Add a family' button navigates
// to { name: 'add-family' }; star button aria-label `Make ${familyName} the default`;
// remove aria-label `Remove ${familyName}`; toast prop renders; notice 'locked' shows the
// lockout copy in an alert.
```

Write them as real tests following the file's existing mocking pattern (module mocks for server-registry + a vault mock extended with `isBiometric: vi.fn().mockResolvedValue(false)`).

- [ ] **Step 4: Rewrite `src/screens/Families.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { Screen } from '../App'
import { Header, ErrBox } from '../components/chrome'
import { Ic } from '../components/Icons'
import Toast from '../components/Toast'
import { formatLastOpened } from '../lib/relative-time'
import { createVault } from '../services/credential-vault'
import { listServers, removeServer, setDefaultServer, type ServerEntry } from '../services/server-registry'

const LOCKED_COPY = 'Too many tries — the server is taking a breather. Try again in a few minutes.'

export default function Families({
  navigate, toast: bootToast, notice,
}: {
  navigate: (s: Screen) => void
  toast?: string
  notice?: string
}) {
  const [servers, setServers] = useState<ServerEntry[]>([])
  const [bio, setBio] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState<string | null>(bootToast ?? null)

  const reload = () => {
    void listServers().then(async entries => {
      setServers(entries)
      const vault = createVault()
      const flags = await Promise.all(entries.map(e => vault.isBiometric(e.id)))
      setBio(Object.fromEntries(entries.map((e, i) => [e.id, flags[i]])))
    })
  }
  useEffect(reload, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  async function remove(entry: ServerEntry) {
    await removeServer(entry.id)
    await createVault().clear(entry.id)
    setToast(`${entry.familyName} was removed from this phone.`)
    reload()
  }

  return (
    <div className="m-scr">
      <Header title="My families"
        right={<button className="m-iconbtn" aria-label="Settings" onClick={() => navigate({ name: 'settings' })}><Ic id="i-gear" s={20} /></button>} />
      <div className="m-bd">
        {notice === 'locked' && <div style={{ marginBottom: 11 }}><ErrBox>{LOCKED_COPY}</ErrBox></div>}
        {servers.length === 0 && (
          <div className="empty">
            <img src="/art/kitten.svg" alt="" width="84" />
            <b>No families on this phone yet.</b>
            Pair one and it&rsquo;ll live right here.
          </div>
        )}
        {servers.map(entry => (
          <div className="fam-row" key={entry.id}>
            <button className="fam-card" onClick={() => navigate({ name: 'connecting', entry })}>
              <div className={'fam-av' + (entry.deploymentMode === 'saas' ? '' : ' apr')}>{entry.familyName[0]}</div>
              <div className="t">
                <div className="nm">{entry.familyName}{entry.isDefault && <span className="chip c-apr">Opens first</span>}</div>
                <div className="host">
                  {new URL(entry.baseUrl).host} · {entry.lastUsedAt ? `opened ${formatLastOpened(entry.lastUsedAt)}` : 'not opened yet'}
                </div>
              </div>
              {bio[entry.id] && <Ic id="i-face" s={18} style={{ color: 'var(--color-sub)', flexShrink: 0 }} />}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button className={'rowbtn star' + (entry.isDefault ? ' on' : '')}
                aria-label={`Make ${entry.familyName} the default`}
                onClick={() => void setDefaultServer(entry.id).then(reload)}>
                <Ic id={entry.isDefault ? 'i-starf' : 'i-star'} s={17} />
              </button>
              <button className="rowbtn x" aria-label={`Remove ${entry.familyName}`} onClick={() => void remove(entry)}>
                <Ic id="i-x" s={15} />
              </button>
            </div>
          </div>
        ))}
        <button className="m-btn ghost" style={{ borderStyle: 'dashed', marginTop: 6 }} onClick={() => navigate({ name: 'add-family' })}>
          <Ic id="i-plus" s={16} />Add a family
        </button>
      </div>
      {toast && <Toast message={toast} />}
    </div>
  )
}
```

Note: aria-labels switch from `familySlug` to `familyName` — update any test that used slugs.

- [ ] **Step 5: Run tests** — `npm test` → PASS.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: families screen — storybook cards, biometric glyph, toasts"`

---

### Task 8: Settings restyle

**Files:**
- Modify: `src/screens/Settings.tsx`, `src/screens/Settings.test.tsx`

**Interfaces:**
- Consumes: `isAutoOpenEnabled` / `AUTO_OPEN_KEY` (unchanged exports), `listServers`, `Header`, `Ic`.
- Produces: nothing new (exports unchanged).

- [ ] **Step 1: Update tests** — new/changed assertions in `src/screens/Settings.test.tsx` (keep the file's Preferences/vault mocking):

```tsx
// switch has role="switch" aria-label 'Open my family automatically', toggles aria-checked
// description names the default family when one exists ('jump straight into Smith Family')
// clear flow: 'Clear all data' -> confirm copy 'This clears the book from this phone — the
//   server keeps everything. Sure?' -> 'Yes, clear it' clears and navigates to welcome,
//   'Keep it' backs out
// footer contains 'Sprout Track Mobile v0.1.0'
```

Written as real tests following the existing patterns.

- [ ] **Step 2: Run to verify failures**, then rewrite the render (logic — `isAutoOpenEnabled`, `toggleAutoOpen`, `clearAll` — unchanged; add `defName` state loaded from `listServers()` → `find(e => e.isDefault)?.familyName ?? null`):

```tsx
return (
  <div className="m-scr">
    <Header title="Settings" onBack={() => navigate({ name: 'families' })} />
    <div className="m-bd">
      <div className="sect">
        <div className="swrow">
          <div className="t">
            <b>Open my family automatically</b>
            <p>Skip the list — jump straight into {defName ? <b style={{ fontWeight: 700 }}>{defName}</b> : 'your default family'} when the app opens. Your unlock is still the gate.</p>
          </div>
          <button className={'sw' + (autoOpen ? ' on' : '')} role="switch" aria-checked={autoOpen}
            aria-label="Open my family automatically" onClick={() => void toggleAutoOpen(!autoOpen)}><i></i></button>
        </div>
      </div>
      <div className="sect">
        <div className="sect-hd"><Ic id="i-shield" s={19} /><h3>Your PINs stay put</h3></div>
        <p>Saved sign-ins live in this phone&rsquo;s secure keychain and never leave it. Remove a family and its PIN goes with it.</p>
      </div>
      <div className="sect">
        <div className="sect-hd"><Ic id="i-alert" s={19} style={{ color: 'var(--color-rust)' }} /><h3 style={{ color: 'var(--color-rust)' }}>Clear this phone</h3></div>
        <p style={{ marginBottom: 12 }}>Removes every saved family and PIN from this phone. Your family&rsquo;s data stays safe on the server.</p>
        {confirming ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <p style={{ fontWeight: 700, color: 'var(--color-rust)' }}>This clears the book from this phone — the server keeps everything. Sure?</p>
            <div style={{ display: 'flex', gap: 9 }}>
              <button className="m-btn danger solid sm" onClick={() => void clearAll()}>Yes, clear it</button>
              <button className="m-btn ghost sm" onClick={() => setConfirming(false)}>Keep it</button>
            </div>
          </div>
        ) : (
          <button className="m-btn danger sm" onClick={() => setConfirming(true)}>Clear all data</button>
        )}
      </div>
      <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--color-sub)', marginTop: 22 }}>
        Sprout Track Mobile v0.1.0<br />The tracker itself lives on your server.
      </p>
    </div>
  </div>
)
```

- [ ] **Step 3: Run tests** — `npm test` → PASS.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: settings screen — storybook sections and clear-phone confirm"`

---

### Task 9: Offline restyle

**Files:**
- Modify: `src/screens/Offline.tsx`, `src/screens/Offline.test.tsx` (create if missing)

- [ ] **Step 1: Write/adjust the test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import Offline from './Offline'
import type { ServerEntry } from '../services/server-registry'

const entry = {
  id: 'e1', baseUrl: 'https://x.example.com', familySlug: 's', familyName: 'Smith Family',
  deploymentMode: 'selfhosted', authType: 'SYSTEM', lastUsedAt: null, isDefault: true,
} as ServerEntry

describe('Offline', () => {
  it('names the family and retries via connecting', async () => {
    const navigate = vi.fn()
    render(<Offline navigate={navigate} entry={entry} />)
    expect(screen.getByText(/Can’t reach your server\./)).toBeInTheDocument()
    expect(screen.getByText(/Smith Family/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Try again/ }))
    expect(navigate).toHaveBeenCalledWith({ name: 'connecting', entry })
    await userEvent.click(screen.getByRole('button', { name: 'Switch family' }))
    expect(navigate).toHaveBeenCalledWith({ name: 'families' })
  })
})
```

- [ ] **Step 2: Run to verify failure**, then implement:

```tsx
import type { Screen } from '../App'
import { Ic } from '../components/Icons'
import type { ServerEntry } from '../services/server-registry'

export default function Offline({ navigate, entry }: { navigate: (s: Screen) => void; entry: ServerEntry }) {
  return (
    <div className="m-scr">
      <div className="center-scr">
        <img src="/art/kitten.svg" alt="" width="104" />
        <h2>Can&rsquo;t reach your server.</h2>
        <p>{entry.familyName}&rsquo;s server isn&rsquo;t answering right now. Everything already logged is safe — we just can&rsquo;t say hello.</p>
        <div className="btns">
          <button className="m-btn" onClick={() => navigate({ name: 'connecting', entry })}><Ic id="i-refresh" s={17} />Try again</button>
          <button className="m-btn ghost" onClick={() => navigate({ name: 'families' })}>Switch family</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run tests** — `npm test` → PASS.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: offline screen — storybook design"`

---

### Task 10: Session handoff, shell side (contract + session + connect)

**Files:**
- Modify: `shared/bridge-contract.ts`, `shared/bridge-contract.test.ts`, `src/services/session.ts`, `src/services/session.test.ts`, `src/services/connect.ts`, `src/services/connect.test.ts`

**Interfaces:**
- Produces:
  - Contract: `{ type: 'sessionInjected'; slug: string; token: string; caretakerId?: string }` (Task 13 mirrors this in the vendored copy).
  - `LoginResult` ok-variant gains `caretakerId?: string` (from envelope `data.id` when it's a string).
  - `connectToFamily` on successful login navigates to `` `${baseUrl}/${slug}/log-entry#bridge-session=${encodeURIComponent(encodeMessage({...}))}` ``.

- [ ] **Step 1: Write failing contract tests** (append to `shared/bridge-contract.test.ts`)

```ts
it('round-trips sessionInjected with token and optional caretakerId', () => {
  const msg = { type: 'sessionInjected', slug: 'smith-family', token: 'jwt123' } as const
  expect(decodeMessage(encodeMessage(msg))?.msg).toEqual(msg)
  const withId = { ...msg, caretakerId: '42' }
  expect(decodeMessage(encodeMessage(withId))?.msg).toEqual(withId)
})

it('rejects sessionInjected without a token', () => {
  expect(decodeMessage(JSON.stringify({ v: 1, msg: { type: 'sessionInjected', slug: 's' } }))).toBeNull()
})

it('rejects sessionInjected with a non-string caretakerId', () => {
  expect(decodeMessage(JSON.stringify({
    v: 1, msg: { type: 'sessionInjected', slug: 's', token: 't', caretakerId: 7 },
  }))).toBeNull()
})
```

- [ ] **Step 2: Run to verify failure**, then update `shared/bridge-contract.ts`:

```ts
| { type: 'sessionInjected'; slug: string; token: string; caretakerId?: string }
```

```ts
sessionInjected: m =>
  typeof m.slug === 'string' && typeof m.token === 'string' &&
  (m.caretakerId === undefined || typeof m.caretakerId === 'string'),
```

- [ ] **Step 3: Write failing session test** (append to `src/services/session.test.ts`, using the file's fake-`post` pattern)

```ts
it('surfaces caretakerId from the login envelope', async () => {
  const post = async () => ({ status: 200, body: { success: true, data: { token: 't', familySlug: 'fs', id: '42' } } })
  const result = await loginWithCredentials(
    { id: 'x1', baseUrl: 'https://h', familySlug: 'fs' },
    { type: 'pin', loginId: null, securityPin: '1' }, post,
  )
  expect(result).toEqual({ ok: true, token: 't', familySlug: 'fs', caretakerId: '42' })
})
```

Implement in `src/services/session.ts`:

```ts
export type LoginResult =
  | { ok: true; token: string; familySlug: string; caretakerId?: string }
  | { ok: false; error: 'invalid' | 'locked' | 'unreachable'; retryAfterSeconds?: number }
```

and in `doLogin`'s success return (envelope type gains `id?: unknown`):

```ts
const caretakerId = typeof envelope.data.id === 'string' ? envelope.data.id : undefined
return {
  ok: true, token: envelope.data.token,
  familySlug: envelope.data.familySlug ?? entry.familySlug,
  ...(caretakerId !== undefined ? { caretakerId } : {}),
}
```

- [ ] **Step 4: Write failing connect test** (append to `src/services/connect.test.ts`, following its deps-override pattern)

```ts
it('hands the session to the web app via the bridge-session fragment', async () => {
  const openUrl = vi.fn()
  const outcome = await connectToFamily(entry, {
    ...baseDeps,
    login: vi.fn().mockResolvedValue({ ok: true, token: 'jwt123', familySlug: entry.familySlug, caretakerId: '42' }),
    openUrl,
  })
  expect(outcome).toBe('navigated')
  const url = openUrl.mock.calls[0][0] as string
  const [base, fragment] = url.split('#bridge-session=')
  expect(base).toBe(`${entry.baseUrl}/${entry.familySlug}/log-entry`)
  const decoded = decodeMessage(decodeURIComponent(fragment))
  expect(decoded?.msg).toEqual({
    type: 'sessionInjected', slug: entry.familySlug, token: 'jwt123', caretakerId: '42',
  })
})
```

Implement in `src/services/connect.ts` (replace the `result.ok` branch; import `encodeMessage` from `../../shared/bridge-contract`):

```ts
if (result.ok) {
  const msg = {
    type: 'sessionInjected' as const,
    slug: result.familySlug,
    token: result.token,
    ...(result.caretakerId !== undefined ? { caretakerId: result.caretakerId } : {}),
  }
  deps.openUrl(`${familyUrl}/log-entry#bridge-session=${encodeURIComponent(encodeMessage(msg))}`)
  return 'navigated'
}
```

- [ ] **Step 5: Run the full suite** — `npm test` → PASS.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: hand shell login session to the web app via bridge-session fragment"`

---

### Task 11: Logout-by-reason boot actions

**Files:**
- Modify: `src/services/bridge-events.ts`, `src/services/bridge-events.test.ts`, `src/App.test.tsx` (reconnect boot behavior)

**Interfaces:**
- Produces: `export type BootAction = 'auto-open' | 'show-server-list' | 'reconnect'`; mapping per the table below. App.tsx already handles `'reconnect'` (Task 3) — remove any temporary `as string` widening from Task 3 if one was added.

| Incoming | BootAction |
|---|---|
| no `bridge-event` param / undecodable | `auto-open` |
| `loggedOut` reason `switch-family` or `logout-user` | `show-server-list` |
| `loggedOut` reason `logout-idle`, `logout-refresh-failed`, `logout-jwt-error` | `reconnect` |
| `loggedOut` any other reason | `show-server-list` |
| `sessionExpired` | `reconnect` |
| any other decodable message | `auto-open` |

- [ ] **Step 1: Write failing tests** (rewrite the mapping block in `src/services/bridge-events.test.ts`)

```ts
import { encodeMessage } from '../../shared/bridge-contract'
import { bootActionFromSearch } from './bridge-events'

const search = (msg: Parameters<typeof encodeMessage>[0]) =>
  `?bridge-event=${encodeURIComponent(encodeMessage(msg))}`

it.each([
  ['switch-family', 'show-server-list'],
  ['logout-user', 'show-server-list'],
  ['logout-idle', 'reconnect'],
  ['logout-refresh-failed', 'reconnect'],
  ['logout-jwt-error', 'reconnect'],
  ['something-new', 'show-server-list'],
] as const)('loggedOut reason %s -> %s', (reason, expected) => {
  expect(bootActionFromSearch(search({ type: 'loggedOut', reason }))).toBe(expected)
})

it('sessionExpired -> reconnect', () => {
  expect(bootActionFromSearch(search({ type: 'sessionExpired' }))).toBe('reconnect')
})

it('no param -> auto-open', () => {
  expect(bootActionFromSearch('')).toBe('auto-open')
})

it('undecodable param -> auto-open', () => {
  expect(bootActionFromSearch('?bridge-event=garbage')).toBe('auto-open')
})
```

- [ ] **Step 2: Run to verify failure**, then implement `src/services/bridge-events.ts`:

```ts
import { decodeMessage } from '../../shared/bridge-contract'

export type BootAction = 'auto-open' | 'show-server-list' | 'reconnect'

const RECONNECT_REASONS = new Set(['logout-idle', 'logout-refresh-failed', 'logout-jwt-error'])

/** Interpret a ?bridge-event= param the web app used to hand control back to the shell. */
export function bootActionFromSearch(search: string): BootAction {
  const raw = new URLSearchParams(search).get('bridge-event')
  if (!raw) return 'auto-open'
  const decoded = decodeMessage(raw)
  if (!decoded) return 'auto-open'
  if (decoded.msg.type === 'sessionExpired') return 'reconnect'
  if (decoded.msg.type === 'loggedOut') {
    return RECONNECT_REASONS.has(decoded.msg.reason) ? 'reconnect' : 'show-server-list'
  }
  return 'auto-open'
}
```

(`stripBridgeEvent` unchanged.)

- [ ] **Step 3: Add App-level reconnect test** (append to `src/App.test.tsx`, using the file's existing location/registry mocking)

```tsx
it('reconnects to the most recent family after a session-expiry logout', async () => {
  // window.location.search set to a loggedOut/logout-idle bridge-event;
  // listServers mocked to [{...recent, lastUsedAt: '2026-07-20T10:00:00Z'}]
  render(<App />)
  expect(await screen.findByText(/Opening Recent Family…/)).toBeInTheDocument()
})
```

- [ ] **Step 4: Run the full suite** — `npm test` → PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: route logouts by reason — list for user logout, reconnect on expiry"`

---

### Task 12: Native chrome (status bar, splash) + README

**Files:**
- Modify: `src/main.tsx`, `capacitor.config.ts`, `README.md`
- Regenerate: `android/`+`ios/` platform asset files (via `@capacitor/assets` + `cap sync`)

- [ ] **Step 1: Status bar in `src/main.tsx`** (after imports, before render)

```ts
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

if (Capacitor.isNativePlatform()) {
  // Paper background → dark status-bar content. Style.Light = dark text for light backgrounds.
  void StatusBar.setStyle({ style: Style.Light })
  if (Capacitor.getPlatform() === 'android') void StatusBar.setBackgroundColor({ color: '#f7f1e2' })
}
```

- [ ] **Step 2: Splash config in `capacitor.config.ts`** (add to `plugins`)

```ts
SplashScreen: {
  backgroundColor: '#f7f1e2',
  launchAutoHide: true,
},
```

- [ ] **Step 3: Regenerate native assets and sync**

```bash
npx @capacitor/assets generate --iconBackgroundColor '#f7f1e2' --splashBackgroundColor '#f7f1e2'
npm run sync
```

- [ ] **Step 4: README updates** — in `README.md`:
  - Under Development, add: "The shell UI follows the v1-storybook theme (`docs/mockups/capacitor-app.html`); fonts are bundled via @fontsource (no network needed at runtime)."
  - Replace the first Known-v0-limitations bullet with: "Silent session handoff passes the shell's login to the web app via a `#bridge-session=` fragment; it requires a server running the native-aware layer (sprout-track branch `feature/native-aware-layer`). Older servers ignore the fragment and show the web login once. The web session may also not auto-refresh past ~30 min (the shell's refresh cookie may not reach the webview); expiry then routes back through the shell, which re-logs-in with saved credentials."

- [ ] **Step 5: Verify** — `npm test && npm run build` → PASS/success.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: paper status bar and splash, README for handoff behavior"`

---

### Task 13: Vendored contract update (sprout-track repo)

**Files (all inside `/Users/johnoverton/Development/mobile-app-v1/sprout-track`):**
- Modify: `src/utils/bridge-contract.ts`, `tests/bridge-contract.test.ts`

**Interfaces:**
- Consumes: the exact shape from Task 10.
- Produces: vendored `sessionInjected` accepting `{ slug, token, caretakerId? }` for Task 14.

- [ ] **Step 1: Verify repo + branch**

```bash
cd /Users/johnoverton/Development/mobile-app-v1/sprout-track
git rev-parse --show-toplevel   # …/mobile-app-v1/sprout-track
git branch --show-current       # feature/native-aware-layer — STOP if anything else
```

- [ ] **Step 2: Write failing tests** (append to `tests/bridge-contract.test.ts`, matching Task 10's cases)

```ts
it('round-trips sessionInjected with token and optional caretakerId', () => {
  const msg = { type: 'sessionInjected', slug: 'smith-family', token: 'jwt123' } as const
  expect(decodeMessage(encodeMessage(msg))?.msg).toEqual(msg)
  const withId = { ...msg, caretakerId: '42' }
  expect(decodeMessage(encodeMessage(withId))?.msg).toEqual(withId)
})

it('rejects sessionInjected without a token', () => {
  expect(decodeMessage(JSON.stringify({ v: 1, msg: { type: 'sessionInjected', slug: 's' } }))).toBeNull()
})

it('rejects sessionInjected with a non-string caretakerId', () => {
  expect(decodeMessage(JSON.stringify({
    v: 1, msg: { type: 'sessionInjected', slug: 's', token: 't', caretakerId: 7 },
  }))).toBeNull()
})
```

- [ ] **Step 3: Run to verify failure** — `npx vitest run tests/bridge-contract.test.ts` → FAIL.

- [ ] **Step 4: Apply the same two edits as Task 10** to `src/utils/bridge-contract.ts` (type union member + validator). If the drift test asserts source equality with a snapshot/hash, update it per its own instructions in the test file.

- [ ] **Step 5: Run the full suite** — `npm test` → PASS (706 + new).
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: bridge contract — sessionInjected carries token and caretakerId"`

---

### Task 14: Native session consumer + client-layout wiring (sprout-track repo)

**Files (all inside `/Users/johnoverton/Development/mobile-app-v1/sprout-track`):**
- Create: `src/utils/native-session.ts`
- Test: `tests/native-session.test.ts`
- Modify: `app/(app)/[slug]/client-layout.tsx` (the `isUnlocked` useState initializer, around line 85)

**Interfaces:**
- Consumes: vendored `decodeMessage` (Task 13), `isNativeApp()` from `src/utils/native-app.ts`.
- Produces:

```ts
// Pure, injectable core — node-env testable:
export interface InjectedSessionEnv {
  hash: string
  pathname: string
  search: string
  native: boolean
  storage: { setItem(key: string, value: string): void }
  replaceUrl: (url: string) => void
  now: () => number
}
export function consumeInjectedSessionFrom(env: InjectedSessionEnv): boolean
// Browser wrapper used by client-layout (also fire-and-forgets timeout-settings seeding):
export function consumeInjectedSession(): boolean
```

- [ ] **Step 1: Verify repo + branch** (same commands as Task 13 Step 1 — STOP if wrong).

- [ ] **Step 2: Write failing tests** (`tests/native-session.test.ts`)

```ts
import { describe, expect, it, vi } from 'vitest'
import { consumeInjectedSessionFrom, type InjectedSessionEnv } from '@/src/utils/native-session'
import { encodeMessage } from '@/src/utils/bridge-contract'

function makeEnv(overrides: Partial<InjectedSessionEnv> = {}): InjectedSessionEnv & {
  stored: Record<string, string>
  replaced: string[]
} {
  const stored: Record<string, string> = {}
  const replaced: string[] = []
  return {
    hash: '#bridge-session=' + encodeURIComponent(encodeMessage({
      type: 'sessionInjected', slug: 'smith-family', token: 'jwt123', caretakerId: '42',
    })),
    pathname: '/smith-family/log-entry',
    search: '',
    native: true,
    storage: { setItem: (k, v) => { stored[k] = v } },
    replaceUrl: url => replaced.push(url),
    now: () => 1_752_000_000_000,
    stored,
    replaced,
    ...overrides,
  }
}

describe('consumeInjectedSessionFrom', () => {
  it('injects the session and strips the fragment', () => {
    const env = makeEnv()
    expect(consumeInjectedSessionFrom(env)).toBe(true)
    expect(env.stored.authToken).toBe('jwt123')
    expect(env.stored.unlockTime).toBe('1752000000000')
    expect(env.stored.caretakerId).toBe('42')
    expect(env.replaced).toEqual(['/smith-family/log-entry'])
  })

  it('omits caretakerId when the message has none', () => {
    const env = makeEnv({
      hash: '#bridge-session=' + encodeURIComponent(encodeMessage({
        type: 'sessionInjected', slug: 'smith-family', token: 'jwt123',
      })),
    })
    expect(consumeInjectedSessionFrom(env)).toBe(true)
    expect('caretakerId' in env.stored).toBe(false)
  })

  it('no-ops entirely without the fragment', () => {
    const env = makeEnv({ hash: '' })
    expect(consumeInjectedSessionFrom(env)).toBe(false)
    expect(env.replaced).toEqual([])
    expect(Object.keys(env.stored)).toEqual([])
  })

  it('no-ops (fragment kept) outside the native app', () => {
    const env = makeEnv({ native: false })
    expect(consumeInjectedSessionFrom(env)).toBe(false)
    expect(env.replaced).toEqual([])
    expect(Object.keys(env.stored)).toEqual([])
  })

  it('strips but does not inject on slug mismatch', () => {
    const env = makeEnv({ pathname: '/other-family/log-entry' })
    expect(consumeInjectedSessionFrom(env)).toBe(false)
    expect(Object.keys(env.stored)).toEqual([])
    expect(env.replaced).toEqual(['/other-family/log-entry'])
  })

  it('strips but does not inject on malformed payloads', () => {
    const env = makeEnv({ hash: '#bridge-session=%%%not-valid' })
    expect(consumeInjectedSessionFrom(env)).toBe(false)
    expect(Object.keys(env.stored)).toEqual([])
    expect(env.replaced.length).toBe(1)
  })

  it('preserves the query string when stripping', () => {
    const env = makeEnv({ search: '?src=x' })
    expect(consumeInjectedSessionFrom(env)).toBe(true)
    expect(env.replaced).toEqual(['/smith-family/log-entry?src=x'])
  })
})
```

- [ ] **Step 3: Run to verify failure** — `npx vitest run tests/native-session.test.ts` → FAIL.

- [ ] **Step 4: Implement `src/utils/native-session.ts`**

```ts
import { decodeMessage } from './bridge-contract';
import { isNativeApp } from './native-app';

const PREFIX = '#bridge-session=';

export interface InjectedSessionEnv {
  hash: string;
  pathname: string;
  search: string;
  native: boolean;
  storage: { setItem(key: string, value: string): void };
  replaceUrl: (url: string) => void;
  now: () => number;
}

/**
 * Consume a shell-injected session fragment (#bridge-session=<encoded sessionInjected>).
 * Returns true when a session was written. In the native app the fragment is always
 * stripped — valid or not — so tokens never linger in the URL; outside the native app
 * nothing is touched.
 */
export function consumeInjectedSessionFrom(env: InjectedSessionEnv): boolean {
  if (!env.hash.startsWith(PREFIX) || !env.native) return false;
  const strip = () => env.replaceUrl(env.pathname + env.search);
  let decoded: ReturnType<typeof decodeMessage>;
  try {
    decoded = decodeMessage(decodeURIComponent(env.hash.slice(PREFIX.length)));
  } catch {
    strip();
    return false;
  }
  const slug = env.pathname.split('/').filter(Boolean)[0] ?? '';
  if (!decoded || decoded.msg.type !== 'sessionInjected' || decoded.msg.slug !== slug) {
    strip();
    return false;
  }
  env.storage.setItem('authToken', decoded.msg.token);
  env.storage.setItem('unlockTime', env.now().toString());
  if (decoded.msg.caretakerId) env.storage.setItem('caretakerId', decoded.msg.caretakerId);
  strip();
  return true;
}

/** Browser entry point — binds window and seeds the timeout settings the login screens store. */
export function consumeInjectedSession(): boolean {
  if (typeof window === 'undefined') return false;
  const injected = consumeInjectedSessionFrom({
    hash: window.location.hash,
    pathname: window.location.pathname,
    search: window.location.search,
    native: isNativeApp(),
    storage: window.localStorage,
    replaceUrl: url => window.history.replaceState(null, '', url),
    now: Date.now,
  });
  if (injected) void seedTimeoutSettings();
  return injected;
}

async function seedTimeoutSettings(): Promise<void> {
  for (const [endpoint, key] of [
    ['/api/settings/auth-life', 'authLifeSeconds'],
    ['/api/settings/idle-time', 'idleTimeSeconds'],
  ] as const) {
    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      if (data.success) localStorage.setItem(key, data.data.toString());
    } catch {
      /* session-timeout falls back to defaults */
    }
  }
}
```

- [ ] **Step 5: Run tests** — `npx vitest run tests/native-session.test.ts` → PASS.

- [ ] **Step 6: Wire into `app/(app)/[slug]/client-layout.tsx`**

In the `isUnlocked` useState initializer (~line 85), call the consumer before reading `unlockTime` (it is idempotent — a second StrictMode invocation finds no fragment and no-ops):

```ts
const [isUnlocked, setIsUnlocked] = useState(() => {
  // Only run this on client-side
  if (typeof window !== 'undefined') {
    consumeInjectedSession(); // shell-handed session (native app): writes authToken/unlockTime, strips the fragment
    const unlockTime = localStorage.getItem('unlockTime');
    if (unlockTime && Date.now() - parseInt(unlockTime) <= 60 * 1000) {
      return true;
    }
  }
  return false;
});
```

Add the import: `import { consumeInjectedSession } from '@/src/utils/native-session';` (match the file's existing import style for `@/src/utils/*`).

- [ ] **Step 7: Run the full suite** — `npm test` → PASS. Also `node scripts/check-missing-translations.js` → no new missing keys (the consumer adds no user-facing strings).

- [ ] **Step 8: Commit and push**

```bash
git rev-parse --show-toplevel && git branch --show-current   # re-verify
git add -A && git commit -m "feat: consume shell-injected session fragment in native app"
git push origin feature/native-aware-layer
```

---

## Final verification

- [ ] mobile-app-v1: `npm test && npm run build && npm run sync` — all green.
- [ ] sprout-track: `npm test` — all green (706 baseline + new).
- [ ] Manual smoke (dev loop): sprout-track `npm run dev`; shell on Android emulator (`http://10.0.2.2:3000/<slug>`) — pairing lands on the storybook UI, opening a family shows Connecting then the web app **without** a second login, in-app logout returns to the families list, Switch Family returns to the families list, and the shell renders in paper/teal with Literata headings.
- [ ] Final whole-branch review per subagent-driven-development, then finishing-a-development-branch for `feature/ui-pass`; push `feature/native-aware-layer` to update PR #234.
