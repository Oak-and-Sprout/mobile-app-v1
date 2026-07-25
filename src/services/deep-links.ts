import type { Screen } from '../App'

const HOST = 'sprout-track.com'

/**
 * Maps a Universal/App Link URL to a boot-time Screen, or null if it isn't ours.
 *
 * Returning null covers two different situations, and App.tsx treats them
 * the same way (drop it, let the normal boot/current screen stand) even
 * though they aren't equivalent:
 *
 * 1. A host/path this shell never claims (an AASA path outside the set
 *    below, `/account`, marketing routes). The OS never handed this URL to
 *    the app in the first place, so there is nothing to hand onward - it was
 *    already headed to the system browser.
 * 2. A path this shell DOES claim in the AASA/App Links intent filter, but
 *    whose shape this function doesn't recognize (`/verify` or
 *    `/passwordreset` with no `?token=`, `/setup/` with no token segment).
 *    Here the OS already chose this app over the browser - by the time this
 *    function runs, no browser is going to see this URL. There is no
 *    `openExternal`-style fallback implemented for this case: re-opening the
 *    same URL externally risks an OS routing loop right back into this app
 *    (it's still an AASA/App Links match), and Universal/App Links have no
 *    standard "decline and forward to Safari" primitive to invoke instead.
 *    So case 2 is currently a silent no-op, not a "hands onward" - the user
 *    doesn't get an error, but they also don't get anywhere.
 *
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
