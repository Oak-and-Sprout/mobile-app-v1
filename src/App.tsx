import { useEffect, useRef, useState } from 'react'
import Splash from './screens/Splash'
import Fork from './screens/Fork'
import Families from './screens/Families'
import AddFamily from './screens/AddFamily'
import AccountSignIn from './screens/AccountSignIn'
import AccountSignUp from './screens/AccountSignUp'
import AccountVerify from './screens/AccountVerify'
import AccountReset from './screens/AccountReset'
import Offline from './screens/Offline'
import Connecting from './screens/Connecting'
import ReAuth from './screens/ReAuth'
import Settings, { isAutoOpenEnabled } from './screens/Settings'
import Wizard from './screens/wizard/Wizard'
import { getDefaultServer, listServers, type ServerEntry } from './services/server-registry'
import { bootActionFromSearch, stripBridgeEvent } from './services/bridge-events'
import type { AccountCreds } from './services/credential-vault'
import type { WizardResume } from './services/account-routing'

export type Screen =
  | { name: 'splash' }
  | { name: 'fork' }
  | { name: 'acct-signin'; notice?: string }
  | { name: 'acct-signup' }
  | { name: 'acct-verify'; token: string; creds: AccountCreds; biometric: boolean }
  | { name: 'acct-reset' }
  | { name: 'wizard'; token: string; creds: AccountCreds; biometric: boolean; resume?: WizardResume; firstName?: string }
  | { name: 'add-family'; prefillInput?: string }
  | { name: 'families'; toast?: string; notice?: string }
  | { name: 'settings' }
  | { name: 'offline'; entry: ServerEntry }
  | { name: 'connecting'; entry: ServerEntry }
  | { name: 'reauth'; entry: ServerEntry }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'splash' })
  const bootTarget = useRef<Screen | null>(null)
  const splashDone = useRef(false)

  useEffect(() => {
    // A `?bridge-event=` param means the web app handed control back to the shell.
    // Read it before the async work below and strip it immediately so it isn't
    // reprocessed on a later remount.
    const bootAction = bootActionFromSearch(window.location.search)
    stripBridgeEvent()

    const applyBootTarget = (target: Screen) => {
      bootTarget.current = target
      if (splashDone.current) setScreen(s => (s.name === 'splash' ? target : s))
    }

    void (async () => {
      const servers = await listServers()
      if (servers.length === 0) return applyBootTarget({ name: 'fork' })
      if (bootAction === 'show-server-list') return applyBootTarget({ name: 'families' })
      if (bootAction === 'reconnect') {
        // listServers() sorts most-recently-used first; the entry we just left is at the top.
        const recent = servers.find(e => e.lastUsedAt !== null)
        return applyBootTarget(recent ? { name: 'connecting', entry: recent } : { name: 'families' })
      }
      const def = await getDefaultServer()
      const autoOpen = def ? await isAutoOpenEnabled() : false
      applyBootTarget(def && autoOpen ? { name: 'connecting', entry: def } : { name: 'families' })
    })()
  }, [])

  const handleSplashDone = () => {
    splashDone.current = true
    const target = bootTarget.current
    if (target) setScreen(s => (s.name === 'splash' ? target : s))
  }

  return (
    <div className="m-root" data-testid="app-root">
      {screen.name === 'splash' && <Splash onDone={handleSplashDone} />}
      {screen.name === 'fork' && <Fork navigate={setScreen} />}
      {screen.name === 'acct-signin' && <AccountSignIn navigate={setScreen} notice={screen.notice} />}
      {screen.name === 'acct-signup' && <AccountSignUp navigate={setScreen} />}
      {screen.name === 'acct-verify' && (
        <AccountVerify navigate={setScreen} token={screen.token} creds={screen.creds} biometric={screen.biometric} />
      )}
      {screen.name === 'acct-reset' && <AccountReset navigate={setScreen} />}
      {screen.name === 'wizard' && (
        <Wizard
          navigate={setScreen}
          token={screen.token}
          creds={screen.creds}
          biometric={screen.biometric}
          resume={screen.resume}
          firstName={screen.firstName}
        />
      )}
      {screen.name === 'families' && <Families navigate={setScreen} toast={screen.toast} notice={screen.notice} />}
      {screen.name === 'add-family' && <AddFamily navigate={setScreen} prefillInput={screen.prefillInput} />}
      {screen.name === 'settings' && <Settings navigate={setScreen} />}
      {screen.name === 'offline' && <Offline navigate={setScreen} entry={screen.entry} />}
      {screen.name === 'connecting' && <Connecting entry={screen.entry} navigate={setScreen} />}
      {screen.name === 'reauth' && <ReAuth entry={screen.entry} navigate={setScreen} />}
    </div>
  )
}
