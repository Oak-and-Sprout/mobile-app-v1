import { useState } from 'react'
import type { Screen } from '../App'
import { CredentialVault, createVault, type StoredCredentials } from '../services/credential-vault'
import {
  ProbeError, fetchAuthType, fetchFamilyBySlug, parseServerInput, probeDeployment,
  type AuthType, type DeploymentConfig, type PublicFamily,
} from '../services/server-probe'
import { saveServer } from '../services/server-registry'
import { loginWithCredentials } from '../services/session'

export interface AddServerDeps {
  probeDeployment: typeof probeDeployment
  fetchFamilyBySlug: typeof fetchFamilyBySlug
  fetchAuthType: typeof fetchAuthType
  saveServer: typeof saveServer
  login: typeof loginWithCredentials
  vault: CredentialVault
}

const defaultDeps = (): AddServerDeps => ({
  probeDeployment, fetchFamilyBySlug, fetchAuthType, saveServer,
  login: loginWithCredentials, vault: createVault(),
})

interface Located {
  baseUrl: string
  config: DeploymentConfig
  family: PublicFamily
  authType: AuthType
}

const ERROR_TEXT: Record<string, string> = {
  'invalid-url': 'Please enter a valid server address.',
  unreachable: "Can't reach this server. Check the address and your connection.",
  'not-sprout-track': "That doesn't look like a Sprout Track server.",
  'family-not-found': 'Family not found on this server.',
  invalid: 'Login failed — check your PIN.',
  locked: 'Too many attempts — try again in a few minutes.',
  'missing-slug': 'Add your family name to the address (e.g. myhost.com/smith-family).',
}

export default function AddServer({
  navigate, prefillBaseUrl, deps: depsOverride,
}: {
  navigate: (s: Screen) => void
  prefillBaseUrl?: string
  deps?: Partial<AddServerDeps>
}) {
  const [deps] = useState<AddServerDeps>(() => ({ ...defaultDeps(), ...depsOverride }))
  const [input, setInput] = useState(prefillBaseUrl ?? '')
  const [located, setLocated] = useState<Located | null>(null)
  const [useAccount, setUseAccount] = useState(false)
  const [loginId, setLoginId] = useState('')
  const [pin, setPin] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [biometric, setBiometric] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const cleartext = located?.baseUrl.startsWith('http://') ?? false

  async function locate() {
    setError(null)
    setBusy(true)
    try {
      const { baseUrl, familySlug } = parseServerInput(input)
      if (!familySlug) throw new Error('missing-slug')
      const config = await deps.probeDeployment(baseUrl)
      const family = await deps.fetchFamilyBySlug(baseUrl, familySlug)
      const authType = await deps.fetchAuthType(baseUrl, familySlug)
      setLocated({ baseUrl, config, family, authType })
    } catch (e) {
      const kind = e instanceof ProbeError ? e.kind : (e as Error).message
      setError(ERROR_TEXT[kind] ?? ERROR_TEXT.unreachable)
    } finally {
      setBusy(false)
    }
  }

  async function verifyAndSave() {
    if (!located) return
    setError(null)
    setBusy(true)
    try {
      const creds: StoredCredentials = useAccount
        ? { type: 'account', email, password }
        : { type: 'pin', loginId: located.authType === 'CARETAKER' ? loginId : null, securityPin: pin }
      const target = { id: `${located.baseUrl}|${located.family.slug}`, baseUrl: located.baseUrl, familySlug: located.family.slug }
      const result = await deps.login(target, creds)
      if (!result.ok) {
        setError(ERROR_TEXT[result.error])
        return
      }
      const saved = await deps.saveServer({
        baseUrl: located.baseUrl,
        familySlug: located.family.slug,
        familyName: located.family.name,
        deploymentMode: located.config.deploymentMode,
        authType: useAccount ? 'ACCOUNT' : located.authType,
      })
      await deps.vault.store(saved.id, creds, { biometric })
      navigate({ name: 'server-list' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Connect to a family</h1>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Server address
        <input
          className="rounded-lg border border-gray-300 p-3 dark:border-gray-600 dark:bg-gray-800"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="https://myhost.com/smith-family"
          autoCapitalize="none"
          autoCorrect="off"
        />
      </label>
      <button
        className="rounded-xl bg-gradient-to-r from-brand to-brand-emerald px-6 py-3 font-semibold text-white disabled:opacity-50"
        disabled={busy || input.trim() === ''}
        onClick={locate}
      >
        Find family
      </button>

      {located && (
        <section className="flex flex-col gap-3 rounded-xl border border-mint-border bg-mint p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="font-semibold text-brand-deep dark:text-dark-accent">{located.family.name}</p>
          {cleartext && <p className="text-sm text-amber-700">This connection is not encrypted.</p>}

          {located.config.enableAccounts && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useAccount} onChange={e => setUseAccount(e.target.checked)} />
              Sign in with my Sprout Track account
            </label>
          )}

          {useAccount ? (
            <>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Email
                <input className="rounded-lg border border-gray-300 p-3" type="email"
                  value={email} onChange={e => setEmail(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Password
                <input className="rounded-lg border border-gray-300 p-3" type="password"
                  value={password} onChange={e => setPassword(e.target.value)} />
              </label>
            </>
          ) : (
            <>
              {located.authType === 'CARETAKER' && (
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Login ID
                  <input className="rounded-lg border border-gray-300 p-3" inputMode="numeric" maxLength={2}
                    value={loginId} onChange={e => setLoginId(e.target.value)} />
                </label>
              )}
              <label className="flex flex-col gap-1 text-sm font-medium">
                PIN
                <input className="rounded-lg border border-gray-300 p-3" type="password" inputMode="numeric"
                  value={pin} onChange={e => setPin(e.target.value)} />
              </label>
            </>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={biometric} onChange={e => setBiometric(e.target.checked)} />
            Remember with Face ID / fingerprint
          </label>

          <button
            className="rounded-xl bg-gradient-to-r from-brand to-brand-emerald px-6 py-3 font-semibold text-white disabled:opacity-50"
            disabled={busy}
            onClick={verifyAndSave}
          >
            Verify &amp; save
          </button>
        </section>
      )}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button className="mt-auto text-sm text-gray-500" onClick={() => navigate({ name: 'welcome' })}>
        Back
      </button>
    </main>
  )
}
