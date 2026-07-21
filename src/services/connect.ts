import { encodeMessage } from '../../shared/bridge-contract'
import { CredentialVault, createVault } from './credential-vault'
import { loginWithCredentials } from './session'
import { touchServer, type ServerEntry } from './server-registry'

export type ConnectOutcome = 'navigated' | 'needs-login' | 'offline' | 'locked'

export interface ConnectDeps {
  vault: CredentialVault
  login: typeof loginWithCredentials
  touch: typeof touchServer
  clearCreds: (serverId: string) => Promise<void>
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
    clearCreds: id => vault.clear(id),
    openUrl: url => window.location.assign(url),
    ...depsOverride,
  }

  await deps.touch(entry.id)
  const familyUrl = `${entry.baseUrl}/${entry.familySlug}`
  const creds = await deps.vault.retrieve(entry.id)
  if (!creds) {
    deps.openUrl(familyUrl)
    return 'needs-login'
  }
  const result = await deps.login(entry, creds)
  if (result.ok) {
    const msg = {
      type: 'sessionInjected' as const,
      slug: result.familySlug,
      token: result.token,
      ...(result.caretakerId !== undefined ? { caretakerId: result.caretakerId } : {}),
    }
    deps.openUrl(`${familyUrl}/log-entry#bridge-session=${encodeURIComponent(encodeMessage(msg))}`)
    return 'navigated'
  }
  if (result.error === 'unreachable') return 'offline'
  if (result.error === 'locked') return 'locked'
  await deps.clearCreds(entry.id)
  deps.openUrl(familyUrl)
  return 'needs-login'
}
