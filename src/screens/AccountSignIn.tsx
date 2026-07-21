import { useState } from 'react'
import type { Screen } from '../App'
import { Header, ErrBox } from '../components/chrome'
import { CredentialVault, createVault, type StoredCredentials } from '../services/credential-vault'
import { fetchFamilyBySlug } from '../services/server-probe'
import { saveServer } from '../services/server-registry'
import { loginWithCredentials } from '../services/session'

const SAAS_BASE = 'https://sprout-track.com'

export interface AccountSignInDeps {
  login: typeof loginWithCredentials
  fetchFamilyBySlug: typeof fetchFamilyBySlug
  saveServer: typeof saveServer
  vault: Pick<CredentialVault, 'store'>
}

const defaultDeps = (): AccountSignInDeps => ({
  login: loginWithCredentials, fetchFamilyBySlug, saveServer, vault: createVault(),
})

const ERROR_TEXT: Record<string, string> = {
  invalid: 'That email and password didn’t match. Give it another look and try again.',
  locked: 'Too many tries — the server is taking a breather. Try again in a few minutes.',
  unreachable: 'Can’t reach that server. Check the address and your connection.',
  'save-failed': 'Login worked but saving the family failed — try again.',
}

function titleFromSlug(slug: string): string {
  return slug.split(/[-_]/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

export default function AccountSignIn({
  navigate, deps: depsOverride,
}: {
  navigate: (s: Screen) => void
  deps?: Partial<AccountSignInDeps>
}) {
  const [deps] = useState<AccountSignInDeps>(() => ({ ...defaultDeps(), ...depsOverride }))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [biometric, setBiometric] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    setError(null)
    setBusy(true)
    try {
      const creds: StoredCredentials = { type: 'account', email, password }
      const result = await deps.login({ id: `${SAAS_BASE}|account`, baseUrl: SAAS_BASE, familySlug: '' }, creds)
      if (!result.ok) {
        setError(ERROR_TEXT[result.error])
        return
      }
      const slug = result.familySlug
      let name = titleFromSlug(slug)
      try {
        name = (await deps.fetchFamilyBySlug(SAAS_BASE, slug)).name
      } catch { /* login already succeeded; slug-derived name is fine */ }
      try {
        const saved = await deps.saveServer({
          baseUrl: SAAS_BASE, familySlug: slug, familyName: name,
          deploymentMode: 'saas', authType: 'ACCOUNT',
        })
        await deps.vault.store(saved.id, creds, { biometric })
        navigate({ name: 'families', toast: `Saved — ${name} is on this phone now.` })
      } catch {
        setError(ERROR_TEXT['save-failed'])
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="m-scr">
      <Header title="Sign in to Sprout Track" onBack={() => navigate({ name: 'welcome' })} />
      <div className="m-bd">
        <div className="f-grid">
          <p className="fh" style={{ marginTop: 0 }}>The same account you use on sprout-track.com — your family comes with it, no address to type.</p>
          <div>
            <label className="fl" htmlFor="acEm">Email</label>
            <input className="fi" id="acEm" type="email" autoCapitalize="none" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="fl" htmlFor="acPw">Password</label>
            <input className="fi" id="acPw" type="password" placeholder="Your password"
              value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <label className="fcheck">
            <input type="checkbox" checked={biometric} onChange={e => setBiometric(e.target.checked)} />
            <span><b>Unlock with Face ID next time</b><small>Your password lives in this phone&rsquo;s secure keychain — a glance opens the book.</small></span>
          </label>
          {error && <ErrBox>{error}</ErrBox>}
          <button className="m-btn" disabled={busy || !email || !password} onClick={() => void signIn()}>
            {busy ? 'Checking with Sprout Track…' : 'Sign me in'}
          </button>
          <p className="fh" style={{ textAlign: 'center' }}>New here? Start your trial at sprout-track.com — then come back and sign in.</p>
        </div>
      </div>
    </div>
  )
}
