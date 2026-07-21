import { fetchSetupStatus } from './account'
import { fetchFamilyBySlug } from './server-probe'
import { saveServer } from './server-registry'
import type { CredentialVault, AccountCreds } from './credential-vault'
import { titleFromSlug } from '../lib/slug'
import type { Screen } from '../App'

export interface WizardResume { familyId: string; stage: 2 | 3; familyName: string; slug: string }

export type PostLoginRoute =
  | { kind: 'saved'; toast: string }
  | { kind: 'wizard'; resume?: WizardResume }
  | { kind: 'verify' }
  | { kind: 'error'; message: string }

export interface AccountRoutingDeps {
  fetchSetupStatus: typeof fetchSetupStatus
  fetchFamilyBySlug: typeof fetchFamilyBySlug
  saveServer: typeof saveServer
  vault: Pick<CredentialVault, 'store'>
}

export async function routeAfterAccountLogin(
  args: {
    base: string
    token: string
    creds: AccountCreds
    biometric: boolean
    familySlug?: string
    verified: boolean
  },
  deps: AccountRoutingDeps,
): Promise<PostLoginRoute> {
  const { base, token, creds, biometric, familySlug, verified } = args

  if (!familySlug) {
    return verified ? { kind: 'wizard' } : { kind: 'verify' }
  }

  const status = await deps.fetchSetupStatus(base, token)
  if (!status) {
    return { kind: 'error', message: 'Signed in, but we couldn’t check your family’s setup - try again.' }
  }

  if (status.setupStage < 3) {
    return {
      kind: 'wizard',
      resume: {
        familyId: status.familyId,
        stage: status.currentStage,
        familyName: status.familyName,
        slug: status.familySlug,
      },
    }
  }

  let name = titleFromSlug(familySlug)
  try {
    name = (await deps.fetchFamilyBySlug(base, familySlug)).name
  } catch {
    // login already succeeded; slug-derived name is fine
  }

  try {
    const saved = await deps.saveServer({
      baseUrl: base,
      familySlug,
      familyName: name,
      deploymentMode: 'saas',
      authType: 'ACCOUNT',
    })
    await deps.vault.store(saved.id, creds, { biometric })
    return { kind: 'saved', toast: `Saved - ${name} is on this phone now.` }
  } catch {
    return { kind: 'error', message: 'Login worked but saving the family failed - try again.' }
  }
}

/** Maps a non-error PostLoginRoute to a Screen. */
export function screenForRoute(
  route: Exclude<PostLoginRoute, { kind: 'error' }>,
  ctx: { token: string; creds: AccountCreds; biometric: boolean; firstName?: string },
): Screen {
  switch (route.kind) {
    case 'saved':
      return { name: 'families', toast: route.toast }
    case 'wizard':
      return {
        name: 'wizard',
        token: ctx.token,
        creds: ctx.creds,
        biometric: ctx.biometric,
        resume: route.resume,
        firstName: ctx.firstName,
      }
    case 'verify':
      return { name: 'acct-verify', token: ctx.token, creds: ctx.creds, biometric: ctx.biometric }
  }
}
