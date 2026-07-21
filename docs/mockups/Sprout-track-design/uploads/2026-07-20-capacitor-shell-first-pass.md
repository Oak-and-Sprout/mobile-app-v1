# Capacitor Shell First Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the bundled shell of the Sprout Track mobile app — server/family registry, pairing, credential vault with biometrics, session login service, and Capacitor scaffolding — working and tested in the browser, with the Android native platform generated.

**Architecture:** Thin native shell + remote webview (spec §2, `docs/superpowers/specs/2026-07-20-capacitor-mobile-app-design.md`). The shell is a small Vite + React + TS app that is the Capacitor webview's local origin; connecting to a family navigates the same webview to the remote Sprout Track origin. All services are plain TS modules with injected I/O so they test in Vitest/jsdom without native devices.

**Tech Stack:** Vite 6, React 18, TypeScript (strict), Tailwind CSS v4, Vitest + Testing Library, Capacitor 7 (`@capacitor/core`, `@capacitor/preferences`, `@capacitor/network`, `@capacitor/app`, `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capgo/capacitor-native-biometric`).

## Global Constraints

- Node >= 22, npm. No CocoaPods / full Xcode on this machine: add **Android** platform only; iOS platform addition is documented, not executed.
- TypeScript `strict: true` everywhere. No `any` in exported signatures.
- Theme colors (spec §8): brand teal `#0d9488`, emerald `#059669`, hover `#0f766e`/`#047857`, deep `#065f46`; light base `#ffffff`/`#f9fafb`, mint `#ecfdf5`/`#a7f3d0`; dark surfaces `#111827`/`#1f2937`, dark accent `#5eead4`. Font: Inter.
- Sprout Track API facts (verified in the reference build): response envelope `{ success, data?, error? }`; unauthenticated endpoints `GET /api/deployment-config`, `GET /api/family/by-slug/{slug}`, `GET /api/auth/caretaker-exists?familySlug=...`; login `POST /api/auth` body `{ loginId?, securityPin, familySlug }` and `POST /api/accounts/login` body `{ email, password }`; lockout returns HTTP 429.
- **Session handoff is v0 in this plan:** the shell validates credentials natively and stores them; the remote web app may still show its own login screen. Silent injection ships with the sprout-track native-aware layer (separate follow-up plan, out of scope here).
- Commits use conventional prefixes (`feat:`, `test:`, `chore:`). Commit at the end of every task at minimum.
- All `npm` / `npx cap` commands run from the repo root `/Users/johnoverton/Development/mobile-app-v1`.

## File Structure

```
mobile-app-v1/
├── package.json  vite.config.ts  tsconfig.json  index.html
├── capacitor.config.ts
├── android/                     # generated (Task 11)
├── resources/icon-only.png      # from sprout-track public/sprout-1024.png
├── shared/bridge-contract.ts    # typed bridge messages (+ test)
├── src/
│   ├── main.tsx  App.tsx  index.css
│   ├── lib/api-client.ts        # CapacitorHttp native / fetch web
│   ├── services/server-probe.ts     # URL parse + instance/family validation
│   ├── services/server-registry.ts  # saved servers (Preferences)
│   ├── services/credential-vault.ts # secure creds + biometric gate
│   ├── services/session.ts          # login replay, single-flight
│   ├── services/connect.ts          # connect-to-family orchestration
│   └── screens/Welcome.tsx  AddServer.tsx  ServerList.tsx  Settings.tsx  Offline.tsx
└── (tests co-located: *.test.ts / *.test.tsx)
```

Screen refinement vs. spec: no separate Unlock screen — the biometric prompt is an OS modal raised by the vault during connect. Settings is minimal (clear-all + version).

---

### Task 1: Project scaffold (Vite + React + TS + Vitest + Tailwind)

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/App.test.tsx`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces: `npm run dev`, `npm test`, `npm run build` all work; `<App />` renders a root div with test id `app-root`.

- [ ] **Step 1: Init npm and install dependencies**

```bash
npm init -y
npm pkg set name="sprout-track-mobile" version="0.1.0" type="module"
npm pkg set scripts.dev="vite" scripts.build="tsc -b && vite build" scripts.test="vitest run" scripts.test:watch="vitest"
npm i react react-dom
npm i -D vite @vitejs/plugin-react typescript @types/react @types/react-dom vitest jsdom @testing-library/react @testing-library/jest-dom tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Write config files**

`vite.config.ts`:
```ts
/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "shared"]
}
```

Add `"test": { "globals": true }` support by setting `globals: true` inside the `test` block of `vite.config.ts` (edit the block above to include it).

`src/test-setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Sprout Track</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/index.css`:
```css
@import "tailwindcss";
```

`src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

`src/App.tsx`:
```tsx
export default function App() {
  return <div data-testid="app-root">Sprout Track</div>
}
```

Append to `.gitignore` (keep existing lines):
```
node_modules/
dist/
```

- [ ] **Step 3: Write the smoke test**

`src/App.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import App from './App'

test('renders the app root', () => {
  render(<App />)
  expect(screen.getByTestId('app-root')).toBeInTheDocument()
})
```

- [ ] **Step 4: Verify test and build pass**

Run: `npm test` → expect 1 passed.
Run: `npm run build` → expect a `dist/` output with no TS errors.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vite + React + TS + Vitest + Tailwind shell"
```

---

### Task 2: Theme tokens and screen state machine

**Files:**
- Modify: `src/index.css`, `src/App.tsx`
- Create: `src/screens/Welcome.tsx` (placeholder), `src/screens/ServerList.tsx` (placeholder), `src/App.test.tsx` (extend)

**Interfaces:**
- Consumes: Task 1 scaffold.
- Produces: CSS theme tokens (`--color-brand`, `--color-brand-emerald`, etc.); `type Screen` union and `App` navigation via a `navigate(screen: Screen)` prop passed to screens. Later tasks replace the placeholder screens; the `Screen` union is:
  ```ts
  export type Screen =
    | { name: 'welcome' }
    | { name: 'add-server'; prefillBaseUrl?: string }
    | { name: 'server-list' }
    | { name: 'settings' }
    | { name: 'offline'; retry: () => void }
  ```

- [ ] **Step 1: Extend the failing test**

Append to `src/App.test.tsx`:
```tsx
test('shows Welcome when no servers are saved', () => {
  render(<App />)
  expect(screen.getByText(/welcome to sprout track/i)).toBeInTheDocument()
})
```

Run: `npm test` → expect the new test to FAIL (text not found).

- [ ] **Step 2: Implement theme tokens**

Replace `src/index.css`:
```css
@import "tailwindcss";

@theme {
  --color-brand: #0d9488;
  --color-brand-emerald: #059669;
  --color-brand-hover: #0f766e;
  --color-brand-deep: #065f46;
  --color-mint: #ecfdf5;
  --color-mint-border: #a7f3d0;
  --color-cream: #f9fafb;
  --color-dark-accent: #5eead4;
  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

body {
  @apply bg-white text-gray-900 font-sans antialiased dark:bg-gray-900 dark:text-gray-100;
}
```

- [ ] **Step 3: Implement the state machine and placeholder screens**

`src/screens/Welcome.tsx`:
```tsx
import type { Screen } from '../App'

export default function Welcome({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="bg-gradient-to-r from-brand to-brand-emerald bg-clip-text text-3xl font-bold text-transparent">
        Welcome to Sprout Track
      </h1>
      <button
        className="w-full max-w-sm rounded-xl bg-gradient-to-r from-brand to-brand-emerald px-6 py-3 font-semibold text-white"
        onClick={() => navigate({ name: 'add-server', prefillBaseUrl: 'https://sprout-track.com' })}
      >
        Use Sprout Track
      </button>
      <button
        className="w-full max-w-sm rounded-xl border border-mint-border bg-mint px-6 py-3 font-semibold text-brand-deep"
        onClick={() => navigate({ name: 'add-server' })}
      >
        Connect to my own server
      </button>
    </main>
  )
}
```

`src/screens/ServerList.tsx` (placeholder, replaced in Task 9):
```tsx
import type { Screen } from '../App'

export default function ServerList({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">My Families</h1>
      <button className="mt-4 text-brand" onClick={() => navigate({ name: 'add-server' })}>
        Add a family
      </button>
    </main>
  )
}
```

Replace `src/App.tsx`:
```tsx
import { useState } from 'react'
import Welcome from './screens/Welcome'
import ServerList from './screens/ServerList'

export type Screen =
  | { name: 'welcome' }
  | { name: 'add-server'; prefillBaseUrl?: string }
  | { name: 'server-list' }
  | { name: 'settings' }
  | { name: 'offline'; retry: () => void }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'welcome' })
  return (
    <div data-testid="app-root">
      {screen.name === 'welcome' && <Welcome navigate={setScreen} />}
      {screen.name === 'server-list' && <ServerList navigate={setScreen} />}
      {screen.name === 'add-server' && <div>Add server (Task 8)</div>}
      {screen.name === 'settings' && <div>Settings (Task 10)</div>}
      {screen.name === 'offline' && <div>Offline (Task 9)</div>}
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

Run: `npm test` → expect all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: theme tokens and screen state machine with Welcome"
```

---

### Task 3: Bridge contract module

