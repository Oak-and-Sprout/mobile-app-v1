import { useEffect, useRef, useState } from 'react'
import type { Screen } from '../App'
import { Header, ErrBox } from '../components/chrome'
import { Ic } from '../components/Icons'
import { createVault, type AccountCreds } from '../services/credential-vault'
import { fetchFamilyBySlug } from '../services/server-probe'
import { saveServer } from '../services/server-registry'
import { SAAS_BASE, fetchAccountStatus, resendVerification, fetchSetupStatus } from '../services/account'
import { routeAfterAccountLogin, screenForRoute, type AccountRoutingDeps } from '../services/account-routing'

export interface AccountVerifyDeps extends AccountRoutingDeps {
  fetchAccountStatus: typeof fetchAccountStatus
  resendVerification: typeof resendVerification
}

const defaultDeps = (): AccountVerifyDeps => ({
  fetchAccountStatus, resendVerification, fetchSetupStatus, fetchFamilyBySlug, saveServer, vault: createVault(),
})

export default function AccountVerify({
  navigate, token, creds, biometric, deps: depsOverride, pollMs = 5000,
}: {
  navigate: (s: Screen) => void
  token: string
  creds: AccountCreds
  biometric: boolean
  deps?: Partial<AccountVerifyDeps>
  pollMs?: number
}) {
  const [deps] = useState<AccountVerifyDeps>(() => ({ ...defaultDeps(), ...depsOverride }))
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const routedRef = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false

    function stopPolling() {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    async function check() {
      const status = await deps.fetchAccountStatus(SAAS_BASE, token)
      if (cancelled || routedRef.current || !status?.verified) return
      routedRef.current = true
      stopPolling()

      const route = await routeAfterAccountLogin({
        base: SAAS_BASE,
        token,
        creds,
        biometric,
        familySlug: status.familySlug,
        verified: true,
      }, deps)
      if (cancelled) return

      if (route.kind === 'error') {
        setError(route.message)
        return
      }
      navigate(screenForRoute(route, { token, creds, biometric, firstName: status.firstName }))
    }

    void check()
    intervalRef.current = setInterval(() => { void check() }, pollMs)
    return () => {
      cancelled = true
      stopPolling()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function resend() {
    setError(null)
    setNote(null)
    setBusy(true)
    try {
      const ok = await deps.resendVerification(SAAS_BASE, creds.email)
      if (ok) {
        setNote('Sent - check your inbox.')
      } else {
        setError('Couldn’t resend just now - try again in a minute.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="m-scr">
      <Header title="Check your email." onBack={() => navigate({ name: 'acct-signin' })} />
      <div className="m-bd">
        <div className="f-grid">
          <p className="fh" style={{ marginTop: 0 }}>We sent a verification link to <b>{creds.email}</b>. Tap it, then come back here - we&rsquo;ll notice the moment you&rsquo;re verified.</p>
          <div className="slug-checking"><span className="dots" style={{ margin: 0 }}><i></i><i></i><i></i></span>Waiting for your click…</div>
          {note && <p className="slug-ok"><Ic id="i-check" s={15} />{note}</p>}
          {error && <ErrBox>{error}</ErrBox>}
          <button className="m-btn ghost" disabled={busy} onClick={() => void resend()}>Resend the email</button>
        </div>
      </div>
    </div>
  )
}
