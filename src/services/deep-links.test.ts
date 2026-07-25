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
    expect(screenForDeepLink('https://sprout-track.com/verify')).toBeNull()
  })

  it('ignores a malformed url', () => {
    expect(screenForDeepLink('not a url')).toBeNull()
  })
})
