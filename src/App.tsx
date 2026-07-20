import { useState } from 'react'
import Welcome from './screens/Welcome'
import ServerList from './screens/ServerList'
import AddServer from './screens/AddServer'

export type Screen =
  | { name: 'welcome' }
  | { name: 'add-server'; prefillBaseUrl?: string }
  | { name: 'server-list' }
  | { name: 'settings' }
  | { name: 'offline'; retry: () => void }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'welcome' })
  return (
    <div data-testid="app-root">
      {screen.name === 'welcome' && <Welcome navigate={setScreen} />}
      {screen.name === 'server-list' && <ServerList navigate={setScreen} />}
      {screen.name === 'add-server' && <AddServer navigate={setScreen} prefillBaseUrl={screen.prefillBaseUrl} />}
      {screen.name === 'settings' && <div>Settings (Task 10)</div>}
      {screen.name === 'offline' && <div>Offline (Task 9)</div>}
    </div>
  )
}
