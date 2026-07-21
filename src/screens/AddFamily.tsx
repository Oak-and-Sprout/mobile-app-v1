import { useEffect, useState } from 'react'
import type { Screen } from '../App'
import { ErrBox, Header, WarnBox } from '../components/chrome'
import { BioCheck } from '../components/BioCheck'
import { CredentialVault, createVault, type StoredCredentials } from '../services/credential-vault'
import {
  ProbeError, fetchAuthType, fetchFamilyBySlug, parseServerInput, probeDeployment,
  type AuthType, type DeploymentConfig, type PublicFamily,
} from '../services/server-probe'
import { listServers, saveServer } from '../services/server-registry'
import { loginWithCredentials } from '../services/session'

export interface AddFamilyDeps {
  probeDeployment: typeof probeDeployment
  fetchFamilyBySlug: typeof fetchFamilyBySlug
  fetchAuthType: typeof fetchAuthType
  saveServer: typeof saveServer
  listServers: typeof listServers
  login: typeof loginWithCredentials
  vault: CredentialVault
}

const defaultDeps = (): AddFamilyDeps => ({
  probeDeployment, fetchFamilyBySlug, fetchAuthType, saveServer, listServers,
  login: loginWithCredentials, vault: createVault(),
})

interface Located {
  baseUrl: string
  config: DeploymentConfig
  family: PublicFamily
  authType: AuthType
}

const ERROR_TEXT: Record<string, string> = {
  'invalid-url': "That doesn’t look like an address. Try something like myhost.com/smith-family.",
  'missing-slug': "Add your family’s name to the end - like myhost.com/smith-family.",
  'family-not-found': "No family by that name on this server. Check the spelling?",
  'not-sprout-track': "We reached it, but it isn’t a Sprout Track server.",
  unreachable: "Can’t reach that server. Check the address and your connection.",
  invalid: "That PIN didn’t work. Give it another look and try again.",
  locked: 'Too many tries - the server is taking a breather. Try again in a few minutes.',
  'save-failed': 'Login worked but saving the family failed - try again.',
}