**Files:**
- Create: `shared/bridge-contract.ts`, `shared/bridge-contract.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (used later by the sprout-track native-aware layer and the shell's bridge host):
  ```ts
  export const BRIDGE_CONTRACT_VERSION: number // = 1
  export type WebToNativeMessage =
    | { type: 'keepAwake'; on: boolean }
    | { type: 'capturePhoto' }
    | { type: 'sessionExpired' }
    | { type: 'loggedOut'; reason: string }
    | { type: 'registerPushToken'; jwt: string }
  export type NativeToWebMessage =
    | { type: 'sessionInjected'; slug: string }
    | { type: 'appResumed' }
  export function encodeMessage(msg: WebToNativeMessage | NativeToWebMessage): string
  export function decodeMessage(raw: string): { v: number; msg: WebToNativeMessage | NativeToWebMessage } | null
  ```
  `decodeMessage` returns `null` for malformed JSON, unknown `type`, or an envelope version greater than `BRIDGE_CONTRACT_VERSION` (spec §5: ignore messages above the known version).

- [ ] **Step 1: Write the failing tests**

`shared/bridge-contract.test.ts`:
```ts
import { BRIDGE_CONTRACT_VERSION, decodeMessage, encodeMessage } from './bridge-contract'

test('round-trips a keepAwake message', () => {
  const decoded = decodeMessage(encodeMessage({ type: 'keepAwake', on: true }))
  expect(decoded).toEqual({ v: BRIDGE_CONTRACT_VERSION, msg: { type: 'keepAwake', on: true } })
})

test('returns null for malformed JSON', () => {
  expect(decodeMessage('{not json')).toBeNull()
})

test('returns null for unknown message type', () => {
  expect(decodeMessage(JSON.stringify({ v: 1, msg: { type: 'teleport' } }))).toBeNull()
})

test('returns null for a newer contract version', () => {
  const raw = JSON.stringify({ v: BRIDGE_CONTRACT_VERSION + 1, msg: { type: 'appResumed' } })
  expect(decodeMessage(raw)).toBeNull()
})
```

Run: `npm test shared` → expect FAIL (module not found).

- [ ] **Step 2: Implement**

`shared/bridge-contract.ts`:
```ts
export const BRIDGE_CONTRACT_VERSION = 1

export type WebToNativeMessage =
  | { type: 'keepAwake'; on: boolean }
  | { type: 'capturePhoto' }
  | { type: 'sessionExpired' }
  | { type: 'loggedOut'; reason: string }
  | { type: 'registerPushToken'; jwt: string }

export type NativeToWebMessage =
  | { type: 'sessionInjected'; slug: string }
  | { type: 'appResumed' }

type AnyMessage = WebToNativeMessage | NativeToWebMessage

const KNOWN_TYPES: ReadonlySet<string> = new Set([
  'keepAwake', 'capturePhoto', 'sessionExpired', 'loggedOut', 'registerPushToken',
  'sessionInjected', 'appResumed',
])

export function encodeMessage(msg: AnyMessage): string {
  return JSON.stringify({ v: BRIDGE_CONTRACT_VERSION, msg })
}

export function decodeMessage(raw: string): { v: number; msg: AnyMessage } | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const { v, msg } = parsed as { v?: unknown; msg?: unknown }
  if (typeof v !== 'number' || v > BRIDGE_CONTRACT_VERSION) return null
  if (typeof msg !== 'object' || msg === null) return null
  const type = (msg as { type?: unknown }).type
  if (typeof type !== 'string' || !KNOWN_TYPES.has(type)) return null
  return { v, msg: msg as AnyMessage }
}
```

- [ ] **Step 3: Run tests**

Run: `npm test shared` → expect 4 PASS.

- [ ] **Step 4: Commit**

```bash
git add shared && git commit -m "feat: typed versioned bridge contract with codec"
```

---

### Task 4: Server probe (URL parsing + instance/family validation)

**Files:**
- Create: `src/services/server-probe.ts`, `src/services/server-probe.test.ts`

**Interfaces:**
- Consumes: global `fetch` (injected as `fetchFn` for tests).
- Produces:
  ```ts
  export interface ParsedServerInput { baseUrl: string; familySlug: string | null }
  export function parseServerInput(input: string): ParsedServerInput // throws Error('invalid-url')
  export interface DeploymentConfig {
    deploymentMode: 'saas' | 'selfhosted'
    enableAccounts: boolean
    allowAccountRegistration: boolean
  }
  export interface PublicFamily { name: string; slug: string; isActive: boolean }
  export type AuthType = 'SYSTEM' | 'CARETAKER'
  export class ProbeError extends Error { constructor(public kind: 'unreachable' | 'not-sprout-track' | 'family-not-found') }
  export async function probeDeployment(baseUrl: string, fetchFn?: typeof fetch): Promise<DeploymentConfig>
  export async function fetchFamilyBySlug(baseUrl: string, slug: string, fetchFn?: typeof fetch): Promise<PublicFamily>
  export async function fetchAuthType(baseUrl: string, slug: string, fetchFn?: typeof fetch): Promise<AuthType>
  ```
  API responses may arrive raw or wrapped in `{ success, data }` — both are accepted (`unwrap` helper). `fetchAuthType` maps `caretaker-exists` data `{ exists: true }` → `'CARETAKER'`, else `'SYSTEM'`.

- [ ] **Step 1: Write the failing tests**

`src/services/server-probe.test.ts`:
```ts
import { describe, expect, test, vi } from 'vitest'
import {
  ProbeError, fetchAuthType, fetchFamilyBySlug, parseServerInput, probeDeployment,
} from './server-probe'

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('parseServerInput', () => {
  test('adds https and strips trailing slash', () => {
    expect(parseServerInput('myhost.com/')).toEqual({ baseUrl: 'https://myhost.com', familySlug: null })
  })
  test('extracts a family slug from a full URL', () => {
    expect(parseServerInput('https://myhost.com/smith-family')).toEqual({
      baseUrl: 'https://myhost.com', familySlug: 'smith-family',
    })
  })
  test('keeps explicit http and port', () => {
    expect(parseServerInput('http://192.168.1.10:3000/fam')).toEqual({
      baseUrl: 'http://192.168.1.10:3000', familySlug: 'fam',
    })
  })
  test('throws on garbage', () => {
    expect(() => parseServerInput('not a url at all !!')).toThrow('invalid-url')
  })
})

describe('probeDeployment', () => {
  test('accepts an enveloped response', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      data: { deploymentMode: 'saas', enableAccounts: true, allowAccountRegistration: true },
    }))
    const config = await probeDeployment('https://x.com', fetchFn as unknown as typeof fetch)
    expect(config.deploymentMode).toBe('saas')
    expect(fetchFn).toHaveBeenCalledWith('https://x.com/api/deployment-config', expect.anything())
  })
  test('throws not-sprout-track on a non-Sprout-Track 200', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ hello: 'world' }))
    await expect(probeDeployment('https://x.com', fetchFn as unknown as typeof fetch))
      .rejects.toMatchObject({ kind: 'not-sprout-track' })
  })
  test('throws unreachable on network failure', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    await expect(probeDeployment('https://x.com', fetchFn as unknown as typeof fetch))
      .rejects.toMatchObject({ kind: 'unreachable' })
  })
})

describe('fetchFamilyBySlug', () => {
  test('returns the family', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({
      success: true, data: { name: 'Smith Family', slug: 'smith-family', isActive: true },
    }))
    await expect(fetchFamilyBySlug('https://x.com', 'smith-family', fetchFn as unknown as typeof fetch))
      .resolves.toMatchObject({ slug: 'smith-family' })
  })
  test('throws family-not-found on 404', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ success: false }, 404))
    await expect(fetchFamilyBySlug('https://x.com', 'nope', fetchFn as unknown as typeof fetch))
      .rejects.toMatchObject({ kind: 'family-not-found' })
  })
})

describe('fetchAuthType', () => {
  test('maps exists=true to CARETAKER', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { exists: true } }))
    await expect(fetchAuthType('https://x.com', 's', fetchFn as unknown as typeof fetch)).resolves.toBe('CARETAKER')
  })
  test('maps exists=false to SYSTEM', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { exists: false } }))
    await expect(fetchAuthType('https://x.com', 's', fetchFn as unknown as typeof fetch)).resolves.toBe('SYSTEM')
  })
})
```

Run: `npm test server-probe` → expect FAIL (module not found).

- [ ] **Step 2: Implement**

`src/services/server-probe.ts`:
```ts
export interface ParsedServerInput { baseUrl: string; familySlug: string | null }

export interface DeploymentConfig {
  deploymentMode: 'saas' | 'selfhosted'
  enableAccounts: boolean
  allowAccountRegistration: boolean
}

export interface PublicFamily { name: string; slug: string; isActive: boolean }
export type AuthType = 'SYSTEM' | 'CARETAKER'

export class ProbeError extends Error {
  constructor(public kind: 'unreachable' | 'not-sprout-track' | 'family-not-found') {
    super(kind)
    this.name = 'ProbeError'
  }
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/i

export function parseServerInput(input: string): ParsedServerInput {
  const trimmed = input.trim()
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    throw new Error('invalid-url')
  }
  if (!url.hostname || url.hostname.includes(' ')) throw new Error('invalid-url')
  const segments = url.pathname.split('/').filter(Boolean)
  const familySlug = segments.length > 0 && SLUG_RE.test(segments[0]) ? segments[0] : null
  return { baseUrl: `${url.protocol}//${url.host}`, familySlug }
}

