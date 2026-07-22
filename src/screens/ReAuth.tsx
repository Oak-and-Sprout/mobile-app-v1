import { useCallback, useEffect, useState } from 'react'
import type { Screen } from '../App'
import { Header, ErrBox } from '../components/chrome'
import { BioCheck } from '../components/BioCheck'
import { CredentialFields } from '../components/CredentialFields'
import { CredentialVault, createVault, type StoredCredentials } from '../services/credential-vault'
import { sessionHandoffUrl } from '../services/connect'
import { touchServer, type ServerEntry } from '../services/server-registry'
import { loginWithCredentials } from '../services/session'

export interface ReAuthDeps {
  login: typeof loginWithCredentials
  vault: Pick<CredentialVault, 'store' | 'isBiometric' | 'peekIdentifier'>
  touch: typeof touchServer
  openUrl: (url: string) => void
}

const defaultDeps = (): ReAuthDeps => ({
  login: loginWithCredentials, vault: createVault(), touch: touchServer,
  openUrl: url => window.location.assign(url),
})

const ERROR_TEXT: Record<string, string> = {
  invalid: 'That still didn’t work. Give it another look and try again.',
  locked: 'Too many tries - the server is taking a breather. Try again in a few minutes.',
  unreachable: 'Can’t reach that server. Check the address and your connection.',
  'save-failed': 'Sign-in worked but saving it failed - try again.',
}

export default function ReAuth({
  navigate, entry, deps: depsOverride,
}: {
  navigate: (s: Screen) => void
  entry: ServerEntry
  deps?: Partial<ReAuthDeps>
}) {
  const [deps] = useState<ReAuthDeps>(() => ({ ...defaultDeps(), ...depsOverride }))
  const [creds, setCreds] = useState<StoredCredentials | null>(null)
  const [biometric, setBiometric] = useState(true)
  const [initial, setInitial] = useState<{ loginId?: string | null; email?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onCredsChange = useCallback((c: StoredCredentials | null) => setCreds(c), [])

  useEffect(() => {
    let cancelled = false
    void Promise.all([deps.vault.peekIdentifier(entry.id), deps.vault.isBiometric(entry.id)])
      .then(([id, bio]) => {
        if (cancelled) return
        setInitial(id)
        setBiometric(bio)
      })
      .catch(() => { if (!cancelled) setInitial({}) })
    return () => { cancelled = true }
  }, [deps, entry.id])

  async function verify() {
    if (!creds) return
    setError(null)
    setBusy(true)
    try {
      const result = await deps.login(entry, creds)
      if (!result.ok) {
        setError(ERROR_TEXT[result.error])
        return
      }
      try {
        await deps.vault.store(entry.id, creds, { biometric })
      } catch {
        setError(ERROR_TEXT['save-failed'])
        return
      }
      // Hand the session straight to the web app with the token we just got.
      // Going back through Connecting would re-read the vault (and re-prompt
      // biometric), which loops when biometric can't verify on this device.
      await deps.touch(entry.id)
      deps.openUrl(sessionHandoffUrl(entry.baseUrl, result))
    } finally {
      setBusy(false)
    }
  }

  const host = new URL(entry.baseUrl).host
  const what = entry.authType === 'ACCOUNT' ? 'password' : 'PIN'

  return (
    <div className="m-scr">
      <Header title="Sign in again" onBack={() => navigate({ name: 'families' })} />
      <div className="m-bd">
        <div className="f-grid">
          <p className="fh" style={{ marginTop: 0 }}>Your saved {what} for <b>{entry.familyName}</b> didn&rsquo;t work - your family may have changed it. Enter it again to keep one-tap sign-in on this phone.</p>
          <div className="fam-card" style={{ cursor: 'default' }}>
            <div className={'fam-av' + (entry.deploymentMode === 'saas' ? '' : ' apr')}>{entry.familyName[0]}</div>
            <div className="t">
              <div className="nm">{entry.familyName}</div>
              <div className="host">{host}</div>
            </div>
          </div>
          {initial !== null && (
            <CredentialFields authType={entry.authType} initial={initial} onChange={onCredsChange} />
          )}
          <BioCheck checked={biometric} onChange={setBiometric} what={what} />
          {error && <ErrBox>{error}</ErrBox>}
          <button className="m-btn" disabled={busy || creds === null} onClick={() => void verify()}>
            {busy ? 'Checking with your server…' : 'Verify & save'}
          </button>
        </div>
      </div>
    </div>
  )
}
