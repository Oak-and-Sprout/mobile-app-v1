import { Capacitor } from '@capacitor/core'
import { NativeBiometric } from '@capgo/capacitor-native-biometric'

export type StoredCredentials =
  | { type: 'pin'; loginId: string | null; securityPin: string }
  | { type: 'account'; email: string; password: string }

export type AccountCreds = Extract<StoredCredentials, { type: 'account' }>

export interface VaultBackend {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  verifyIdentity(reason: string): Promise<boolean>
  isAvailable(): Promise<boolean>
}

interface VaultRecord { biometric: boolean; creds: StoredCredentials }

const keyFor = (serverId: string) => `sprout-creds:${serverId}`

export class CredentialVault {
  constructor(private backend: VaultBackend) {}

  async store(serverId: string, creds: StoredCredentials, opts: { biometric: boolean }): Promise<void> {
    // Only arm the biometric gate if the device can actually verify — otherwise
    // a later read would prompt for a biometric that always fails (e.g. Face ID
    // not enrolled on a simulator), locking the user out of their own credential.
    const biometric = opts.biometric ? await this.backend.isAvailable() : false
    const record: VaultRecord = { biometric, creds }
    await this.backend.set(keyFor(serverId), JSON.stringify(record))
  }

  /** Whether this device can perform biometric verification (drives the checkbox default). */
  async biometricAvailable(): Promise<boolean> {
    return this.backend.isAvailable()
  }

  async retrieve(serverId: string): Promise<StoredCredentials | null> {
    const raw = await this.backend.get(keyFor(serverId))
    if (!raw) return null
    let record: VaultRecord
    try {
      record = JSON.parse(raw) as VaultRecord
    } catch {
      return null
    }
    if (record.biometric) {
      const ok = await this.backend.verifyIdentity('Unlock your Sprout Track family')
      if (!ok) return null
    }
    return record.creds
  }

  async has(serverId: string): Promise<boolean> {
    return (await this.backend.get(keyFor(serverId))) !== null
  }

  async clear(serverId: string): Promise<void> {
    await this.backend.delete(keyFor(serverId))
  }

  async isBiometric(serverId: string): Promise<boolean> {
    const raw = await this.backend.get(keyFor(serverId))
    if (!raw) return false
    try {
      return Boolean((JSON.parse(raw) as VaultRecord).biometric)
    } catch {
      return false
    }
  }

  /**
   * Read the non-secret identifier (caretaker login ID or account email) from a
   * stored record without unlocking the secret — used to prefill the re-auth
   * screen. Never returns the PIN/password; falls back to empty on any error.
   */
  async peekIdentifier(serverId: string): Promise<{ loginId?: string | null; email?: string }> {
    const raw = await this.backend.get(keyFor(serverId))
    if (!raw) return {}
    try {
      const { creds } = JSON.parse(raw) as VaultRecord
      return creds.type === 'account' ? { email: creds.email } : { loginId: creds.loginId }
    } catch {
      return {}
    }
  }
}

/** Keychain/Keystore via NativeBiometric credential storage; server field namespaces the entry. */
function nativeBackend(): VaultBackend {
  return {
    async get(key) {
      try {
        const { password } = await NativeBiometric.getCredentials({ server: key })
        return password ?? null
      } catch {
        return null
      }
    },
    async set(key, value) {
      await NativeBiometric.setCredentials({ server: key, username: 'credentials', password: value })
    },
    async delete(key) {
      await NativeBiometric.deleteCredentials({ server: key })
    },
    async verifyIdentity(reason) {
      try {
        await NativeBiometric.verifyIdentity({ reason, title: 'Sprout Track' })
        return true
      } catch {
        return false
      }
    },
    async isAvailable() {
      try {
        const { isAvailable } = await NativeBiometric.isAvailable()
        return isAvailable
      } catch {
        return false
      }
    },
  }
}

/** Browser dev fallback ONLY — plaintext localStorage, never shipped as the native path. */
function webDevBackend(): VaultBackend {
  return {
    async get(key) { return localStorage.getItem(key) },
    async set(key, value) { localStorage.setItem(key, value) },
    async delete(key) { localStorage.removeItem(key) },
    async verifyIdentity() { return true },
    async isAvailable() { return false },
  }
}

export function createVault(): CredentialVault {
  return new CredentialVault(Capacitor.isNativePlatform() ? nativeBackend() : webDevBackend())
}
