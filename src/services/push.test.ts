import { describe, it, expect, vi } from 'vitest'
import { PushNotifications } from '@capacitor/push-notifications'
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

// Guards against push.ts reaching into globalThis.Capacitor.Plugins instead of
// importing the plugin directly. That reach-through pattern is correct for the
// server's native-aware layer (loaded from a remote origin, must tolerate the
// plugin being absent) but wrong for the shell, which owns its own bundle: an
// unimported plugin never runs Capacitor's registerPlugin() side effect, so
// Capacitor.Plugins.PushNotifications stays undefined and every push call
// silently degrades to its swallowed-failure path with no error anywhere. jsdom
// has no native PushNotifications implementation to call through to, so this
// asserts the imported binding itself is live and shaped like a plugin, which
// is exactly what breaks (import removed -> binding undefined/incomplete) if
// the globalThis approach is reintroduced.
describe('PushNotifications import wiring', () => {
  it('imports a live plugin binding with the methods push.ts depends on', () => {
    expect(PushNotifications).toBeDefined()
    expect(typeof PushNotifications.register).toBe('function')
    expect(typeof PushNotifications.addListener).toBe('function')
    expect(typeof PushNotifications.checkPermissions).toBe('function')
    expect(typeof PushNotifications.requestPermissions).toBe('function')
  })
})

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
    expect(order.indexOf('registration')).toBeLessThan(order.indexOf('register'))
    expect(result).toEqual({ token: 'tok-123', platform: 'ios' })
  })

  it('resolves null immediately on registrationError, without waiting for the timeout', async () => {
    const plugin = fakePlugin({
      addListener: vi.fn(async (event: string, cb: (t: unknown) => void) => {
        if (event === 'registrationError') setTimeout(() => cb({ error: 'no APNs' }), 0)
      }),
    })
    // A long timeout: if this test passes quickly, the error path resolved it, not the timer.
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
