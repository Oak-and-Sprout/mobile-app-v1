import { useEffect, useState } from 'react'
import type { Screen } from '../App'
import { Header, ErrBox } from '../components/chrome'
import { Ic } from '../components/Icons'
import Toast from '../components/Toast'
import { formatLastOpened } from '../lib/relative-time'
import { createVault } from '../services/credential-vault'
import { unregisterFrom } from '../services/push'
import { getLastToken } from '../services/push-opt-in'
import { listServers, removeServer, setDefaultServer, type ServerEntry } from '../services/server-registry'

const LOCKED_COPY = 'Too many tries - the server is taking a breather. Try again in a few minutes.'

export default function Families({
  navigate, toast: bootToast, notice,
}: {
  navigate: (s: Screen) => void
  toast?: string
  notice?: string
}) {
  const [servers, setServers] = useState<ServerEntry[]>([])
  const [bio, setBio] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState<string | null>(bootToast ?? null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const reload = () => {
    void listServers().then(async entries => {
      setServers(entries)
      const vault = createVault()
      const flags = await Promise.all(entries.map(e => vault.isBiometric(e.id)))
      setBio(Object.fromEntries(entries.map((e, i) => [e.id, flags[i]])))
    })
  }
  useEffect(reload, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  async function remove(entry: ServerEntry) {
    await removeServer(entry.id)
    // Best effort: stops this household's notifications immediately rather than
    // waiting for the token to go stale on the server. Must never block removal -
    // including a failed *read* of the stored token, not just a failed unregister.
    try {
      const token = await getLastToken()
      if (token) await unregisterFrom(entry.baseUrl, token)
    } catch {
      // Best effort - see comment above.
    }
    await createVault().clear(entry.id)
    setConfirmingId(null)
    setToast(`${entry.familyName} was removed from this phone.`)
    reload()
  }

  return (
    <div className="m-scr">
      <Header title="My families"
        right={<button className="m-iconbtn" aria-label="Settings" onClick={() => navigate({ name: 'settings' })}><Ic id="i-gear" s={20} /></button>} />
      <div className="m-bd">
        {notice === 'locked' && <div style={{ marginBottom: 11 }}><ErrBox>{LOCKED_COPY}</ErrBox></div>}
        {servers.length === 0 && (
          <div className="empty">
            <img src="/art/kitten.svg" alt="" width="84" />
            <b>No families on this phone yet.</b>
            Pair one and it&rsquo;ll live right here.
          </div>
        )}
        {servers.map(entry => (
          <div className={'fam-item' + (confirmingId === entry.id ? ' confirming' : '')} key={entry.id}>
            {confirmingId === entry.id ? (
              <div className="fam-confirm">
                <div className="t">Remove <b>{entry.familyName}</b> from this phone? Its saved sign-in leaves with it - your family&rsquo;s data stays on the server.</div>
                <div className="btns">
                  <button className="m-btn danger solid sm" onClick={() => void remove(entry)}>Remove</button>
                  <button className="m-btn ghost sm" onClick={() => setConfirmingId(null)}>Keep</button>
                </div>
              </div>
            ) : (
              <>
                <button className="fam-open" onClick={() => navigate({ name: 'connecting', entry })}>
                  <div className={'fam-av' + (entry.deploymentMode === 'saas' ? '' : ' apr')}>{entry.familyName[0]}</div>
                  <div className="t">
                    <div className="nm">{entry.familyName}{entry.isDefault && <span className="chip c-apr">Opens first</span>}</div>
                    <div className="host">
                      {new URL(entry.baseUrl).host} · {entry.lastUsedAt ? `opened ${formatLastOpened(entry.lastUsedAt)}` : 'not opened yet'}
                    </div>
                  </div>
                  {bio[entry.id] && <Ic id="i-face" s={18} style={{ color: 'var(--color-sub)', flexShrink: 0 }} />}
                </button>
                <div className="fam-actions">
                  <button className={'rowbtn star' + (entry.isDefault ? ' on' : '')}
                    aria-label={`Make ${entry.familyName} the default`}
                    onClick={() => void setDefaultServer(entry.id).then(reload)}>
                    <Ic id={entry.isDefault ? 'i-starf' : 'i-star'} s={20} />
                  </button>
                  <button className="rowbtn" aria-label={`Update sign-in for ${entry.familyName}`}
                    onClick={() => navigate({ name: 'reauth', entry })}>
                    <Ic id="i-key" s={19} />
                  </button>
                  <button className="rowbtn x" aria-label={`Remove ${entry.familyName}`} onClick={() => setConfirmingId(entry.id)}>
                    <Ic id="i-x" s={18} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        <button className="m-btn ghost" style={{ borderStyle: 'dashed', marginTop: 6 }} onClick={() => navigate({ name: 'fork' })}>
          <Ic id="i-plus" s={16} />Add a family
        </button>
      </div>
      {toast && <Toast message={toast} />}
    </div>
  )
}
