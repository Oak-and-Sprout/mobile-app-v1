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
  it('attaches the registration listener BEFORE register - iOS does not retain it', async () => {
    const order: string[] = []
    const plugin = fakePlugin({
      addListener: vi.fn(async (_e: string, cb: (t: { value: string }) => void) => {
        order.push('listen')
        setTimeout(() => cb({ value: 'tok-123' }), 0)
      }),
      register: vi.fn(async () => { order.push('register') }),
    })
    const result = await acquireToken({ plugin, platform: 'ios' })
    expect(order).toEqual(['listen', 'register'])
    expect(result).toEqual({ token: 'tok-123', platform: 'ios' })
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
