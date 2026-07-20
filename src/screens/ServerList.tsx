import { useEffect, useState } from 'react'
import type { Screen } from '../App'
import { connectToFamily, type ConnectOutcome } from '../services/connect'
import { createVault } from '../services/credential-vault'
import { listServers, removeServer, setDefaultServer, type ServerEntry } from '../services/server-registry'

export default function ServerList({
  navigate,
  connect = connectToFamily,
}: {
  navigate: (s: Screen) => void
  connect?: (entry: ServerEntry) => Promise<ConnectOutcome>
}) {
  const [servers, setServers] = useState<ServerEntry[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  const reload = () => { void listServers().then(setServers) }
  useEffect(reload, [])

  // `retry` below is handed to the offline screen and invoked after ServerList itself may
  // have unmounted (the app has since navigated to 'offline'). A 'locked'/'needs-login'
  // outcome on that later call can't rely on this component's setNotice still doing anything,
  // so it navigates back to server-list instead — mirrors App.tsx's openDefault pattern.
  async function open(entry: ServerEntry, viaRetry = false) {
    setNotice(null)
    const outcome = await connect(entry)
    if (outcome === 'offline') navigate({ name: 'offline', retry: () => void open(entry, true) })
    else if (outcome === 'locked' || outcome === 'needs-login') {
      if (viaRetry) navigate({ name: 'server-list' })
      else if (outcome === 'locked') setNotice('Too many attempts — try again in a few minutes.')
    }
  }

  async function remove(entry: ServerEntry) {
    await removeServer(entry.id)
    await createVault().clear(entry.id)
    reload()
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Families</h1>
        <button aria-label="Settings" className="text-gray-500" onClick={() => navigate({ name: 'settings' })}>
          ⚙︎
        </button>
      </div>

      {servers.map(entry => (
        <div key={entry.id} className="flex items-center gap-2">
          <button
            className="flex-1 rounded-xl border border-gray-200 bg-cream p-4 text-left dark:border-gray-700 dark:bg-gray-800"
            onClick={() => void open(entry)}
          >
            <span className="block font-semibold">
              {entry.familyName} {entry.isDefault && <span aria-label="default">★</span>}
            </span>
            <span className="block text-sm text-gray-500">{new URL(entry.baseUrl).host}</span>
          </button>
          <button aria-label={`Remove ${entry.familySlug}`} className="p-2 text-gray-400"
            onClick={() => void remove(entry)}>
            ✕
          </button>
          <button aria-label={`Make ${entry.familySlug} default`} className="p-2 text-gray-400"
            onClick={() => void setDefaultServer(entry.id).then(reload)}>
            {entry.isDefault ? '★' : '☆'}
          </button>
        </div>
      ))}

      {notice && <p role="alert" className="text-sm text-red-600">{notice}</p>}

      <button
        className="mt-2 rounded-xl bg-gradient-to-r from-brand to-brand-emerald px-6 py-3 font-semibold text-white"
        onClick={() => navigate({ name: 'add-server' })}
      >
        Add a family
      </button>
    </main>
  )
}
