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

test('maps 429 with remainingTime to locked with retryAfterSeconds', async () => {
  const post = vi.fn().mockResolvedValue({ status: 429, body: { success: false, data: { remainingTime: 30 } } })
  const result = await loginWithCredentials(entry, { type: 'pin', loginId: null, securityPin: '1' }, post)
  expect(result).toEqual({ ok: false, error: 'locked', retryAfterSeconds: 30 })
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

test('surfaces caretakerId from the login envelope', async () => {
  const post = async () => ({ status: 200, body: { success: true, data: { token: 't', familySlug: 'fs', id: '42' } } })
  const result = await loginWithCredentials(
    { id: 'x1', baseUrl: 'https://h', familySlug: 'fs' },
    { type: 'pin', loginId: null, securityPin: '1' }, post,
  )
  expect(result).toEqual({ ok: true, token: 't', familySlug: 'fs', caretakerId: '42' })
})

test('account login with the real nested envelope shape reads token/familySlug/id from data.user', async () => {
  // Real /api/accounts/login shape: { success, data: { success, message, token, user: { id, familySlug? } } }
  const post = async () => ({
    status: 200,
    body: {
      success: true,
      data: {
        success: true,
        message: 'Login successful',
        token: 'jwt-account',
        user: { id: 'acct-1', email: 'a@b.com', familySlug: 'jones-family' },
      },
    },
  })
  const result = await loginWithCredentials(
    { id: 'https://x.com|account', baseUrl: 'https://x.com', familySlug: '' },
    { type: 'account', email: 'a@b.com', password: 'pw' }, post,
  )
  expect(result).toEqual({ ok: true, token: 'jwt-account', familySlug: 'jones-family', caretakerId: 'acct-1' })
})

test('nested account envelope with no user.familySlug falls back to entry.familySlug', async () => {
  const post = async () => ({
    status: 200,
    body: {
      success: true,
      data: {
        success: true,
        message: 'Login successful',
        token: 'jwt-account',
        user: { id: 'acct-1', email: 'a@b.com', hasFamily: false },
      },
    },
  })
  const result = await loginWithCredentials(
    { id: 'https://x.com|account', baseUrl: 'https://x.com', familySlug: 'fallback-slug' },
    { type: 'account', email: 'a@b.com', password: 'pw' }, post,
  )
  expect(result).toEqual({ ok: true, token: 'jwt-account', familySlug: 'fallback-slug', caretakerId: 'acct-1' })
})

test('single-flight cleanup: after resolve, subsequent login hits network again', async () => {
  const post = vi.fn().mockResolvedValue(ok('jwt-1'))
  // First concurrent pair (not awaited until both are queued)
  const p1 = loginWithCredentials(entry, { type: 'pin', loginId: null, securityPin: '1' }, post)
  const p2 = loginWithCredentials(entry, { type: 'pin', loginId: null, securityPin: '1' }, post)
  await Promise.all([p1, p2])
  expect(post).toHaveBeenCalledOnce() // both shared one call
  // Third call after cleanup
  post.mockClear()
  post.mockResolvedValue(ok('jwt-2'))
  await loginWithCredentials(entry, { type: 'pin', loginId: null, securityPin: '1' }, post)
  expect(post).toHaveBeenCalledOnce() // inFlight.delete ran, so third call is fresh
})
