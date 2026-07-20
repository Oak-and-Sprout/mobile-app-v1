import { useEffect, useState } from 'react'
import Welcome from './screens/Welcome'
import ServerList from './screens/ServerList'
import AddServer from './screens/AddServer'
import Offline from './screens/Offline'
import { listServers } from './services/server-registry'

export type Screen =
  | { name: 'welcome' }
  | { name: 'add-server'; prefillBaseUrl?: string }
  | { name: 'server-list' }
  | { name: 'settings' }
  | { name: 'offline'; retry: () => void }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'welcome' })
  useEffect(() => {
    void listServers().then(servers => {
      if (servers.length > 0) setScreen({ name: 'server-list' })
    })
  }, [])
  return (
    <div data-testid="app-root">
      {screen.name === 'welcome' && <Welcome navigate={setScreen} />}
      {screen.name === 'server-list' && <ServerList navigate={setScreen} />}
      {screen.name === 'add-server' && <AddServer navigate={setScreen} prefillBaseUrl={screen.prefillBaseUrl} />}
      {screen.name === 'settings' && <div>Settings (Task 10)</div>}
      {screen.name === 'offline' && <Offline navigate={setScreen} retry={screen.retry} />}
    </div>
  )
}
