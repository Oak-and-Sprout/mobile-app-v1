import { useEffect, useState } from 'react'
import { Preferences } from '@capacitor/preferences'
import type { Screen } from '../App'
import { createVault } from '../services/credential-vault'
import { listServers } from '../services/server-registry'

export const AUTO_OPEN_KEY = 'auto-open-default'

export async function isAutoOpenEnabled(): Promise<boolean> {
  const { value } = await Preferences.get({ key: AUTO_OPEN_KEY })
  return value !== 'false'
}

export default function Settings({ navigate }: { navigate: (s: Screen) => void }) {
  const [autoOpen, setAutoOpen] = useState(true)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => { void isAutoOpenEnabled().then(setAutoOpen) }, [])

  async function toggleAutoOpen(next: boolean) {
    setAutoOpen(next)
    await Preferences.set({ key: AUTO_OPEN_KEY, value: String(next) })
  }

  async function clearAll() {
    const vault = createVault()
    for (const entry of await listServers()) await vault.clear(entry.id)
    await Preferences.clear()
    setConfirming(false)
    navigate({ name: 'welcome' })
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <label className="flex items-center justify-between gap-4">
        <span>Open my family automatically</span>
        <input type="checkbox" checked={autoOpen} onChange={e => void toggleAutoOpen(e.target.checked)} />
      </label>

      {confirming ? (
        <div className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-4 dark:bg-red-950">
          <p className="text-sm">This removes every saved family and credential from this device.</p>
          <button className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white" onClick={() => void clearAll()}>
            Yes, clear everything
          </button>
          <button className="text-sm text-gray-500" onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      ) : (
        <button className="rounded-xl border border-red-300 px-6 py-3 font-semibold text-red-600"
          onClick={() => setConfirming(true)}>
          Clear all data
        </button>
      )}

      <p className="mt-auto text-center text-xs text-gray-400">Sprout Track Mobile v0.1.0</p>
      <button className="text-sm text-gray-500" onClick={() => navigate({ name: 'families' })}>Back</button>
    </main>
  )
}
