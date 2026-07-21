import { useState, type ReactNode } from 'react'
import { ErrBox } from '../../components/chrome'
import { Ic } from '../../components/Icons'
import { digitsOnly } from '../../lib/slug'
import type { SecurityConfig, WizardCaretaker } from '../../services/wizard'
import WizFrame from './WizFrame'

interface CtDraft { id: string; name: string; type: string; role: 'ADMIN' | 'USER'; pin: string }

const ROLE_LABEL: Record<'ADMIN' | 'USER', string> = { ADMIN: 'Admin', USER: 'User' }

export default function Step2Security({
  busy, error, firstName, onNext,
}: {
  busy: boolean
  error: ReactNode | null
  firstName?: string
  onNext: (config: SecurityConfig) => void
}) {
  const [mode, setMode] = useState<'pin' | 'caretakers'>('caretakers')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [cts, setCts] = useState<WizardCaretaker[]>([])
  const [ct, setCt] = useState<CtDraft>({
    id: '', name: firstName ?? '', type: firstName ? 'Account Owner' : '', role: 'ADMIN', pin: '',
  })
  const [ctErr, setCtErr] = useState<string | null>(null)

  // Live login-ID feedback. The ID field intentionally does not strip non-digit keystrokes
  // (unlike the PIN fields, which use digitsOnly) so the "Digits only." state is reachable.
  const idErr: ReactNode | null =
    ct.id === ''
      ? null
      : !/^\d+$/.test(ct.id)
        ? 'Digits only.'
        : ct.id === '00'
          ? <><b>00</b> is reserved for the system.</>
          : cts.some(c => c.loginId === ct.id)
            ? <>ID <b>{ct.id}</b> is taken.</>
            : null

  function addCt() {
    setCtErr(null)
    if (!/^\d{2}$/.test(ct.id) || idErr) {
      setCtErr('Pick a free two-digit ID, 01–99.')
      return
    }
    if (!ct.name.trim()) {
      setCtErr('Give this caretaker a name.')
      return
    }
    if (!/^\d{6,10}$/.test(ct.pin)) {
      setCtErr('PINs are 6–10 digits.')
      return
    }
    const role = cts.length === 0 ? 'ADMIN' : ct.role
    setCts(list => [...list, { loginId: ct.id, name: ct.name.trim(), type: ct.type, role, securityPin: ct.pin }])
    setCt({ id: '', name: '', type: '', role: 'USER', pin: '' })
  }

  const ok2 = mode === 'pin' ? /^\d{6,10}$/.test(pin) && pin === pin2 : cts.length > 0

  function submit() {
    const config: SecurityConfig = mode === 'pin' ? { mode: 'pin', securityPin: pin } : { mode: 'caretakers', caretakers: cts }
    onNext(config)
  }

  return (
    <WizFrame
      step={2}
      savedNote="Family saved"
      title="Who can open the book?"
      intro="Pick how your family signs in. You can change this anytime."
      footer={
        <button className="m-btn" disabled={!ok2 || busy} onClick={submit}>
          {busy ? 'Saving security…' : 'Next'}
        </button>
      }
    >
      <div className="f-grid">
        <label className={'ropt' + (mode === 'pin' ? ' on' : '')}>
          <input type="radio" name="wzMode" checked={mode === 'pin'} onChange={() => setMode('pin')} />
          <span><b>One shared family PIN</b><small>Simplest - everyone uses the same PIN.</small></span>
        </label>
        <label className={'ropt' + (mode === 'caretakers' ? ' on' : '')}>
          <input type="radio" name="wzMode" checked={mode === 'caretakers'} onChange={() => setMode('caretakers')} />
          <span><b>Caretakers with their own PINs</b><small>Every entry shows who logged it - better tracking and access control.</small></span>
        </label>
        {mode === 'pin' ? (
          <div className="f-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label className="fl" htmlFor="wzPin">Family PIN <small>(6–10 digits)</small></label>
              <input
                className="fi" id="wzPin" type="password" inputMode="numeric" placeholder="••••••"
                value={pin} onChange={e => setPin(digitsOnly(e.target.value, 10))}
              />
            </div>
            <div>
              <label className="fl" htmlFor="wzPin2">Confirm PIN</label>
              <input
                className="fi" id="wzPin2" type="password" inputMode="numeric" placeholder="Same again"
                value={pin2} onChange={e => setPin2(digitsOnly(e.target.value, 10))}
              />
            </div>
          </div>
        ) : (
          <>
            {cts.map(c => (
              <div className="ct-item" key={c.loginId}>
                <span className="nm">{c.name}</span>
                <span className={'chip ' + (c.role === 'ADMIN' ? 'c-teal' : 'c-blue')}>{ROLE_LABEL[c.role]}</span>
                {c.type && <span className="chip c-apr">{c.type}</span>}
                <span className="meta">ID {c.loginId}</span>
                <button
                  className="rowbtn x" aria-label={`Remove ${c.name}`}
                  onClick={() => setCts(l => l.filter(x => x.loginId !== c.loginId))}
                >
                  <Ic id="i-x" s={14} />
                </button>
              </div>
            ))}
            <div className="fgroup">
              <b>{cts.length === 0 ? (firstName ? 'Create your profile first' : 'Add yourself first') : 'Add another caretaker'}</b>
              <p className="fh">
                {cts.length === 0
                  ? 'The first caretaker is the admin - that’s you. Pick a 2-digit ID and a PIN.'
                  : 'Parents, grandparents, the nanny - anyone who helps.'}
              </p>
              <div className="f-grid">
                <div className="f-2">
                  <div>
                    <label className="fl" htmlFor="wzCtId">Login ID <small>(2 digits)</small></label>
                    <input
                      className="fi" id="wzCtId" inputMode="numeric" maxLength={2} placeholder="01"
                      value={ct.id} onChange={e => setCt(v => ({ ...v, id: e.target.value.slice(0, 2) }))}
                    />
                    {idErr && <p className="fi-err">{idErr}</p>}
                  </div>
                  <div>
                    <label className="fl" htmlFor="wzCtName">Name</label>
                    <input
                      className="fi" id="wzCtName" placeholder="Betty" value={ct.name}
                      onChange={e => setCt(v => ({ ...v, name: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="f-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div>
                    <label className="fl" htmlFor="wzCtPin">PIN <small>(6–10 digits)</small></label>
                    <input
                      className="fi" id="wzCtPin" type="password" inputMode="numeric" placeholder="••••••"
                      value={ct.pin} onChange={e => setCt(v => ({ ...v, pin: digitsOnly(e.target.value, 10) }))}
                    />
                  </div>
                  <div>
                    <label className="fl" htmlFor="wzCtType">Type <small>(optional)</small></label>
                    <input
                      className="fi" id="wzCtType" placeholder="Parent, Nanny…" value={ct.type}
                      onChange={e => setCt(v => ({ ...v, type: e.target.value }))}
                    />
                  </div>
                </div>
                {cts.length > 0 && (
                  <div>
                    <label className="fl" htmlFor="wzCtRole">Role</label>
                    <select
                      className="fi" id="wzCtRole" value={ct.role}
                      onChange={e => setCt(v => ({ ...v, role: e.target.value as 'ADMIN' | 'USER' }))}
                    >
                      <option value="USER">User</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                    <p className="fh">Admins can edit family settings and people.</p>
                  </div>
                )}
                {cts.length === 0 && <p className="fh" style={{ margin: 0 }}>The first caretaker is always an admin.</p>}
                {ctErr && <ErrBox>{ctErr}</ErrBox>}
                <button className="m-btn ghost" style={{ borderStyle: 'dashed' }} onClick={addCt}>
                  <Ic id="i-plus" s={16} />{cts.length === 0 ? (firstName ? 'Create my profile' : 'Add caretaker') : 'Add caretaker'}
                </button>
              </div>
            </div>
          </>
        )}
        {error && <ErrBox>{error}</ErrBox>}
      </div>
    </WizFrame>
  )
}
