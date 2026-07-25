import { encodeMessage } from '../../shared/bridge-contract'
import { CredentialVault, createVault } from './credential-vault'
import { safeRoute } from './notification-routing'
import { registerPushForEntry } from './push'
import { markConnectedOnce as storeConnectedOnce } from './push-opt-in'
import { loginWithCredentials } from './session'
import { touchServer, type ServerEntry } from './server-registry'

export type ConnectOutcome = 'navigated' | 'needs-reauth' | 'offline' | 'locked'

/**
 * Build the URL that hands a freshly-obtained session to the web app: the family
 * page (defaulting to log-entry) with the session encoded in a
 * `#bridge-session=` fragment the server's native layer consumes on load.
 * Shared so re-auth can hand off with the token it already has instead of
 * re-running connect (which would re-read the vault and re-prompt biometric).
 *
 * `route` is resolved through `safeRoute` before it ever touches the URL: this
 * fragment carries the session token, so an unvalidated route is a
 * token-redirection primitive.
 */
export function sessionHandoffUrl(
  baseUrl: string,
  result: { familySlug: string; token: string; caretakerId?: string },
  route = 'log-entry',
): string {
  const msg = {
    type: 'sessionInjected' as const,
    slug: result.familySlug,
    token: result.token,
    ...(result.caretakerId !== undefined ? { caretakerId: result.caretakerId } : {}),
  }
  return `${baseUrl}/${result.familySlug}/${safeRoute(route)}#bridge-session=${encodeURIComponent(encodeMessage(msg))}`
}

export interface ConnectDeps {
  vault: CredentialVault
  login: typeof loginWithCredentials
  touch: typeof touchServer
  openUrl: (url: string) => void
  registerPush: (entry: ServerEntry, jwt: string) => void
  markConnectedOnce: () => void
}

export async function connectToFamily(
  entry: ServerEntry,
  depsOverride: Partial<ConnectDeps> = {},
  route?: string,
): Promise<ConnectOutcome> {
  const vault = depsOverride.vault ?? createVault()
  const deps: ConnectDeps = {
    vault,
    login: loginWithCredentials,
    touch: touchServer,
    openUrl: url => window.location.assign(url),
    registerPush: (entry, jwt) => { void registerPushForEntry(entry, jwt) },
    markConnectedOnce: () => { void storeConnectedOnce() },
    ...depsOverride,
  }

  await deps.touch(entry.id)
  // No stored credential (or biometric was declined): send the user to the
  // in-app re-auth screen rather than the web login, so the family stays
  // recoverable without re-pairing.
  const creds = await deps.vault.retrieve(entry.id)
  if (!creds) return 'needs-reauth'
  const result = await deps.login(entry, creds)
  if (result.ok) {
    // Neither call may block or fail the handoff: registration is
    // best-effort, and the connected-once flag only unlocks the intro on a
    // future launch (the shell's React tree is gone the instant openUrl runs).
    try { deps.registerPush(entry, result.token) } catch { /* never block handoff */ }
    try { deps.markConnectedOnce() } catch { /* never block handoff */ }
    deps.openUrl(sessionHandoffUrl(entry.baseUrl, result, route))
    return 'navigated'
  }
  if (result.error === 'unreachable') return 'offline'
  if (result.error === 'locked') return 'locked'
  // The stored PIN/password no longer works (changed on the server). Leave the
  // old credential untouched — the re-auth screen overwrites it only after a
  // new one verifies, so nothing is lost if the user cancels.
  return 'needs-reauth'
}