export default function AddFamily({
  navigate, prefillInput, deps: depsOverride,
}: {
  navigate: (s: Screen) => void
  prefillInput?: string
  deps?: Partial<AddFamilyDeps>
}) {
  const [deps] = useState<AddFamilyDeps>(() => ({ ...defaultDeps(), ...depsOverride }))
  const [input, setInput] = useState(prefillInput ?? '')
  const [located, setLocated] = useState<Located | null>(null)
  const [loginId, setLoginId] = useState('')
  const [pin, setPin] = useState('')
  const [biometric, setBiometric] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [hasFamilies, setHasFamilies] = useState(true)

  useEffect(() => {
    let cancelled = false
    deps.listServers().then(list => {
      if (!cancelled) setHasFamilies(list.length > 0)
    }).catch(() => { /* keep default true  -  don't strand the user on a listServers error */ })
    return () => { cancelled = true }
  }, [deps])

  async function locate() {
    setError(null)
    setLocated(null)
    setBusy(true)
    try {
      const { baseUrl, familySlug } = parseServerInput(input)
      if (!familySlug) throw new Error('missing-slug')
      const config = await deps.probeDeployment(baseUrl)
      const family = await deps.fetchFamilyBySlug(baseUrl, familySlug)
      const authType = await deps.fetchAuthType(baseUrl, familySlug)
      setLocated({ baseUrl, config, family, authType })
      setLoginId('')
      setPin('')
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
      const creds: StoredCredentials = { type: 'pin', loginId: located.authType === 'CARETAKER' ? loginId : null, securityPin: pin }
      const target = { id: `${located.baseUrl}|${located.family.slug}`, baseUrl: located.baseUrl, familySlug: located.family.slug }
      const result = await deps.login(target, creds)
      if (!result.ok) {
        setError(ERROR_TEXT[result.error])
        return
      }
      try {
        const saved = await deps.saveServer({
          baseUrl: located.baseUrl,
          familySlug: located.family.slug,
          familyName: located.family.name,
          deploymentMode: located.config.deploymentMode,
          authType: located.authType,
        })
        await deps.vault.store(saved.id, creds, { biometric })
        navigate({ name: 'families', toast: `Saved - ${located.family.name} is on this phone now.` })
      } catch {
        setError(ERROR_TEXT['save-failed'])
      }
    } finally {
      setBusy(false)
    }
  }

  const cleartext = located?.baseUrl.startsWith('http://') ?? false
  const host = located ? new URL(located.baseUrl).host : ''
  const hosted = host === 'sprout-track.com' || host.endsWith('.sprout-track.com')
  const canVerify = located?.authType === 'CARETAKER' ? loginId !== '' && pin !== '' : pin !== ''

  return (
    <div className="m-scr">
      <Header title="Connect to a family" onBack={() => navigate(hasFamilies ? { name: 'families' } : { name: 'welcome' })} />
      <div className="m-bd">
        <div className="f-grid">
          <div>
            <label className="fl" htmlFor="addr">Family link</label>
            <input className="fi" id="addr" value={input} autoCapitalize="none" spellCheck="false"
              placeholder="myhost.com/smith-family"
              onChange={e => { setInput(e.target.value); setLocated(null); setError(null) }} />
            <p className="fh">The same address you&rsquo;d open in a browser - hosted or self-hosted.</p>
          </div>
          {!located && (
            <button className="m-btn" disabled={busy || input.trim() === ''} onClick={() => void locate()}>
              {busy ? 'Knocking on the door…' : 'Find my family'}
            </button>
          )}
          {error && !located && <ErrBox>{error}</ErrBox>}
          {located && <>
            <div className="fam-card" style={{ cursor: 'default' }}>
              <div className={'fam-av' + (hosted ? '' : ' apr')}>{located.family.name[0]}</div>
              <div className="t">
                <div className="nm">{located.family.name}</div>
                <div className="host">{host}</div>
              </div>
              <span className={'chip ' + (hosted ? 'c-teal' : 'c-apr')}>{hosted ? 'Hosted' : 'Self-hosted'}</span>
            </div>
            {cleartext && <WarnBox>Heads up - this connection isn&rsquo;t encrypted. Fine on your home network, risky on public Wi-Fi.</WarnBox>}
            <div className="fgroup">
              <b>How you sign in</b>
              <p className="fh">Same {located.authType === 'CARETAKER' ? 'ID and PIN' : 'PIN'} as the website - we check it with your server, then keep it safe here.</p>
              {located.authType === 'CARETAKER' ? (
                <div className="f-2">
                  <div><label className="fl" htmlFor="lid">Login ID</label>
                    <input className="fi" id="lid" inputMode="numeric" maxLength={2} placeholder="11" value={loginId} onChange={e => setLoginId(e.target.value)} /></div>
                  <div><label className="fl" htmlFor="pin">PIN</label>
                    <input className="fi" id="pin" type="password" inputMode="numeric" maxLength={10} placeholder="••••••" value={pin} onChange={e => setPin(e.target.value)} /></div>
                </div>
              ) : (
                <div><label className="fl" htmlFor="pin">Family PIN</label>
                  <input className="fi" id="pin" type="password" inputMode="numeric" maxLength={10} placeholder="••••••" value={pin} onChange={e => setPin(e.target.value)} /></div>
              )}
            </div>
            <BioCheck checked={biometric} onChange={setBiometric} />
            {error && <ErrBox>{error}</ErrBox>}
            <button className="m-btn" disabled={busy || !canVerify} onClick={() => void verifyAndSave()}>
              {busy ? 'Checking with your server…' : 'Verify & save'}
            </button>
          </>}
        </div>
      </div>
    </div>
  )
}
