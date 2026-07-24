import { describe, expect, test, vi } from 'vitest'
import {
  ProbeError, fetchAuthType, fetchFamilyBySlug, parseServerInput, probeDeployment,
} from './server-probe'

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('parseServerInput', () => {
  test('adds https and strips trailing slash', () => {
    expect(parseServerInput('myhost.com/')).toEqual({
      baseUrl: 'https://myhost.com', familySlug: null, candidates: ['https://myhost.com', 'http://myhost.com'],
    })
  })
  test('extracts a family slug from a full URL', () => {
    expect(parseServerInput('https://myhost.com/smith-family')).toEqual({
      baseUrl: 'https://myhost.com', familySlug: 'smith-family', candidates: ['https://myhost.com'],
    })
  })
  test('keeps explicit http and port', () => {
    expect(parseServerInput('http://192.168.1.10:3000/fam')).toEqual({
      baseUrl: 'http://192.168.1.10:3000', familySlug: 'fam', candidates: ['http://192.168.1.10:3000'],
    })
  })
  test('scheme-less input with a port keeps the port in the http fallback candidate', () => {
    expect(parseServerInput('192.168.1.10:3000/fam').candidates).toEqual([
      'https://192.168.1.10:3000', 'http://192.168.1.10:3000',
    ])
  })
  test('throws on garbage', () => {
    expect(() => parseServerInput('not a url at all !!')).toThrow('invalid-url')
  })
})

describe('probeDeployment', () => {
  test('accepts an enveloped response', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      data: { deploymentMode: 'saas', enableAccounts: true, allowAccountRegistration: true },
    }))
    const config = await probeDeployment('https://x.com', fetchFn as unknown as typeof fetch)
    expect(config.deploymentMode).toBe('saas')
    expect(fetchFn).toHaveBeenCalledWith('https://x.com/api/deployment-config', expect.anything())
  })
  test('throws not-sprout-track on a non-Sprout-Track 200', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ hello: 'world' }))
    await expect(probeDeployment('https://x.com', fetchFn as unknown as typeof fetch))
      .rejects.toMatchObject({ kind: 'not-sprout-track' })
  })
  test('throws unreachable on network failure', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    await expect(probeDeployment('https://x.com', fetchFn as unknown as typeof fetch))
      .rejects.toMatchObject({ kind: 'unreachable' })
  })
})

describe('fetchFamilyBySlug', () => {
  test('returns the family', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({
      success: true, data: { name: 'Smith Family', slug: 'smith-family', isActive: true },
    }))
    await expect(fetchFamilyBySlug('https://x.com', 'smith-family', fetchFn as unknown as typeof fetch))
      .resolves.toMatchObject({ slug: 'smith-family' })
  })
  test('throws family-not-found on 404', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ success: false }, 404))
    await expect(fetchFamilyBySlug('https://x.com', 'nope', fetchFn as unknown as typeof fetch))
      .rejects.toMatchObject({ kind: 'family-not-found' })
  })
})

describe('fetchAuthType', () => {
  test('maps exists=true to CARETAKER', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { exists: true } }))
    await expect(fetchAuthType('https://x.com', 's', fetchFn as unknown as typeof fetch)).resolves.toBe('CARETAKER')
  })
  test('maps exists=false to SYSTEM', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { exists: false } }))
    await expect(fetchAuthType('https://x.com', 's', fetchFn as unknown as typeof fetch)).resolves.toBe('SYSTEM')
  })
  test('throws unreachable on a non-200 status instead of defaulting to SYSTEM', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ error: 'server error' }, 500))
    await expect(fetchAuthType('https://x.com', 's', fetchFn as unknown as typeof fetch))
      .rejects.toMatchObject({ kind: 'unreachable' })
  })
})
