import type { CSSProperties } from 'react'

const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export function IconDefs() {
  return (
    <svg style={{ display: 'none' }} aria-hidden="true">
      <defs>
        <symbol {...STROKE} id="i-back" viewBox="0 0 24 24"><path d="M19 12H5m6-6l-6 6 6 6" /></symbol>
        <symbol {...STROKE} strokeWidth={1.6} id="i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /></symbol>
        <symbol {...STROKE} id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></symbol>
        <symbol {...STROKE} id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
        <symbol {...STROKE} id="i-alert" viewBox="0 0 24 24"><path d="M12 4.5L21 20H3zM12 10.5v4M12 17.3h.01" /></symbol>
        <symbol {...STROKE} id="i-shield" viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></symbol>
        <symbol {...STROKE} strokeWidth={1.6} id="i-face" viewBox="0 0 24 24"><path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" /><path d="M8.6 9.5v1.4M15.4 9.5v1.4M12 9.5v3.2a1 1 0 0 1-1 1M9 16.2c.9.9 1.9 1.3 3 1.3s2.1-.4 3-1.3" /></symbol>
        <symbol {...STROKE} id="i-star" viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.8L12 16.9l-5.3 2.7 1.1-5.8-4.3-4.1 5.9-.8z" /></symbol>
        <symbol fill="currentColor" id="i-starf" viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.8L12 16.9l-5.3 2.7 1.1-5.8-4.3-4.1 5.9-.8z" /></symbol>
        <symbol {...STROKE} id="i-refresh" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 3.5V8h-4.5" /></symbol>
        <symbol {...STROKE} id="i-mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7.5l9 6 9-6" /></symbol>
        <symbol {...STROKE} id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" /></symbol>
        <symbol {...STROKE} id="i-people" viewBox="0 0 24 24"><circle cx="9" cy="9" r="3.2" /><path d="M3.5 19.5c.7-3.2 2.7-4.8 5.5-4.8s4.8 1.6 5.5 4.8M17 6.7a2.8 2.8 0 0 1 0 5.6M18.5 15c1.8.6 2.9 1.9 3.4 4" /></symbol>
        <symbol {...STROKE} id="i-chevr" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></symbol>
        <symbol {...STROKE} id="i-chevd" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></symbol>
        <symbol {...STROKE} id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" /></symbol>
        <symbol {...STROKE} id="i-out" viewBox="0 0 24 24"><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M15 8l4 4-4 4M19 12h-9" /></symbol>
        <symbol {...STROKE} id="i-ext" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></symbol>
        <symbol {...STROKE} id="i-key" viewBox="0 0 24 24"><circle cx="7.5" cy="15.5" r="3.5" /><path d="M10.5 13L20 4M16.5 5.5L19 8" /></symbol>
        <symbol {...STROKE} id="i-check" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></symbol>
      </defs>
    </svg>
  )
}

export function Ic({ id, s = 18, style }: { id: string; s?: number; style?: CSSProperties }) {
  return <svg width={s} height={s} style={style} aria-hidden="true"><use href={`#${id}`} /></svg>
}
