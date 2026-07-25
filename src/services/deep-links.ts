import type { Screen } from '../App'

const HOST = 'sprout-track.com'

/**
 * Maps a Universal/App Link URL to a boot-time Screen, or null if it isn't ours.
 *
 * Returning null means "not ours": App.tsx hands the URL onward (the system
 * browser / normal web navigation) and continues its own boot unaffected.
 * The claimed-path set here must stay in lockstep with the server's AASA
 * (`sprout-track/app/.well-known/apple-app-site-association/route.ts`):
 * `['/setup/*', '/verify*', '/passwordreset*']`.
 *
 * `/account` is deliberately never claimed, on purpose, not by omission:
 * MANAGE_SUBSCRIPTION_URL points at `https://sprout-track.com/account` so
 * subscription management opens in the system browser for App Store payment
 * compliance. Claiming it here would route it back into the app and defeat
 * that mechanism. Marketing routes (`/`, `/pricing`, `/features`, `/privacy`,
 * `/terms`, `/home`) are likewise left unclaimed.
 */
export function screenForDeepLink(url: string): Screen | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.hostname !== HOST) return null

  const segments = parsed.pathname.split('/').filter(Boolean)
  const token = parsed.searchParams.get('token')

  if (segments[0] === 'passwordreset') return token ? { name: 'acct-reset-confirm', token } : null
  if (segments[0] === 'verify') return token ? { name: 'acct-verify-link', token } : null
  if (segments[0] === 'setup' && segments[1]) return { name: 'setup-link', token: segments[1] }
  return null
}