/** Accept either a raw payload or the Sprout Track `{ success, data }` envelope. */
function unwrap(body: unknown): unknown {
  if (typeof body === 'object' && body !== null && 'data' in body && 'success' in body) {
    return (body as { data: unknown }).data
  }
  return body
}

async function getJson(url: string, fetchFn: typeof fetch): Promise<{ status: number; payload: unknown }> {
  let res: Response
  try {
    res = await fetchFn(url, { headers: { Accept: 'application/json' } })
  } catch {
    throw new ProbeError('unreachable')
  }
  let payload: unknown = null
  try {
    payload = unwrap(await res.json())
  } catch {
    payload = null
  }
  return { status: res.status, payload }
}

export async function probeDeployment(baseUrl: string, fetchFn: typeof fetch = fetch): Promise<DeploymentConfig> {
  const { status, payload } = await getJson(`${baseUrl}/api/deployment-config`, fetchFn)
  const config = payload as DeploymentConfig | null
  if (status !== 200 || !config || (config.deploymentMode !== 'saas' && config.deploymentMode !== 'selfhosted')) {
    throw new ProbeError('not-sprout-track')
  }
  return {
    deploymentMode: config.deploymentMode,
    enableAccounts: Boolean(config.enableAccounts),
    allowAccountRegistration: Boolean(config.allowAccountRegistration),
  }
}

export async function fetchFamilyBySlug(baseUrl: string, slug: string, fetchFn: typeof fetch = fetch): Promise<PublicFamily> {
  const { status, payload } = await getJson(`${baseUrl}/api/family/by-slug/${encodeURIComponent(slug)}`, fetchFn)
  const family = payload as PublicFamily | null
  if (status === 404 || !family || typeof family.slug !== 'string') throw new ProbeError('family-not-found')
  return { name: family.name, slug: family.slug, isActive: Boolean(family.isActive) }
}

export async function fetchAuthType(baseUrl: string, slug: string, fetchFn: typeof fetch = fetch): Promise<AuthType> {
  const { payload } = await getJson(
    `${baseUrl}/api/auth/caretaker-exists?familySlug=${encodeURIComponent(slug)}`, fetchFn,
  )
  const exists = Boolean((payload as { exists?: unknown } | null)?.exists)
  return exists ? 'CARETAKER' : 'SYSTEM'
}
```

- [ ] **Step 3: Run tests**

Run: `npm test server-probe` → expect all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/services && git commit -m "feat: server probe with URL parsing and instance validation"
```

---

### Task 5: Server registry

**Files:**
- Create: `src/services/server-registry.ts`, `src/services/server-registry.test.ts`

**Interfaces:**
- Consumes: `@capacitor/preferences` (install here: `npm i @capacitor/core @capacitor/preferences`). Its web implementation uses `localStorage`, which jsdom provides — no mocking needed; clear `localStorage` in `beforeEach`.
- Produces:
  ```ts
  export interface ServerEntry {
    id: string                 // crypto.randomUUID()
    baseUrl: string
    familySlug: string
    familyName: string
    deploymentMode: 'saas' | 'selfhosted'
    authType: 'SYSTEM' | 'CARETAKER' | 'ACCOUNT'
    lastUsedAt: string | null  // ISO
    isDefault: boolean
  }
  export async function listServers(): Promise<ServerEntry[]>            // sorted lastUsedAt desc, nulls last
  export async function saveServer(entry: Omit<ServerEntry, 'id' | 'lastUsedAt' | 'isDefault'>): Promise<ServerEntry>
  export async function removeServer(id: string): Promise<void>
  export async function setDefaultServer(id: string): Promise<void>      // exactly one default
  export async function getDefaultServer(): Promise<ServerEntry | null>
  export async function touchServer(id: string): Promise<void>           // sets lastUsedAt = now
  ```
  `saveServer` upserts by `(baseUrl, familySlug)`; the first saved entry becomes default automatically.

- [ ] **Step 1: Install and write the failing tests**

```bash
npm i @capacitor/core @capacitor/preferences
```

`src/services/server-registry.test.ts`:
```ts
import { beforeEach, expect, test } from 'vitest'
import {
  getDefaultServer, listServers, removeServer, saveServer, setDefaultServer, touchServer,
} from './server-registry'

const smith = {
  baseUrl: 'https://myhost.com', familySlug: 'smith-family', familyName: 'Smith Family',
  deploymentMode: 'selfhosted' as const, authType: 'CARETAKER' as const,
}

beforeEach(() => localStorage.clear())

test('saves and lists a server; first entry becomes default', async () => {
  const saved = await saveServer(smith)
  expect(saved.id).toBeTruthy()
  expect(saved.isDefault).toBe(true)
  expect(await listServers()).toHaveLength(1)
})

test('upserts by baseUrl + slug instead of duplicating', async () => {
  await saveServer(smith)
  await saveServer({ ...smith, familyName: 'Smith Family Renamed' })
  const servers = await listServers()
  expect(servers).toHaveLength(1)
  expect(servers[0].familyName).toBe('Smith Family Renamed')
})

test('setDefaultServer keeps exactly one default', async () => {
  const a = await saveServer(smith)
  const b = await saveServer({ ...smith, familySlug: 'jones-family', familyName: 'Jones' })
  await setDefaultServer(b.id)
  const servers = await listServers()
  expect(servers.filter(s => s.isDefault).map(s => s.id)).toEqual([b.id])
  expect((await getDefaultServer())?.id).toBe(b.id)
  expect(servers.find(s => s.id === a.id)?.isDefault).toBe(false)
})

test('removeServer deletes the entry', async () => {
  const a = await saveServer(smith)
  await removeServer(a.id)
  expect(await listServers()).toHaveLength(0)
  expect(await getDefaultServer()).toBeNull()
})

test('touchServer bumps lastUsedAt and sorts most-recent first', async () => {
  await saveServer(smith)
  const b = await saveServer({ ...smith, familySlug: 'jones-family', familyName: 'Jones' })
  await touchServer(b.id)
  const servers = await listServers()
  expect(servers[0].id).toBe(b.id)
  expect(servers[0].lastUsedAt).not.toBeNull()
})
```

Run: `npm test server-registry` → expect FAIL.

- [ ] **Step 2: Implement**

`src/services/server-registry.ts`:
```ts
import { Preferences } from '@capacitor/preferences'

export interface ServerEntry {
  id: string
  baseUrl: string
  familySlug: string
  familyName: string
  deploymentMode: 'saas' | 'selfhosted'
  authType: 'SYSTEM' | 'CARETAKER' | 'ACCOUNT'
  lastUsedAt: string | null
  isDefault: boolean
}

const KEY = 'server-registry'

async function readAll(): Promise<ServerEntry[]> {
  const { value } = await Preferences.get({ key: KEY })
  if (!value) return []
  try {
    return JSON.parse(value) as ServerEntry[]
  } catch {
    return []
  }
}

async function writeAll(entries: ServerEntry[]): Promise<void> {
  await Preferences.set({ key: KEY, value: JSON.stringify(entries) })
}

export async function listServers(): Promise<ServerEntry[]> {
  const entries = await readAll()
  return entries.sort((a, b) => {
    if (a.lastUsedAt === b.lastUsedAt) return 0
    if (a.lastUsedAt === null) return 1
    if (b.lastUsedAt === null) return -1
    return b.lastUsedAt.localeCompare(a.lastUsedAt)
  })
}

export async function saveServer(
  entry: Omit<ServerEntry, 'id' | 'lastUsedAt' | 'isDefault'>,
): Promise<ServerEntry> {
  const entries = await readAll()
  const existing = entries.find(e => e.baseUrl === entry.baseUrl && e.familySlug === entry.familySlug)
  if (existing) {
    Object.assign(existing, entry)
    await writeAll(entries)
    return existing
  }
  const created: ServerEntry = {
    ...entry,
    id: crypto.randomUUID(),
    lastUsedAt: null,
    isDefault: entries.length === 0,
  }
  entries.push(created)
  await writeAll(entries)
  return created
}

export async function removeServer(id: string): Promise<void> {
  await writeAll((await readAll()).filter(e => e.id !== id))
}

export async function setDefaultServer(id: string): Promise<void> {
  const entries = await readAll()
  for (const e of entries) e.isDefault = e.id === id
  await writeAll(entries)
}

export async function getDefaultServer(): Promise<ServerEntry | null> {
  return (await readAll()).find(e => e.isDefault) ?? null
}

export async function touchServer(id: string): Promise<void> {
  const entries = await readAll()
  const entry = entries.find(e => e.id === id)
  if (entry) {
    entry.lastUsedAt = new Date().toISOString()
    await writeAll(entries)
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npm test server-registry` → expect 5 PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: server registry backed by Capacitor Preferences"
```

---

### Task 6: Credential vault with biometric gate

**Files:**
- Create: `src/services/credential-vault.ts`, `src/services/credential-vault.test.ts`

**Interfaces:**
- Consumes: `@capgo/capacitor-native-biometric` (install: `npm i @capgo/capacitor-native-biometric`). Vault logic is tested against an injected in-memory backend; the native backend is thin glue.
- Produces:
  ```ts
  export type StoredCredentials =
    | { type: 'pin'; loginId: string | null; securityPin: string }
    | { type: 'account'; email: string; password: string }
  export interface VaultBackend {
    get(key: string): Promise<string | null>
    set(key: string, value: string): Promise<void>
    delete(key: string): Promise<void>
    verifyIdentity(reason: string): Promise<boolean>  // raises OS biometric prompt on native
  }
  export class CredentialVault {
    constructor(backend: VaultBackend)
    store(serverId: string, creds: StoredCredentials, opts: { biometric: boolean }): Promise<void>
    retrieve(serverId: string): Promise<StoredCredentials | null>  // biometric-flagged entries verify first; failed/cancelled verify returns null
    clear(serverId: string): Promise<void>
    has(serverId: string): Promise<boolean>                        // does NOT trigger biometrics
  }
  export function createVault(): CredentialVault  // native backend on device, localStorage dev backend on web
  ```
  Storage format per entry: JSON `{ biometric: boolean, creds: StoredCredentials }` under key `sprout-creds:{serverId}`.

- [ ] **Step 1: Install and write the failing tests**

```bash
npm i @capgo/capacitor-native-biometric
```

`src/services/credential-vault.test.ts`:
```ts
import { expect, test, vi } from 'vitest'
import { CredentialVault, type StoredCredentials, type VaultBackend } from './credential-vault'

