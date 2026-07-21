import { decodeMessage } from '../../shared/bridge-contract'

export type BootAction = 'auto-open' | 'show-server-list' | 'reconnect'

const RECONNECT_REASONS = new Set(['logout-idle', 'logout-refresh-failed', 'logout-jwt-error'])

/** Interpret a ?bridge-event= param the web app used to hand control back to the shell. */
export function bootActionFromSearch(search: string): BootAction {
  const raw = new URLSearchParams(search).get('bridge-event')
  if (!raw) return 'auto-open'
  const decoded = decodeMessage(raw)
  if (!decoded) return 'auto-open'
  if (decoded.msg.type === 'sessionExpired') return 'reconnect'
  if (decoded.msg.type === 'loggedOut') {
    return RECONNECT_REASONS.has(decoded.msg.reason) ? 'reconnect' : 'show-server-list'
  }
  return 'auto-open'
}

export function stripBridgeEvent(): void {
  const url = new URL(window.location.href)
  if (url.searchParams.has('bridge-event')) {
    url.searchParams.delete('bridge-event')
    window.history.replaceState(null, '', url.toString())
  }
}
