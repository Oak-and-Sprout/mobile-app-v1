# Native Push, Deep Links, and Nursery Wake — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the native app build — working push notifications on iOS and Android, Universal/App Links, an in-app password reset screen, and automatic screen-wake in nursery mode.

**Architecture:** Push splits by platform — FCM HTTP v1 for Android, direct APNs HTTP/2 for iOS — behind one `nativePush.ts` dispatcher that owns the existing token lifecycle. The Capacitor shell (not the web app) owns push permission, token acquisition, and registration, using the JWT it already holds at connect time. Nursery keep-awake and immersive mode are driven from native code observing the WebView URL, because the shell's JS is not running once the WebView is on the remote server.

**Tech Stack:** Capacitor 8 (Vite + React 19 + TS), Next.js 16 + Prisma, vitest on both sides, `node:http2` + `jsonwebtoken` for APNs, `@capacitor/push-notifications`, `@capacitor/app`.

**Spec:** `docs/superpowers/specs/2026-07-25-native-push-and-nursery-wake-design.md`

---

## ⚠️ Nested git repo — read before ANY commit

`sprout-track/` is a **separate git clone**. Its working branch is
`feature/native-aware-layer` (PR #234). **Never commit to its `main`.** Bash cwd
persists between calls and a commit has already landed in the wrong repo once.

**Before every commit, run and confirm both:**

```bash
git rev-parse --show-toplevel   # which repo am I in?
git branch --show-current       # which branch?
```

- Outer repo `mobile-app-v1` → branch `feature/native-push-and-deep-links`
- Inner repo `sprout-track` → branch `feature/native-aware-layer`

**Every subagent prompt must carry this guard verbatim.**

---

## Global Constraints

- **The native-aware invariant:** every native-aware branch is gated on shell UA
  detection and **must no-op in a normal browser**. Web users see no behavior
  change.
- **Never read `isNativeApp()` inline during render** — it depends on
  `navigator`, so it is `false` during SSR and `true` after hydration. Read it in
  a `useEffect` into state.
- **`sprout-track/src/utils/bridge-contract.ts` is vendored — do not edit it.**
  No task in this plan changes the bridge contract.
- **All user-facing strings in `sprout-track` go through `t()`**, then run
  `node scripts/check-missing-translations.js` (11 locales). Shell strings are
  plain English — the shell has no localization layer.
- **No Tailwind `dark:` classes in `sprout-track`** — dark mode is `html.dark`
  CSS in plain `.css` files.
- **Prisma must stay SQLite *and* Postgres compatible.**
- **Family scoping golden rule:** ownership comes only from `authContext`. The
  single scoped exception is `DELETE /device-tokens` (spec D7), which is
  unauthenticated by design and gated on native push being configured.
- **Tests:** `sprout-track` → `tests/*.test.ts`, node env, `@/` alias. Shell →
  colocated `*.test.ts(x)`, jsdom, `globals: true`.
- **Baselines that must stay green:** `sprout-track` 706 tests, shell 122 tests.
- **Shell copy uses typographic punctuation** — `&rsquo;` for apostrophes,
  ` - ` (spaced hyphen) where existing screens use it. Match neighbouring files.
- **Never delete a device token on a transient failure.** Only a definitive
  "this token is dead" response (FCM `UNREGISTERED`, APNs `410 Unregistered`).

---

## Phase A — Server transports (`sprout-track`)

### Task 1: APNs send module

**Files:**
- Create: `sprout-track/src/lib/notifications/apnsPush.ts`
- Create: `sprout-track/tests/apns-push.test.ts`

**Interfaces:**
- Consumes: `NotificationPayload` from `src/lib/notifications/push.ts`
- Produces:
  - `interface ApnsConfig { authKey: string; keyId: string; teamId: string; bundleId: string; production: boolean }`
  - `loadApnsConfig(env?: NodeJS.ProcessEnv): ApnsConfig | null`
  - `isApnsConfigured(): boolean`
  - `buildApnsJwtClaims(config: ApnsConfig, nowSeconds: number): { iss: string; iat: number }`
  - `buildApnsRequest(token: string, payload: NotificationPayload, config: ApnsConfig): { path: string; headers: Record<string, string>; body: string }`
  - `classifyApnsResponse(status: number, body: string): { success: boolean; unregistered: boolean }`
  - `sendOne(token: string, payload: NotificationPayload): Promise<{ success: boolean; unregistered: boolean }>`

- [ ] **Step 1: Write the failing tests**

Create `sprout-track/tests/apns-push.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  loadApnsConfig,
  buildApnsJwtClaims,
  buildApnsRequest,
  classifyApnsResponse,
} from '@/src/lib/notifications/apnsPush';

const ENV = {
  APNS_AUTH_KEY: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
  APNS_KEY_ID: 'ABC1234567',
  APNS_TEAM_ID: 'TEAM123456',
  APNS_BUNDLE_ID: 'com.sprouttrack.app',
  APNS_PRODUCTION: 'true',
} as unknown as NodeJS.ProcessEnv;

const CONFIG = loadApnsConfig(ENV)!;

describe('loadApnsConfig', () => {
  it('returns null when unconfigured', () => {
    expect(loadApnsConfig({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it('returns null when any field is missing', () => {
    const partial = { ...ENV, APNS_KEY_ID: undefined } as unknown as NodeJS.ProcessEnv;
    expect(loadApnsConfig(partial)).toBeNull();
  });

  it('parses a complete configuration', () => {
    expect(CONFIG.keyId).toBe('ABC1234567');
    expect(CONFIG.teamId).toBe('TEAM123456');
    expect(CONFIG.bundleId).toBe('com.sprouttrack.app');
    expect(CONFIG.production).toBe(true);
  });

  it('defaults production to false when the flag is absent', () => {
    const sandbox = { ...ENV, APNS_PRODUCTION: undefined } as unknown as NodeJS.ProcessEnv;
    expect(loadApnsConfig(sandbox)!.production).toBe(false);
  });
});

describe('buildApnsJwtClaims', () => {
  it('issues from the team id and stamps iat', () => {
    expect(buildApnsJwtClaims(CONFIG, 1_700_000_000)).toEqual({
      iss: 'TEAM123456',
      iat: 1_700_000_000,
    });
  });
});

describe('buildApnsRequest', () => {
  const payload = { title: 'Feed due', body: 'Emma is due for a feed' };

  it('targets the device path and sets the topic', () => {
    const req = buildApnsRequest('devtoken', payload, CONFIG);
    expect(req.path).toBe('/3/device/devtoken');
    expect(req.headers['apns-topic']).toBe('com.sprouttrack.app');
    expect(req.headers['apns-push-type']).toBe('alert');
    expect(req.headers['apns-priority']).toBe('10');
  });

  it('omits the collapse header when there is no tag', () => {
    const req = buildApnsRequest('devtoken', payload, CONFIG);
    expect(req.headers['apns-collapse-id']).toBeUndefined();
  });

  it('sets the collapse header from the tag', () => {
    const req = buildApnsRequest('devtoken', { ...payload, tag: 'feed-timer' }, CONFIG);
    expect(req.headers['apns-collapse-id']).toBe('feed-timer');
  });

  it('builds an aps alert and stringifies data values', () => {
    const req = buildApnsRequest('devtoken', { ...payload, data: { babyId: 42 } }, CONFIG);
    const parsed = JSON.parse(req.body);
    expect(parsed.aps.alert).toEqual({ title: 'Feed due', body: 'Emma is due for a feed' });
    expect(parsed.aps.sound).toBe('default');
    expect(parsed.babyId).toBe('42');
  });
});

describe('classifyApnsResponse', () => {
  it('treats 200 as success', () => {
    expect(classifyApnsResponse(200, '')).toEqual({ success: true, unregistered: false });
  });

  it('treats 410 Unregistered as a dead token', () => {
    expect(classifyApnsResponse(410, '{"reason":"Unregistered"}')).toEqual({
      success: false,
      unregistered: true,
    });
  });

  it('does NOT delete on BadDeviceToken — usually an environment mismatch', () => {
    expect(classifyApnsResponse(400, '{"reason":"BadDeviceToken"}')).toEqual({
      success: false,
      unregistered: false,
    });
  });

  it('treats 500 as transient', () => {
    expect(classifyApnsResponse(500, 'InternalServerError')).toEqual({
      success: false,
      unregistered: false,
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /Users/johnoverton/Development/mobile-app-v1/sprout-track && npx vitest run tests/apns-push.test.ts
```

Expected: FAIL — cannot resolve `@/src/lib/notifications/apnsPush`.

- [ ] **Step 3: Implement the module**

Create `sprout-track/src/lib/notifications/apnsPush.ts`:

```ts
/**
 * Native push for iOS: APNs HTTP/2, called directly. Sits beside fcmPush.ts
 * (Android) under the nativePush.ts dispatcher. Configured via APNS_* env vars;
 * unconfigured deployments no-op. No Firebase involvement on this path.
 */

import http2 from 'node:http2';
import jwt from 'jsonwebtoken';
import type { NotificationPayload } from './push';

export interface ApnsConfig {
  authKey: string;
  keyId: string;
  teamId: string;
  bundleId: string;
  production: boolean;
}

export function loadApnsConfig(env: NodeJS.ProcessEnv = process.env): ApnsConfig | null {
  const authKey = env.APNS_AUTH_KEY;
  const keyId = env.APNS_KEY_ID;
  const teamId = env.APNS_TEAM_ID;
  const bundleId = env.APNS_BUNDLE_ID;
  if (!authKey || !keyId || !teamId || !bundleId) return null;
  return {
    authKey: authKey.replace(/\\n/g, '\n'),
    keyId,
    teamId,
    bundleId,
    production: env.APNS_PRODUCTION === 'true',
  };
}

export function isApnsConfigured(): boolean {
  return loadApnsConfig() !== null;
}

export function buildApnsJwtClaims(config: ApnsConfig, nowSeconds: number): { iss: string; iat: number } {
  return { iss: config.teamId, iat: nowSeconds };
}

export function buildApnsRequest(
  token: string,
  payload: NotificationPayload,
  config: ApnsConfig
): { path: string; headers: Record<string, string>; body: string } {
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload.data ?? {})) {
    data[key] = String(value);
  }
  const headers: Record<string, string> = {
    'apns-topic': config.bundleId,
    'apns-push-type': 'alert',
    'apns-priority': '10',
  };
  if (payload.tag) headers['apns-collapse-id'] = payload.tag;
  return {
    path: `/3/device/${token}`,
    headers,
    body: JSON.stringify({
      aps: { alert: { title: payload.title, body: payload.body }, sound: 'default' },
      ...data,
    }),
  };
}

export function classifyApnsResponse(
  status: number,
  body: string
): { success: boolean; unregistered: boolean } {
  if (status === 200) return { success: true, unregistered: false };
  // Only a definitive "this token is dead" deletes it. BadDeviceToken is far more
  // often a sandbox/production mismatch (see APNS_PRODUCTION) than a gone device.
  const unregistered = status === 410 && body.includes('Unregistered');
  return { success: false, unregistered };
}

// Apple rejects provider tokens refreshed more often than once per 20 minutes,
// so this cache is required, not an optimization.
const TOKEN_TTL_MS = 45 * 60 * 1000;
let cachedProviderToken: { token: string; issuedAt: number } | null = null;

function providerToken(config: ApnsConfig): string {
  const now = Date.now();
  if (cachedProviderToken && now - cachedProviderToken.issuedAt < TOKEN_TTL_MS) {
    return cachedProviderToken.token;
  }
  const token = jwt.sign(buildApnsJwtClaims(config, Math.floor(now / 1000)), config.authKey, {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: config.keyId },
  });
  cachedProviderToken = { token, issuedAt: now };
  return token;
}

export async function sendOne(
  token: string,
  payload: NotificationPayload
): Promise<{ success: boolean; unregistered: boolean }> {
  const config = loadApnsConfig();
  if (!config) return { success: false, unregistered: false };

  const host = config.production ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com';
  const { path, headers, body } = buildApnsRequest(token, payload, config);

  return new Promise((resolve) => {
    const client = http2.connect(host);
    client.on('error', () => {
      client.close();
      resolve({ success: false, unregistered: false });
    });

    const req = client.request({
      ':method': 'POST',
      ':path': path,
      authorization: `bearer ${providerToken(config)}`,
      ...headers,
    });

    let status = 0;
    let responseBody = '';
    req.on('response', (h) => {
      status = Number(h[':status'] ?? 0);
    });
    req.on('data', (chunk) => {
      responseBody += chunk;
    });
    req.on('error', () => {
      client.close();
      resolve({ success: false, unregistered: false });
    });
    req.on('end', () => {
      client.close();
      const result = classifyApnsResponse(status, responseBody);
      if (!result.success) {
        console.error(`[APNs] send failed (${status}): ${responseBody.slice(0, 300)}`);
      }
      resolve(result);
    });

    req.end(body);
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd /Users/johnoverton/Development/mobile-app-v1/sprout-track && npx vitest run tests/apns-push.test.ts
```

Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/johnoverton/Development/mobile-app-v1/sprout-track
git rev-parse --show-toplevel && git branch --show-current   # MUST be sprout-track / feature/native-aware-layer
git add src/lib/notifications/apnsPush.ts tests/apns-push.test.ts
git commit -m "feat(push): APNs HTTP/2 send module for iOS device tokens"
```

---

### Task 2: Dispatcher and `fcmPush` reduction

**Files:**
- Create: `sprout-track/src/lib/notifications/nativePush.ts`
- Create: `sprout-track/tests/native-push-dispatch.test.ts`
- Modify: `sprout-track/src/lib/notifications/fcmPush.ts` (remove `sendToDeviceTokens`, export `sendOne`)
- Modify: `sprout-track/src/lib/notifications/activityHook.ts` (import site)
- Modify: `sprout-track/src/lib/notifications/timerCheck.ts` (two import sites)

**Interfaces:**
- Consumes: `sendOne` from `apnsPush.ts` (Task 1) and from `fcmPush.ts`
- Produces:
  - `interface SendOutcome { success: boolean; unregistered: boolean }`
  - `sendToDeviceTokens(target: { familyId: string; caretakerId?: string | null; accountId?: string | null }, payload: NotificationPayload, deps?: NativePushDeps): Promise<number>`
  - `interface NativePushDeps { sendFcm; sendApns; findTokens; onSuccess; onFailure; onUnregistered }`

The `deps` parameter is what makes this testable without a database. Real call
sites omit it.

- [ ] **Step 1: Write the failing tests**

Create `sprout-track/tests/native-push-dispatch.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { sendToDeviceTokens } from '@/src/lib/notifications/nativePush';

const PAYLOAD = { title: 'T', body: 'B' };
const TARGET = { familyId: 'fam1', caretakerId: 'care1' };

function deps(overrides = {}) {
  return {
    sendFcm: vi.fn().mockResolvedValue({ success: true, unregistered: false }),
    sendApns: vi.fn().mockResolvedValue({ success: true, unregistered: false }),
    findTokens: vi.fn().mockResolvedValue([]),
    onSuccess: vi.fn().mockResolvedValue(undefined),
    onFailure: vi.fn().mockResolvedValue(undefined),
    onUnregistered: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('sendToDeviceTokens', () => {
  it('returns 0 without querying when no owner is given', async () => {
    const d = deps();
    expect(await sendToDeviceTokens({ familyId: 'fam1' }, PAYLOAD, d)).toBe(0);
    expect(d.findTokens).not.toHaveBeenCalled();
  });

  it('routes android tokens to FCM and ios tokens to APNs', async () => {
    const d = deps({
      findTokens: vi.fn().mockResolvedValue([
        { id: '1', token: 'a', platform: 'android' },
        { id: '2', token: 'b', platform: 'ios' },
      ]),
    });
    expect(await sendToDeviceTokens(TARGET, PAYLOAD, d)).toBe(2);
    expect(d.sendFcm).toHaveBeenCalledWith('a', PAYLOAD);
    expect(d.sendApns).toHaveBeenCalledWith('b', PAYLOAD);
  });

  it('stamps success for delivered tokens', async () => {
    const d = deps({
      findTokens: vi.fn().mockResolvedValue([{ id: '1', token: 'a', platform: 'android' }]),
    });
    await sendToDeviceTokens(TARGET, PAYLOAD, d);
    expect(d.onSuccess).toHaveBeenCalledWith('1');
    expect(d.onFailure).not.toHaveBeenCalled();
  });

  it('deletes by token — not by id — so every family row for a dead token goes', async () => {
    const d = deps({
      findTokens: vi.fn().mockResolvedValue([{ id: '1', token: 'dead', platform: 'ios' }]),
      sendApns: vi.fn().mockResolvedValue({ success: false, unregistered: true }),
    });
    expect(await sendToDeviceTokens(TARGET, PAYLOAD, d)).toBe(0);
    expect(d.onUnregistered).toHaveBeenCalledWith('dead');
    expect(d.onFailure).not.toHaveBeenCalled();
  });

  it('increments failure count on a transient error without deleting', async () => {
    const d = deps({
      findTokens: vi.fn().mockResolvedValue([{ id: '1', token: 'a', platform: 'android' }]),
      sendFcm: vi.fn().mockResolvedValue({ success: false, unregistered: false }),
    });
    expect(await sendToDeviceTokens(TARGET, PAYLOAD, d)).toBe(0);
    expect(d.onFailure).toHaveBeenCalledWith('1');
    expect(d.onUnregistered).not.toHaveBeenCalled();
  });

  it('keeps sending after one token throws', async () => {
    const d = deps({
      findTokens: vi.fn().mockResolvedValue([
        { id: '1', token: 'a', platform: 'android' },
        { id: '2', token: 'b', platform: 'android' },
      ]),
      sendFcm: vi
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValue({ success: true, unregistered: false }),
    });
    expect(await sendToDeviceTokens(TARGET, PAYLOAD, d)).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /Users/johnoverton/Development/mobile-app-v1/sprout-track && npx vitest run tests/native-push-dispatch.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the dispatcher**

Create `sprout-track/src/lib/notifications/nativePush.ts`:

```ts
/**
 * Native push dispatcher. Owns the device-token query, per-platform routing, and
 * the token lifecycle; the transport modules (fcmPush, apnsPush) only send one
 * message and report an outcome. Unconfigured transports no-op, so a deployment
 * with FCM but no APNs delivers to Android and skips iOS.
 */

import prisma from '../../../app/api/db';
import type { NotificationPayload } from './push';
import { sendOne as sendFcmOne } from './fcmPush';
import { sendOne as sendApnsOne } from './apnsPush';

export interface SendOutcome {
  success: boolean;
  unregistered: boolean;
}

interface TokenRow {
  id: string;
  token: string;
  platform: string;
}

export interface NativePushDeps {
  sendFcm: (token: string, payload: NotificationPayload) => Promise<SendOutcome>;
  sendApns: (token: string, payload: NotificationPayload) => Promise<SendOutcome>;
  findTokens: (target: { familyId: string; ownerFilter: object[] }) => Promise<TokenRow[]>;
  onSuccess: (id: string) => Promise<void>;
  onFailure: (id: string) => Promise<void>;
  /** Keyed on the token, not the row id: one dead token may own rows in several families. */
  onUnregistered: (token: string) => Promise<void>;
}

const defaultDeps = (): NativePushDeps => ({
  sendFcm: sendFcmOne,
  sendApns: sendApnsOne,
  findTokens: ({ familyId, ownerFilter }) =>
    prisma.deviceToken.findMany({ where: { familyId, OR: ownerFilter } }),
  onSuccess: async (id) => {
    await prisma.deviceToken.update({
      where: { id },
      data: { failureCount: 0, lastSuccessAt: new Date() },
    });
  },
  onFailure: async (id) => {
    await prisma.deviceToken.update({
      where: { id },
      data: { failureCount: { increment: 1 }, lastFailureAt: new Date() },
    });
  },
  onUnregistered: async (token) => {
    await prisma.deviceToken.deleteMany({ where: { token } });
  },
});

export async function sendToDeviceTokens(
  target: { familyId: string; caretakerId?: string | null; accountId?: string | null },
  payload: NotificationPayload,
  depsOverride?: Partial<NativePushDeps>
): Promise<number> {
  const deps: NativePushDeps = { ...defaultDeps(), ...depsOverride };

  if (!target.caretakerId && !target.accountId) return 0;

  const ownerFilter: object[] = [];
  if (target.caretakerId) ownerFilter.push({ caretakerId: target.caretakerId });
  if (target.accountId) ownerFilter.push({ accountId: target.accountId });

  const tokens = await deps.findTokens({ familyId: target.familyId, ownerFilter });

  let sent = 0;
  for (const row of tokens) {
    try {
      const result =
        row.platform === 'ios'
          ? await deps.sendApns(row.token, payload)
          : await deps.sendFcm(row.token, payload);

      if (result.success) {
        sent += 1;
        await deps.onSuccess(row.id);
      } else if (result.unregistered) {
        await deps.onUnregistered(row.token);
      } else {
        await deps.onFailure(row.id);
      }
    } catch (error) {
      console.error('[NativePush] unexpected send error:', error);
    }
  }
  return sent;
}
```

- [ ] **Step 4: Reduce `fcmPush.ts` to a transport**

In `sprout-track/src/lib/notifications/fcmPush.ts`:
- Delete the entire `sendToDeviceTokens` export and the now-unused `prisma` import.
- Rename the private `sendFcm` function to an exported `sendOne`, changing its
  signature from `(account, token, payload)` to `(token, payload)` — it now loads
  its own config and returns `{ success: false, unregistered: false }` when
  unconfigured:

```ts
export async function sendOne(
  token: string,
  payload: NotificationPayload
): Promise<{ success: boolean; unregistered: boolean }> {
  const account = loadFcmServiceAccount();
  if (!account) return { success: false, unregistered: false };
  const accessToken = await getAccessToken(account);
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${account.projectId}/messages:send`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildFcmMessage(token, payload)),
    }
  );
  if (res.ok) return { success: true, unregistered: false };
  const body = await res.text();
  const unregistered = res.status === 404 && body.includes('UNREGISTERED');
  console.error(`[FCM] send failed (${res.status}): ${body.slice(0, 300)}`);
  return { success: false, unregistered };
}
```

Keep `loadFcmServiceAccount`, `isFcmConfigured`, and `buildFcmMessage` exactly as
they are — `tests/fcm-push.test.ts` covers them.

- [ ] **Step 5: Repoint the three call sites**

In `activityHook.ts` and `timerCheck.ts` (two sites), change:

```ts
import { sendToDeviceTokens } from './fcmPush';
```

to:

```ts
import { sendToDeviceTokens } from './nativePush';
```

Nothing else changes — the signature and the fire-and-forget `.catch(console.error)`
shape are identical.

- [ ] **Step 6: Run the full server suite**

```bash
cd /Users/johnoverton/Development/mobile-app-v1/sprout-track && npm test
```

Expected: PASS, ≥712 tests (706 baseline + 6 new). If `tests/fcm-push.test.ts`
referenced `sendToDeviceTokens`, move those cases to
`tests/native-push-dispatch.test.ts` rather than deleting them.

- [ ] **Step 7: Commit**

```bash
cd /Users/johnoverton/Development/mobile-app-v1/sprout-track
git rev-parse --show-toplevel && git branch --show-current
git add src/lib/notifications/ tests/native-push-dispatch.test.ts tests/fcm-push.test.ts
git commit -m "refactor(push): dispatch device sends by platform behind nativePush"
```

---

### Task 3: Schema, routes, and deployment flag

**Files:**
- Modify: `sprout-track/prisma/schema.prisma` (`DeviceToken`)
- Create: `sprout-track/prisma/migrations/<timestamp>_device_token_family_unique/migration.sql`
- Modify: `sprout-track/app/api/notifications/device-tokens/route.ts`
- Modify: `sprout-track/app/api/deployment-config/route.ts`
- Modify: `sprout-track/tests/device-tokens.test.ts`

**Interfaces:**
- Consumes: `isApnsConfigured` (Task 1), `isFcmConfigured` (existing)
- Produces: `nativePush: { ios: boolean; android: boolean }` on the
  deployment-config response, alongside a retained `nativePushEnabled: boolean`

- [ ] **Step 1: Change the schema**

In `sprout-track/prisma/schema.prisma`, in `model DeviceToken`:
- Change `token String @unique` to `token String`
- Add `@@unique([token, familyId])` beside the existing `@@index` lines

- [ ] **Step 2: Generate the migration**

```bash
cd /Users/johnoverton/Development/mobile-app-v1/sprout-track
npm run prisma:generate
npx prisma migrate dev --name device_token_family_unique
```

Inspect the generated SQL and confirm it uses no Postgres-only or SQLite-only
syntax.

- [ ] **Step 3: Write the failing route tests**

Add to `sprout-track/tests/device-tokens.test.ts`:

```ts
it('POST upserts on the composite key so one token can serve two families', () => {
  expect(upsertWhere({ token: 'tok', familyId: 'fam1' })).toEqual({
    token_familyId: { token: 'tok', familyId: 'fam1' },
  });
});

it('routes are unavailable when neither transport is configured', () => {
  expect(deviceTokenRoutesEnabled({ fcm: false, apns: false })).toBe(false);
});

it('routes are available when either transport is configured', () => {
  expect(deviceTokenRoutesEnabled({ fcm: true, apns: false })).toBe(true);
  expect(deviceTokenRoutesEnabled({ fcm: false, apns: true })).toBe(true);
});
```

- [ ] **Step 4: Implement the route changes**

In `app/api/notifications/device-tokens/route.ts`:

Add two exported helpers so the logic is testable without Next:

```ts
export function deviceTokenRoutesEnabled(flags: { fcm: boolean; apns: boolean }): boolean {
  return flags.fcm || flags.apns;
}

export function upsertWhere(args: { token: string; familyId: string }) {
  return { token_familyId: { token: args.token, familyId: args.familyId } };
}
```

Both handlers begin with:

```ts
if (!deviceTokenRoutesEnabled({ fcm: isFcmConfigured(), apns: isApnsConfigured() })) {
  return NextResponse.json<ApiResponse<never>>(
    { success: false, error: 'Not found.' },
    { status: 404 }
  );
}
```

`handlePost` changes its upsert to `where: upsertWhere({ token: parsed.token, familyId })`.

`handleDelete` **drops `withAuthContext`** and becomes a plain exported `DELETE`.
It reads `?token=`, calls `prisma.deviceToken.deleteMany({ where: { token } })`,
and **returns `{ success: true }` whether or not a row existed** — the response
must not reveal which tokens are registered.

```ts
export const POST = withAuthContext(handlePost);
export const DELETE = handleDelete;   // unauthenticated by design — spec D7
```

Add a comment above `handleDelete` recording why:

```ts
// Spec D7: unauthenticated by design. The device token is high-entropy and held
// only by the device that owns it, so presenting it is self-authenticating for
// this one operation. The shell has no JWT when a family is removed, and
// acquiring one would fire a biometric prompt on a delete action. Deleting a
// push token grants no read or write access to family data.
```

- [ ] **Step 5: Update deployment-config**

In `app/api/deployment-config/route.ts`:

```ts
import { isApnsConfigured } from '../../../src/lib/notifications/apnsPush';
// ...
nativePushEnabled: isFcmConfigured() || isApnsConfigured(),
nativePush: { ios: isApnsConfigured(), android: isFcmConfigured() },
```

`nativePushEnabled` **must be retained** — App Store review latency guarantees
older shell builds will be talking to this server, and they know only that flag.

- [ ] **Step 6: Remove the web app's registration path (spec §5.6)**

The shell owns registration now (spec D3), so the web-app registrar is dead code
that would double-register through a bridge that may not be injected.

```bash
cd /Users/johnoverton/Development/mobile-app-v1/sprout-track
rm src/utils/native-push.ts tests/native-push.test.ts
```

In `app/(app)/[slug]/client-layout.tsx`, delete both the import:

```ts
import { registerNativePushToken } from '@/src/utils/native-push';
```

and its call site:

```ts
if (mounted && isUnlocked && isNativeApp()) void registerNativePushToken();
```

Leave every other use of `isNativeApp` in that file alone.

The bridge contract's now-unused `registerPushToken` message **stays** — removing
it would force a contract version bump across both repos, and
`NativeAppIntegration.md` already documents the contract as the union of both
sides' vocabulary. **Do not edit `src/utils/bridge-contract.ts`.**

- [ ] **Step 7: Run the suite**

```bash
cd /Users/johnoverton/Development/mobile-app-v1/sprout-track && npm test && npx tsc --noEmit
```

Expected: PASS, with no dangling references to `native-push`.

- [ ] **Step 8: Commit**

```bash
cd /Users/johnoverton/Development/mobile-app-v1/sprout-track
git rev-parse --show-toplevel && git branch --show-current
git add -A prisma/ app/api/notifications/device-tokens/route.ts app/api/deployment-config/route.ts app/\(app\)/\[slug\]/client-layout.tsx src/utils/ tests/
git commit -m "feat(push): per-family device tokens, SaaS-gated routes, per-platform flag"
```

---

## Phase B — Server web-side (`sprout-track`)

### Task 4: Nursery display controls

**Files:**
- Modify: `sprout-track/src/utils/shell-chrome.ts`
- Modify: `sprout-track/tests/shell-chrome.test.ts`
- Modify: `sprout-track/src/components/features/nursery-mode/SettingsDrawer.tsx`
- Modify: `sprout-track/src/components/features/nursery-mode/NurseryModeContainer.tsx`
- Modify: `sprout-track/src/hooks/useWakeLock.ts`

**Interfaces:**
- Produces: `nurseryDisplayControls(isNative: boolean): { showWakeLock: boolean; showFullscreen: boolean }`

- [ ] **Step 1: Write the failing test**

Add to `sprout-track/tests/shell-chrome.test.ts`:

```ts
import { nurseryDisplayControls } from '@/src/utils/shell-chrome';

describe('nurseryDisplayControls', () => {
  it('shows both controls in a browser', () => {
    expect(nurseryDisplayControls(false)).toEqual({ showWakeLock: true, showFullscreen: true });
  });

  it('hides both in the shell — the app owns keep-awake and immersive', () => {
    expect(nurseryDisplayControls(true)).toEqual({ showWakeLock: false, showFullscreen: false });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /Users/johnoverton/Development/mobile-app-v1/sprout-track && npx vitest run tests/shell-chrome.test.ts
```

Expected: FAIL — `nurseryDisplayControls` is not exported.

- [ ] **Step 3: Implement**

Append to `sprout-track/src/utils/shell-chrome.ts`:

```ts
/**
 * Nursery mode's wake-lock and fullscreen toggles are browser-shaped affordances.
 * Inside the shell the native layer keeps the screen awake and goes immersive for
 * the whole nursery session, so the controls would be inert at best and
 * contradictory at worst — the wake-lock card currently renders
 * "Wake lock not supported" there.
 */
export function nurseryDisplayControls(isNative: boolean): {
  showWakeLock: boolean;
  showFullscreen: boolean;
} {
  return { showWakeLock: !isNative, showFullscreen: !isNative };
}
```

- [ ] **Step 4: Wire `NurseryModeContainer`**

Add the effect-read of shell-ness (never inline during render):

```tsx
const [inShell, setInShell] = useState(false);
useEffect(() => setInShell(isNativeApp()), []);
const displayControls = nurseryDisplayControls(inShell);
```

Import `isNativeApp` from `@/src/utils/native-app` and `nurseryDisplayControls`
from `@/src/utils/shell-chrome`.

Gate the footer status. Replace:

```tsx
<div className="l" style={{ textTransform: 'uppercase' }}>
  {wakeLock.isActive && <span className="nursery-dotlock" />}
  {wakeStatus}
</div>
```

with:

```tsx
{displayControls.showWakeLock && (
  <div className="l" style={{ textTransform: 'uppercase' }}>
    {wakeLock.isActive && <span className="nursery-dotlock" />}
    {wakeStatus}
  </div>
)}
```

Pass the flags through to the drawer:

```tsx
showWakeLock={displayControls.showWakeLock}
showFullscreen={displayControls.showFullscreen}
```

- [ ] **Step 5: Wire `SettingsDrawer`**

Add `showWakeLock: boolean` and `showFullscreen: boolean` to `SettingsDrawerProps`
and destructure them. Wrap the wake-lock button in `{showWakeLock && ( ... )}`,
and change the fullscreen condition from `{fullscreenSupported && (` to
`{showFullscreen && fullscreenSupported && (`.

- [ ] **Step 6: Skip auto-acquire in the shell**

In `sprout-track/src/hooks/useWakeLock.ts`, change the auto-acquire effect so it
does nothing inside the shell — otherwise it attempts a `navigator.wakeLock` call
that cannot succeed and logs an error:

```ts
useEffect(() => {
  if (isNativeApp()) return;      // native layer owns keep-awake in the shell
  if (mechanism() === 'none') return;
  // ...unchanged
}, [request, release]);
```

Import `isNativeApp` from `@/src/utils/native-app`.

- [ ] **Step 7: Verify**

```bash
cd /Users/johnoverton/Development/mobile-app-v1/sprout-track && npm test && npx tsc --noEmit
```

Expected: PASS, and no type errors.

- [ ] **Step 8: Commit**

```bash
cd /Users/johnoverton/Development/mobile-app-v1/sprout-track
git rev-parse --show-toplevel && git branch --show-current
git add src/utils/shell-chrome.ts tests/shell-chrome.test.ts src/components/features/nursery-mode/ src/hooks/useWakeLock.ts
git commit -m "feat(nursery): hide wake-lock and fullscreen controls inside the shell"
```

---

### Task 5: Notification routes and email link paths

**Files:**
- Create: `sprout-track/src/lib/notifications/routes.ts`
- Create: `sprout-track/tests/notification-routes.test.ts`
- Modify: `sprout-track/src/lib/notifications/activityHook.ts`, `timerCheck.ts` (payload `data`)
- Create: `sprout-track/app/verify/page.tsx`
- Create: `sprout-track/app/passwordreset/page.tsx`
- Modify: `sprout-track/app/api/utils/account-emails.ts`
- Create: `sprout-track/tests/account-email-links.test.ts`

**Interfaces:**
- Produces:
  - `NOTIFICATION_ROUTES: readonly string[]`
  - `routeForNotification(kind: string): string`

- [ ] **Step 1: Write the failing tests**

Create `sprout-track/tests/notification-routes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { NOTIFICATION_ROUTES, routeForNotification } from '@/src/lib/notifications/routes';

describe('routeForNotification', () => {
  it('sends medicine notifications to the medicine screen', () => {
    expect(routeForNotification('medicine')).toBe('medicine');
  });

  it('falls back to log-entry for an unknown kind', () => {
    expect(routeForNotification('nonsense')).toBe('log-entry');
  });

  it('only ever returns an allow-listed route', () => {
    for (const kind of ['medicine', 'feed', 'diaper', 'activity', 'nonsense', '']) {
      expect(NOTIFICATION_ROUTES).toContain(routeForNotification(kind));
    }
  });
});
```

Create `sprout-track/tests/account-email-links.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { verificationLink, passwordResetLink } from '@/app/api/utils/account-emails';

describe('account email links', () => {
  it('uses a real path for verification, not a fragment', () => {
    expect(verificationLink('https://sprout-track.com', 'tok')).toBe(
      'https://sprout-track.com/verify?token=tok'
    );
  });

  it('uses a real path for password reset, not a fragment', () => {
    expect(passwordResetLink('https://sprout-track.com', 'tok')).toBe(
      'https://sprout-track.com/passwordreset?token=tok'
    );
  });

  it('produces links Universal Links can match — no # in the path', () => {
    expect(verificationLink('https://x.test', 't')).not.toContain('#');
    expect(passwordResetLink('https://x.test', 't')).not.toContain('#');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd /Users/johnoverton/Development/mobile-app-v1/sprout-track && npx vitest run tests/notification-routes.test.ts tests/account-email-links.test.ts
```

Expected: FAIL on both.

- [ ] **Step 3: Implement the route table**

Create `sprout-track/src/lib/notifications/routes.ts`:

```ts
/**
 * Notification target routes. The shell concatenates this value into the URL that
 * carries the session token in its #bridge-session= fragment, so it must never be
 * an unvalidated value from a payload — an arbitrary route is a token-redirection
 * primitive. Both sides resolve through this allow-list.
 */

export const NOTIFICATION_ROUTES = ['log-entry', 'medicine', 'calendar'] as const;

const BY_KIND: Record<string, (typeof NOTIFICATION_ROUTES)[number]> = {
  medicine: 'medicine',
  feed: 'log-entry',
  diaper: 'log-entry',
  activity: 'log-entry',
};

export function routeForNotification(kind: string): string {
  const candidate = BY_KIND[kind];
  // The membership check is load-bearing, not belt-and-braces: BY_KIND is a plain
  // object literal, so a lookup for 'constructor' / '__proto__' / 'toString' etc.
  // resolves through Object.prototype and returns something TRUTHY — which means a
  // bare `?? 'log-entry'` fallback never fires and a non-route escapes.
  return (NOTIFICATION_ROUTES as readonly string[]).includes(candidate) ? candidate : 'log-entry';
}
```

The allow-list test must exercise prototype keys (`constructor`, `__proto__`,
`toString`, `hasOwnProperty`, `valueOf`), not just an unknown word — an unknown
word passes even with the broken version.

- [ ] **Step 4: Add route and slug to notification payloads**

At each send site in `activityHook.ts` and `timerCheck.ts`, the payload `data`
gains two keys. The family slug is already available where `familyId` is
resolved — if it is not, load it alongside. Example for the medicine timer site:

```ts
data: {
  ...existingData,
  familySlug,
  route: routeForNotification('medicine'),
},
```

Use `'feed'` / `'diaper'` for the feed and diaper timer sites and `'activity'`
for `activityHook.ts`.

- [ ] **Step 5: Extract and switch the email links**

In `sprout-track/app/api/utils/account-emails.ts`, add two exported builders and
use them in place of the inline template strings:

```ts
/** Path-based, not fragment-based: Universal and App Links match on path, and a
 *  URL fragment is not part of that match. The legacy /#verify and /#passwordreset
 *  handlers stay in place indefinitely for links already sitting in inboxes. */
export function verificationLink(domainUrl: string, token: string): string {
  return `${domainUrl}/verify?token=${token}`;
}

export function passwordResetLink(domainUrl: string, token: string): string {
  return `${domainUrl}/passwordreset?token=${token}`;
}
```

Replace `const verificationUrl = \`${domainUrl}/#verify?token=${token}\`;` with
`const verificationUrl = verificationLink(domainUrl, token);` and the reset one
likewise.

- [ ] **Step 6: Add the two page routes**

Create `sprout-track/app/verify/page.tsx` and
`sprout-track/app/passwordreset/page.tsx`. Each reads `?token=` from
`useSearchParams()` and renders the same component the existing hash handler in
`app/page.tsx` renders for `#verify` / `#passwordreset`. Read `app/page.tsx`
first and reuse its component rather than duplicating markup.

**Do not remove or alter the hash handling in `app/page.tsx`.**

- [ ] **Step 7: Translations and verification**

```bash
cd /Users/johnoverton/Development/mobile-app-v1/sprout-track
node scripts/check-missing-translations.js
npm test && npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd /Users/johnoverton/Development/mobile-app-v1/sprout-track
git rev-parse --show-toplevel && git branch --show-current
git add src/lib/notifications/ app/verify app/passwordreset app/api/utils/account-emails.ts tests/ src/localization/
git commit -m "feat: notification target routes and path-based account email links"
```

---

### Task 6: Association files

**Files:**
- Create: `sprout-track/app/.well-known/apple-app-site-association/route.ts`
- Create: `sprout-track/app/.well-known/assetlinks.json/route.ts`
- Create: `sprout-track/tests/association-files.test.ts`
- Modify: `sprout-track/middleware.ts` (exclude `.well-known` if it intercepts)

**Interfaces:**
- Produces: `APPLE_APP_SITE_ASSOCIATION` and `ASSET_LINKS` constants, and
  `claimedPaths(): string[]`

- [ ] **Step 1: Write the failing test**

Create `sprout-track/tests/association-files.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { APPLE_APP_SITE_ASSOCIATION, claimedPaths } from '@/app/.well-known/apple-app-site-association/route';

describe('claimed deep-link paths', () => {
  it('claims the three resume-in-app paths', () => {
    expect(claimedPaths()).toEqual(['/setup/*', '/verify*', '/passwordreset*']);
  });

  it('NEVER claims /account — IAP compliance depends on it opening externally', () => {
    expect(claimedPaths().some((p) => p.startsWith('/account'))).toBe(false);
  });

  it('does not claim the marketing site', () => {
    for (const p of ['/', '/features', '/pricing', '/privacy', '/terms', '/home']) {
      expect(claimedPaths()).not.toContain(p);
    }
  });

  it('exposes a single applinks detail entry', () => {
    expect(APPLE_APP_SITE_ASSOCIATION.applinks.details).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/johnoverton/Development/mobile-app-v1/sprout-track && npx vitest run tests/association-files.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the AASA route**

Create `sprout-track/app/.well-known/apple-app-site-association/route.ts`:

```ts
import { NextResponse } from 'next/server';

/** Universal Link paths claimed by the iOS shell.
 *  /account is deliberately absent: MANAGE_SUBSCRIPTION_URL points there so
 *  openExternal pushes subscription management into the system browser for App
 *  Store compliance. Claiming it would bounce the user back into the app. */
export function claimedPaths(): string[] {
  return ['/setup/*', '/verify*', '/passwordreset*'];
}

const APP_ID = `${process.env.APPLE_TEAM_ID ?? 'TEAMID'}.com.sprouttrack.app`;

export const APPLE_APP_SITE_ASSOCIATION = {
  applinks: {
    details: [{ appIDs: [APP_ID], components: claimedPaths().map((p) => ({ '/': p })) }],
  },
};

export async function GET() {
  return NextResponse.json(APPLE_APP_SITE_ASSOCIATION, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  });
}
```

- [ ] **Step 4: Implement the assetlinks route**

Create `sprout-track/app/.well-known/assetlinks.json/route.ts`:

```ts
import { NextResponse } from 'next/server';

/** ANDROID_CERT_SHA256 must be the Play App Signing fingerprint from the Play
 *  Console — NOT the local upload key. Using the upload key is the single most
 *  common reason App Links silently fail to verify. */
export const ASSET_LINKS = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.sprouttrack.app',
      sha256_cert_fingerprints: [process.env.ANDROID_CERT_SHA256 ?? ''],
    },
  },
];

export async function GET() {
  return NextResponse.json(ASSET_LINKS, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  });
}
```

- [ ] **Step 5: Confirm middleware does not intercept**

```bash
cd /Users/johnoverton/Development/mobile-app-v1/sprout-track && cat middleware.ts 2>/dev/null | head -40
```

If a `matcher` exists, add `.well-known` to its exclusion list. Both files must be
reachable unauthenticated, over HTTPS, with **no redirect**.

- [ ] **Step 6: Verify locally**

```bash
cd /Users/johnoverton/Development/mobile-app-v1/sprout-track && npm test
```

Then, with `npm run dev` running in another terminal:

```bash
curl -i http://localhost:3000/.well-known/apple-app-site-association
curl -i http://localhost:3000/.well-known/assetlinks.json
```

Expected: HTTP 200, `Content-Type: application/json`, no redirect.

- [ ] **Step 7: Commit**

```bash
cd /Users/johnoverton/Development/mobile-app-v1/sprout-track
git rev-parse --show-toplevel && git branch --show-current
git add app/.well-known tests/association-files.test.ts middleware.ts
git commit -m "feat(deeplinks): serve AASA and assetlinks for the native shell"
```

---

## Phase C — Shell push (`mobile-app-v1`)

### Task 7: Push service

**Files:**
- Create: `mobile-app-v1/src/services/push.ts`
- Create: `mobile-app-v1/src/services/push.test.ts`

**Interfaces:**
- Produces:
  - `type PermissionState = 'granted' | 'denied' | 'prompt'`
  - `permissionState(deps?): Promise<PermissionState>`
  - `requestPermission(deps?): Promise<PermissionState>`
  - `acquireToken(deps?): Promise<{ token: string; platform: 'ios' | 'android' } | null>`
  - `registerWith(baseUrl: string, jwt: string, token: string, platform: string, post?): Promise<boolean>`
  - `unregisterFrom(baseUrl: string, token: string, del?): Promise<void>`
  - `interface PushDeps { plugin; platform; timeoutMs }`

- [ ] **Step 1: Write the failing tests**

Create `mobile-app-v1/src/services/push.test.ts`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { permissionState, requestPermission, acquireToken, registerWith } from './push'

function fakePlugin(over: Record<string, unknown> = {}) {
  return {
    checkPermissions: vi.fn().mockResolvedValue({ receive: 'prompt' }),
    requestPermissions: vi.fn().mockResolvedValue({ receive: 'granted' }),
    register: vi.fn().mockResolvedValue(undefined),
    addListener: vi.fn().mockResolvedValue(undefined),
    ...over,
  }
}

describe('permissionState', () => {
  it('maps the plugin receive value straight through', async () => {
    const plugin = fakePlugin({ checkPermissions: vi.fn().mockResolvedValue({ receive: 'granted' }) })
    expect(await permissionState({ plugin })).toBe('granted')
  })

  it('reports denied when the plugin is absent', async () => {
    expect(await permissionState({ plugin: null })).toBe('denied')
  })
})

describe('requestPermission', () => {
  it('returns the granted result', async () => {
    expect(await requestPermission({ plugin: fakePlugin() })).toBe('granted')
  })

  it('returns denied without throwing when the plugin is absent', async () => {
    expect(await requestPermission({ plugin: null })).toBe('denied')
  })
})

describe('acquireToken', () => {
  // Record the EVENT NAME, not a constant: acquireToken attaches two listeners, and a
  // fixture that pushes 'listen' for both cannot express the invariant being guarded.
  it('attaches the registration listener BEFORE register - iOS does not retain it', async () => {
    const order: string[] = []
    const plugin = fakePlugin({
      addListener: vi.fn(async (event: string, cb: (t: { value: string }) => void) => {
        order.push(event)
        if (event === 'registration') setTimeout(() => cb({ value: 'tok-123' }), 0)
      }),
      register: vi.fn(async () => { order.push('register') }),
    })
    const result = await acquireToken({ plugin, platform: 'ios' })
    expect(order).toEqual(['registration', 'registrationError', 'register'])
    // The real invariant, and it survives someone adding a third listener later.
    expect(order.indexOf('registration')).toBeLessThan(order.indexOf('register'))
    expect(result).toEqual({ token: 'tok-123', platform: 'ios' })
  })

  it('resolves null immediately on registrationError, without waiting for the timeout', async () => {
    const plugin = fakePlugin({
      addListener: vi.fn(async (event: string, cb: (t: unknown) => void) => {
        if (event === 'registrationError') setTimeout(() => cb({ error: 'no APNs' }), 0)
      }),
    })
    // The long timeout is the point: if this resolves fast, the error listener did it.
    expect(await acquireToken({ plugin, platform: 'ios', timeoutMs: 60_000 })).toBeNull()
  })

  it('resolves null on timeout rather than hanging', async () => {
    const plugin = fakePlugin({ addListener: vi.fn().mockResolvedValue(undefined) })
    expect(await acquireToken({ plugin, platform: 'android', timeoutMs: 10 })).toBeNull()
  })

  it('resolves null when the plugin is absent', async () => {
    expect(await acquireToken({ plugin: null, platform: 'ios' })).toBeNull()
  })
})

describe('registerWith', () => {
  it('posts the token with the bearer JWT', async () => {
    const post = vi.fn().mockResolvedValue({ status: 200, body: { success: true } })
    expect(await registerWith('https://s.test', 'jwt1', 'tok', 'ios', post)).toBe(true)
    expect(post).toHaveBeenCalledWith(
      'https://s.test/api/notifications/device-tokens',
      { token: 'tok', platform: 'ios' },
      { token: 'jwt1' },
    )
  })

  it('returns false on a 404 - the server has native push disabled', async () => {
    const post = vi.fn().mockResolvedValue({ status: 404, body: null })
    expect(await registerWith('https://s.test', 'jwt1', 'tok', 'ios', post)).toBe(false)
  })

  it('returns false rather than throwing when the request fails', async () => {
    const post = vi.fn().mockRejectedValue(new Error('offline'))
    expect(await registerWith('https://s.test', 'jwt1', 'tok', 'ios', post)).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd /Users/johnoverton/Development/mobile-app-v1 && npx vitest run src/services/push.test.ts
```

Expected: FAIL — `./push` not found.

- [ ] **Step 3: Implement**

Create `mobile-app-v1/src/services/push.ts`:

```ts
import { Capacitor } from '@capacitor/core'
import { postJson } from '../lib/api-client'

export type PermissionState = 'granted' | 'denied' | 'prompt'

interface PushPlugin {
  checkPermissions(): Promise<{ receive: string }>
  requestPermissions(): Promise<{ receive: string }>
  register(): Promise<void>
  addListener(event: string, cb: (value: { value: string }) => void): Promise<unknown>
}

export interface PushDeps {
  plugin: PushPlugin | null
  platform: 'ios' | 'android'
  timeoutMs: number
}

function livePlugin(): PushPlugin | null {
  const cap = (globalThis as { Capacitor?: { Plugins?: Record<string, unknown> } }).Capacitor
  return (cap?.Plugins?.PushNotifications as PushPlugin) ?? null
}

function defaults(): PushDeps {
  return {
    plugin: livePlugin(),
    platform: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android',
    timeoutMs: 15_000,
  }
}

function normalize(receive: string): PermissionState {
  if (receive === 'granted') return 'granted'
  if (receive === 'denied') return 'denied'
  return 'prompt'
}

export async function permissionState(over: Partial<PushDeps> = {}): Promise<PermissionState> {
  const { plugin } = { ...defaults(), ...over }
  if (!plugin) return 'denied'
  try {
    return normalize((await plugin.checkPermissions()).receive)
  } catch {
    return 'denied'
  }
}

export async function requestPermission(over: Partial<PushDeps> = {}): Promise<PermissionState> {
  const { plugin } = { ...defaults(), ...over }
  if (!plugin) return 'denied'
  try {
    return normalize((await plugin.requestPermissions()).receive)
  } catch {
    return 'denied'
  }
}

/**
 * The listener MUST be attached before register(): the plugin emits `registration`
 * with retainUntilConsumed on Android but NOT on iOS, so an iOS listener attached
 * afterwards loses the token silently. Resolves null on timeout so a device that
 * never completes registration can't leave a pending promise behind.
 */
export async function acquireToken(
  over: Partial<PushDeps> = {},
): Promise<{ token: string; platform: 'ios' | 'android' } | null> {
  const { plugin, platform, timeoutMs } = { ...defaults(), ...over }
  if (!plugin) return null
  return new Promise(resolve => {
    let settled = false
    const finish = (value: { token: string; platform: 'ios' | 'android' } | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)

    void (async () => {
      try {
        await plugin.addListener('registration', t => finish({ token: t.value, platform }))
        await plugin.addListener('registrationError', () => finish(null))
        await plugin.register()
      } catch {
        finish(null)
      }
    })()
  })
}

export async function registerWith(
  baseUrl: string,
  jwt: string,
  token: string,
  platform: string,
  post: typeof postJson = postJson,
): Promise<boolean> {
  try {
    const res = await post(
      `${baseUrl}/api/notifications/device-tokens`,
      { token, platform },
      { token: jwt },
    )
    return res.status === 200
  } catch {
    return false
  }
}

/** Unauthenticated by design (spec D7) - the token authenticates itself. */
export async function unregisterFrom(
  baseUrl: string,
  token: string,
  del: (url: string) => Promise<unknown> = url => fetch(url, { method: 'DELETE' }),
): Promise<void> {
  try {
    await del(`${baseUrl}/api/notifications/device-tokens?token=${encodeURIComponent(token)}`)
  } catch {
    // Best effort - a stale row is cleaned by the UNREGISTERED lifecycle.
  }
}
```

- [ ] **Step 4: Run to verify they pass**

```bash
cd /Users/johnoverton/Development/mobile-app-v1 && npx vitest run src/services/push.test.ts
```

Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/johnoverton/Development/mobile-app-v1
git rev-parse --show-toplevel && git branch --show-current   # MUST be mobile-app-v1 / feature/native-push-and-deep-links
git add src/services/push.ts src/services/push.test.ts
git commit -m "feat(push): shell push service - permission, token, registration"
```

---

### Task 8: Register at connect time

**Files:**
- Modify: `mobile-app-v1/src/services/connect.ts`
- Modify: `mobile-app-v1/src/services/connect.test.ts`
- Create: `mobile-app-v1/src/services/push-opt-in.ts`
- Create: `mobile-app-v1/src/services/push-opt-in.test.ts`

**Interfaces:**
- Consumes: `permissionState`, `acquireToken`, `registerWith` (Task 7)
- Produces:
  - `type OptIn = 'unasked' | 'granted' | 'declined'`
  - `getOptIn(): Promise<OptIn>`, `setOptIn(v: OptIn): Promise<void>`
  - `registerPushForEntry(entry: ServerEntry, jwt: string, deps?): Promise<void>`
  - `ConnectDeps` gains `registerPush: (entry: ServerEntry, jwt: string) => void`

- [ ] **Step 1: Write the failing opt-in tests**

Create `mobile-app-v1/src/services/push-opt-in.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { Preferences } from '@capacitor/preferences'
import { getOptIn, setOptIn } from './push-opt-in'

beforeEach(async () => { await Preferences.clear() })

describe('push opt-in', () => {
  it('defaults to unasked', async () => {
    expect(await getOptIn()).toBe('unasked')
  })

  it('round-trips a stored value', async () => {
    await setOptIn('declined')
    expect(await getOptIn()).toBe('declined')
  })

  it('treats an unrecognized stored value as unasked', async () => {
    await Preferences.set({ key: 'push-opt-in', value: 'garbage' })
    expect(await getOptIn()).toBe('unasked')
  })
})
```

- [ ] **Step 2: Write the failing connect test**

Add to `mobile-app-v1/src/services/connect.test.ts`:

```ts
it('registers push with the fresh JWT before handing off', async () => {
  const registerPush = vi.fn()
  await connectToFamily(ENTRY, {
    vault: { retrieve: async () => CREDS, store: async () => {}, clear: async () => {} },
    login: async () => ({ ok: true, token: 'jwt-9', familySlug: 'fam' }),
    touch: async () => {},
    openUrl: () => {},
    registerPush,
  })
  expect(registerPush).toHaveBeenCalledWith(ENTRY, 'jwt-9')
})

it('still navigates when push registration throws', async () => {
  const outcome = await connectToFamily(ENTRY, {
    vault: { retrieve: async () => CREDS, store: async () => {}, clear: async () => {} },
    login: async () => ({ ok: true, token: 'jwt-9', familySlug: 'fam' }),
    touch: async () => {},
    openUrl: () => {},
    registerPush: () => { throw new Error('boom') },
  })
  expect(outcome).toBe('navigated')
})
```

Reuse the `ENTRY` / `CREDS` fixtures already defined in that file.

- [ ] **Step 3: Run both to verify they fail**

```bash
cd /Users/johnoverton/Development/mobile-app-v1 && npx vitest run src/services/push-opt-in.test.ts src/services/connect.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement opt-in storage**

Create `mobile-app-v1/src/services/push-opt-in.ts`:

```ts
import { Preferences } from '@capacitor/preferences'

export type OptIn = 'unasked' | 'granted' | 'declined'

const KEY = 'push-opt-in'
const TOKEN_KEY = 'push-last-token'
const VALUES: OptIn[] = ['unasked', 'granted', 'declined']

export async function getOptIn(): Promise<OptIn> {
  const { value } = await Preferences.get({ key: KEY })
  return VALUES.includes(value as OptIn) ? (value as OptIn) : 'unasked'
}

export async function setOptIn(value: OptIn): Promise<void> {
  await Preferences.set({ key: KEY, value })
}

/**
 * The last token we successfully registered. Family removal needs a token to
 * unregister with, and re-running acquireToken() there would call register()
 * again - blocking the removal UI for the full timeout when permission is denied.
 */
export async function getLastToken(): Promise<string | null> {
  const { value } = await Preferences.get({ key: TOKEN_KEY })
  return value ?? null
}

export async function setLastToken(token: string): Promise<void> {
  await Preferences.set({ key: TOKEN_KEY, value: token })
}
```

Add matching cases to `push-opt-in.test.ts`:

```ts
it('has no remembered token before registration', async () => {
  expect(await getLastToken()).toBeNull()
})

it('round-trips the remembered token', async () => {
  await setLastToken('tok-1')
  expect(await getLastToken()).toBe('tok-1')
})
```

- [ ] **Step 5: Implement registration and wire connect**

Append to `mobile-app-v1/src/services/push.ts`:

```ts
import { getJson } from '../lib/api-client'
import { getOptIn } from './push-opt-in'
import type { ServerEntry } from './server-registry'

async function serverSupportsPush(baseUrl: string, platform: 'ios' | 'android'): Promise<boolean> {
  try {
    const res = await getJson(`${baseUrl}/api/deployment-config`)
    const data = (res.body as { data?: { nativePush?: { ios?: boolean; android?: boolean }; nativePushEnabled?: boolean } } | null)?.data
    // Older servers expose only the flat flag; newer ones are per-platform.
    if (data?.nativePush) return Boolean(data.nativePush[platform])
    return Boolean(data?.nativePushEnabled)
  } catch {
    return false
  }
}

/** Fire-and-forget. Every failure path is swallowed: registration must never
 *  delay the handoff or change the ConnectOutcome. */
export async function registerPushForEntry(entry: ServerEntry, jwt: string): Promise<void> {
  try {
    if ((await getOptIn()) !== 'granted') return
    if ((await permissionState()) !== 'granted') return
    const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'
    if (!(await serverSupportsPush(entry.baseUrl, platform))) return
    const acquired = await acquireToken()
    if (!acquired) return
    const ok = await registerWith(entry.baseUrl, jwt, acquired.token, acquired.platform)
    if (ok) await setLastToken(acquired.token)
  } catch {
    // Deliberately silent.
  }
}
```

Import `setLastToken` alongside `getOptIn`.

In `mobile-app-v1/src/services/connect.ts`, add to `ConnectDeps`:

```ts
registerPush: (entry: ServerEntry, jwt: string) => void
```

default it to `(entry, jwt) => { void registerPushForEntry(entry, jwt) }`, and
call it inside the success branch, wrapped so a throwing dep cannot break connect:

```ts
if (result.ok) {
  try { deps.registerPush(entry, result.token) } catch { /* never block handoff */ }
  deps.openUrl(sessionHandoffUrl(entry.baseUrl, result))
  return 'navigated'
}
```

- [ ] **Step 6: Run the shell suite**

```bash
cd /Users/johnoverton/Development/mobile-app-v1 && npm test
```

Expected: PASS, ≥137 tests.

- [ ] **Step 7: Commit**

```bash
cd /Users/johnoverton/Development/mobile-app-v1
git rev-parse --show-toplevel && git branch --show-current
git add src/services/
git commit -m "feat(push): register the device token at connect time"
```

---

### Task 9: Permission intro screen

**Files:**
- Create: `mobile-app-v1/src/screens/NotificationsIntro.tsx`
- Create: `mobile-app-v1/src/screens/NotificationsIntro.test.tsx`
- Modify: `mobile-app-v1/src/App.tsx` (Screen union + render)

**Interfaces:**
- Consumes: `requestPermission` (Task 7), `getOptIn`/`setOptIn` (Task 8)
- Produces: `Screen` variant `{ name: 'push-intro'; next: Screen }`

- [ ] **Step 1: Write the failing test**

Create `mobile-app-v1/src/screens/NotificationsIntro.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotificationsIntro from './NotificationsIntro'

const NEXT = { name: 'families' } as const

describe('NotificationsIntro', () => {
  it('explains what notifications are for before any OS prompt', () => {
    render(<NotificationsIntro navigate={vi.fn()} next={NEXT} deps={{ requestPermission: vi.fn(), setOptIn: vi.fn() }} />)
    expect(screen.getByText(/feed and medicine timers/i)).toBeInTheDocument()
  })

  it('does not fire the OS prompt until Turn on is pressed', () => {
    const requestPermission = vi.fn()
    render(<NotificationsIntro navigate={vi.fn()} next={NEXT} deps={{ requestPermission, setOptIn: vi.fn() }} />)
    expect(requestPermission).not.toHaveBeenCalled()
  })

  it('records granted and continues when the user turns it on', async () => {
    const navigate = vi.fn()
    const setOptIn = vi.fn().mockResolvedValue(undefined)
    render(<NotificationsIntro navigate={navigate} next={NEXT}
      deps={{ requestPermission: vi.fn().mockResolvedValue('granted'), setOptIn }} />)
    await userEvent.click(screen.getByRole('button', { name: /turn on/i }))
    expect(setOptIn).toHaveBeenCalledWith('granted')
    expect(navigate).toHaveBeenCalledWith(NEXT)
  })

  it('records declined and continues on Not now, without prompting', async () => {
    const navigate = vi.fn()
    const setOptIn = vi.fn().mockResolvedValue(undefined)
    const requestPermission = vi.fn()
    render(<NotificationsIntro navigate={navigate} next={NEXT} deps={{ requestPermission, setOptIn }} />)
    await userEvent.click(screen.getByRole('button', { name: /not now/i }))
    expect(requestPermission).not.toHaveBeenCalled()
    expect(setOptIn).toHaveBeenCalledWith('declined')
    expect(navigate).toHaveBeenCalledWith(NEXT)
  })

  it('records declined when the user denies at the OS level', async () => {
    const setOptIn = vi.fn().mockResolvedValue(undefined)
    render(<NotificationsIntro navigate={vi.fn()} next={NEXT}
      deps={{ requestPermission: vi.fn().mockResolvedValue('denied'), setOptIn }} />)
    await userEvent.click(screen.getByRole('button', { name: /turn on/i }))
    expect(setOptIn).toHaveBeenCalledWith('declined')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/johnoverton/Development/mobile-app-v1 && npx vitest run src/screens/NotificationsIntro.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `mobile-app-v1/src/screens/NotificationsIntro.tsx`, matching the styling
of `src/screens/Settings.tsx` (`m-scr` / `m-bd` / `sect` / `sect-hd` / `m-btn`):

```tsx
import { useState } from 'react'
import type { Screen } from '../App'
import { Header } from '../components/chrome'
import { Ic } from '../components/Icons'
import { requestPermission } from '../services/push'
import { setOptIn } from '../services/push-opt-in'

export interface NotificationsIntroDeps {
  requestPermission: typeof requestPermission
  setOptIn: typeof setOptIn
}

const defaultDeps = (): NotificationsIntroDeps => ({ requestPermission, setOptIn })

export default function NotificationsIntro({
  navigate, next, deps: depsOverride,
}: {
  navigate: (s: Screen) => void
  next: Screen
  deps?: Partial<NotificationsIntroDeps>
}) {
  const [deps] = useState<NotificationsIntroDeps>(() => ({ ...defaultDeps(), ...depsOverride }))
  const [busy, setBusy] = useState(false)

  async function turnOn() {
    setBusy(true)
    const state = await deps.requestPermission()
    await deps.setOptIn(state === 'granted' ? 'granted' : 'declined')
    navigate(next)
  }

  async function notNow() {
    await deps.setOptIn('declined')
    navigate(next)
  }

  return (
    <div className="m-scr">
      <Header title="Know when it&rsquo;s time" />
      <div className="m-bd">
        <div className="sect">
          <div className="sect-hd"><Ic id="i-bell" s={19} /><h3>Notifications</h3></div>
          <p>Feed and medicine timers, and what your co-parent logs while you&rsquo;re away.
            We&rsquo;ll only send what your family has turned on.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
          <button className="m-btn" disabled={busy} onClick={() => void turnOn()}>Turn on</button>
          <button className="m-btn ghost" disabled={busy} onClick={() => void notNow()}>Not now</button>
        </div>
        <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--color-sub)', marginTop: 18 }}>
          You can change this any time in Settings.
        </p>
      </div>
    </div>
  )
}
```

If `Icons.tsx` has no `i-bell` glyph, add one in the established style, or reuse
an existing glyph rather than inventing markup.

- [ ] **Step 4: Wire into `App.tsx` — shown on the launch AFTER the first connect**

Add to the `Screen` union:

```ts
| { name: 'push-intro'; next: Screen }
```

and to the render block:

```tsx
{screen.name === 'push-intro' && <NotificationsIntro navigate={setScreen} next={screen.next} />}
```

**Timing matters and is easy to get wrong.** The shell cannot show anything
"just after connecting" — `connectToFamily` calls `openUrl` internally, so by the
time it returns `'navigated'` the WebView has left for the server and the shell's
React tree is gone. Instead:

1. In `push-opt-in.ts`, add `hasConnectedOnce()` / `markConnectedOnce()` backed by
   a `has-connected-once` Preferences key, mirroring `getOptIn` / `setOptIn`.
2. In `connect.ts`, call `void markConnectedOnce()` in the same success branch
   that calls `registerPush`.
3. In `App.tsx`'s launch effect, **before** resolving the auto-open / families
   target, insert the intro when the user has already used the app once:

```ts
if ((await getOptIn()) === 'unasked' && (await hasConnectedOnce())) {
  const next = def && autoOpen ? { name: 'connecting' as const, entry: def } : { name: 'families' as const }
  return applyBootTarget({ name: 'push-intro', next })
}
```

Place it after `getDefaultServer()` / `isAutoOpenEnabled()` resolve so `next`
carries the destination the user would otherwise have reached. Leave the
`bootAction` branches above it untouched — a bridge event is a deliberate
navigation and must not be preempted by the intro.

Add matching cases to `push-opt-in.test.ts`:

```ts
it('has not connected before the first connect', async () => {
  expect(await hasConnectedOnce()).toBe(false)
})

it('remembers that a connect happened', async () => {
  await markConnectedOnce()
  expect(await hasConnectedOnce()).toBe(true)
})
```

and to `connect.test.ts`:

```ts
it('marks that a connect happened so the intro can appear next launch', async () => {
  const markConnectedOnce = vi.fn()
  await connectToFamily(ENTRY, {
    vault: { retrieve: async () => CREDS, store: async () => {}, clear: async () => {} },
    login: async () => ({ ok: true, token: 'jwt-9', familySlug: 'fam' }),
    touch: async () => {}, openUrl: () => {}, registerPush: () => {}, markConnectedOnce,
  })
  expect(markConnectedOnce).toHaveBeenCalled()
})
```

`markConnectedOnce` joins `ConnectDeps` alongside `registerPush`, defaulted the
same way.

- [ ] **Step 5: Verify**

```bash
cd /Users/johnoverton/Development/mobile-app-v1 && npm test && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
cd /Users/johnoverton/Development/mobile-app-v1
git rev-parse --show-toplevel && git branch --show-current
git add src/screens/NotificationsIntro.tsx src/screens/NotificationsIntro.test.tsx src/App.tsx src/screens/Connecting.tsx src/components/Icons.tsx
git commit -m "feat(push): soft pre-prompt before the OS notification permission"
```

---

### Task 10: Settings row and family-removal unregister

**Files:**
- Modify: `mobile-app-v1/src/screens/Settings.tsx`
- Modify: `mobile-app-v1/src/screens/Settings.test.tsx`
- Modify: `mobile-app-v1/src/screens/Families.tsx`

**Interfaces:**
- Consumes: `permissionState`, `unregisterFrom` (Task 7), `getOptIn` / `setOptIn` / `getLastToken` (Task 8)
- Produces: `notificationRowState(perm: PermissionState, optIn: OptIn): 'on' | 'off' | 'blocked'`

- [ ] **Step 1: Write the failing test**

Add to `mobile-app-v1/src/screens/Settings.test.tsx`:

```ts
import { notificationRowState } from './Settings'

describe('notificationRowState', () => {
  it('is on only when the OS granted and the user opted in', () => {
    expect(notificationRowState('granted', 'granted')).toBe('on')
  })

  it('is off when the user declined even though the OS would allow it', () => {
    expect(notificationRowState('granted', 'declined')).toBe('off')
  })

  it('is blocked when the OS denied - Settings is the only recovery', () => {
    expect(notificationRowState('denied', 'granted')).toBe('blocked')
    expect(notificationRowState('denied', 'unasked')).toBe('blocked')
  })

  it('is off when nothing has been asked yet', () => {
    expect(notificationRowState('prompt', 'unasked')).toBe('off')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/johnoverton/Development/mobile-app-v1 && npx vitest run src/screens/Settings.test.tsx
```

Expected: FAIL — `notificationRowState` is not exported.

- [ ] **Step 3: Implement**

In `mobile-app-v1/src/screens/Settings.tsx`:

```ts
import type { PermissionState } from '../services/push'
import type { OptIn } from '../services/push-opt-in'

/** Driven by live OS state, not the stored preference alone - a user can revoke
 *  permission in OS settings at any time and a preference-driven row would lie. */
export function notificationRowState(perm: PermissionState, optIn: OptIn): 'on' | 'off' | 'blocked' {
  if (perm === 'denied') return 'blocked'
  return perm === 'granted' && optIn === 'granted' ? 'on' : 'off'
}
```

Add a `sect` block rendering, per state:
- `on` — "On for this phone", with a switch that sets `declined` when turned off
- `off` — a button reading "Turn on notifications" that navigates to
  `{ name: 'push-intro', next: { name: 'settings' } }`
- `blocked` — "Turned off in your phone&rsquo;s settings." plus a link out using
  the same `openExternal`-style pattern the shell already uses for external URLs

Read the live values in an effect:

```tsx
const [notif, setNotif] = useState<'on' | 'off' | 'blocked'>('off')
useEffect(() => {
  void (async () => setNotif(notificationRowState(await permissionState(), await getOptIn())))()
}, [])
```

- [ ] **Step 4: Unregister on family removal**

This is what closes the privacy gap in spec D7 — a caregiver who removes a
household stops receiving its notifications immediately, rather than waiting for
the token to go stale.

In `Families.tsx`, wherever an entry is removed and `vault.clear(entry.id)` is
called, add before it:

```ts
const token = await getLastToken()
if (token) await unregisterFrom(entry.baseUrl, token)
```

In `Settings.tsx`'s `clearAll()`, do the same inside the existing loop over
`listServers()`.

Use the **stored** token, never `acquireToken()`: the latter calls `register()`
again and would block the removal UI for the full timeout when permission is
denied. Both call sites are best-effort — a failure here must not prevent the
family from being removed.

- [ ] **Step 5: Verify**

```bash
cd /Users/johnoverton/Development/mobile-app-v1 && npm test && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
cd /Users/johnoverton/Development/mobile-app-v1
git rev-parse --show-toplevel && git branch --show-current
git add src/screens/Settings.tsx src/screens/Settings.test.tsx src/screens/Families.tsx
git commit -m "feat(push): notifications row in Settings, unregister on family removal"
```

---

### Task 11: Handoff route and notification tap

**Files:**
- Modify: `mobile-app-v1/src/services/connect.ts` (`sessionHandoffUrl`)
- Modify: `mobile-app-v1/src/services/connect.test.ts`
- Create: `mobile-app-v1/src/services/notification-routing.ts`
- Create: `mobile-app-v1/src/services/notification-routing.test.ts`
- Modify: `mobile-app-v1/src/App.tsx`

**Interfaces:**
- Produces:
  - `NOTIFICATION_ROUTES: readonly string[]` (must match the server list in Task 5)
  - `safeRoute(value: unknown): string`
  - `entryForNotification(data: unknown, servers: ServerEntry[]): { entry: ServerEntry; route: string } | null`
  - `sessionHandoffUrl(baseUrl, result, route?)`

- [ ] **Step 1: Write the failing tests**

Create `mobile-app-v1/src/services/notification-routing.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { safeRoute, entryForNotification } from './notification-routing'

const SERVERS = [
  { id: '1', baseUrl: 'https://a.test', familySlug: 'smith', familyName: 'Smith' },
  { id: '2', baseUrl: 'https://b.test', familySlug: 'jones', familyName: 'Jones' },
] as never

describe('safeRoute', () => {
  it('passes an allow-listed route through', () => {
    expect(safeRoute('medicine')).toBe('medicine')
  })

  it('rejects an unknown route', () => {
    expect(safeRoute('evil')).toBe('log-entry')
  })

  it('rejects a traversal attempt - the route lands in a token-bearing URL', () => {
    expect(safeRoute('../../evil.test/steal')).toBe('log-entry')
    expect(safeRoute('//evil.test')).toBe('log-entry')
  })

  it('rejects non-strings', () => {
    expect(safeRoute(undefined)).toBe('log-entry')
    expect(safeRoute(42)).toBe('log-entry')
  })
})

describe('entryForNotification', () => {
  it('matches a saved server by family slug', () => {
    expect(entryForNotification({ familySlug: 'jones', route: 'medicine' }, SERVERS))
      .toEqual({ entry: SERVERS[1], route: 'medicine' })
  })

  it('returns null for an unsaved family', () => {
    expect(entryForNotification({ familySlug: 'nobody' }, SERVERS)).toBeNull()
  })

  it('defaults the route when the payload omits it', () => {
    expect(entryForNotification({ familySlug: 'smith' }, SERVERS)?.route).toBe('log-entry')
  })

  it('returns null for a malformed payload', () => {
    expect(entryForNotification(null, SERVERS)).toBeNull()
    expect(entryForNotification({}, SERVERS)).toBeNull()
  })
})
```

Add to `connect.test.ts`:

```ts
it('defaults the handoff to log-entry', () => {
  expect(sessionHandoffUrl('https://s.test', { familySlug: 'fam', token: 't' }))
    .toContain('/fam/log-entry#bridge-session=')
})

it('honours an allow-listed route', () => {
  expect(sessionHandoffUrl('https://s.test', { familySlug: 'fam', token: 't' }, 'medicine'))
    .toContain('/fam/medicine#bridge-session=')
})

it('falls back to log-entry for a route outside the allow-list', () => {
  expect(sessionHandoffUrl('https://s.test', { familySlug: 'fam', token: 't' }, '../evil'))
    .toContain('/fam/log-entry#bridge-session=')
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd /Users/johnoverton/Development/mobile-app-v1 && npx vitest run src/services/notification-routing.test.ts src/services/connect.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement the routing module**

Create `mobile-app-v1/src/services/notification-routing.ts`:

```ts
import type { ServerEntry } from './server-registry'

/**
 * Mirrors sprout-track/src/lib/notifications/routes.ts. The route is concatenated
 * into the URL that carries the session token in its #bridge-session= fragment,
 * so an unvalidated value is a token-redirection primitive. Always resolve
 * through safeRoute - never use a payload value directly.
 */
export const NOTIFICATION_ROUTES = ['log-entry', 'medicine', 'calendar'] as const

export function safeRoute(value: unknown): string {
  return typeof value === 'string' && (NOTIFICATION_ROUTES as readonly string[]).includes(value)
    ? value
    : 'log-entry'
}

export function entryForNotification(
  data: unknown,
  servers: ServerEntry[],
): { entry: ServerEntry; route: string } | null {
  if (typeof data !== 'object' || data === null) return null
  const { familySlug, route } = data as { familySlug?: unknown; route?: unknown }
  if (typeof familySlug !== 'string') return null
  const entry = servers.find(s => s.familySlug === familySlug)
  return entry ? { entry, route: safeRoute(route) } : null
}
```

- [ ] **Step 4: Parameterize `sessionHandoffUrl`**

In `connect.ts`:

```ts
import { safeRoute } from './notification-routing'

export function sessionHandoffUrl(
  baseUrl: string,
  result: { familySlug: string; token: string; caretakerId?: string },
  route = 'log-entry',
): string {
  const msg = { /* unchanged */ }
  return `${baseUrl}/${result.familySlug}/${safeRoute(route)}#bridge-session=${encodeURIComponent(encodeMessage(msg))}`
}
```

Add an optional `route` to `connectToFamily`'s signature, threaded to
`sessionHandoffUrl`, and to the `connecting` screen variant in `App.tsx`:
`{ name: 'connecting'; entry: ServerEntry; route?: string }`.

- [ ] **Step 5: Attach the tap listener in `App.tsx`**

Inside the existing boot `useEffect`, before the async block:

```ts
const push = (globalThis as { Capacitor?: { Plugins?: Record<string, unknown> } })
  .Capacitor?.Plugins?.PushNotifications as
  { addListener(e: string, cb: (a: { notification: { data: unknown } }) => void): Promise<unknown> } | undefined

void push?.addListener('pushNotificationActionPerformed', async action => {
  const match = entryForNotification(action.notification.data, await listServers())
  if (match) applyBootTarget({ name: 'connecting', entry: match.entry, route: match.route })
})
```

The event is emitted with `retainUntilConsumed: true` on both platforms, so a
cold-start tap is still waiting when this listener attaches.

- [ ] **Step 6: Verify**

```bash
cd /Users/johnoverton/Development/mobile-app-v1 && npm test && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
cd /Users/johnoverton/Development/mobile-app-v1
git rev-parse --show-toplevel && git branch --show-current
git add src/services/ src/App.tsx
git commit -m "feat(push): route notification taps to the right family and screen"
```

---

## Phase D — Password reset and deep links (`mobile-app-v1`)

### Task 12: Reset service functions and shared password rules

**Files:**
- Create: `mobile-app-v1/src/lib/password-rules.ts`
- Create: `mobile-app-v1/src/lib/password-rules.test.ts`
- Modify: `mobile-app-v1/src/screens/AccountSignUp.tsx` (re-export `PW_REQS`)
- Modify: `mobile-app-v1/src/services/account.ts`
- Modify: `mobile-app-v1/src/services/account.test.ts`

**Interfaces:**
- Produces:
  - `PW_REQS: readonly (readonly [string, (p: string) => boolean])[]`
  - `passwordMeetsRules(p: string): boolean`
  - `validateResetToken(base, token, get?): Promise<{ valid: boolean; email?: string } | null>`
  - `submitPasswordReset(base, token, password, post?): Promise<{ ok: true } | { ok: false; error: 'invalid' | 'rate-limited' | 'unreachable'; message?: string }>`

- [ ] **Step 1: Write the failing tests**

Create `mobile-app-v1/src/lib/password-rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { PW_REQS, passwordMeetsRules } from './password-rules'

describe('password rules', () => {
  it('mirrors the register endpoint - 8+, lower, upper, number, symbol', () => {
    expect(PW_REQS.map(([label]) => label)).toEqual([
      '8+ characters', 'A number', 'A lowercase letter', 'A symbol', 'An uppercase letter',
    ])
  })

  it('accepts a password meeting every rule', () => {
    expect(passwordMeetsRules('Abcdef1!')).toBe(true)
  })

  it('rejects one missing a symbol', () => {
    expect(passwordMeetsRules('Abcdefg1')).toBe(false)
  })

  it('rejects one that is too short', () => {
    expect(passwordMeetsRules('Ab1!')).toBe(false)
  })
})
```

Add to `mobile-app-v1/src/services/account.test.ts`:

```ts
import { validateResetToken, submitPasswordReset } from './account'

describe('validateResetToken', () => {
  it('reports a valid token and the account email', async () => {
    const get = vi.fn().mockResolvedValue({ status: 200, body: { success: true, data: { valid: true, email: 'a@b.test' } } })
    expect(await validateResetToken('https://s.test', 'tok', get)).toEqual({ valid: true, email: 'a@b.test' })
    expect(get).toHaveBeenCalledWith('https://s.test/api/accounts/reset-password?token=tok')
  })

  it('reports an expired token as invalid', async () => {
    const get = vi.fn().mockResolvedValue({ status: 200, body: { success: true, data: { valid: false } } })
    expect(await validateResetToken('https://s.test', 'tok', get)).toEqual({ valid: false })
  })

  it('returns null when the request fails', async () => {
    const get = vi.fn().mockRejectedValue(new Error('offline'))
    expect(await validateResetToken('https://s.test', 'tok', get)).toBeNull()
  })

  it('returns null on a malformed envelope', async () => {
    const get = vi.fn().mockResolvedValue({ status: 200, body: { success: true, data: {} } })
    expect(await validateResetToken('https://s.test', 'tok', get)).toBeNull()
  })
})

describe('submitPasswordReset', () => {
  it('succeeds on a success envelope', async () => {
    const post = vi.fn().mockResolvedValue({ status: 200, body: { success: true, data: { success: true } } })
    expect(await submitPasswordReset('https://s.test', 'tok', 'Abcdef1!', post)).toEqual({ ok: true })
    expect(post).toHaveBeenCalledWith('https://s.test/api/accounts/reset-password', { token: 'tok', password: 'Abcdef1!' })
  })

  it('maps 429 to rate-limited', async () => {
    const post = vi.fn().mockResolvedValue({ status: 429, body: { success: false, error: 'Too many' } })
    expect(await submitPasswordReset('https://s.test', 'tok', 'Abcdef1!', post))
      .toEqual({ ok: false, error: 'rate-limited', message: 'Too many' })
  })

  it('maps 400 to invalid - the token expired between validation and submit', async () => {
    const post = vi.fn().mockResolvedValue({ status: 400, body: { success: false, error: 'Reset token has expired.' } })
    expect(await submitPasswordReset('https://s.test', 'tok', 'Abcdef1!', post))
      .toEqual({ ok: false, error: 'invalid', message: 'Reset token has expired.' })
  })

  it('maps a thrown request to unreachable', async () => {
    const post = vi.fn().mockRejectedValue(new Error('offline'))
    expect(await submitPasswordReset('https://s.test', 'tok', 'Abcdef1!', post))
      .toEqual({ ok: false, error: 'unreachable' })
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd /Users/johnoverton/Development/mobile-app-v1 && npx vitest run src/lib/password-rules.test.ts src/services/account.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Extract the password rules**

Create `mobile-app-v1/src/lib/password-rules.ts` holding the `PW_REQS` array
currently in `AccountSignUp.tsx` **verbatim** (same labels, same regexes, same
order), plus:

```ts
export function passwordMeetsRules(p: string): boolean {
  return PW_REQS.every(([, fn]) => fn(p))
}
```

In `AccountSignUp.tsx`, delete the inline definition and add:

```ts
export { PW_REQS } from '../lib/password-rules'
import { PW_REQS } from '../lib/password-rules'
```

The re-export keeps `AccountSignUp.test.tsx`, which imports `PW_REQS` by name,
working unchanged.

- [ ] **Step 4: Add the two service functions**

Append to `mobile-app-v1/src/services/account.ts`:

```ts
export async function validateResetToken(
  base: string,
  token: string,
  get: typeof getJson = getJson,
): Promise<{ valid: boolean; email?: string } | null> {
  try {
    const res = await get(`${base}/api/accounts/reset-password?token=${encodeURIComponent(token)}`)
    if (res.status !== 200) return null
    const data = (res.body as { success?: boolean; data?: { valid?: boolean; email?: string } } | null)?.data
    if (typeof data?.valid !== 'boolean') return null
    return { valid: data.valid, ...(typeof data.email === 'string' ? { email: data.email } : {}) }
  } catch {
    return null
  }
}

export type ResetSubmitResult =
  | { ok: true }
  | { ok: false; error: 'invalid' | 'rate-limited' | 'unreachable'; message?: string }

export async function submitPasswordReset(
  base: string,
  token: string,
  password: string,
  post: typeof postJson = postJson,
): Promise<ResetSubmitResult> {
  let res: { status: number; body: unknown }
  try {
    res = await post(`${base}/api/accounts/reset-password`, { token, password })
  } catch {
    return { ok: false, error: 'unreachable' }
  }
  const envelope = res.body as { success?: boolean; error?: string; data?: { success?: boolean } } | null
  if (res.status === 200 && envelope?.success && envelope.data?.success) return { ok: true }
  const message = envelope?.error
  const error = res.status === 429 ? 'rate-limited' : 'invalid'
  return { ok: false, error, ...(typeof message === 'string' ? { message } : {}) }
}
```

Note the `encodeURIComponent` on the token — the test asserts the plain value
because the fixture token has no reserved characters; real tokens must still be
encoded.

- [ ] **Step 5: Verify**

```bash
cd /Users/johnoverton/Development/mobile-app-v1 && npm test && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
cd /Users/johnoverton/Development/mobile-app-v1
git rev-parse --show-toplevel && git branch --show-current
git add src/lib/password-rules.ts src/lib/password-rules.test.ts src/screens/AccountSignUp.tsx src/services/account.ts src/services/account.test.ts
git commit -m "feat(account): shared password rules and reset-token service calls"
```

---

### Task 13: Password reset screen

**Files:**
- Create: `mobile-app-v1/src/screens/AccountResetConfirm.tsx`
- Create: `mobile-app-v1/src/screens/AccountResetConfirm.test.tsx`
- Modify: `mobile-app-v1/src/App.tsx`

**Interfaces:**
- Consumes: `validateResetToken`, `submitPasswordReset`, `PW_REQS`, `passwordMeetsRules` (Task 12)
- Produces: `Screen` variant `{ name: 'acct-reset-confirm'; token: string }`

- [ ] **Step 1: Write the failing tests**

Create `mobile-app-v1/src/screens/AccountResetConfirm.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AccountResetConfirm from './AccountResetConfirm'

const ok = () => ({ valid: true, email: 'a@b.test' })

function setup(over = {}) {
  const navigate = vi.fn()
  const deps = {
    validateResetToken: vi.fn().mockResolvedValue(ok()),
    submitPasswordReset: vi.fn().mockResolvedValue({ ok: true }),
    ...over,
  }
  render(<AccountResetConfirm navigate={navigate} token="tok" deps={deps} />)
  return { navigate, deps }
}

describe('AccountResetConfirm', () => {
  it('shows the account email once the token validates', async () => {
    setup()
    expect(await screen.findByText(/a@b\.test/)).toBeInTheDocument()
  })

  it('explains an expired token and offers a fresh link', async () => {
    const { navigate } = setup({ validateResetToken: vi.fn().mockResolvedValue({ valid: false }) })
    await userEvent.click(await screen.findByRole('button', { name: /new link/i }))
    expect(navigate).toHaveBeenCalledWith({ name: 'acct-reset' })
  })

  it('treats an unreachable server as an invalid token rather than a blank screen', async () => {
    setup({ validateResetToken: vi.fn().mockResolvedValue(null) })
    expect(await screen.findByRole('button', { name: /new link/i })).toBeInTheDocument()
  })

  it('keeps submit disabled until every rule passes', async () => {
    setup()
    const field = await screen.findByLabelText(/new password/i)
    await userEvent.type(field, 'weak')
    expect(screen.getByRole('button', { name: /save new password/i })).toBeDisabled()
    await userEvent.clear(field)
    await userEvent.type(field, 'Abcdef1!')
    expect(screen.getByRole('button', { name: /save new password/i })).toBeEnabled()
  })

  it('navigates to sign in with a notice on success', async () => {
    const { navigate } = setup()
    await userEvent.type(await screen.findByLabelText(/new password/i), 'Abcdef1!')
    await userEvent.click(screen.getByRole('button', { name: /save new password/i }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'acct-signin', notice: expect.stringMatching(/new password/i) }),
    ))
  })

  it('falls back to the invalid state when the token expires mid-flow', async () => {
    setup({ submitPasswordReset: vi.fn().mockResolvedValue({ ok: false, error: 'invalid', message: 'expired' }) })
    await userEvent.type(await screen.findByLabelText(/new password/i), 'Abcdef1!')
    await userEvent.click(screen.getByRole('button', { name: /save new password/i }))
    expect(await screen.findByRole('button', { name: /new link/i })).toBeInTheDocument()
  })

  it('surfaces the lockout message on 429 and keeps the password typed', async () => {
    setup({ submitPasswordReset: vi.fn().mockResolvedValue({ ok: false, error: 'rate-limited', message: 'Too many attempts.' }) })
    const field = await screen.findByLabelText(/new password/i)
    await userEvent.type(field, 'Abcdef1!')
    await userEvent.click(screen.getByRole('button', { name: /save new password/i }))
    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument()
    expect(field).toHaveValue('Abcdef1!')
  })

  it('keeps the password typed after a network failure', async () => {
    setup({ submitPasswordReset: vi.fn().mockResolvedValue({ ok: false, error: 'unreachable' }) })
    const field = await screen.findByLabelText(/new password/i)
    await userEvent.type(field, 'Abcdef1!')
    await userEvent.click(screen.getByRole('button', { name: /save new password/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(field).toHaveValue('Abcdef1!')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd /Users/johnoverton/Development/mobile-app-v1 && npx vitest run src/screens/AccountResetConfirm.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `mobile-app-v1/src/screens/AccountResetConfirm.tsx`. Match
`AccountReset.tsx` and `AccountSignUp.tsx` exactly for markup and classes —
`m-scr` / `Header` / `m-bd` / `f-grid` / `fl` / `fi` / `m-btn` / `auth-alt` /
`ErrBox`, and the `PW_REQS` checklist rendered the way `AccountSignUp` renders it.

```tsx
import { useEffect, useState } from 'react'
import type { Screen } from '../App'
import { Header, ErrBox } from '../components/chrome'
import { PW_REQS, passwordMeetsRules } from '../lib/password-rules'
import { SAAS_BASE, validateResetToken, submitPasswordReset } from '../services/account'

export interface AccountResetConfirmDeps {
  validateResetToken: typeof validateResetToken
  submitPasswordReset: typeof submitPasswordReset
}

const defaultDeps = (): AccountResetConfirmDeps => ({ validateResetToken, submitPasswordReset })

type Phase = 'checking' | 'valid' | 'invalid'

export default function AccountResetConfirm({
  navigate, token, deps: depsOverride,
}: {
  navigate: (s: Screen) => void
  token: string
  deps?: Partial<AccountResetConfirmDeps>
}) {
  const [deps] = useState<AccountResetConfirmDeps>(() => ({ ...defaultDeps(), ...depsOverride }))
  const [phase, setPhase] = useState<Phase>('checking')
  const [email, setEmail] = useState<string | null>(null)
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const result = await deps.validateResetToken(SAAS_BASE, token)
      // A null result means we couldn't reach the server. Showing the invalid
      // state with a "request a new link" path beats a blank or stuck screen.
      if (!result || !result.valid) return setPhase('invalid')
      setEmail(result.email ?? null)
      setPhase('valid')
    })()
  }, [deps, token])

  async function save() {
    setError(null)
    setBusy(true)
    try {
      const result = await deps.submitPasswordReset(SAAS_BASE, token, pw)
      if (result.ok) {
        navigate({ name: 'acct-signin', notice: 'Your new password is saved - sign in with it.' })
        return
      }
      if (result.error === 'invalid') return setPhase('invalid')
      setError(result.error === 'rate-limited'
        ? (result.message ?? 'Too many attempts. Try again in a few minutes.')
        : 'Can&rsquo;t reach Sprout Track right now. Check your connection.')
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'checking') {
    return (
      <div className="m-scr">
        <Header title="Set a new password." />
        <div className="m-bd"><p className="fh">Checking your link&hellip;</p></div>
      </div>
    )
  }

  if (phase === 'invalid') {
    return (
      <div className="m-scr">
        <Header title="That link expired." onBack={() => navigate({ name: 'acct-signin' })} />
        <div className="m-bd">
          <div className="f-grid">
            <p className="fh" style={{ marginTop: 0 }}>
              Reset links work for one hour, and only once. We can send you another.
            </p>
            <button className="m-btn" onClick={() => navigate({ name: 'acct-reset' })}>Send me a new link</button>
            <div className="auth-alt">
              <button className="m-link" onClick={() => navigate({ name: 'acct-signin' })}>Back to sign in</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="m-scr">
      <Header title="Set a new password." onBack={() => { if (!busy) navigate({ name: 'acct-signin' }) }} />
      <div className="m-bd">
        <div className="f-grid">
          {email && <p className="fh" style={{ marginTop: 0 }}>For <b>{email}</b>.</p>}
          <div>
            <label className="fl" htmlFor="rcP">New password</label>
            <input className="fi" id="rcP" type="password" placeholder="Make it a good one"
              value={pw} onChange={e => setPw(e.target.value)} />
            <div className="pwreq">
              {PW_REQS.map(([label, fn]) => (
                <span key={label} className={fn(pw) ? 'ok' : ''}>{label}</span>
              ))}
            </div>
          </div>
          {error && <ErrBox>{error}</ErrBox>}
          <button className="m-btn" disabled={busy || !passwordMeetsRules(pw)} onClick={() => void save()}>
            Save new password
          </button>
        </div>
      </div>
    </div>
  )
}
```

Open `AccountSignUp.tsx` and copy its exact checklist markup and class names in
place of the `pwreq` block above if they differ — the two screens must look
identical in that region.

- [ ] **Step 4: Wire into `App.tsx`**

```ts
| { name: 'acct-reset-confirm'; token: string }
```

```tsx
{screen.name === 'acct-reset-confirm' && <AccountResetConfirm navigate={setScreen} token={screen.token} />}
```

- [ ] **Step 5: Verify**

```bash
cd /Users/johnoverton/Development/mobile-app-v1 && npm test && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
cd /Users/johnoverton/Development/mobile-app-v1
git rev-parse --show-toplevel && git branch --show-current
git add src/screens/AccountResetConfirm.tsx src/screens/AccountResetConfirm.test.tsx src/App.tsx
git commit -m "feat(account): in-app password reset screen"
```

---

### Task 14: Deep-link routing

**Files:**
- Create: `mobile-app-v1/src/services/deep-links.ts`
- Create: `mobile-app-v1/src/services/deep-links.test.ts`
- Modify: `mobile-app-v1/src/App.tsx`

**Interfaces:**
- Produces: `screenForDeepLink(url: string): Screen | null`

- [ ] **Step 1: Write the failing tests**

Create `mobile-app-v1/src/services/deep-links.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { screenForDeepLink } from './deep-links'

describe('screenForDeepLink', () => {
  it('routes a password reset link to the confirm screen', () => {
    expect(screenForDeepLink('https://sprout-track.com/passwordreset?token=abc'))
      .toEqual({ name: 'acct-reset-confirm', token: 'abc' })
  })

  it('routes a verification link to the verify screen', () => {
    expect(screenForDeepLink('https://sprout-track.com/verify?token=xyz'))
      .toEqual({ name: 'acct-verify-link', token: 'xyz' })
  })

  it('routes a setup link to the setup-link screen', () => {
    expect(screenForDeepLink('https://sprout-track.com/setup/a1b2c3'))
      .toEqual({ name: 'setup-link', token: 'a1b2c3' })
  })

  it('NEVER claims /account - IAP compliance depends on it opening externally', () => {
    expect(screenForDeepLink('https://sprout-track.com/account')).toBeNull()
    expect(screenForDeepLink('https://sprout-track.com/account/payment-success')).toBeNull()
  })

  it('ignores marketing routes', () => {
    for (const p of ['/', '/pricing', '/features', '/privacy', '/terms', '/home']) {
      expect(screenForDeepLink(`https://sprout-track.com${p}`)).toBeNull()
    }
  })

  it('ignores links from another host', () => {
    expect(screenForDeepLink('https://evil.test/passwordreset?token=abc')).toBeNull()
  })

  it('ignores a claimed path with no token', () => {
    expect(screenForDeepLink('https://sprout-track.com/passwordreset')).toBeNull()
    expect(screenForDeepLink('https://sprout-track.com/setup/')).toBeNull()
  })

  it('ignores a malformed url', () => {
    expect(screenForDeepLink('not a url')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd /Users/johnoverton/Development/mobile-app-v1 && npx vitest run src/services/deep-links.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `mobile-app-v1/src/services/deep-links.ts`:

```ts
import type { Screen } from '../App'

const HOST = 'sprout-track.com'

/**
 * Returning null means "not ours" - App.tsx hands the URL to the system browser
 * and continues its normal boot. /account is deliberately never claimed:
 * MANAGE_SUBSCRIPTION_URL points there so subscription management opens
 * externally for App Store compliance, and claiming it would bounce the user
 * straight back into the app.
 */
export function screenForDeepLink(url: string): Screen | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.hostname !== HOST) return null

  const segments = parsed.pathname.split('/').filter(Boolean)
  const token = parsed.searchParams.get('token')

  if (segments[0] === 'passwordreset') return token ? { name: 'acct-reset-confirm', token } : null
  if (segments[0] === 'verify') return token ? { name: 'acct-verify-link', token } : null
  if (segments[0] === 'setup' && segments[1]) return { name: 'setup-link', token: segments[1] }
  return null
}
```

The `setup-link` screen is built in Task 15. Add
`| { name: 'setup-link'; token: string }` to the `Screen` union in this task so
`screenForDeepLink` type-checks; Task 15 adds the screen and its render branch.

The `acct-verify-link` variant is new: `AccountVerify` requires `creds` it cannot
have on a cold link. Add `{ name: 'acct-verify-link'; token: string }` to the
`Screen` union and render `AccountVerify` in a link mode that polls status with
the token alone and routes on success, without the `creds`-dependent branches.
Read `AccountVerify.tsx` and extend it rather than duplicating it.

- [ ] **Step 4: Attach the listener in `App.tsx`**

```ts
import { App as CapApp } from '@capacitor/app'
import { screenForDeepLink } from './services/deep-links'

void CapApp.addListener('appUrlOpen', ({ url }) => {
  const target = screenForDeepLink(url)
  if (target) applyBootTarget(target)
})
```

Place it beside the notification listener inside the boot effect, so both share
the existing `bootTarget` / `splashDone` guards.

- [ ] **Step 5: Verify**

```bash
cd /Users/johnoverton/Development/mobile-app-v1 && npm test && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
cd /Users/johnoverton/Development/mobile-app-v1
git rev-parse --show-toplevel && git branch --show-current
git add src/services/deep-links.ts src/services/deep-links.test.ts src/App.tsx src/screens/AccountVerify.tsx
git commit -m "feat(deeplinks): route setup, verify, and reset links into the shell"
```

---

### Task 15: Setup-link flow

**Files:**
- Modify: `mobile-app-v1/src/services/wizard.ts`
- Modify: `mobile-app-v1/src/services/wizard.test.ts`
- Create: `mobile-app-v1/src/screens/SetupLink.tsx`
- Create: `mobile-app-v1/src/screens/SetupLink.test.tsx`
- Modify: `mobile-app-v1/src/screens/wizard/Wizard.tsx`
- Modify: `mobile-app-v1/src/App.tsx`

**Interfaces:**
- Consumes: `screenForDeepLink` producing `{ name: 'setup-link'; token }` (Task 14)
- Produces:
  - `validateSetupToken(base, token, post?): Promise<'valid' | 'invalid' | 'expired' | 'used' | 'unreachable'>`
  - `exchangeSetupToken(base, token, password, post?): Promise<{ ok: true; jwt: string } | { ok: false; error: 'wrong-password' | 'invalid' | 'unreachable' }>`
  - `createFamily(base, jwt, args, post?)` gains an optional `setupToken` in `args`
  - `finishSetupWizard(base, slug, familyName, creds, biometric, deps?): Promise<{ toast: string }>`
  - `Wizard` gains `mode?: 'account' | 'setup'` and `setupToken?: string`

**Background:** `/setup/{token}` is an admin-generated provisioning link
(`create-setup-link`, system administrators only) — a 6-hex-character token in
`FamilySetup` with a stored password and a 7-day expiry. It is a **different auth
model** from account signup, but the Wizard's three steps are reusable: only the
auth source and the finish step change.

- [ ] **Step 1: Write the failing service tests**

Add to `mobile-app-v1/src/services/wizard.test.ts`:

```ts
import { validateSetupToken, exchangeSetupToken } from './wizard'

describe('validateSetupToken', () => {
  it('reports a usable token', async () => {
    const post = vi.fn().mockResolvedValue({ status: 200, body: { success: true, data: { valid: true } } })
    expect(await validateSetupToken('https://s.test', 'a1b2c3', post)).toBe('valid')
    expect(post).toHaveBeenCalledWith('https://s.test/api/setup/validate-token', { token: 'a1b2c3' })
  })

  it('distinguishes expired from invalid from already-used', async () => {
    const mk = (status: number) => vi.fn().mockResolvedValue({ status, body: { success: false } })
    expect(await validateSetupToken('https://s.test', 't', mk(404))).toBe('invalid')
    expect(await validateSetupToken('https://s.test', 't', mk(410))).toBe('expired')
    expect(await validateSetupToken('https://s.test', 't', mk(409))).toBe('used')
  })

  it('reports unreachable when the request throws', async () => {
    const post = vi.fn().mockRejectedValue(new Error('offline'))
    expect(await validateSetupToken('https://s.test', 't', post)).toBe('unreachable')
  })
})

describe('exchangeSetupToken', () => {
  it('returns the setup JWT', async () => {
    const post = vi.fn().mockResolvedValue({ status: 200, body: { success: true, data: { token: 'jwt-setup' } } })
    expect(await exchangeSetupToken('https://s.test', 'a1b2c3', 'pw', post))
      .toEqual({ ok: true, jwt: 'jwt-setup' })
    expect(post).toHaveBeenCalledWith('https://s.test/api/auth/token', { token: 'a1b2c3', password: 'pw' })
  })

  it('maps 401 to wrong-password so the user can retry', async () => {
    const post = vi.fn().mockResolvedValue({ status: 401, body: { success: false } })
    expect(await exchangeSetupToken('https://s.test', 't', 'bad', post))
      .toEqual({ ok: false, error: 'wrong-password' })
  })

  it('maps 410 to invalid', async () => {
    const post = vi.fn().mockResolvedValue({ status: 410, body: { success: false } })
    expect(await exchangeSetupToken('https://s.test', 't', 'pw', post))
      .toEqual({ ok: false, error: 'invalid' })
  })

  it('maps a thrown request to unreachable', async () => {
    const post = vi.fn().mockRejectedValue(new Error('offline'))
    expect(await exchangeSetupToken('https://s.test', 't', 'pw', post))
      .toEqual({ ok: false, error: 'unreachable' })
  })
})

describe('createFamily in setup mode', () => {
  it('sends the setup token and isNewFamily alongside name and slug', async () => {
    const post = vi.fn().mockResolvedValue({ status: 200, body: { success: true, data: { id: 'fam1' } } })
    await createFamily('https://s.test', 'jwt', { name: 'Smith', slug: 'smith', setupToken: 'a1b2c3' }, post)
    expect(post).toHaveBeenCalledWith(
      'https://s.test/api/setup/start',
      { name: 'Smith', slug: 'smith', token: 'a1b2c3', isNewFamily: true },
      { token: 'jwt' },
    )
  })

  it('omits both in account mode', async () => {
    const post = vi.fn().mockResolvedValue({ status: 200, body: { success: true, data: { id: 'fam1' } } })
    await createFamily('https://s.test', 'jwt', { name: 'Smith', slug: 'smith' }, post)
    expect(post).toHaveBeenCalledWith(
      'https://s.test/api/setup/start',
      { name: 'Smith', slug: 'smith' },
      { token: 'jwt' },
    )
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd /Users/johnoverton/Development/mobile-app-v1 && npx vitest run src/services/wizard.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement the service functions**

Append to `mobile-app-v1/src/services/wizard.ts`:

```ts
export type SetupTokenState = 'valid' | 'invalid' | 'expired' | 'used' | 'unreachable'

/** Admin-generated setup links: 6 hex chars, a stored password, a 7-day expiry.
 *  The three failure statuses are distinct user-facing situations, so they stay distinct here. */
export async function validateSetupToken(
  base: string,
  token: string,
  post: typeof postJson = postJson,
): Promise<SetupTokenState> {
  let res: { status: number; body: unknown }
  try {
    res = await post(`${base}/api/setup/validate-token`, { token })
  } catch {
    return 'unreachable'
  }
  if (res.status === 410) return 'expired'
  if (res.status === 409) return 'used'
  const envelope = envelopeOf(res.body)
  const data = envelope?.data as { valid?: unknown } | undefined
  return isSuccessStatus(res.status) && envelope?.success && data?.valid === true ? 'valid' : 'invalid'
}

export async function exchangeSetupToken(
  base: string,
  token: string,
  password: string,
  post: typeof postJson = postJson,
): Promise<{ ok: true; jwt: string } | { ok: false; error: 'wrong-password' | 'invalid' | 'unreachable' }> {
  let res: { status: number; body: unknown }
  try {
    res = await post(`${base}/api/auth/token`, { token, password })
  } catch {
    return { ok: false, error: 'unreachable' }
  }
  if (res.status === 401) return { ok: false, error: 'wrong-password' }
  const envelope = envelopeOf(res.body)
  const data = envelope?.data as { token?: unknown } | undefined
  if (!isSuccessStatus(res.status) || !envelope?.success || typeof data?.token !== 'string') {
    return { ok: false, error: 'invalid' }
  }
  return { ok: true, jwt: data.token }
}
```

Change `createFamily`'s `args` to `{ name: string; slug: string; setupToken?: string }`
and build the body so account mode is byte-identical to today:

```ts
const body = args.setupToken
  ? { name: args.name, slug: args.slug, token: args.setupToken, isNewFamily: true }
  : { name: args.name, slug: args.slug }
const res = await callOrThrowUnreachable(() => post(`${base}/api/setup/start`, body, { token }))
```

Add the setup-mode finish, which stores the **PIN credential the user just
configured** rather than account credentials:

```ts
export async function finishSetupWizard(
  base: string,
  slug: string,
  familyName: string,
  creds: StoredCredentials,
  biometric: boolean,
  deps?: FinishDeps,
): Promise<{ toast: string }> {
  const { login, saveServer, vault } = deps ?? { login: loginWithCredentials, saveServer: saveServerToRegistry, vault: createVault() }
  const result = await login({ id: `${base}|${slug}`, baseUrl: base, familySlug: slug }, creds)
  if (!result.ok) throw new WizardError('rejected', 'relogin')
  const saved = await saveServer({
    baseUrl: base,
    familySlug: slug,
    familyName,
    deploymentMode: 'saas',
    authType: creds.type === 'pin' && creds.loginId === null ? 'SYSTEM' : 'CARETAKER',
  })
  await vault.store(saved.id, creds, { biometric })
  return { toast: `Welcome home - ${familyName} is set up and saved to this phone.` }
}
```

Import `StoredCredentials` from `./credential-vault` if it is not already imported.

- [ ] **Step 4: Write the failing screen tests**

Create `mobile-app-v1/src/screens/SetupLink.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SetupLink from './SetupLink'

function setup(over = {}) {
  const navigate = vi.fn()
  const deps = {
    validateSetupToken: vi.fn().mockResolvedValue('valid'),
    exchangeSetupToken: vi.fn().mockResolvedValue({ ok: true, jwt: 'jwt-setup' }),
    ...over,
  }
  render(<SetupLink navigate={navigate} token="a1b2c3" deps={deps} />)
  return { navigate, deps }
}

describe('SetupLink', () => {
  it('asks for the setup password once the token validates', async () => {
    setup()
    expect(await screen.findByLabelText(/setup password/i)).toBeInTheDocument()
  })

  it('distinguishes an expired link from an invalid one', async () => {
    setup({ validateSetupToken: vi.fn().mockResolvedValue('expired') })
    expect(await screen.findByText(/expired/i)).toBeInTheDocument()
  })

  it('says so when the link was already used', async () => {
    setup({ validateSetupToken: vi.fn().mockResolvedValue('used') })
    expect(await screen.findByText(/already been used/i)).toBeInTheDocument()
  })

  it('hands off to the wizard in setup mode with the exchanged jwt', async () => {
    const { navigate } = setup()
    await userEvent.type(await screen.findByLabelText(/setup password/i), 'hunter22')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'wizard', token: 'jwt-setup', mode: 'setup', setupToken: 'a1b2c3' }),
    ))
  })

  it('keeps the user on the password step after a wrong password', async () => {
    const { navigate } = setup({ exchangeSetupToken: vi.fn().mockResolvedValue({ ok: false, error: 'wrong-password' }) })
    await userEvent.type(await screen.findByLabelText(/setup password/i), 'nope')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/setup password/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run to verify they fail**

```bash
cd /Users/johnoverton/Development/mobile-app-v1 && npx vitest run src/screens/SetupLink.test.tsx
```

Expected: FAIL.

- [ ] **Step 6: Implement the screen**

Create `mobile-app-v1/src/screens/SetupLink.tsx`, matching `AccountReset.tsx`'s
structure and classes (`m-scr` / `Header` / `m-bd` / `f-grid` / `fl` / `fi` /
`m-btn` / `ErrBox`). Phases: `checking` → `password` → `bad` (with a distinct
message per `invalid` / `expired` / `used` / `unreachable`). On successful
exchange, `navigate({ name: 'wizard', token: jwt, mode: 'setup', setupToken: token, creds: null, biometric })`.

Read `AccountReset.tsx` and mirror its deps-injection and busy/error handling
exactly rather than inventing a new shape.

- [ ] **Step 7: Teach `Wizard` setup mode**

In `Wizard.tsx`:
- Add `mode?: 'account' | 'setup'` (default `'account'`) and `setupToken?: string`
  to the props, and make `creds` accept `AccountCreds | null`.
- `handleStep1Next` passes `setupToken` into `createFamily`'s args when in setup
  mode.
- `handleStep3Complete` **skips `linkAccountToCaretaker` in setup mode** — there
  is no account to link — and calls `finishSetupWizard(SAAS_BASE, slug,
  familyName, pinCredsFromStep2, biometric, deps.finish)` instead of
  `finishWizard`.
- Step 2 already collects the security configuration; capture the credential it
  produces into state so step 3 can hand it to `finishSetupWizard`.

Add `finishSetupWizard` and `validateSetupToken` / `exchangeSetupToken` to
`WizardDeps` and `defaultDeps()` alongside the existing entries.

- [ ] **Step 8: Wire `App.tsx`**

Add the render branch:

```tsx
{screen.name === 'setup-link' && <SetupLink navigate={setScreen} token={screen.token} />}
```

Extend the `wizard` Screen variant with `mode?: 'account' | 'setup'` and
`setupToken?: string`, and widen its `creds` to `AccountCreds | null`.

- [ ] **Step 9: Verify**

```bash
cd /Users/johnoverton/Development/mobile-app-v1 && npm test && npx tsc --noEmit
```

Expected: PASS, with the existing `Wizard.test.tsx` account-mode cases still
green — account mode must be unchanged.

- [ ] **Step 10: Commit**

```bash
cd /Users/johnoverton/Development/mobile-app-v1
git rev-parse --show-toplevel && git branch --show-current
git add src/services/wizard.ts src/services/wizard.test.ts src/screens/SetupLink.tsx src/screens/SetupLink.test.tsx src/screens/wizard/Wizard.tsx src/App.tsx
git commit -m "feat(setup): consume admin setup links in the shell wizard"
```

---

## Phase E — Native platform configuration

### Task 16: iOS and Android push + deep-link configuration

**Files:**
- Modify: `mobile-app-v1/ios/App/App/Info.plist`
- Create: `mobile-app-v1/ios/App/App/App.entitlements`
- Modify: `mobile-app-v1/android/app/src/main/AndroidManifest.xml`
- Modify: `mobile-app-v1/.gitignore`
- Modify: `mobile-app-v1/capacitor.config.ts`

- [ ] **Step 1: iOS — background mode and entitlements**

Add to `Info.plist` before `</dict>`:

```xml
<key>UIBackgroundModes</key>
<array>
    <string>remote-notification</string>
</array>
```

Create `ios/App/App/App.entitlements`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>aps-environment</key>
	<string>development</string>
	<key>com.apple.developer.associated-domains</key>
	<array>
		<string>applinks:sprout-track.com</string>
	</array>
</dict>
</plist>
```

In Xcode, add the **Push Notifications** and **Associated Domains** capabilities
to the App target so the entitlements file is referenced by the build settings.
Archive builds set `aps-environment` to `production` automatically.

- [ ] **Step 2: Android — permission and App Links**

In `AndroidManifest.xml`, add beside the existing `INTERNET` permission:

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

Add inside the `MainActivity` element, after the existing launcher intent-filter:

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="sprout-track.com" android:pathPrefix="/setup/" />
    <data android:scheme="https" android:host="sprout-track.com" android:pathPrefix="/verify" />
    <data android:scheme="https" android:host="sprout-track.com" android:pathPrefix="/passwordreset" />
</intent-filter>
```

`MainActivity` is already `launchMode="singleTask"`, so links arrive via
`onNewIntent` rather than creating a second activity instance. **Android path
prefixes live in the manifest and cannot change without an app release** — unlike
the iOS AASA, which is server-side.

- [ ] **Step 3: Keep `google-services.json` out of git**

Add to `.gitignore`:

```
android/app/google-services.json
ios/App/App/GoogleService-Info.plist
```

Place the real `google-services.json` (Firebase console → Android app
`com.sprouttrack.app`) at `android/app/google-services.json`. `build.gradle`
already applies the plugin conditionally when the file is present.

- [ ] **Step 4: Bump the UA version**

In `capacitor.config.ts`, bump both `appendUserAgent` strings to
`SproutTrackApp/0.2.0 (ios)` / `(android)` and the `version` in `package.json` to
match. The server's detection regex accepts any version, but the UA is the only
signal it has about which shell build it is talking to.

- [ ] **Step 5: Sync and build both platforms**

```bash
cd /Users/johnoverton/Development/mobile-app-v1 && npm run sync
```

Expected: build succeeds and `cap sync` reports both platforms updated.

- [ ] **Step 6: Commit**

```bash
cd /Users/johnoverton/Development/mobile-app-v1
git rev-parse --show-toplevel && git branch --show-current
git add ios android .gitignore capacitor.config.ts package.json
git commit -m "chore(native): push capability, POST_NOTIFICATIONS, App Links intent filters"
```

---

### Task 17: Native nursery observation

**Files:**
- Create: `mobile-app-v1/ios/App/App/NurseryAwareViewController.swift`
- Modify: `mobile-app-v1/ios/App/App/Base.lproj/Main.storyboard`
- Create: `mobile-app-v1/android/app/src/main/java/com/sprouttrack/app/NurseryAwareWebViewClient.java`
- Modify: `mobile-app-v1/android/app/src/main/java/com/sprouttrack/app/MainActivity.java`
- Modify: `mobile-app-v1/package.json` (drop `@capacitor-community/keep-awake`)

- [ ] **Step 1: iOS view controller**

Create `ios/App/App/NurseryAwareViewController.swift`:

```swift
import UIKit
import WebKit
import Capacitor

/// The shell's JS stops running once the WebView navigates to the remote server,
/// so keep-awake and immersive mode for nursery mode have to be driven natively.
/// WKWebView.url is KVO-compliant and updates on history.pushState, so Next.js
/// client-side navigation is observed too.
class NurseryAwareViewController: CAPBridgeViewController {
    private var urlObservation: NSKeyValueObservation?
    private var nurseryActive = false

    static func isNurseryPath(_ path: String) -> Bool {
        let segments = path.split(separator: "/").map(String.init)
        return segments.count >= 2 && segments[1] == "nursery-mode"
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        urlObservation = webView?.observe(\.url, options: [.new]) { [weak self] _, change in
            guard let self, let url = change.newValue ?? nil else { return }
            self.apply(active: Self.isNurseryPath(url.path))
        }
    }

    private func apply(active: Bool) {
        guard active != nurseryActive else { return }
        nurseryActive = active
        UIApplication.shared.isIdleTimerDisabled = active
        setStatusBarVisible(!active)
    }

    deinit {
        urlObservation?.invalidate()
        UIApplication.shared.isIdleTimerDisabled = false
    }
}
```

In `Base.lproj/Main.storyboard`, change the `viewController` element's
`customClass` from `CAPBridgeViewController` to `NurseryAwareViewController` and
its `customModule` from `Capacitor` to `App`.

- [ ] **Step 2: Android WebViewClient**

Create `android/app/src/main/java/com/sprouttrack/app/NurseryAwareWebViewClient.java`:

```java
package com.sprouttrack.app;

import android.net.Uri;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

/** doUpdateVisitedHistory - not onPageStarted - because Next.js navigates with
 *  history.pushState, which does not start a page load. */
public class NurseryAwareWebViewClient extends BridgeWebViewClient {
    public interface NurseryListener { void onNurseryChanged(boolean active); }

    private final NurseryListener listener;
    private boolean active = false;

    public NurseryAwareWebViewClient(Bridge bridge, NurseryListener listener) {
        super(bridge);
        this.listener = listener;
    }

    static boolean isNurseryPath(String url) {
        try {
            String path = Uri.parse(url).getPath();
            if (path == null) return false;
            String[] segments = path.replaceAll("^/+", "").split("/");
            return segments.length >= 2 && "nursery-mode".equals(segments[1]);
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
        super.doUpdateVisitedHistory(view, url, isReload);
        boolean next = isNurseryPath(url);
        if (next != active) {
            active = next;
            listener.onNurseryChanged(next);
        }
    }
}
```

- [ ] **Step 3: Android activity**

Replace `MainActivity.java`'s body with:

```java
package com.sprouttrack.app;

import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        bridge.setWebViewClient(new NurseryAwareWebViewClient(bridge, this::applyNursery));
    }

    private void applyNursery(boolean active) {
        runOnUiThread(() -> {
            WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            if (active) {
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                controller.setSystemBarsBehavior(
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controller.hide(WindowInsetsCompat.Type.systemBars());
            } else {
                getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                controller.show(WindowInsetsCompat.Type.systemBars());
            }
        });
    }
}
```

- [ ] **Step 4: Drop the now-unused plugin**

```bash
cd /Users/johnoverton/Development/mobile-app-v1 && npm uninstall @capacitor-community/keep-awake && npm run sync
```

Keep-awake is handled natively now. `sprout-track`'s `useWakeLock` still checks
for the plugin and correctly resolves to `'none'` in the shell — Task 4 already
made it skip auto-acquire there.

- [ ] **Step 5: Manual device verification**

This is the only part of the plan that cannot be unit-tested. Record the result
in the progress ledger.

1. `npx cap run ios` (or `npm run android`), connect to a family
2. Enter nursery mode → confirm the status bar hides and the screen does not dim
3. Exit nursery mode → confirm both revert
4. Confirm the Settings drawer shows **no** wake-lock or fullscreen card, and the
   footer shows no "WAKE LOCK NOT SUPPORTED" text

- [ ] **Step 6: Commit**

```bash
cd /Users/johnoverton/Development/mobile-app-v1
git rev-parse --show-toplevel && git branch --show-current
git add ios android package.json package-lock.json
git commit -m "feat(nursery): native keep-awake and immersive driven by WebView URL"
```

---

## Phase F — Documentation

### Task 18: Update architecture and operations docs

**Files:**
- Modify: `sprout-track/documentation/Architecture-Documentation/NativeAppIntegration.md`
- Modify: `sprout-track/documentation/Admin-Documentation/environment-variables.md`
- Modify: `mobile-app-v1/CLAUDE.md`
- Modify: `mobile-app-v1/.superpowers/sdd/progress.md`

- [ ] **Step 1: Update `NativeAppIntegration.md`**

Rewrite the "Native push channel (FCM)" section as "Native push channel" covering
both transports, the `nativePush.ts` dispatcher, the composite unique key, the
SaaS-only decision, and the unauthenticated DELETE with its rationale. Add a new
"Deep links" section covering claimed paths, the `/account` exclusion, and the
iOS-server-side / Android-manifest asymmetry. Update the "Wake lock" subsection —
it is now native URL observation, not the KeepAwake plugin. Correct the "Client
registration" subsection: the shell owns registration; `src/utils/native-push.ts`
is gone.

- [ ] **Step 2: Update `environment-variables.md`**

Document `APNS_AUTH_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`,
`APNS_PRODUCTION`, `APPLE_TEAM_ID`, and `ANDROID_CERT_SHA256`. State that native
push is SaaS-only and that self-hosted deployments leave them unset and are
unaffected. Call out the `APNS_PRODUCTION` sandbox/production trap explicitly.

- [ ] **Step 3: Update the shell's `CLAUDE.md`**

Under "Known v0 seams", remove the resolved push item and the note that session
handoff is incomplete (it is not — `native-session.ts` ships). Add a short
"Push and deep links" section pointing at the spec.

- [ ] **Step 4: Update the progress ledger**

Append a section for this pass with one line per task and its commit.

- [ ] **Step 5: Verify and commit both repos**

```bash
cd /Users/johnoverton/Development/mobile-app-v1/sprout-track
git rev-parse --show-toplevel && git branch --show-current
npm test
git add documentation/
git commit -m "docs: native push transports, deep links, and native nursery wake"

cd /Users/johnoverton/Development/mobile-app-v1
git rev-parse --show-toplevel && git branch --show-current
npm test
git add CLAUDE.md .superpowers/sdd/progress.md
git commit -m "docs: record the native push and deep links pass"
```

---

## Final verification

- [ ] `cd sprout-track && npm test` — ≥706 baseline plus new tests, all green
- [ ] `cd sprout-track && npx tsc --noEmit` — clean
- [ ] `cd sprout-track && node scripts/check-missing-translations.js` — no missing keys
- [ ] `npm test` in the shell — ≥122 baseline plus new tests, all green
- [ ] `npx tsc --noEmit` in the shell — clean
- [ ] `npm run sync` — both platforms build
- [ ] Manual: nursery mode keeps the screen awake and goes immersive, both platforms
- [ ] Manual: a push notification arrives and its tap opens the right family
- [ ] Manual: a `/passwordreset?token=` link from a real email opens the app
- [ ] Manual: a `/setup/{token}` link opens the shell, accepts the setup password,
      and completes the wizard with the family saved to the registry and vault
- [ ] Manual: `https://sprout-track.com/account` opens in the **system browser**,
      not the app — this is the App Store compliance check