function memoryBackend(verifyResult = true): VaultBackend & { verify: ReturnType<typeof vi.fn> } {
  const store = new Map<string, string>()
  const verify = vi.fn().mockResolvedValue(verifyResult)
  return {
    get: async k => store.get(k) ?? null,
    set: async (k, v) => void store.set(k, v),
    delete: async k => void store.delete(k),
    verifyIdentity: verify,
    verify,
  }
}

const pinCreds: StoredCredentials = { type: 'pin', loginId: '01', securityPin: '123456' }

test('stores and retrieves credentials without biometrics', async () => {
  const backend = memoryBackend()
  const vault = new CredentialVault(backend)
  await vault.store('srv1', pinCreds, { biometric: false })
  await expect(vault.retrieve('srv1')).resolves.toEqual(pinCreds)
  expect(backend.verify).not.toHaveBeenCalled()
})

test('biometric-flagged entries verify identity before returning', async () => {
  const backend = memoryBackend(true)
  const vault = new CredentialVault(backend)
  await vault.store('srv1', pinCreds, { biometric: true })
  await expect(vault.retrieve('srv1')).resolves.toEqual(pinCreds)
  expect(backend.verify).toHaveBeenCalledOnce()
})

test('returns null when biometric verification fails', async () => {
  const backend = memoryBackend(false)
  const vault = new CredentialVault(backend)
  await vault.store('srv1', pinCreds, { biometric: true })
  await expect(vault.retrieve('srv1')).resolves.toBeNull()
})

test('has() reports presence without triggering biometrics', async () => {
  const backend = memoryBackend()
  const vault = new CredentialVault(backend)
  await expect(vault.has('srv1')).resolves.toBe(false)
  await vault.store('srv1', pinCreds, { biometric: true })
  await expect(vault.has('srv1')).resolves.toBe(true)
  expect(backend.verify).not.toHaveBeenCalled()
})

test('clear removes the entry', async () => {
  const backend = memoryBackend()
  const vault = new CredentialVault(backend)
  await vault.store('srv1', pinCreds, { biometric: false })
  await vault.clear('srv1')
  await expect(vault.retrieve('srv1')).resolves.toBeNull()
})
```

Run: `npm test credential-vault` → expect FAIL.

- [ ] **Step 2: Implement**

`src/services/credential-vault.ts`:
```ts
import { Capacitor } from '@capacitor/core'
import { NativeBiometric } from '@capgo/capacitor-native-biometric'

export type StoredCredentials =
  | { type: 'pin'; loginId: string | null; securityPin: string }
  | { type: 'account'; email: string; password: string }

export interface VaultBackend {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  verifyIdentity(reason: string): Promise<boolean>
}

interface VaultRecord { biometric: boolean; creds: StoredCredentials }

const keyFor = (serverId: string) => `sprout-creds:${serverId}`

export class CredentialVault {
  constructor(private backend: VaultBackend) {}

  async store(serverId: string, creds: StoredCredentials, opts: { biometric: boolean }): Promise<void> {
    const record: VaultRecord = { biometric: opts.biometric, creds }
    await this.backend.set(keyFor(serverId), JSON.stringify(record))
  }

  async retrieve(serverId: string): Promise<StoredCredentials | null> {
    const raw = await this.backend.get(keyFor(serverId))
    if (!raw) return null
    let record: VaultRecord
    try {
      record = JSON.parse(raw) as VaultRecord
    } catch {
      return null
    }
    if (record.biometric) {
      const ok = await this.backend.verifyIdentity('Unlock your Sprout Track family')
      if (!ok) return null
    }
    return record.creds
  }

  async has(serverId: string): Promise<boolean> {
    return (await this.backend.get(keyFor(serverId))) !== null
  }

  async clear(serverId: string): Promise<void> {
    await this.backend.delete(keyFor(serverId))
  }
}

/** Keychain/Keystore via NativeBiometric credential storage; server field namespaces the entry. */
function nativeBackend(): VaultBackend {
  return {
    async get(key) {
      try {
        const { password } = await NativeBiometric.getCredentials({ server: key })
        return password ?? null
      } catch {
        return null
      }
    },
    async set(key, value) {
      await NativeBiometric.setCredentials({ server: key, username: 'credentials', password: value })
    },
    async delete(key) {
      await NativeBiometric.deleteCredentials({ server: key })
    },
    async verifyIdentity(reason) {
      try {
        await NativeBiometric.verifyIdentity({ reason, title: 'Sprout Track' })
        return true
      } catch {
        return false
      }
    },
  }
}

/** Browser dev fallback ONLY — plaintext localStorage, never shipped as the native path. */
function webDevBackend(): VaultBackend {
  return {
    async get(key) { return localStorage.getItem(key) },
    async set(key, value) { localStorage.setItem(key, value) },
    async delete(key) { localStorage.removeItem(key) },
    async verifyIdentity() { return true },
  }
}

export function createVault(): CredentialVault {
  return new CredentialVault(Capacitor.isNativePlatform() ? nativeBackend() : webDevBackend())
}
```

- [ ] **Step 3: Run tests**

Run: `npm test credential-vault` → expect 5 PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: credential vault with biometric gate and native/web backends"
```

---

### Task 7: Session login service

**Files:**
- Create: `src/lib/api-client.ts`, `src/services/session.ts`, `src/services/session.test.ts`

