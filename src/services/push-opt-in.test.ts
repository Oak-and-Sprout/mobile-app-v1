import { describe, it, expect, beforeEach } from 'vitest'
import { Preferences } from '@capacitor/preferences'
import { getOptIn, setOptIn, getLastToken, setLastToken, hasConnectedOnce, markConnectedOnce } from './push-opt-in'

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

describe('push last token', () => {
  it('has no remembered token before registration', async () => {
    expect(await getLastToken()).toBeNull()
  })

  it('round-trips the remembered token', async () => {
    await setLastToken('tok-1')
    expect(await getLastToken()).toBe('tok-1')
  })
})

describe('has-connected-once', () => {
  it('has not connected before the first connect', async () => {
    expect(await hasConnectedOnce()).toBe(false)
  })

  it('remembers that a connect happened', async () => {
    await markConnectedOnce()
    expect(await hasConnectedOnce()).toBe(true)
  })
})
