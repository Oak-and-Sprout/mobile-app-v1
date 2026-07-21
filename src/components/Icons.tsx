import type { CSSProperties } from 'react'

const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export function IconDefs() {
  return (
    <svg style={{ display: 'none' }} aria-hidden="true">
      <defs>
        <symbol {...STROKE} id="i-back" viewBox="0 0 24 24"><path d="M19 12H5m6-6l-6 6 6 6" /></symbol>
        <symbol {...STROKE} id="i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" /></symbol>
        <symbol {...STROKE} id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></symbol>
        <symbol {...STROKE} id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
        <symbol {...STROKE} id="i-alert" viewBox="0 0 24 24"><path d="M12 4.5L21 20H3zM12 10.5v4M12 17.3h.01" /></symbol>
        <symbol {...STROKE} id="i-shield" viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></symbol>
        <symbol {...STROKE} strokeWidth={1.6} id="i-face" viewBox="0 0 24 24"><path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" /><path d="M8.6 9.5v1.4M15.4 9.5v1.4M12 9.5v3.2a1 1 0 0 1-1 1M9 16.2c.9.9 1.9 1.3 3 1.3s2.1-.4 3-1.3" /></symbol>
        <symbol {...STROKE} id="i-star" viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.8L12 16.9l-5.3 2.7 1.1-5.8-4.3-4.1 5.9-.8z" /></symbol>
        <symbol fill="currentColor" id="i-starf" viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.8L12 16.9l-5.3 2.7 1.1-5.8-4.3-4.1 5.9-.8z" /></symbol>
        <symbol {...STROKE} id="i-refresh" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 3.5V8h-4.5" /></symbol>
      </defs>
    </svg>
  )
}

export function Ic({ id, s = 18, style }: { id: string; s?: number; style?: CSSProperties }) {
  return <svg width={s} height={s} style={style} aria-hidden="true"><use href={`#${id}`} /></svg>
}