**Interfaces:**
- Consumes: `ServerEntry` (Task 5), `StoredCredentials` (Task 6).
- Produces:
  ```ts
  // api-client.ts — native requests use CapacitorHttp (bypasses CORS, writes the shared
  // native cookie jar so the webview receives the refreshToken cookie); web uses fetch.
  export interface HttpResponse { status: number; body: unknown }
  export async function postJson(url: string, body: unknown): Promise<HttpResponse>

  // session.ts
  export type LoginResult =
    | { ok: true; token: string; familySlug: string }
    | { ok: false; error: 'invalid' | 'locked' | 'unreachable'; retryAfterSeconds?: number }
  export async function loginWithCredentials(
    entry: Pick<ServerEntry, 'id' | 'baseUrl' | 'familySlug'>,
    creds: StoredCredentials,
    post?: typeof postJson,
  ): Promise<LoginResult>
  ```
  Single-flight: concurrent calls for the same `entry.id` share one in-flight promise (protects the server's 3-attempt IP lockout). PIN creds → `POST {base}/api/auth` with `{ loginId?, securityPin, familySlug }` (omit `loginId` when null); account creds → `POST {base}/api/accounts/login` with `{ email, password }`. HTTP 429 → `locked`; 401/403 or `success: false` → `invalid`; network error → `unreachable`.

- [ ] **Step 1: Write the failing tests**

`src/services/session.test.ts`:
```ts
import { expect, test, vi } from 'vitest'
import { loginWithCredentials } from './session'
import type { HttpResponse } from '../lib/api-client'

const entry = { id: 'srv1', baseUrl: 'https://x.com', familySlug: 'smith-family' }
const ok = (token: string): HttpResponse => ({
  status: 200,
  body: { success: true, data: { token, familySlug: 'smith-family' } },
})

test('PIN login posts to /api/auth and returns the token', async () => {
  const post = vi.fn().mockResolvedValue(ok('jwt-123'))
  const result = await loginWithCredentials(entry, { type: 'pin', loginId: '01', securityPin: '123456' }, post)
  expect(result).toEqual({ ok: true, token: 'jwt-123', familySlug: 'smith-family' })
  expect(post).toHaveBeenCalledWith('https://x.com/api/auth',
    { loginId: '01', securityPin: '123456', familySlug: 'smith-family' })
})

test('SYSTEM pin login omits loginId', async () => {
  const post = vi.fn().mockResolvedValue(ok('jwt-123'))
  await loginWithCredentials(entry, { type: 'pin', loginId: null, securityPin: '123456' }, post)
  expect(post).toHaveBeenCalledWith('https://x.com/api/auth',
    { securityPin: '123456', familySlug: 'smith-family' })
})

test('account login posts to /api/accounts/login', async () => {
  const post = vi.fn().mockResolvedValue(ok('jwt-a'))
  await loginWithCredentials(entry, { type: 'account', email: 'a@b.com', password: 'pw' }, post)
  expect(post).toHaveBeenCalledWith('https://x.com/api/accounts/login', { email: 'a@b.com', password: 'pw' })
})

test('maps 429 to locked', async () => {
  const post = vi.fn().mockResolvedValue({ status: 429, body: { success: false } })
  const result = await loginWithCredentials(entry, { type: 'pin', loginId: null, securityPin: '1' }, post)
  expect(result).toEqual({ ok: false, error: 'locked', retryAfterSeconds: undefined })
})

test('maps 401 to invalid and network error to unreachable', async () => {
  const post401 = vi.fn().mockResolvedValue({ status: 401, body: { success: false } })
  expect((await loginWithCredentials(entry, { type: 'pin', loginId: null, securityPin: '1' }, post401)))
    .toEqual({ ok: false, error: 'invalid' })
  const postErr = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
  expect((await loginWithCredentials(entry, { type: 'pin', loginId: null, securityPin: '1' }, postErr)))
    .toEqual({ ok: false, error: 'unreachable' })
})

test('single-flights concurrent logins for the same server', async () => {
  let resolveFirst: (r: HttpResponse) => void
  const post = vi.fn().mockReturnValue(new Promise<HttpResponse>(r => { resolveFirst = r }))
  const p1 = loginWithCredentials(entry, { type: 'pin', loginId: null, securityPin: '1' }, post)
  const p2 = loginWithCredentials(entry, { type: 'pin', loginId: null, securityPin: '1' }, post)
  resolveFirst!(ok('jwt-1'))
  const [r1, r2] = await Promise.all([p1, p2])
  expect(post).toHaveBeenCalledOnce()
  expect(r1).toEqual(r2)
})
```

Run: `npm test src/services/session` → expect FAIL.

- [ ] **Step 2: Implement**

`src/lib/api-client.ts`:
```ts
import { Capacitor, CapacitorHttp } from '@capacitor/core'

export interface HttpResponse { status: number; body: unknown }

/**
 * POST JSON. On native platforms CapacitorHttp performs the request natively:
 * no CORS restrictions, and Set-Cookie responses land in the shared cookie jar
 * the webview uses — so a successful login seeds the refreshToken cookie for
 * the server origin.
 */
export async function postJson(url: string, body: unknown): Promise<HttpResponse> {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.post({
      url,
      headers: { 'Content-Type': 'application/json' },
      data: body,
    })
    return { status: res.status, body: res.data }
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  let parsed: unknown = null
  try {
    parsed = await res.json()
  } catch {
    parsed = null
  }
  return { status: res.status, body: parsed }
}
```

`src/services/session.ts`:
```ts
import { postJson } from '../lib/api-client'
import type { StoredCredentials } from './credential-vault'

export type LoginResult =
  | { ok: true; token: string; familySlug: string }
  | { ok: false; error: 'invalid' | 'locked' | 'unreachable'; retryAfterSeconds?: number }

interface LoginTarget { id: string; baseUrl: string; familySlug: string }

const inFlight = new Map<string, Promise<LoginResult>>()

export async function loginWithCredentials(
  entry: LoginTarget,
  creds: StoredCredentials,
  post: typeof postJson = postJson,
): Promise<LoginResult> {
  const existing = inFlight.get(entry.id)
  if (existing) return existing
  const promise = doLogin(entry, creds, post).finally(() => inFlight.delete(entry.id))
  inFlight.set(entry.id, promise)
  return promise
}

async function doLogin(entry: LoginTarget, creds: StoredCredentials, post: typeof postJson): Promise<LoginResult> {
  const [url, body] =
    creds.type === 'pin'
      ? [
          `${entry.baseUrl}/api/auth`,
          creds.loginId === null
            ? { securityPin: creds.securityPin, familySlug: entry.familySlug }
            : { loginId: creds.loginId, securityPin: creds.securityPin, familySlug: entry.familySlug },
        ]
      : [`${entry.baseUrl}/api/accounts/login`, { email: creds.email, password: creds.password }]

  let res: { status: number; body: unknown }
  try {
    res = await post(url, body)
  } catch {
    return { ok: false, error: 'unreachable' }
  }

  if (res.status === 429) {
    const remaining = (res.body as { data?: { remainingTime?: number } } | null)?.data?.remainingTime
    return { ok: false, error: 'locked', retryAfterSeconds: remaining }
  }

  const envelope = res.body as { success?: boolean; data?: { token?: string; familySlug?: string } } | null
  if (res.status !== 200 || !envelope?.success || !envelope.data?.token) {
    return { ok: false, error: 'invalid' }
  }
  return { ok: true, token: envelope.data.token, familySlug: envelope.data.familySlug ?? entry.familySlug }
}
```

- [ ] **Step 3: Run tests**

Run: `npm test src/services/session` → expect 6 PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: session login service with single-flight and native http client"
```

---

### Task 8: Welcome + AddServer screens (pairing flow)

**Files:**
- Create: `src/screens/AddServer.tsx`, `src/screens/AddServer.test.tsx`
- Modify: `src/App.tsx` (wire `add-server` to the real screen)

**Interfaces:**
- Consumes: `parseServerInput`, `probeDeployment`, `fetchFamilyBySlug`, `fetchAuthType`, `ProbeError` (Task 4); `saveServer` (Task 5); `createVault` (Task 6); `loginWithCredentials` (Task 7); `Screen` (Task 2).
- Produces: `AddServer` component with props:
  ```ts
  interface AddServerProps {
    navigate: (s: Screen) => void
    prefillBaseUrl?: string
    deps?: Partial<AddServerDeps>  // every service injectable for tests
  }
  interface AddServerDeps {
    probeDeployment: typeof probeDeployment
    fetchFamilyBySlug: typeof fetchFamilyBySlug
    fetchAuthType: typeof fetchAuthType
    saveServer: typeof saveServer
    login: typeof loginWithCredentials
    vault: CredentialVault
  }
  ```
  Flow (three phases held in local state): **1) locate** — URL (+ slug if not in URL) → probe instance → resolve family → auth type; **2) credentials** — PIN (+ 2-digit login ID when `CARETAKER`) or email/password when the server is SaaS and the user picks account login; **3) verify & save** — `login(...)`; on `ok` → `saveServer` + optional "Remember with biometrics" checkbox → `vault.store` → `navigate({ name: 'server-list' })`. Errors render inline: `unreachable` → "Can't reach this server", `not-sprout-track` → "That doesn't look like a Sprout Track server", `family-not-found` → "Family not found", `invalid` → "Login failed — check your PIN", `locked` → "Too many attempts — try again in a few minutes". An `http://` URL shows the one-time cleartext warning text: "This connection is not encrypted".

- [ ] **Step 1: Write the failing tests**

`src/screens/AddServer.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import AddServer from './AddServer'
import { CredentialVault, type VaultBackend } from '../services/credential-vault'
import { ProbeError } from '../services/server-probe'

function makeDeps(overrides: Record<string, unknown> = {}) {
  const backend: VaultBackend = {
    get: async () => null, set: vi.fn(async () => {}), delete: async () => {}, verifyIdentity: async () => true,
  }
  return {
    probeDeployment: vi.fn().mockResolvedValue({
      deploymentMode: 'selfhosted', enableAccounts: false, allowAccountRegistration: false,
    }),
    fetchFamilyBySlug: vi.fn().mockResolvedValue({ name: 'Smith Family', slug: 'smith-family', isActive: true }),
    fetchAuthType: vi.fn().mockResolvedValue('SYSTEM'),
    saveServer: vi.fn().mockResolvedValue({ id: 'srv1', isDefault: true }),
    login: vi.fn().mockResolvedValue({ ok: true, token: 'jwt', familySlug: 'smith-family' }),
    vault: new CredentialVault(backend),
    ...overrides,
  }
}

test('happy path: locate family, enter PIN, save, navigate to server list', async () => {
  const user = userEvent.setup()
  const deps = makeDeps()
  const navigate = vi.fn()
  render(<AddServer navigate={navigate} deps={deps} />)

  await user.type(screen.getByLabelText(/server address/i), 'https://myhost.com/smith-family')
  await user.click(screen.getByRole('button', { name: /find family/i }))
  expect(await screen.findByText(/smith family/i)).toBeInTheDocument()

  await user.type(screen.getByLabelText(/pin/i), '123456')
  await user.click(screen.getByRole('button', { name: /verify & save/i }))

  await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'server-list' }))
  expect(deps.saveServer).toHaveBeenCalledWith(expect.objectContaining({ familySlug: 'smith-family' }))
})

test('shows an error when the server is not Sprout Track', async () => {
  const user = userEvent.setup()
  const deps = makeDeps({ probeDeployment: vi.fn().mockRejectedValue(new ProbeError('not-sprout-track')) })
  render(<AddServer navigate={vi.fn()} deps={deps} />)
  await user.type(screen.getByLabelText(/server address/i), 'https://example.com/x')
  await user.click(screen.getByRole('button', { name: /find family/i }))
  expect(await screen.findByText(/doesn't look like a sprout track server/i)).toBeInTheDocument()
})

test('shows lockout message on 429', async () => {
  const user = userEvent.setup()
  const deps = makeDeps({ login: vi.fn().mockResolvedValue({ ok: false, error: 'locked' }) })
  render(<AddServer navigate={vi.fn()} deps={deps} />)
  await user.type(screen.getByLabelText(/server address/i), 'https://myhost.com/smith-family')
  await user.click(screen.getByRole('button', { name: /find family/i }))
  await screen.findByText(/smith family/i)
  await user.type(screen.getByLabelText(/pin/i), '123456')
  await user.click(screen.getByRole('button', { name: /verify & save/i }))
  expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument()
})

test('warns about unencrypted http servers', async () => {
  const user = userEvent.setup()
  render(<AddServer navigate={vi.fn()} deps={makeDeps()} />)
  await user.type(screen.getByLabelText(/server address/i), 'http://192.168.1.10:3000/smith-family')
  await user.click(screen.getByRole('button', { name: /find family/i }))
  expect(await screen.findByText(/not encrypted/i)).toBeInTheDocument()
})
```

Run: `npm test AddServer` → expect FAIL.

- [ ] **Step 2: Implement**

`src/screens/AddServer.tsx`:
```tsx
import { useState } from 'react'
import type { Screen } from '../App'
import { CredentialVault, createVault, type StoredCredentials } from '../services/credential-vault'
import {
  ProbeError, fetchAuthType, fetchFamilyBySlug, parseServerInput, probeDeployment,
  type AuthType, type DeploymentConfig, type PublicFamily,
} from '../services/server-probe'
import { saveServer } from '../services/server-registry'
import { loginWithCredentials } from '../services/session'

export interface AddServerDeps {
  probeDeployment: typeof probeDeployment
  fetchFamilyBySlug: typeof fetchFamilyBySlug
  fetchAuthType: typeof fetchAuthType
  saveServer: typeof saveServer
  login: typeof loginWithCredentials
  vault: CredentialVault
}

const defaultDeps = (): AddServerDeps => ({
  probeDeployment, fetchFamilyBySlug, fetchAuthType, saveServer,
  login: loginWithCredentials, vault: createVault(),
})

interface Located {
  baseUrl: string
  config: DeploymentConfig
  family: PublicFamily
  authType: AuthType
}

const ERROR_TEXT: Record<string, string> = {
  'invalid-url': 'Please enter a valid server address.',
  unreachable: "Can't reach this server. Check the address and your connection.",
  'not-sprout-track': "That doesn't look like a Sprout Track server.",
  'family-not-found': 'Family not found on this server.',
  invalid: 'Login failed — check your PIN.',
  locked: 'Too many attempts — try again in a few minutes.',
  'missing-slug': 'Add your family name to the address (e.g. myhost.com/smith-family).',
}

export default function AddServer({
  navigate, prefillBaseUrl, deps: depsOverride,
}: {
  navigate: (s: Screen) => void
  prefillBaseUrl?: string
  deps?: Partial<AddServerDeps>
}) {
  const [deps] = useState<AddServerDeps>(() => ({ ...defaultDeps(), ...depsOverride }))
  const [input, setInput] = useState(prefillBaseUrl ?? '')
  const [located, setLocated] = useState<Located | null>(null)
  const [useAccount, setUseAccount] = useState(false)
  const [loginId, setLoginId] = useState('')
  const [pin, setPin] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [biometric, setBiometric] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const cleartext = located?.baseUrl.startsWith('http://') ?? false

  async function locate() {
    setError(null)
    setBusy(true)
    try {
      const { baseUrl, familySlug } = parseServerInput(input)
      if (!familySlug) throw new Error('missing-slug')
      const config = await deps.probeDeployment(baseUrl)
      const family = await deps.fetchFamilyBySlug(baseUrl, familySlug)
      const authType = await deps.fetchAuthType(baseUrl, familySlug)
      setLocated({ baseUrl, config, family, authType })
    } catch (e) {
      const kind = e instanceof ProbeError ? e.kind : (e as Error).message
      setError(ERROR_TEXT[kind] ?? ERROR_TEXT.unreachable)
    } finally {
      setBusy(false)
    }
  }

  async function verifyAndSave() {
    if (!located) return
    setError(null)
    setBusy(true)
    try {
      const creds: StoredCredentials = useAccount
        ? { type: 'account', email, password }
        : { type: 'pin', loginId: located.authType === 'CARETAKER' ? loginId : null, securityPin: pin }
      const target = { id: `${located.baseUrl}|${located.family.slug}`, baseUrl: located.baseUrl, familySlug: located.family.slug }
      const result = await deps.login(target, creds)
      if (!result.ok) {
        setError(ERROR_TEXT[result.error])
        return
      }
      const saved = await deps.saveServer({
        baseUrl: located.baseUrl,
        familySlug: located.family.slug,
        familyName: located.family.name,
        deploymentMode: located.config.deploymentMode,
        authType: useAccount ? 'ACCOUNT' : located.authType,
      })
      await deps.vault.store(saved.id, creds, { biometric })
      navigate({ name: 'server-list' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Connect to a family</h1>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Server address
        <input
          className="rounded-lg border border-gray-300 p-3 dark:border-gray-600 dark:bg-gray-800"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="https://myhost.com/smith-family"
          autoCapitalize="none"
          autoCorrect="off"
        />
      </label>
      <button
        className="rounded-xl bg-gradient-to-r from-brand to-brand-emerald px-6 py-3 font-semibold text-white disabled:opacity-50"
        disabled={busy || input.trim() === ''}
        onClick={locate}
      >
        Find family
      </button>

      {located && (
        <section className="flex flex-col gap-3 rounded-xl border border-mint-border bg-mint p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="font-semibold text-brand-deep dark:text-dark-accent">{located.family.name}</p>
          {cleartext && <p className="text-sm text-amber-700">This connection is not encrypted.</p>}

          {located.config.enableAccounts && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useAccount} onChange={e => setUseAccount(e.target.checked)} />
              Sign in with my Sprout Track account
            </label>
          )}

          {useAccount ? (
            <>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Email
                <input className="rounded-lg border border-gray-300 p-3" type="email"
                  value={email} onChange={e => setEmail(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Password
                <input className="rounded-lg border border-gray-300 p-3" type="password"
                  value={password} onChange={e => setPassword(e.target.value)} />
              </label>
            </>
          ) : (
            <>
              {located.authType === 'CARETAKER' && (
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Login ID
                  <input className="rounded-lg border border-gray-300 p-3" inputMode="numeric" maxLength={2}
                    value={loginId} onChange={e => setLoginId(e.target.value)} />
                </label>
              )}
              <label className="flex flex-col gap-1 text-sm font-medium">
                PIN
                <input className="rounded-lg border border-gray-300 p-3" type="password" inputMode="numeric"
                  value={pin} onChange={e => setPin(e.target.value)} />
              </label>
            </>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={biometric} onChange={e => setBiometric(e.target.checked)} />
            Remember with Face ID / fingerprint
          </label>

          <button
            className="rounded-xl bg-gradient-to-r from-brand to-brand-emerald px-6 py-3 font-semibold text-white disabled:opacity-50"
            disabled={busy}
            onClick={verifyAndSave}
          >
            Verify &amp; save
          </button>
        </section>
      )}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button className="mt-auto text-sm text-gray-500" onClick={() => navigate({ name: 'welcome' })}>
        Back
      </button>
    </main>
  )
}
```

In `src/App.tsx`, replace the `add-server` placeholder line with:
```tsx
{screen.name === 'add-server' && <AddServer navigate={setScreen} prefillBaseUrl={screen.prefillBaseUrl} />}
```
and add `import AddServer from './screens/AddServer'`.

- [ ] **Step 3: Run tests**

Run: `npm test` → expect all PASS (including earlier suites).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add-server pairing screen with probe, login verify, and vault save"
```

---

### Task 9: ServerList + Offline screens and connect flow

**Files:**
- Create: `src/services/connect.ts`, `src/services/connect.test.ts`, `src/screens/Offline.tsx`
- Modify: `src/screens/ServerList.tsx` (replace placeholder), `src/App.tsx`
- Test: `src/screens/ServerList.test.tsx`

**Interfaces:**
- Consumes: registry (Task 5), vault (Task 6), session (Task 7), `Screen` (Task 2).
- Produces:
  ```ts
  // connect.ts
  export type ConnectOutcome = 'navigated' | 'needs-login' | 'offline' | 'locked'
  export interface ConnectDeps {
    vault: CredentialVault
    login: typeof loginWithCredentials
    touch: typeof touchServer
    clearCreds: (serverId: string) => Promise<void>
    openUrl: (url: string) => void   // default: window.location.assign
  }
  export async function connectToFamily(entry: ServerEntry, deps?: Partial<ConnectDeps>): Promise<ConnectOutcome>
  ```
  Behavior: `touch(entry.id)`; `vault.retrieve` → if creds present, `login(...)`: `ok` → `openUrl('{baseUrl}/{slug}/log-entry')`, return `'navigated'`; `invalid` → `clearCreds(entry.id)` then still `openUrl('{baseUrl}/{slug}')` (web login screen; v0 handoff), return `'needs-login'`; `locked` → return `'locked'` (no navigation); `unreachable` → return `'offline'`. No creds (or biometric declined) → `openUrl('{baseUrl}/{slug}')`, return `'needs-login'`.
- ServerList renders registry entries (name, host, default star), tap → `connectToFamily`; `'offline'` outcome → `navigate({ name: 'offline', retry })`; remove button per row (`removeServer` + `vault.clear`); "Add a family" → add-server; gear → settings. Offline screen shows retry + "switch family" buttons.

- [ ] **Step 1: Write the failing connect tests**

`src/services/connect.test.ts`:
```ts
import { expect, test, vi } from 'vitest'
import { connectToFamily } from './connect'
import { CredentialVault, type VaultBackend } from './credential-vault'
import type { ServerEntry } from './server-registry'

const entry: ServerEntry = {
  id: 'srv1', baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith',
  deploymentMode: 'selfhosted', authType: 'SYSTEM', lastUsedAt: null, isDefault: true,
}

function vaultWith(creds: unknown): CredentialVault {
  const backend: VaultBackend = {
    get: async () => (creds ? JSON.stringify({ biometric: false, creds }) : null),
    set: async () => {}, delete: async () => {}, verifyIdentity: async () => true,
  }
  return new CredentialVault(backend)
}

test('with stored creds and a live server: logs in and opens log-entry', async () => {
  const openUrl = vi.fn()
  const outcome = await connectToFamily(entry, {
    vault: vaultWith({ type: 'pin', loginId: null, securityPin: '123456' }),
    login: vi.fn().mockResolvedValue({ ok: true, token: 'jwt', familySlug: 'smith-family' }),
    touch: vi.fn(), clearCreds: vi.fn(), openUrl,
  })
  expect(outcome).toBe('navigated')
  expect(openUrl).toHaveBeenCalledWith('https://x.com/smith-family/log-entry')
})

test('without creds: opens the family page for web login', async () => {
  const openUrl = vi.fn()
  const outcome = await connectToFamily(entry, {
    vault: vaultWith(null), login: vi.fn(), touch: vi.fn(), clearCreds: vi.fn(), openUrl,
  })
  expect(outcome).toBe('needs-login')
  expect(openUrl).toHaveBeenCalledWith('https://x.com/smith-family')
})

test('invalid stored creds are cleared, then web login opens', async () => {
  const openUrl = vi.fn()
  const clearCreds = vi.fn()
  const outcome = await connectToFamily(entry, {
    vault: vaultWith({ type: 'pin', loginId: null, securityPin: 'wrong' }),
    login: vi.fn().mockResolvedValue({ ok: false, error: 'invalid' }),
    touch: vi.fn(), clearCreds, openUrl,
  })
  expect(outcome).toBe('needs-login')
  expect(clearCreds).toHaveBeenCalledWith('srv1')
  expect(openUrl).toHaveBeenCalledWith('https://x.com/smith-family')
})

test('unreachable server returns offline without navigating', async () => {
  const openUrl = vi.fn()
  const outcome = await connectToFamily(entry, {
    vault: vaultWith({ type: 'pin', loginId: null, securityPin: '1' }),
    login: vi.fn().mockResolvedValue({ ok: false, error: 'unreachable' }),
    touch: vi.fn(), clearCreds: vi.fn(), openUrl,
  })
  expect(outcome).toBe('offline')
  expect(openUrl).not.toHaveBeenCalled()
})

test('lockout returns locked without navigating or clearing creds', async () => {
  const openUrl = vi.fn()
  const clearCreds = vi.fn()
  const outcome = await connectToFamily(entry, {
    vault: vaultWith({ type: 'pin', loginId: null, securityPin: '1' }),
    login: vi.fn().mockResolvedValue({ ok: false, error: 'locked' }),
    touch: vi.fn(), clearCreds, openUrl,
  })
  expect(outcome).toBe('locked')
  expect(openUrl).not.toHaveBeenCalled()
  expect(clearCreds).not.toHaveBeenCalled()
})
```

Run: `npm test connect` → expect FAIL.

- [ ] **Step 2: Implement connect.ts**

`src/services/connect.ts`:
```ts
import { CredentialVault, createVault } from './credential-vault'
import { loginWithCredentials } from './session'
import { touchServer, type ServerEntry } from './server-registry'

export type ConnectOutcome = 'navigated' | 'needs-login' | 'offline' | 'locked'

export interface ConnectDeps {
  vault: CredentialVault
  login: typeof loginWithCredentials
  touch: typeof touchServer
  clearCreds: (serverId: string) => Promise<void>
  openUrl: (url: string) => void
}

export async function connectToFamily(
  entry: ServerEntry,
  depsOverride: Partial<ConnectDeps> = {},
): Promise<ConnectOutcome> {
  const vault = depsOverride.vault ?? createVault()
  const deps: ConnectDeps = {
    vault,
    login: loginWithCredentials,
    touch: touchServer,
    clearCreds: id => vault.clear(id),
    openUrl: url => window.location.assign(url),
    ...depsOverride,
  }

  await deps.touch(entry.id)
  const familyUrl = `${entry.baseUrl}/${entry.familySlug}`
  const creds = await deps.vault.retrieve(entry.id)
  if (!creds) {
    deps.openUrl(familyUrl)
    return 'needs-login'
  }
  const result = await deps.login(entry, creds)
  if (result.ok) {
    deps.openUrl(`${familyUrl}/log-entry`)
    return 'navigated'
  }
  if (result.error === 'unreachable') return 'offline'
  if (result.error === 'locked') return 'locked'
  await deps.clearCreds(entry.id)
  deps.openUrl(familyUrl)
  return 'needs-login'
}
```

Run: `npm test connect` → expect 5 PASS.

- [ ] **Step 3: Write the failing ServerList test**

`src/screens/ServerList.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import ServerList from './ServerList'
import { saveServer } from '../services/server-registry'

beforeEach(() => localStorage.clear())

test('lists saved families and connects on tap', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  const connect = vi.fn().mockResolvedValue('navigated')
  const user = userEvent.setup()
  render(<ServerList navigate={vi.fn()} connect={connect} />)
  await user.click(await screen.findByRole('button', { name: /smith family/i }))
  await waitFor(() => expect(connect).toHaveBeenCalledWith(expect.objectContaining({ familySlug: 'smith-family' })))
})

