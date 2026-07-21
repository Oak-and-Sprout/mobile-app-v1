import { useEffect, useState } from 'react'
import type { Screen } from '../App'
import { Header, ErrBox } from '../components/chrome'
import { Ic } from '../components/Icons'
import Toast from '../components/Toast'
import { formatLastOpened } from '../lib/relative-time'
import { createVault } from '../services/credential-vault'
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
    await createVault().clear(entry.id)
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
          <div className="fam-row" key={entry.id}>
            <button className="fam-card" onClick={() => navigate({ name: 'connecting', entry })}>
              <div className={'fam-av' + (entry.deploymentMode === 'saas' ? '' : ' apr')}>{entry.familyName[0]}</div>
              <div className="t">
                <div className="nm">{entry.familyName}{entry.isDefault && <span className="chip c-apr">Opens first</span>}</div>
                <div className="host">
                  {new URL(entry.baseUrl).host} · {entry.lastUsedAt ? `opened ${formatLastOpened(entry.lastUsedAt)}` : 'not opened yet'}
                </div>
              </div>
              {bio[entry.id] && <Ic id="i-face" s={18} style={{ color: 'var(--color-sub)', flexShrink: 0 }} />}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button className={'rowbtn star' + (entry.isDefault ? ' on' : '')}
                aria-label={`Make ${entry.familyName} the default`}
                onClick={() => void setDefaultServer(entry.id).then(reload)}>
                <Ic id={entry.isDefault ? 'i-starf' : 'i-star'} s={17} />
              </button>
              <button className="rowbtn x" aria-label={`Remove ${entry.familyName}`} onClick={() => void remove(entry)}>
                <Ic id="i-x" s={15} />
              </button>
            </div>
          </div>
        ))}
        <button className="m-btn ghost" style={{ borderStyle: 'dashed', marginTop: 6 }} onClick={() => navigate({ name: 'add-family' })}>
          <Ic id="i-plus" s={16} />Add a family
        </button>
      </div>
      {toast && <Toast message={toast} />}
    </div>
  )
}
