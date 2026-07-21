import { useEffect, useRef, useState } from 'react'

const HOLD_MS = 2150
const FADE_MS = 550

export default function Splash({ onDone }: { onDone: () => void }) {
  const [out, setOut] = useState(false)
  const cb = useRef(onDone)
  cb.current = onDone
  useEffect(() => {
    const a = setTimeout(() => setOut(true), HOLD_MS)
    const b = setTimeout(() => cb.current(), HOLD_MS + FADE_MS)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [])
  return (
    <div className={'splash' + (out ? ' out' : '')}>
      <div className="bg" /><div className="grad" />
      <div className="ct">
        <img src="/logo.png" alt="" />
        <div className="wm">Sprout Track</div>
        <div className="tag">The shareable baby tracker</div>
      </div>
    </div>
  )
}
