import { useEffect, useState } from 'react'
import type { Screen } from '../App'
import { Header, ErrBox } from '../components/chrome'
import { BioCheck } from '../components/BioCheck'
import { useBiometricDefault } from '../lib/biometric'
import { SAAS_BASE } from '../services/account'
import { validateSetupToken, exchangeSetupToken, type SetupTokenState } from '../services/wizard'

export interface SetupLinkDeps {
  validateSetupToken: typeof validateSetupToken
  exchangeSetupToken: typeof exchangeSetupToken
}

const defaultDeps = (): SetupLinkDeps => ({ validateSetupToken, exchangeSetupToken })

type Phase = 'checking' | 'password' | 'bad'

// Distinct copy per failure - these are genuinely different user situations
// (a stale bookmark vs. a link someone already finished vs. no connection).
const BAD_MESSAGE: Record<Exclude<SetupTokenState, 'valid'>, string> = {
  invalid: 'This setup link isn’t valid.',
  expired: 'This setup link has expired. Ask whoever sent it to generate a new one.',
  used: 'This setup link has already been used to set up a family.',
  unreachable: 'Can’t reach Sprout Track right now. Check your connection.',
}

const EXCHANGE_ERROR_MESSAGE: Record<'wrong-password' | 'invalid' | 'unreachable', string> = {
  'wrong-password': 'That password isn’t right - try again.',
  invalid: 'This setup link isn’t valid anymore.',
  unreachable: 'Can’t reach Sprout Track right now. Check your connection.',
}

export default function SetupLink({
  navigate, token, deps: depsOverride,
}: {
  navigate: (s: Screen) => void
  token: string
  deps?: Partial<SetupLinkDeps>
}) {
  const [deps] = useState<SetupLinkDeps>(() => ({ ...defaultDeps(), ...depsOverride }))
  const [phase, setPhase] = useState<Phase>('checking')
  const [badState, setBadState] = useState<Exclude<SetupTokenState, 'valid'>>('invalid')
  const [pw, setPw] = useState('')
  const [biometric, setBiometric] = useBiometricDefault()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await deps.validateSetupToken(SAAS_BASE, token)
      if (cancelled) return
      if (result === 'valid') {
        setPhase('password')
      } else {
        setBadState(result)
        setPhase('bad')
      }
    })()
    return () => { cancelled = true }
  }, [deps, token])

  async function submit() {
    setError(null)
    setBusy(true)
    try {
      const result = await deps.exchangeSetupToken(SAAS_BASE, token, pw)
      if (result.ok) {
        navigate({ name: 'wizard', token: result.jwt, mode: 'setup', setupToken: token, creds: null, biometric })
        return
      }
      setError(EXCHANGE_ERROR_MESSAGE[result.error])
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'checking') {
    return (
      <div className="m-scr">
        <Header title="Setting up your family." />
        <div className="m-bd"><p className="fh">Checking your link&hellip;</p></div>
      </div>
    )
  }

  if (phase === 'bad') {
    return (
      <div className="m-scr">
        <Header title="That link doesn’t work." onBack={() => navigate({ name: 'fork' })} />
        <div className="m-bd">
          <div className="f-grid">
            <p className="fh" style={{ marginTop: 0 }}>{BAD_MESSAGE[badState]}</p>
            <div className="auth-alt">
              <button className="m-link" onClick={() => navigate({ name: 'fork' })}>Back</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="m-scr">
      <Header title="Setting up your family." onBack={() => { if (!busy) navigate({ name: 'fork' }) }} />
      <div className="m-bd">
        <div className="f-grid">
          <p className="fh" style={{ marginTop: 0 }}>Enter the setup password you were given to continue.</p>
          <div>
            <label className="fl" htmlFor="slPw">Setup password</label>
            <input
              className="fi" id="slPw" type="password" placeholder="Setup password"
              value={pw} onChange={e => setPw(e.target.value)}
            />
          </div>
          <BioCheck checked={biometric} onChange={setBiometric} what="PIN" />
          {error && <ErrBox>{error}</ErrBox>}
          <button className="m-btn" disabled={busy || !pw} onClick={() => void submit()}>
            {busy ? 'Checking…' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
