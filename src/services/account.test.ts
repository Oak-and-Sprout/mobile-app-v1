import { describe, expect, it, test, vi } from 'vitest'
import { registerAccount, fetchAccountStatus, resendVerification, requestPasswordReset, fetchSetupStatus, validateResetToken, submitPasswordReset, verifyEmailToken } from './account'

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
test('fetchSetupStatus maps familyData including authType; null on failure', async () => {
  const get = vi.fn().mockResolvedValue({ status: 200, body: { success: true, data: { setupStage: 2, currentStage: 3, familyData: { id: 'f1', name: 'Smith', slug: 'smith', authType: 'CARETAKER' } } } })
  expect(await fetchSetupStatus('https://x.com', 'tok', get))
    .toEqual({ setupStage: 2, currentStage: 3, familyId: 'f1', familyName: 'Smith', familySlug: 'smith', authType: 'CARETAKER' })
  expect(get).toHaveBeenCalledWith('https://x.com/api/family/setup-status', { token: 'tok' })
  expect(await fetchSetupStatus('https://x.com', 'tok', vi.fn().mockRejectedValue(new Error()))).toBeNull()
})
test('fetchSetupStatus maps SYSTEM authType, and null when absent or unrecognized', async () => {
  const system = vi.fn().mockResolvedValue({ status: 200, body: { success: true, data: { setupStage: 1, currentStage: 2, familyData: { id: 'f1', name: 'Smith', slug: 'smith', authType: 'SYSTEM' } } } })
  expect(await fetchSetupStatus('https://x.com', 'tok', system)).toMatchObject({ authType: 'SYSTEM' })

  const absent = vi.fn().mockResolvedValue({ status: 200, body: { success: true, data: { setupStage: 1, currentStage: 2, familyData: { id: 'f1', name: 'Smith', slug: 'smith' } } } })
  expect(await fetchSetupStatus('https://x.com', 'tok', absent)).toMatchObject({ authType: null })

  const unrecognized = vi.fn().mockResolvedValue({ status: 200, body: { success: true, data: { setupStage: 1, currentStage: 2, familyData: { id: 'f1', name: 'Smith', slug: 'smith', authType: 'BOGUS' } } } })
  expect(await fetchSetupStatus('https://x.com', 'tok', unrecognized)).toMatchObject({ authType: null })
})

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

  it('maps a 500 to unreachable, not invalid - the request never completed', async () => {
    const post = vi.fn().mockResolvedValue({ status: 500, body: { success: false, error: 'Internal error' } })
    expect(await submitPasswordReset('https://s.test', 'tok', 'Abcdef1!', post))
      .toEqual({ ok: false, error: 'unreachable', message: 'Internal error' })
  })
})

describe('verifyEmailToken', () => {
  it('succeeds on a success envelope', async () => {
    const post = vi.fn().mockResolvedValue({
      status: 200,
      body: { success: true, data: { success: true, message: 'Account verified successfully! You can now set up your family.', redirectUrl: '/coming-soon' } },
    })
    expect(await verifyEmailToken('https://s.test', 'tok', post)).toEqual({ ok: true })
    expect(post).toHaveBeenCalledWith('https://s.test/api/accounts/verify', { token: 'tok' })
  })

  it('treats an already-verified account as success too', async () => {
    const post = vi.fn().mockResolvedValue({
      status: 200,
      body: { success: true, data: { success: true, message: 'Account already verified.', familySlug: 'smith', redirectUrl: '/smith' } },
    })
    expect(await verifyEmailToken('https://s.test', 'tok', post)).toEqual({ ok: true })
  })

  it('maps 404 (unknown/expired token) to invalid with the server message', async () => {
    const post = vi.fn().mockResolvedValue({ status: 404, body: { success: false, error: 'Invalid or expired verification token' } })
    expect(await verifyEmailToken('https://s.test', 'tok', post))
      .toEqual({ ok: false, error: 'invalid', message: 'Invalid or expired verification token' })
  })

  it('maps 400 (missing token) to invalid', async () => {
    const post = vi.fn().mockResolvedValue({ status: 400, body: { success: false, error: 'Verification token is required' } })
    expect(await verifyEmailToken('https://s.test', 'tok', post))
      .toEqual({ ok: false, error: 'invalid', message: 'Verification token is required' })
  })

  it('maps a 500 to unreachable, not invalid - the request never completed', async () => {
    const post = vi.fn().mockResolvedValue({ status: 500, body: { success: false, error: 'Verification failed. Please try again or contact support.' } })
    expect(await verifyEmailToken('https://s.test', 'tok', post))
      .toEqual({ ok: false, error: 'unreachable', message: 'Verification failed. Please try again or contact support.' })
  })

  it('fails closed on a 200 whose envelope is missing data.success, rather than reporting verified', async () => {
    const post = vi.fn().mockResolvedValue({ status: 200, body: { success: true, data: {} } })
    const result = await verifyEmailToken('https://s.test', 'tok', post)
    expect(result.ok).toBe(false)
  })

  it('maps a thrown request to unreachable', async () => {
    const post = vi.fn().mockRejectedValue(new Error('offline'))
    expect(await verifyEmailToken('https://s.test', 'tok', post)).toEqual({ ok: false, error: 'unreachable' })
  })
})
