import { useState } from 'react'
import type { Screen } from '../App'
import { Header, ErrBox } from '../components/chrome'
import Toast from '../components/Toast'
import { BioCheck } from '../components/BioCheck'
import { useBiometricDefault } from '../lib/biometric'
import { CredentialVault, createVault, type StoredCredentials } from '../services/credential-vault'
import { fetchFamilyBySlug } from '../services/server-probe'
import { saveServer } from '../services/server-registry'
import { loginWithCredentials } from '../services/session'
import { SAAS_BASE, fetchSetupStatus } from '../services/account'
import { routeAfterAccountLogin, screenForRoute, type AccountRoutingDeps } from '../services/account-routing'

export interface AccountSignInDeps extends AccountRoutingDeps {
  login: typeof loginWithCredentials
}

const defaultDeps = (): AccountSignInDeps => ({
  login: loginWithCredentials, fetchSetupStatus, fetchFamilyBySlug, saveServer, vault: createVault(),
})

const ERROR_TEXT: Record<string, string> = {
  invalid: 'That email and password didn’t match. Give it another look and try again.',
  locked: 'Too many tries - the server is taking a breather. Try again in a few minutes.',
  unreachable: 'Can’t reach that server. Check the address and your connection.',
}

export default function AccountSignIn({
  navigate, notice, deps: depsOverride,
}: {
  navigate: (s: Screen) => void
  notice?: string
  deps?: Partial<AccountSignInDeps>
}) {
  const [deps] = useState<AccountSignInDeps>(() => ({ ...defaultDeps(), ...depsOverride }))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [biometric, setBiometric] = useBiometricDefault()
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
      const route = await routeAfterAccountLogin({
        base: SAAS_BASE,
        token: result.token,
        creds,
        biometric,
        familySlug: result.familySlug || undefined,
        verified: result.verified ?? true,
      }, deps)
      if (route.kind === 'error') {
        setError(route.message)
        return
      }
      navigate(screenForRoute(route, { token: result.token, creds, biometric }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="m-scr">
      <Header title="Welcome back." onBack={() => navigate({ name: 'fork' })} />
      <div className="m-bd">
        <div className="f-grid">
          <p className="fh" style={{ marginTop: 0 }}>Sign in to your family&rsquo;s page with your sprout-track.com account.</p>
          <div>
            <label className="fl" htmlFor="aiEm">Email</label>
            <input className="fi" id="aiEm" type="email" autoCapitalize="none" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="fl" htmlFor="aiPw">Password</label>
            <input className="fi" id="aiPw" type="password" placeholder="Your password"
              value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <BioCheck checked={biometric} onChange={setBiometric} what="password" />
          {error && <ErrBox>{error}</ErrBox>}
          <button className="m-btn" disabled={busy || !email || !password} onClick={() => void signIn()}>
            {busy ? 'Checking with Sprout Track…' : 'Sign me in'}
          </button>
          <div className="auth-alt">
            New here? <button className="m-link" onClick={() => navigate({ name: 'acct-signup' })}>Start your free trial</button><br />
            Forgot your password? <button className="m-link" onClick={() => navigate({ name: 'acct-reset' })}>Reset it</button>
          </div>
        </div>
      </div>
      {notice && <Toast message={notice} />}
    </div>
  )
}
