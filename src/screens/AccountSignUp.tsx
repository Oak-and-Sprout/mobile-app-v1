import { useState } from 'react'
import type { Screen } from '../App'
import { Header, ErrBox } from '../components/chrome'
import { BioCheck } from '../components/BioCheck'
import { createVault, type StoredCredentials } from '../services/credential-vault'
import { fetchFamilyBySlug } from '../services/server-probe'
import { saveServer } from '../services/server-registry'
import { loginWithCredentials } from '../services/session'
import { SAAS_BASE, registerAccount, fetchSetupStatus } from '../services/account'
import { routeAfterAccountLogin, screenForRoute, type AccountRoutingDeps } from '../services/account-routing'

export const PW_REQS = [
  ['8+ characters', (p: string) => p.length >= 8],
  ['A number', (p: string) => /\d/.test(p)],
  ['A lowercase letter', (p: string) => /[a-z]/.test(p)],
  ['A symbol', (p: string) => /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(p)],
  ['An uppercase letter', (p: string) => /[A-Z]/.test(p)],
] as const

export interface AccountSignUpDeps extends AccountRoutingDeps {
  register: typeof registerAccount
  login: typeof loginWithCredentials
}

const defaultDeps = (): AccountSignUpDeps => ({
  register: registerAccount, login: loginWithCredentials,
  fetchSetupStatus, fetchFamilyBySlug, saveServer, vault: createVault(),
})

const ERROR_TEXT: Record<string, string> = {
  'rate-limited': 'Too many tries - the server is taking a breather. Try again in a few minutes.',
  unreachable: 'Can’t reach that server. Check the address and your connection.',
}

export default function AccountSignUp({
  navigate, deps: depsOverride,
}: {
  navigate: (s: Screen) => void
  deps?: Partial<AccountSignUpDeps>
}) {
  const [deps] = useState<AccountSignUpDeps>(() => ({ ...defaultDeps(), ...depsOverride }))
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [biometric, setBiometric] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ok = Boolean(first && last && /.+@.+\..+/.test(email) && PW_REQS.every(([, fn]) => fn(pw)))

  async function signUp() {
    setError(null)
    setBusy(true)
    try {
      const result = await deps.register(SAAS_BASE, { email, password: pw, firstName: first, lastName: last })
      if (!result.ok) {
        setError(result.error === 'rejected'
          ? (result.message ?? 'That didn’t work - check your details and try again.')
          : ERROR_TEXT[result.error])
        return
      }

      const creds: StoredCredentials = { type: 'account', email, password: pw }
      const loginResult = await deps.login({ id: `${SAAS_BASE}|account`, baseUrl: SAAS_BASE, familySlug: '' }, creds)
      if (!loginResult.ok) {
        // The server anti-enumerates registration: it returns success even for an email that
        // already has an account, so a follow-up login failure here doesn't mean account
        // creation failed - it may just mean this email is already registered. Keep the copy
        // neutral rather than claiming "Account created."
        setError('Couldn’t sign you in - if you already have an account, use Sign in below or reset your password.')
        return
      }

      const route = await routeAfterAccountLogin({
        base: SAAS_BASE,
        token: loginResult.token,
        creds,
        biometric,
        familySlug: loginResult.familySlug || undefined,
        verified: loginResult.verified ?? true,
      }, deps)
      if (route.kind === 'error') {
        setError(route.message)
        return
      }
      navigate(screenForRoute(route, { token: loginResult.token, creds, biometric, firstName: first }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="m-scr">
      <Header title="Create your account." onBack={() => navigate({ name: 'acct-signin' })} />
      <div className="m-bd">
        <div className="f-grid">
          <p className="fh" style={{ marginTop: 0 }}>14 days free, no card needed.</p>
          <div className="f-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label className="fl" htmlFor="suF">First name</label>
              <input className="fi" id="suF" placeholder="Betty" value={first} onChange={e => setFirst(e.target.value)} />
            </div>
            <div>
              <label className="fl" htmlFor="suL">Last name</label>
              <input className="fi" id="suL" placeholder="Sprout" value={last} onChange={e => setLast(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="fl" htmlFor="suE">Email</label>
            <input className="fi" id="suE" type="email" autoCapitalize="none" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="fl" htmlFor="suP">Password</label>
            <input className="fi" id="suP" type="password" placeholder="Make it a good one"
              value={pw} onChange={e => setPw(e.target.value)} />
            <div className="reqs">
              {PW_REQS.map(([label, fn]) => (
                <span key={label} className={fn(pw) ? 'ok' : ''}><i>✓</i>{label}</span>
              ))}
            </div>
          </div>
          <BioCheck checked={biometric} onChange={setBiometric} what="password" />
          {error && <ErrBox>{error}</ErrBox>}
          <button className="m-btn" disabled={busy || !ok} onClick={() => void signUp()}>
            {busy ? 'Planting your account…' : 'Start my free trial'}
          </button>
          <p className="legal">By signing up you agree to our Terms and Privacy Policy.</p>
          <div className="auth-alt">
            Already have an account? <button className="m-link" onClick={() => navigate({ name: 'acct-signin' })}>Sign in</button>
          </div>
        </div>
      </div>
    </div>
  )
}