test('offline outcome navigates to the offline screen', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  const navigate = vi.fn()
  const user = userEvent.setup()
  render(<ServerList navigate={navigate} connect={vi.fn().mockResolvedValue('offline')} />)
  await user.click(await screen.findByRole('button', { name: /smith family/i }))
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ name: 'offline' })))
})
```

Run: `npm test ServerList` → expect FAIL.

- [ ] **Step 4: Implement ServerList and Offline**

Replace `src/screens/ServerList.tsx`:
```tsx
import { useEffect, useState } from 'react'
import type { Screen } from '../App'
import { connectToFamily, type ConnectOutcome } from '../services/connect'
import { createVault } from '../services/credential-vault'
import { listServers, removeServer, type ServerEntry } from '../services/server-registry'

export default function ServerList({
  navigate,
  connect = connectToFamily,
}: {
  navigate: (s: Screen) => void
  connect?: (entry: ServerEntry) => Promise<ConnectOutcome>
}) {
  const [servers, setServers] = useState<ServerEntry[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  const reload = () => { void listServers().then(setServers) }
  useEffect(reload, [])

  async function open(entry: ServerEntry) {
    setNotice(null)
    const outcome = await connect(entry)
    if (outcome === 'offline') navigate({ name: 'offline', retry: () => void open(entry) })
    if (outcome === 'locked') setNotice('Too many attempts — try again in a few minutes.')
  }

  async function remove(entry: ServerEntry) {
    await removeServer(entry.id)
    await createVault().clear(entry.id)
    reload()
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Families</h1>
        <button aria-label="Settings" className="text-gray-500" onClick={() => navigate({ name: 'settings' })}>
          ⚙︎
        </button>
      </div>

      {servers.map(entry => (
        <div key={entry.id} className="flex items-center gap-2">
          <button
            className="flex-1 rounded-xl border border-gray-200 bg-cream p-4 text-left dark:border-gray-700 dark:bg-gray-800"
            onClick={() => void open(entry)}
          >
            <span className="block font-semibold">
              {entry.familyName} {entry.isDefault && <span aria-label="default">★</span>}
            </span>
            <span className="block text-sm text-gray-500">{new URL(entry.baseUrl).host}</span>
          </button>
          <button aria-label={`Remove ${entry.familyName}`} className="p-2 text-gray-400"
            onClick={() => void remove(entry)}>
            ✕
          </button>
        </div>
      ))}

      {notice && <p role="alert" className="text-sm text-red-600">{notice}</p>}

      <button
        className="mt-2 rounded-xl bg-gradient-to-r from-brand to-brand-emerald px-6 py-3 font-semibold text-white"
        onClick={() => navigate({ name: 'add-server' })}
      >
        Add a family
      </button>
    </main>
  )
}
```

`src/screens/Offline.tsx`:
```tsx
import type { Screen } from '../App'

export default function Offline({ navigate, retry }: { navigate: (s: Screen) => void; retry: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">Can't reach the server</h1>
      <p className="text-gray-500">Check your connection and try again.</p>
      <button
        className="rounded-xl bg-gradient-to-r from-brand to-brand-emerald px-6 py-3 font-semibold text-white"
        onClick={retry}
      >
        Retry
      </button>
      <button className="text-brand" onClick={() => navigate({ name: 'server-list' })}>
        Switch family
      </button>
    </main>
  )
}
```

In `src/App.tsx`: import `Offline`, replace the `offline` placeholder with
```tsx
{screen.name === 'offline' && <Offline navigate={setScreen} retry={screen.retry} />}
```
and add launch routing — replace the `useState` initializer block so the app boots to the right screen:
```tsx
const [screen, setScreen] = useState<Screen>({ name: 'welcome' })
useEffect(() => {
  void listServers().then(servers => {
    if (servers.length > 0) setScreen({ name: 'server-list' })
  })
}, [])
```
(with `import { useEffect, useState } from 'react'` and `import { listServers } from './services/server-registry'`).

- [ ] **Step 5: Run all tests**

Run: `npm test` → expect all PASS. (The App test from Task 1/2 still passes because an empty registry keeps the Welcome screen.)

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: server list, connect flow with v0 session handoff, offline screen"
```

---

### Task 10: Settings screen and default-family fast path

**Files:**
- Create: `src/screens/Settings.tsx`, `src/screens/Settings.test.tsx`
- Modify: `src/App.tsx`, `src/screens/ServerList.tsx` (long-press substitute: a "make default" star button per row)

**Interfaces:**
- Consumes: registry (Task 5), vault (Task 6), `connectToFamily` (Task 9).
- Produces: Settings screen with: auto-open default family toggle (Preferences key `auto-open-default`, default `true`), "Clear all data" button (wipes registry entries + vault entries + Preferences), app version line. App launch behavior: if a default server exists AND `auto-open-default` is enabled, `connectToFamily(default)` immediately (the vault's biometric prompt is the unlock gate); otherwise show `server-list`.

- [ ] **Step 1: Write the failing tests**

`src/screens/Settings.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import Settings from './Settings'
import { listServers, saveServer } from '../services/server-registry'

beforeEach(() => localStorage.clear())

test('clear all data wipes the registry', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 's', familyName: 'S',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  const user = userEvent.setup()
  render(<Settings navigate={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: /clear all data/i }))
  await user.click(screen.getByRole('button', { name: /yes, clear everything/i }))
  await waitFor(async () => expect(await listServers()).toHaveLength(0))
})

test('auto-open toggle persists', async () => {
  const user = userEvent.setup()
  render(<Settings navigate={vi.fn()} />)
  const toggle = await screen.findByRole('checkbox', { name: /open my family automatically/i })
  expect(toggle).toBeChecked()
  await user.click(toggle)
  render(<Settings navigate={vi.fn()} />)
  await waitFor(async () => {
    const toggles = await screen.findAllByRole('checkbox', { name: /open my family automatically/i })
    expect(toggles[toggles.length - 1]).not.toBeChecked()
  })
})
```

Run: `npm test Settings` → expect FAIL.

- [ ] **Step 2: Implement**

`src/screens/Settings.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { Preferences } from '@capacitor/preferences'
import type { Screen } from '../App'
import { createVault } from '../services/credential-vault'
import { listServers } from '../services/server-registry'

export const AUTO_OPEN_KEY = 'auto-open-default'

export async function isAutoOpenEnabled(): Promise<boolean> {
  const { value } = await Preferences.get({ key: AUTO_OPEN_KEY })
  return value !== 'false'
}

export default function Settings({ navigate }: { navigate: (s: Screen) => void }) {
  const [autoOpen, setAutoOpen] = useState(true)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => { void isAutoOpenEnabled().then(setAutoOpen) }, [])

  async function toggleAutoOpen(next: boolean) {
    setAutoOpen(next)
    await Preferences.set({ key: AUTO_OPEN_KEY, value: String(next) })
  }

  async function clearAll() {
    const vault = createVault()
    for (const entry of await listServers()) await vault.clear(entry.id)
    await Preferences.clear()
    setConfirming(false)
    navigate({ name: 'welcome' })
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <label className="flex items-center justify-between gap-4">
        <span>Open my family automatically</span>
        <input type="checkbox" checked={autoOpen} onChange={e => void toggleAutoOpen(e.target.checked)} />
      </label>

      {confirming ? (
        <div className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-4 dark:bg-red-950">
          <p className="text-sm">This removes every saved family and credential from this device.</p>
          <button className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white" onClick={() => void clearAll()}>
            Yes, clear everything
          </button>
          <button className="text-sm text-gray-500" onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      ) : (
        <button className="rounded-xl border border-red-300 px-6 py-3 font-semibold text-red-600"
          onClick={() => setConfirming(true)}>
          Clear all data
        </button>
      )}

      <p className="mt-auto text-center text-xs text-gray-400">Sprout Track Mobile v0.1.0</p>
      <button className="text-sm text-gray-500" onClick={() => navigate({ name: 'server-list' })}>Back</button>
    </main>
  )
}
```

In `src/App.tsx`: import `Settings`, `isAutoOpenEnabled`, `getDefaultServer`, and `connectToFamily`; replace the `settings` placeholder with `<Settings navigate={setScreen} />`; extend the launch `useEffect`:
```tsx
useEffect(() => {
  void (async () => {
    const servers = await listServers()
    if (servers.length === 0) return
    const fallback = () => setScreen({ name: 'server-list' })
    const def = await getDefaultServer()
    if (def && (await isAutoOpenEnabled())) {
      const outcome = await connectToFamily(def)
      if (outcome === 'offline') setScreen({ name: 'offline', retry: () => void connectToFamily(def) })
      else if (outcome !== 'navigated') fallback()
    } else {
      fallback()
    }
  })()
}, [])
```
In `src/screens/ServerList.tsx`, add a star button per row after the remove button:
```tsx
<button aria-label={`Make ${entry.familyName} default`} className="p-2 text-gray-400"
  onClick={() => void setDefaultServer(entry.id).then(reload)}>
  {entry.isDefault ? '★' : '☆'}
</button>
```
(with `setDefaultServer` added to the registry import).

- [ ] **Step 3: Run all tests**

Run: `npm test` → expect all PASS. If the App boot test now flakes because of the async launch effect, keep the assertion `getByTestId('app-root')` (synchronous) — the Welcome-text test remains valid for an empty registry because the effect early-returns.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: settings screen, auto-open default family fast path"
```

---

### Task 11: Capacitor config, Android platform, app assets, README

**Files:**
- Create: `capacitor.config.ts`, `resources/icon-only.png`, `resources/splash.png`, `README.md` (replace stub), `android/` (generated)
- Modify: `package.json` (cap scripts), `.gitignore`

**Interfaces:**
- Consumes: the built shell (`dist/`).
- Produces: `npx cap sync android` succeeds; icons/splash generated from the sprout logo; README documents dev workflow and iOS prerequisites.

- [ ] **Step 1: Install Capacitor platform tooling and remaining plugins**

```bash
npm i @capacitor/cli @capacitor/android @capacitor/app @capacitor/network @capacitor/status-bar @capacitor/splash-screen
npm i -D @capacitor/assets
```

- [ ] **Step 2: Write capacitor.config.ts**

```ts
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.sprouttrack.app',
  appName: 'Sprout Track',
  webDir: 'dist',
  server: {
    // Spec §2/§10-risk-3: user-entered self-hosted servers must load in the same
    // webview with the bridge available. Validated by the bridge spike.
    allowNavigation: ['*'],
    // LAN self-hosts may be plain http (spec §3); shell shows a cleartext warning.
    cleartext: true,
  },
  android: {
    allowMixedContent: false,
  },
}

export default config
```

- [ ] **Step 3: Generate assets and add the Android platform**

```bash
cp /Users/johnoverton/Development/docker_builds/sprout-track_old/public/sprout-1024.png resources/icon-only.png
cp /Users/johnoverton/Development/docker_builds/sprout-track_old/public/sprout-1024.png resources/splash.png
npm run build
npx cap add android
npx @capacitor/assets generate --android --iconBackgroundColor '#ffffff' --iconBackgroundColorDark '#111827' --splashBackgroundColor '#0d9488' --splashBackgroundColorDark '#111827'
npx cap sync android
```

Expected: `android/` directory created; `cap sync android` reports the web assets copied and plugins found (`@capacitor/preferences`, `@capacitor/app`, `@capacitor/network`, `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capgo/capacitor-native-biometric`).

Add npm scripts:
```bash
npm pkg set scripts.sync="npm run build && npx cap sync" scripts.android="npx cap run android"
```

Android cleartext: edit `android/app/src/main/AndroidManifest.xml`, add `android:usesCleartextTraffic="true"` to the `<application>` element.

- [ ] **Step 4: Write the README**

Replace `README.md`:
```markdown
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
```

- [ ] **Step 5: Verify build + tests still pass**

Run: `npm test && npm run build` → expect PASS / clean build.
Run: `ls android/app/src/main/assets/public/index.html` → expect the file to exist (web assets synced).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: capacitor config, android platform, app assets, README"
```

---

## Out of Scope (follow-up plans)

- **Sprout-track repo native-aware layer** (spec §5): bridge consumer module, keep-awake swap, camera capture, logout events, side-nav "Switch family", SW suppression — plus silent session injection replacing the v0 handoff.
- **Push notifications** (spec §7): `DeviceToken` table, `/api/notifications/device-token`, FCM send path, `@capacitor/push-notifications` wiring.
- **Bridge spike on-device validation** (spec §10 risk 3) and iOS platform generation (needs Xcode/CocoaPods).
- Playwright + Docker integration tests against a real Sprout Track instance (spec §9).
