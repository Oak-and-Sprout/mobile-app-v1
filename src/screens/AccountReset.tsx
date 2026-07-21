import { useState } from 'react'
import type { Screen } from '../App'
import { Header, ErrBox } from '../components/chrome'
import { SAAS_BASE, requestPasswordReset } from '../services/account'

export interface AccountResetDeps {
  requestPasswordReset: typeof requestPasswordReset
}

const defaultDeps = (): AccountResetDeps => ({ requestPasswordReset })

export default function AccountReset({
  navigate, deps: depsOverride,
}: {
  navigate: (s: Screen) => void
  deps?: Partial<AccountResetDeps>
}) {
  const [deps] = useState<AccountResetDeps>(() => ({ ...defaultDeps(), ...depsOverride }))
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    setError(null)
    setBusy(true)
    try {
      const ok = await deps.requestPasswordReset(SAAS_BASE, email)
      if (!ok) {
        setError('Can’t reach Sprout Track right now. Check your connection.')
        return
      }
      navigate({ name: 'acct-signin', notice: `Reset link sent to ${email} - it works for one hour.` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="m-scr">
      <Header title="Reset your password." onBack={() => navigate({ name: 'acct-signin' })} />
      <div className="m-bd">
        <div className="f-grid">
          <p className="fh" style={{ marginTop: 0 }}>We&rsquo;ll email you a link. It works for one hour.</p>
          <div>
            <label className="fl" htmlFor="rsE">Email</label>
            <input className="fi" id="rsE" type="email" autoCapitalize="none" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          {error && <ErrBox>{error}</ErrBox>}
          <button className="m-btn" disabled={busy || !email} onClick={() => void send()}>Email me the link</button>
          <div className="auth-alt">Remembered it? <button className="m-link" onClick={() => navigate({ name: 'acct-signin' })}>Back to sign in</button></div>
        </div>
      </div>
    </div>
  )
}
