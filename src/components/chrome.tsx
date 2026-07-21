import type { ReactNode } from 'react'
import { Ic } from './Icons'

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="m-hd">
      {onBack && (
        <button className="m-iconbtn" aria-label="Back" onClick={onBack}><Ic id="i-back" s={20} /></button>
      )}
      <h1 style={onBack ? undefined : { paddingLeft: 8 }}>{title}</h1>
      {right}
    </div>
  )
}

export function ErrBox({ children }: { children: ReactNode }) {
  return <div className="m-err" role="alert"><Ic id="i-alert" s={17} /><span>{children}</span></div>
}

export function WarnBox({ children }: { children: ReactNode }) {
  return <div className="m-warn"><Ic id="i-alert" s={17} /><span>{children}</span></div>
}
