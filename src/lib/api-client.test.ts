import { expect, test, vi, afterEach } from 'vitest'
import { postJson, putJson } from './api-client'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('web path: posts JSON with correct method, headers, credentials, and stringified body', async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    status: 200,
    json: async () => ({ success: true, data: { token: 'jwt-123' } }),
  })
  vi.stubGlobal('fetch', mockFetch)

  const result = await postJson('https://x.com/api/auth', { securityPin: '123456', familySlug: 'smith' })

  expect(mockFetch).toHaveBeenCalledWith('https://x.com/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ securityPin: '123456', familySlug: 'smith' }),
  })
  expect(result).toEqual({
    status: 200,
    body: { success: true, data: { token: 'jwt-123' } },
  })
})

test('web path: returns body: null when response body is not valid JSON', async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    status: 200,
    json: async () => {
      throw new Error('JSON parse failed')
    },
  })
  vi.stubGlobal('fetch', mockFetch)

  const result = await postJson('https://x.com/api/auth', { securityPin: '123456' })

  expect(result).toEqual({
    status: 200,
    body: null,
  })
})

test('web path: puts JSON with correct method, headers, credentials, and stringified body', async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    status: 200,
    json: async () => ({ success: true }),
  })
  vi.stubGlobal('fetch', mockFetch)

  const result = await putJson('https://x.com/api/settings?familyId=f1', { securityPin: '123456', authType: 'SYSTEM' }, { token: 'jwt-1' })

  expect(mockFetch).toHaveBeenCalledWith('https://x.com/api/settings?familyId=f1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jwt-1' },
    credentials: 'include',
    body: JSON.stringify({ securityPin: '123456', authType: 'SYSTEM' }),
  })
  expect(result).toEqual({
    status: 200,
    body: { success: true },
  })
})
