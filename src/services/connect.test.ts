import { expect, test, vi } from 'vitest'
import { decodeMessage } from '../../shared/bridge-contract'
import { connectToFamily } from './connect'
import { CredentialVault, type VaultBackend } from './credential-vault'
import type { ServerEntry } from './server-registry'

const entry: ServerEntry = {
  id: 'srv1', baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith',
  deploymentMode: 'selfhosted', authType: 'SYSTEM', lastUsedAt: null, isDefault: true,
}

function vaultWith(creds: unknown): CredentialVault {
  const backend: VaultBackend = {
    get: async () => (creds ? JSON.stringify({ biometric: false, creds }) : null),
    set: async () => {}, delete: async () => {}, verifyIdentity: async () => true, isAvailable: async () => true,
  }
  return new CredentialVault(backend)
}

test('with stored creds and a live server: logs in and opens log-entry', async () => {
  const openUrl = vi.fn()
  const outcome = await connectToFamily(entry, {
    vault: vaultWith({ type: 'pin', loginId: null, securityPin: '123456' }),
    login: vi.fn().mockResolvedValue({ ok: true, token: 'jwt', familySlug: 'smith-family' }),
    touch: vi.fn(), openUrl,
  })
  expect(outcome).toBe('navigated')
  const url = openUrl.mock.calls[0][0] as string
  expect(url.startsWith('https://x.com/smith-family/log-entry#bridge-session=')).toBe(true)
})

test('hands the session to the web app via the bridge-session fragment', async () => {
  const openUrl = vi.fn()
  const outcome = await connectToFamily(entry, {
    vault: vaultWith({ type: 'pin', loginId: null, securityPin: '123456' }),
    login: vi.fn().mockResolvedValue({ ok: true, token: 'jwt123', familySlug: entry.familySlug, caretakerId: '42' }),
    touch: vi.fn(), openUrl,
  })
  expect(outcome).toBe('navigated')
  const url = openUrl.mock.calls[0][0] as string
  const [base, fragment] = url.split('#bridge-session=')
  expect(base).toBe(`${entry.baseUrl}/${entry.familySlug}/log-entry`)
  const decoded = decodeMessage(decodeURIComponent(fragment))
  expect(decoded?.msg).toEqual({
    type: 'sessionInjected', slug: entry.familySlug, token: 'jwt123', caretakerId: '42',
  })
})

test('when the login result familySlug differs from the stored entry, navigates using the result slug', async () => {
  const openUrl = vi.fn()
  const outcome = await connectToFamily(entry, {
    vault: vaultWith({ type: 'account', email: 'a@b.com', password: 'pw' }),
    login: vi.fn().mockResolvedValue({ ok: true, token: 'jwt-x', familySlug: 'jones-family' }),
    touch: vi.fn(), openUrl,
  })
  expect(outcome).toBe('navigated')
  const url = openUrl.mock.calls[0][0] as string
  const [base, fragment] = url.split('#bridge-session=')
  expect(base).toBe(`${entry.baseUrl}/jones-family/log-entry`)
  const decoded = decodeMessage(decodeURIComponent(fragment))
  expect(decoded?.msg).toMatchObject({ slug: 'jones-family' })
})

test('without creds: routes to in-app re-auth (no web navigation)', async () => {
  const openUrl = vi.fn()
  const outcome = await connectToFamily(entry, {
    vault: vaultWith(null), login: vi.fn(), touch: vi.fn(), openUrl,
  })
  expect(outcome).toBe('needs-reauth')
  expect(openUrl).not.toHaveBeenCalled()
})

test('invalid stored creds route to re-auth without wiping the credential or navigating', async () => {
  const openUrl = vi.fn()
  const vault = vaultWith({ type: 'pin', loginId: null, securityPin: 'wrong' })
  const clearSpy = vi.spyOn(vault, 'clear')
  const outcome = await connectToFamily(entry, {
    vault,
    login: vi.fn().mockResolvedValue({ ok: false, error: 'invalid' }),
    touch: vi.fn(), openUrl,
  })
  expect(outcome).toBe('needs-reauth')
  expect(clearSpy).not.toHaveBeenCalled()
  expect(openUrl).not.toHaveBeenCalled()
})

test('unreachable server returns offline without navigating', async () => {
  const openUrl = vi.fn()
  const outcome = await connectToFamily(entry, {
    vault: vaultWith({ type: 'pin', loginId: null, securityPin: '1' }),
    login: vi.fn().mockResolvedValue({ ok: false, error: 'unreachable' }),
    touch: vi.fn(), openUrl,
  })
  expect(outcome).toBe('offline')
  expect(openUrl).not.toHaveBeenCalled()
})

test('lockout returns locked without navigating or wiping creds', async () => {
  const openUrl = vi.fn()
  const vault = vaultWith({ type: 'pin', loginId: null, securityPin: '1' })
  const clearSpy = vi.spyOn(vault, 'clear')
  const outcome = await connectToFamily(entry, {
    vault,
    login: vi.fn().mockResolvedValue({ ok: false, error: 'locked' }),
    touch: vi.fn(), openUrl,
  })
  expect(outcome).toBe('locked')
  expect(openUrl).not.toHaveBeenCalled()
  expect(clearSpy).not.toHaveBeenCalled()
})
