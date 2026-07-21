import { useEffect, useRef } from 'react'
import type { Screen } from '../App'
import { connectToFamily, type ConnectOutcome } from '../services/connect'
import type { ServerEntry } from '../services/server-registry'

export default function Connecting({
  entry, navigate, connect = connectToFamily,
}: {
  entry: ServerEntry
  navigate: (s: Screen) => void
  connect?: (entry: ServerEntry) => Promise<ConnectOutcome>
}) {
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    void (async () => {
      const outcome = await connect(entry)
      if (outcome === 'offline') navigate({ name: 'offline', entry })
      else if (outcome === 'locked') navigate({ name: 'families', notice: 'locked' })
      // 'navigated' and 'needs-login' both mean the webview is navigating away — keep showing.
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const host = new URL(entry.baseUrl).host
  return (
    <div className="m-scr">
      <div className="center-scr">
        <img className="pulse-logo" src="/logo.png" alt="" />
        <h2>Opening {entry.familyName}…</h2>
        <p style={{ color: 'var(--color-sub)', fontSize: 14.5 }}>{host} · signing you in with your saved credentials</p>
        <div className="dots"><i></i><i></i><i></i></div>
      </div>
    </div>
  )
}
