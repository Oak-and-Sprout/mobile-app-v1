import { useEffect, useRef, useState } from 'react'
import Welcome from './screens/Welcome'
import ServerList from './screens/ServerList'
import AddServer from './screens/AddServer'
import Offline from './screens/Offline'
import Settings, { isAutoOpenEnabled } from './screens/Settings'
import { connectToFamily } from './services/connect'
import { getDefaultServer, listServers, type ServerEntry } from './services/server-registry'

export type Screen =
  | { name: 'welcome' }
  | { name: 'add-server'; prefillBaseUrl?: string }
  | { name: 'server-list' }
  | { name: 'settings' }
  | { name: 'offline'; retry: () => void }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'welcome' })
  const screenRef = useRef(screen)
  useEffect(() => { screenRef.current = screen }, [screen])

  useEffect(() => {
    // Shared by the initial launch attempt and the offline screen's retry button, so a
    // 'locked'/'needs-login' outcome on retry surfaces the same way it would at launch
    // instead of being silently dropped. `guard` is the screen name this call was
    // launched from — the resulting setScreen only applies if the user hasn't since
    // navigated away from it (welcome for the initial attempt, offline for retries).
    async function openDefault(def: ServerEntry, guard: 'welcome' | 'offline') {
      const outcome = await connectToFamily(def)
      if (outcome === 'offline') {
        setScreen(s => s.name === guard ? { name: 'offline', retry: () => void openDefault(def, 'offline') } : s)
      } else if (outcome !== 'navigated') {
        setScreen(s => s.name === guard ? { name: 'server-list' } : s)
      }
    }

    void (async () => {
      const servers = await listServers()
      if (servers.length === 0) return
      const fallback = () => setScreen(s => (s.name === 'welcome') ? { name: 'server-list' } : s)
      const def = await getDefaultServer()
      const autoOpen = def ? await isAutoOpenEnabled() : false
      // Only auto-connect if the user is still on the welcome screen — a click that
      // navigated away while these awaits were pending must not be clobbered.
      if (def && autoOpen && screenRef.current.name === 'welcome') {
        await openDefault(def, 'welcome')
      } else {
        fallback()
      }
    })()
  }, [])

  return (
    <div data-testid="app-root">
      {screen.name === 'welcome' && <Welcome navigate={setScreen} />}
      {screen.name === 'server-list' && <ServerList navigate={setScreen} />}
      {screen.name === 'add-server' && <AddServer navigate={setScreen} prefillBaseUrl={screen.prefillBaseUrl} />}
      {screen.name === 'settings' && <Settings navigate={setScreen} />}
      {screen.name === 'offline' && <Offline navigate={setScreen} retry={screen.retry} />}
    </div>
  )
}
