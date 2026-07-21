import { encodeMessage } from '../../shared/bridge-contract'
import { CredentialVault, createVault } from './credential-vault'
import { loginWithCredentials } from './session'
import { touchServer, type ServerEntry } from './server-registry'

export type ConnectOutcome = 'navigated' | 'needs-reauth' | 'offline' | 'locked'

export interface ConnectDeps {
  vault: CredentialVault
  login: typeof loginWithCredentials
  touch: typeof touchServer
  openUrl: (url: string) => void
}

export async function connectToFamily(
  entry: ServerEntry,
  depsOverride: Partial<ConnectDeps> = {},
): Promise<ConnectOutcome> {
  const vault = depsOverride.vault ?? createVault()
  const deps: ConnectDeps = {
    vault,
    login: loginWithCredentials,
    touch: touchServer,
    openUrl: url => window.location.assign(url),
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
    const msg = {
      type: 'sessionInjected' as const,
      slug: result.familySlug,
      token: result.token,
      ...(result.caretakerId !== undefined ? { caretakerId: result.caretakerId } : {}),
    }
    deps.openUrl(`${entry.baseUrl}/${result.familySlug}/log-entry#bridge-session=${encodeURIComponent(encodeMessage(msg))}`)
    return 'navigated'
  }
  if (result.error === 'unreachable') return 'offline'
  if (result.error === 'locked') return 'locked'
  // The stored PIN/password no longer works (changed on the server). Leave the
  // old credential untouched — the re-auth screen overwrites it only after a
  // new one verifies, so nothing is lost if the user cancels.
  return 'needs-reauth'
}
