import { useEffect, useState } from 'react'
import type { Screen } from '../App'
import { Header, ErrBox } from '../components/chrome'
import { PW_REQS, passwordMeetsRules } from '../lib/password-rules'
import { SAAS_BASE, validateResetToken, submitPasswordReset } from '../services/account'

export interface AccountResetConfirmDeps {
  validateResetToken: typeof validateResetToken
  submitPasswordReset: typeof submitPasswordReset
}

const defaultDeps = (): AccountResetConfirmDeps => ({ validateResetToken, submitPasswordReset })

type Phase = 'checking' | 'valid' | 'invalid'

export default function AccountResetConfirm({
  navigate, token, deps: depsOverride,
}: {
  navigate: (s: Screen) => void
  token: string
  deps?: Partial<AccountResetConfirmDeps>
}) {
  const [deps] = useState<AccountResetConfirmDeps>(() => ({ ...defaultDeps(), ...depsOverride }))
  const [phase, setPhase] = useState<Phase>('checking')
  const [email, setEmail] = useState<string | null>(null)
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await deps.validateResetToken(SAAS_BASE, token)
      if (cancelled) return
      // A null result means we couldn't reach the server. Showing the invalid
      // state with a "request a new link" path beats a blank or stuck screen.
      if (!result || !result.valid) return setPhase('invalid')
      setEmail(result.email ?? null)
      setPhase('valid')
    })()
    return () => { cancelled = true }
  }, [deps, token])

  async function save() {
    setError(null)
    setBusy(true)
    try {
      const result = await deps.submitPasswordReset(SAAS_BASE, token, pw)
      if (result.ok) {
        navigate({ name: 'acct-signin', notice: 'Your new password is saved - sign in with it.' })
        return
      }
      // The token can expire between validation and submission (e.g. the hour ran out
      // while the user was typing). That's the same recovery path as an invalid link -
      // a fresh one - not a generic error the user might think a retry will fix.
      if (result.error === 'invalid') return setPhase('invalid')
      setError(result.error === 'rate-limited'
        ? (result.message ?? 'Too many attempts. Try again in a few minutes.')
        : 'Can’t reach Sprout Track right now. Check your connection.')
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'checking') {
    return (
      <div className="m-scr">
        <Header title="Set a new password." />
        <div className="m-bd"><p className="fh">Checking your link&hellip;</p></div>
      </div>
    )
  }

  if (phase === 'invalid') {
    return (
      <div className="m-scr">
        <Header title="That link expired." onBack={() => navigate({ name: 'acct-signin' })} />
        <div className="m-bd">
          <div className="f-grid">
            <p className="fh" style={{ marginTop: 0 }}>
              Reset links work for one hour, and only once. We can send you another.
            </p>
            <button className="m-btn" onClick={() => navigate({ name: 'acct-reset' })}>Send me a new link</button>
            <div className="auth-alt">
              <button className="m-link" onClick={() => navigate({ name: 'acct-signin' })}>Back to sign in</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="m-scr">
      <Header title="Set a new password." onBack={() => { if (!busy) navigate({ name: 'acct-signin' }) }} />
      <div className="m-bd">
        <div className="f-grid">
          {email && <p className="fh" style={{ marginTop: 0 }}>For <b>{email}</b>.</p>}
          <div>
            <label className="fl" htmlFor="rcP">New password</label>
            <input className="fi" id="rcP" type="password" placeholder="Make it a good one"
              value={pw} onChange={e => setPw(e.target.value)} />
            <div className="reqs">
              {PW_REQS.map(([label, fn]) => (
                <span key={label} className={fn(pw) ? 'ok' : ''}><i>✓</i>{label}</span>
              ))}
            </div>
          </div>
          {error && <ErrBox>{error}</ErrBox>}
          <button className="m-btn" disabled={busy || !passwordMeetsRules(pw)} onClick={() => void save()}>
            Save new password
          </button>
        </div>
      </div>
    </div>
  )
}
