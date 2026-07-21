import type { ReactNode } from 'react'
import { Ic } from '../../components/Icons'

const WIZ_ART: Record<1 | 2 | 3, string> = { 1: 'teddy', 2: 'star', 3: 'kitten' }
const WIZ_ART_W: Record<1 | 2 | 3, number> = { 1: 62, 2: 44, 3: 58 }

/** Shared chrome for the 3-step wizard: brand + progress bar + step meta + rotated art sprite. */
export default function WizFrame({
  step, savedNote, title, intro, children, footer,
}: {
  step: 1 | 2 | 3
  savedNote?: string
  title: string
  intro: ReactNode
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="m-scr bleed">
      <div className="wiz-hd">
        <div className="wiz-brand"><img src="/logo.png" alt="" />Sprout Track</div>
        <div className="prog"><i style={{ width: `${(step / 3) * 100}%` }} /></div>
        <div className="wiz-meta">
          <span className="wiz-step">Step {step} of 3</span>
          {savedNote && <span className="wiz-saved"><Ic id="i-check" s={13} />{savedNote}</span>}
        </div>
      </div>
      <img
        className="wiz-art"
        src={`/art/${WIZ_ART[step]}.svg`}
        alt=""
        width={WIZ_ART_W[step]}
        style={{ transform: `rotate(${step === 2 ? 12 : -7}deg)` }}
      />
      <div className="wiz-bd">
        <h2>{title}</h2>
        <p className="intro">{intro}</p>
        {children}
      </div>
      <div className="wiz-ft">{footer}</div>
    </div>
  )
}
