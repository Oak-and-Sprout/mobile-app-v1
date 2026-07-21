import { useEffect, useState } from 'react'
import { Preferences } from '@capacitor/preferences'
import type { Screen } from '../App'
import { Header } from '../components/chrome'
import { Ic } from '../components/Icons'
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
  const [defName, setDefName] = useState<string | null>(null)

  useEffect(() => { void isAutoOpenEnabled().then(setAutoOpen) }, [])
  useEffect(() => { void listServers().then(entries => setDefName(entries.find(e => e.isDefault)?.familyName ?? null)) }, [])

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
    <div className="m-scr">
      <Header title="Settings" onBack={() => navigate({ name: 'families' })} />
      <div className="m-bd">
        <div className="sect">
          <div className="swrow">
            <div className="t">
              <b>Open my family automatically</b>
              <p>Skip the list — jump straight into {defName ? <b style={{ fontWeight: 700 }}>{defName}</b> : 'your default family'} when the app opens. Your unlock is still the gate.</p>
            </div>
            <button className={'sw' + (autoOpen ? ' on' : '')} role="switch" aria-checked={autoOpen}
              aria-label="Open my family automatically" onClick={() => void toggleAutoOpen(!autoOpen)}><i></i></button>
          </div>
        </div>
        <div className="sect">
          <div className="sect-hd"><Ic id="i-shield" s={19} /><h3>Your PINs stay put</h3></div>
          <p>Saved sign-ins live in this phone&rsquo;s secure keychain and never leave it. Remove a family and its PIN goes with it.</p>
        </div>
        <div className="sect">
          <div className="sect-hd"><Ic id="i-alert" s={19} style={{ color: 'var(--color-rust)' }} /><h3 style={{ color: 'var(--color-rust)' }}>Clear this phone</h3></div>
          <p style={{ marginBottom: 12 }}>Removes every saved family and PIN from this phone. Your family&rsquo;s data stays safe on the server.</p>
          {confirming ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <p style={{ fontWeight: 700, color: 'var(--color-rust)' }}>This clears the book from this phone — the server keeps everything. Sure?</p>
              <div style={{ display: 'flex', gap: 9 }}>
                <button className="m-btn danger solid sm" onClick={() => void clearAll()}>Yes, clear it</button>
                <button className="m-btn ghost sm" onClick={() => setConfirming(false)}>Keep it</button>
              </div>
            </div>
          ) : (
            <button className="m-btn danger sm" onClick={() => setConfirming(true)}>Clear all data</button>
          )}
        </div>
        <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--color-sub)', marginTop: 22 }}>
          Sprout Track Mobile v0.1.0<br />The tracker itself lives on your server.
        </p>
      </div>
    </div>
  )
}
