import { useEffect, useState } from 'react'
import type { StoredCredentials } from '../services/credential-vault'

export type CredAuthType = 'SYSTEM' | 'CARETAKER' | 'ACCOUNT'

/**
 * Credential inputs for a known family, laid out per auth type. Owns the field
 * state and reports the assembled credentials up via `onChange` — `null` until
 * every required field is filled. Shared by pairing (AddFamily) and re-auth so
 * all three auth types get the identical entry UI. Pass a stable `onChange`
 * (useCallback) to avoid a re-render loop.
 */
export function CredentialFields({
  authType, initial, onChange,
}: {
  authType: CredAuthType
  initial?: { loginId?: string | null; email?: string }
  onChange: (creds: StoredCredentials | null) => void
}) {
  const [loginId, setLoginId] = useState(initial?.loginId ?? '')
  const [pin, setPin] = useState('')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [password, setPassword] = useState('')

  useEffect(() => {
    let creds: StoredCredentials | null
    if (authType === 'ACCOUNT') {
      creds = email !== '' && password !== '' ? { type: 'account', email, password } : null
    } else if (authType === 'CARETAKER') {
      creds = loginId !== '' && pin !== '' ? { type: 'pin', loginId, securityPin: pin } : null
    } else {
      creds = pin !== '' ? { type: 'pin', loginId: null, securityPin: pin } : null
    }
    onChange(creds)
  }, [authType, loginId, pin, email, password, onChange])

  if (authType === 'ACCOUNT') {
    return (
      <div className="f-grid">
        <div><label className="fl" htmlFor="cfEm">Email</label>
          <input className="fi" id="cfEm" type="email" autoCapitalize="none" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div><label className="fl" htmlFor="cfPw">Password</label>
          <input className="fi" id="cfPw" type="password" placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)} /></div>
      </div>
    )
  }
  if (authType === 'CARETAKER') {
    return (
      <div className="f-2">
        <div><label className="fl" htmlFor="lid">Login ID</label>
          <input className="fi" id="lid" inputMode="numeric" maxLength={2} placeholder="11" value={loginId} onChange={e => setLoginId(e.target.value)} /></div>
        <div><label className="fl" htmlFor="pin">PIN</label>
          <input className="fi" id="pin" type="password" inputMode="numeric" maxLength={10} placeholder="••••••" value={pin} onChange={e => setPin(e.target.value)} /></div>
      </div>
    )
  }
  return (
    <div><label className="fl" htmlFor="pin">Family PIN</label>
      <input className="fi" id="pin" type="password" inputMode="numeric" maxLength={10} placeholder="••••••" value={pin} onChange={e => setPin(e.target.value)} /></div>
  )
}
