import { useEffect, useState } from 'react'
import { Preferences } from '@capacitor/preferences'
import type { Screen } from '../App'
import { Header } from '../components/chrome'
import { Ic } from '../components/Icons'
import { createVault } from '../services/credential-vault'
import { permissionState, unregisterFrom, type PermissionState } from '../services/push'
import { getOptIn, setOptIn, getLastToken, type OptIn } from '../services/push-opt-in'
import { listServers } from '../services/server-registry'

export const AUTO_OPEN_KEY = 'auto-open-default'

export async function isAutoOpenEnabled(): Promise<boolean> {
  const { value } = await Preferences.get({ key: AUTO_OPEN_KEY })
  return value !== 'false'
}

/** Driven by live OS state, not the stored preference alone - a user can revoke
 *  permission in OS settings at any time and a preference-driven row would lie. */
export function notificationRowState(perm: PermissionState, optIn: OptIn): 'on' | 'off' | 'blocked' {
  if (perm === 'denied') return 'blocked'
  return perm === 'granted' && optIn === 'granted' ? 'on' : 'off'
}

export default function Settings({ navigate }: { navigate: (s: Screen) => void }) {
  const [autoOpen, setAutoOpen] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [defName, setDefName] = useState<string | null>(null)
  const [notif, setNotif] = useState<'on' | 'off' | 'blocked'>('off')

  useEffect(() => { void isAutoOpenEnabled().then(setAutoOpen) }, [])
  useEffect(() => { void listServers().then(entries => setDefName(entries.find(e => e.isDefault)?.familyName ?? null)) }, [])
  useEffect(() => {
    void (async () => setNotif(notificationRowState(await permissionState(), await getOptIn())))()
  }, [])

  async function toggleAutoOpen(next: boolean) {
    setAutoOpen(next)
    await Preferences.set({ key: AUTO_OPEN_KEY, value: String(next) })
  }

  async function turnOffNotifications() {
    setNotif('off')
    await setOptIn('declined')
  }

  async function clearAll() {
    const vault = createVault()
    for (const entry of await listServers()) {
      const token = await getLastToken()
      if (token) await unregisterFrom(entry.baseUrl, token)
      await vault.clear(entry.id)
    }
    await Preferences.clear()
    setConfirming(false)
    navigate({ name: 'fork' })
  }

  return (
    <div className="m-scr">
      <Header title="Settings" onBack={() => navigate({ name: 'families' })} />
      <div className="m-bd">
        <div className="sect">
          <div className="swrow">
            <div className="t">
              <b>Open my starred family automatically</b>
              <p>Skip the list - the family marked with <Ic id="i-starf" s={13} style={{ color: 'var(--color-apricot)', verticalAlign: -1 }} /> {defName ? <>(<b style={{ fontWeight: 700 }}>{defName}</b>)</> : ''} opens the moment the app does. Your unlock is still the gate.</p>
            </div>
            <button className={'sw' + (autoOpen ? ' on' : '')} role="switch" aria-checked={autoOpen}
              aria-label="Open my starred family automatically" onClick={() => void toggleAutoOpen(!autoOpen)}><i></i></button>
          </div>
        </div>
        <div className="sect">
          <div className="sect-hd"><Ic id="i-bell" s={19} /><h3>Notifications</h3></div>
          {notif === 'on' && (
            <div className="swrow">
              <div className="t">
                <b>On for this phone</b>
                <p>Feed and medicine timers, and what your co-parent logs while you&rsquo;re away.</p>
              </div>
              <button className="sw on" role="switch" aria-checked={true}
                aria-label="Notifications" onClick={() => void turnOffNotifications()}><i></i></button>
            </div>
          )}
          {notif === 'off' && (
            <>
              <p style={{ marginBottom: 12 }}>Get a nudge for feed and medicine timers, and for what your co-parent logs while you&rsquo;re away.</p>
              <button className="m-btn sm" onClick={() => navigate({ name: 'push-intro', next: { name: 'settings' } })}>Turn on notifications</button>
            </>
          )}
          {notif === 'blocked' && (
            <>
              <p style={{ marginBottom: 12 }}>Turned off in your phone&rsquo;s settings.</p>
              <button className="m-btn ghost sm" onClick={() => window.location.assign('app-settings:')}>Open settings</button>
            </>
          )}
        </div>
        <div className="sect">
          <div className="sect-hd"><Ic id="i-shield" s={19} /><h3>Your sign-ins stay put</h3></div>
          <p>Saved PINs and passwords live in this phone&rsquo;s secure keychain and never leave it. Remove a family and its sign-in goes with it.</p>
        </div>
        <div className="sect">
          <div className="sect-hd"><Ic id="i-alert" s={19} style={{ color: 'var(--color-rust)' }} /><h3 style={{ color: 'var(--color-rust)' }}>Clear this phone</h3></div>
          <p style={{ marginBottom: 12 }}>Removes every saved family and sign-in from this phone. Your family&rsquo;s data stays safe on the server.</p>
          {confirming ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <p style={{ fontWeight: 700, color: 'var(--color-rust)' }}>This clears the book from this phone - the server keeps everything. Sure?</p>
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
