import { expect, test, vi } from 'vitest'
import { CredentialVault, type StoredCredentials, type VaultBackend } from './credential-vault'

function memoryBackend(verifyResult = true): VaultBackend & { verify: ReturnType<typeof vi.fn> } {
  const store = new Map<string, string>()
  const verify = vi.fn().mockResolvedValue(verifyResult)
  return {
    get: async k => store.get(k) ?? null,
    set: async (k, v) => void store.set(k, v),
    delete: async k => void store.delete(k),
    verifyIdentity: verify,
    verify,
  }
}

const pinCreds: StoredCredentials = { type: 'pin', loginId: '01', securityPin: '123456' }

test('stores and retrieves credentials without biometrics', async () => {
  const backend = memoryBackend()
  const vault = new CredentialVault(backend)
  await vault.store('srv1', pinCreds, { biometric: false })
  await expect(vault.retrieve('srv1')).resolves.toEqual(pinCreds)
  expect(backend.verify).not.toHaveBeenCalled()
})

test('biometric-flagged entries verify identity before returning', async () => {
  const backend = memoryBackend(true)
  const vault = new CredentialVault(backend)
  await vault.store('srv1', pinCreds, { biometric: true })
  await expect(vault.retrieve('srv1')).resolves.toEqual(pinCreds)
  expect(backend.verify).toHaveBeenCalledOnce()
})

test('returns null when biometric verification fails', async () => {
  const backend = memoryBackend(false)
  const vault = new CredentialVault(backend)
  await vault.store('srv1', pinCreds, { biometric: true })
  await expect(vault.retrieve('srv1')).resolves.toBeNull()
})

test('has() reports presence without triggering biometrics', async () => {
  const backend = memoryBackend()
  const vault = new CredentialVault(backend)
  await expect(vault.has('srv1')).resolves.toBe(false)
  await vault.store('srv1', pinCreds, { biometric: true })
  await expect(vault.has('srv1')).resolves.toBe(true)
  expect(backend.verify).not.toHaveBeenCalled()
})

test('clear removes the entry', async () => {
  const backend = memoryBackend()
  const vault = new CredentialVault(backend)
  await vault.store('srv1', pinCreds, { biometric: false })
  await vault.clear('srv1')
  await expect(vault.retrieve('srv1')).resolves.toBeNull()
})
