import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { getJson, postJson } from '../lib/api-client'
import { getOptIn, setLastToken } from './push-opt-in'
import type { ServerEntry } from './server-registry'

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

// Unlike the server's native-aware layer (which is loaded from a remote origin
// inside the shell's WebView and can only reach a plugin through globalThis,
// tolerating its absence), the shell owns its own bundle - it must import the
// plugin directly so Capacitor's registerPlugin() side effect actually runs.
// Every other native-plugin service here does the same (credential-vault.ts,
// server-registry.ts, main.tsx); reaching through globalThis instead silently
// leaves `Capacitor.Plugins.PushNotifications` unpopulated and every push call
// below degrades to its swallowed-failure path with no error anywhere.
// Exported so push.test.ts can assert `defaults().plugin === PushNotifications`
// directly - a test that only imports PushNotifications and asserts on the npm
// export never exercises this function at all, and would stay green even if
// this reverted to the globalThis reach-through described above.
export function defaults(): PushDeps {
  return {
    plugin: PushNotifications as unknown as PushPlugin,
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
        // Both listeners are attached before register(): `registration` is the
        // one that carries the retainUntilConsumed guarantee on Android and the
        // one iOS drops if attached late; `registrationError` is the signal that
        // tells us *why* registration failed (bad APNs entitlement, no FCM
        // config, etc.) and must resolve immediately rather than waiting out the
        // timeout below.
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

/**
 * Newer servers expose per-platform support under `nativePush`; older ones
 * (pre-dating the per-platform split) only have the flat `nativePushEnabled`
 * flag. Shell builds and server versions drift because of App Store review
 * latency, so both shapes have to keep working.
 */
async function serverSupportsPush(
  baseUrl: string,
  platform: 'ios' | 'android',
  getJsonFn: typeof getJson,
): Promise<boolean> {
  try {
    const res = await getJsonFn(`${baseUrl}/api/deployment-config`)
    const data = (
      res.body as { data?: { nativePush?: { ios?: boolean; android?: boolean }; nativePushEnabled?: boolean } } | null
    )?.data
    if (data?.nativePush) return Boolean(data.nativePush[platform])
    return Boolean(data?.nativePushEnabled)
  } catch {
    return false
  }
}

export interface RegisterPushDeps {
  getJson: typeof getJson
  getOptIn: typeof getOptIn
  permissionState: typeof permissionState
  acquireToken: typeof acquireToken
  registerWith: typeof registerWith
  setLastToken: typeof setLastToken
  platform: 'ios' | 'android'
}

function registerPushDefaults(): RegisterPushDeps {
  return {
    getJson,
    getOptIn,
    permissionState,
    acquireToken,
    registerWith,
    setLastToken,
    platform: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android',
  }
}

/**
 * Fire-and-forget. Every failure path is swallowed: registration must never
 * delay the WebView handoff or change the ConnectOutcome.
 */
export async function registerPushForEntry(
  entry: ServerEntry,
  jwt: string,
  over: Partial<RegisterPushDeps> = {},
): Promise<void> {
  const deps = { ...registerPushDefaults(), ...over }
  try {
    if ((await deps.getOptIn()) !== 'granted') return
    if ((await deps.permissionState()) !== 'granted') return
    if (!(await serverSupportsPush(entry.baseUrl, deps.platform, deps.getJson))) return
    const acquired = await deps.acquireToken()
    if (!acquired) return
    const ok = await deps.registerWith(entry.baseUrl, jwt, acquired.token, acquired.platform)
    if (ok) await deps.setLastToken(acquired.token)
  } catch {
    // Deliberately silent - see the doc comment above.
  }
}
