import { expect, test, vi } from 'vitest'
import { registerAccount, fetchAccountStatus, resendVerification, requestPasswordReset, fetchSetupStatus } from './account'

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
