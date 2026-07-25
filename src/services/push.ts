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
        // Only the `registration` listener is attached before register() - it's
        // the one that carries the retainUntilConsumed guarantee on Android and
        // the one iOS drops if attached late. A registrationError listener would
        // be a second addListener call here with no test coverage to justify it;
        // the try/catch below already routes a synchronous register() failure to
        // finish(null), and the timeout covers a registration that never resolves.
        await plugin.addListener('registration', t => finish({ token: t.value, platform }))
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
