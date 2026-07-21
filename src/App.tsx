import { useEffect, useState } from 'react'
import Welcome from './screens/Welcome'
import Families from './screens/Families'
import AddFamily from './screens/AddFamily'
import AccountSignIn from './screens/AccountSignIn'
import Offline from './screens/Offline'
import Connecting from './screens/Connecting'
import Settings, { isAutoOpenEnabled } from './screens/Settings'
import { IconDefs } from './components/Icons'
import { getDefaultServer, listServers, type ServerEntry } from './services/server-registry'
import { bootActionFromSearch, stripBridgeEvent } from './services/bridge-events'

export type Screen =
  | { name: 'welcome' }
  | { name: 'account-signin' }
  | { name: 'add-family'; prefillInput?: string }
  | { name: 'families'; toast?: string; notice?: string }
  | { name: 'settings' }
  | { name: 'offline'; entry: ServerEntry }
  | { name: 'connecting'; entry: ServerEntry }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'welcome' })

  useEffect(() => {
    // A `?bridge-event=` param means the web app handed control back to the shell.
    // Read it before the async work below and strip it immediately so it isn't
    // reprocessed on a later remount.
    const bootAction = bootActionFromSearch(window.location.search)
    stripBridgeEvent()

    void (async () => {
      const servers = await listServers()
      if (servers.length === 0) return // stay on welcome
      // Every setScreen below only applies while still on welcome — a user click
      // that navigated away during the awaits must not be clobbered.
      const ifWelcome = (next: Screen) => setScreen(s => (s.name === 'welcome' ? next : s))
      if (bootAction === 'show-server-list') return ifWelcome({ name: 'families' })
      if (bootAction === 'reconnect') {
        // listServers() sorts most-recently-used first; the entry we just left is at the top.
        const recent = servers.find(e => e.lastUsedAt !== null)
        return ifWelcome(recent ? { name: 'connecting', entry: recent } : { name: 'families' })
      }
      const def = await getDefaultServer()
      const autoOpen = def ? await isAutoOpenEnabled() : false
      if (def && autoOpen) ifWelcome({ name: 'connecting', entry: def })
      else ifWelcome({ name: 'families' })
    })()
  }, [])

  return (
    <div className="m-root" data-testid="app-root">
      <IconDefs />
      {screen.name === 'welcome' && <Welcome navigate={setScreen} />}
      {screen.name === 'account-signin' && <AccountSignIn navigate={setScreen} />}
      {screen.name === 'families' && <Families navigate={setScreen} toast={screen.toast} notice={screen.notice} />}
      {screen.name === 'add-family' && <AddFamily navigate={setScreen} prefillInput={screen.prefillInput} />}
      {screen.name === 'settings' && <Settings navigate={setScreen} />}
      {screen.name === 'offline' && <Offline navigate={setScreen} entry={screen.entry} />}
      {screen.name === 'connecting' && <Connecting entry={screen.entry} navigate={setScreen} />}
    </div>
  )
}
