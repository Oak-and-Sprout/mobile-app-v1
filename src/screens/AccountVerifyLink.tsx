import { useEffect, useState } from 'react'
import type { Screen } from '../App'
import { Header, ErrBox } from '../components/chrome'
import { SAAS_BASE, verifyEmailToken } from '../services/account'

export interface AccountVerifyLinkDeps {
  verifyEmailToken: typeof verifyEmailToken
}

const defaultDeps = (): AccountVerifyLinkDeps => ({ verifyEmailToken })

type Phase = 'verifying' | 'verified' | 'failed'

/**
 * Landing screen for a cold `/verify?token=` Universal Link tap - no account
 * JWT, no stored credentials, just the one-time token from the email. That's
 * a different shape from AccountVerify (which polls an authenticated status
 * endpoint while a signed-in session waits for the click); this screen
 * consumes the token once and lands on sign-in, mirroring
 * AccountResetConfirm's shape rather than AccountVerify's.
 */
export default function AccountVerifyLink({
  navigate, token, deps: depsOverride,
}: {
  navigate: (s: Screen) => void
  token: string
  deps?: Partial<AccountVerifyLinkDeps>
}) {
  const [deps] = useState<AccountVerifyLinkDeps>(() => ({ ...defaultDeps(), ...depsOverride }))
  const [phase, setPhase] = useState<Phase>('verifying')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await deps.verifyEmailToken(SAAS_BASE, token)
      if (cancelled) return
      if (result.ok) {
        setPhase('verified')
        return
      }
      // An unreachable server and a bad/expired token both land here - to the
      // user they're the same dead end, and a permanent spinner is worse than
      // an honest message either way (same reasoning as AccountResetConfirm).
      setError(
        result.error === 'invalid'
          ? (result.message ?? 'That verification link is invalid or has expired.')
          : 'Can’t reach Sprout Track right now. Check your connection.',
      )
      setPhase('failed')
    })()
    return () => { cancelled = true }
  }, [deps, token])

  if (phase === 'verifying') {
    return (
      <div className="m-scr">
        <Header title="Verifying your email." />
        <div className="m-bd"><p className="fh">Confirming your email&hellip;</p></div>
      </div>
    )
  }

  if (phase === 'failed') {
    return (
      <div className="m-scr">
        <Header title="That link didn&rsquo;t work." onBack={() => navigate({ name: 'acct-signin' })} />
        <div className="m-bd">
          <div className="f-grid">
            {error && <ErrBox>{error}</ErrBox>}
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
      <Header title="Email verified." />
      <div className="m-bd">
        <div className="f-grid">
          <p className="fh" style={{ marginTop: 0 }}>You&rsquo;re verified. Sign in to keep going.</p>
          <button
            className="m-btn"
            onClick={() => navigate({ name: 'acct-signin', notice: 'Your email is verified - sign in to continue.' })}
          >
            Continue to sign in
          </button>
        </div>
      </div>
    </div>
  )
}
