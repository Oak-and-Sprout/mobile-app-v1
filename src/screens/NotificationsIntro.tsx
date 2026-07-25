import { useState } from 'react'
import type { Screen } from '../App'
import { Header } from '../components/chrome'
import { Ic } from '../components/Icons'
import { requestPermission } from '../services/push'
import { setOptIn } from '../services/push-opt-in'

export interface NotificationsIntroDeps {
  requestPermission: typeof requestPermission
  setOptIn: typeof setOptIn
}

const defaultDeps = (): NotificationsIntroDeps => ({ requestPermission, setOptIn })

export default function NotificationsIntro({
  navigate, next, deps: depsOverride,
}: {
  navigate: (s: Screen) => void
  next: Screen
  deps?: Partial<NotificationsIntroDeps>
}) {
  const [deps] = useState<NotificationsIntroDeps>(() => ({ ...defaultDeps(), ...depsOverride }))
  const [busy, setBusy] = useState(false)

  async function turnOn() {
    setBusy(true)
    const state = await deps.requestPermission()
    await deps.setOptIn(state === 'granted' ? 'granted' : 'declined')
    navigate(next)
  }

  async function notNow() {
    await deps.setOptIn('declined')
    navigate(next)
  }

  return (
    <div className="m-scr">
      <Header title="Know when it&rsquo;s time" />
      <div className="m-bd">
        <div className="sect">
          <div className="sect-hd"><Ic id="i-bell" s={19} /><h3>Notifications</h3></div>
          <p>Feed and medicine timers, and what your co-parent logs while you&rsquo;re away.
            We&rsquo;ll only send what your family has turned on.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
          <button className="m-btn" disabled={busy} onClick={() => void turnOn()}>Turn on</button>
          <button className="m-btn ghost" disabled={busy} onClick={() => void notNow()}>Not now</button>
        </div>
        <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--color-sub)', marginTop: 18 }}>
          You can change this any time in Settings.
        </p>
      </div>
    </div>
  )
}
