import { postJson, getJson, putJson } from '../lib/api-client'
import { loginWithCredentials } from './session'
import { saveServer as saveServerToRegistry } from './server-registry'
import { createVault, type CredentialVault, type AccountCreds, type StoredCredentials } from './credential-vault'

export interface WizardCaretaker { loginId: string; name: string; type: string; role: 'ADMIN' | 'USER'; securityPin: string }

export type SecurityConfig =
  | { mode: 'pin'; securityPin: string }
  | { mode: 'caretakers'; caretakers: WizardCaretaker[] }

export const FEED_TYPE_OPTIONS: ReadonlyArray<{ label: string; category: string }> = [
  { label: 'Breast feeds', category: 'BREAST' },
  { label: 'Breast milk bottles', category: 'BOTTLE_BREAST_MILK' },
  { label: 'Formula bottles', category: 'BOTTLE_FORMULA' },
  { label: 'Other bottles', category: 'BOTTLE_OTHER' },
  { label: 'Food', category: 'FOOD' },
]

export interface BabyConfig {
  firstName: string
  lastName: string
  birthDate: string
  gender: 'MALE' | 'FEMALE'
  feedWarningTime: string
  diaperWarningTime: string
  feedTimerFrom: 'start' | 'end'
  feedTimerCategories: string[] // all 5 selected → sent as null
}

export class WizardError extends Error {
  constructor(public kind: 'slug-taken' | 'unreachable' | 'rejected', message?: string) {
    super(message ?? kind)
    this.name = 'WizardError'
  }
}

type Envelope = { success?: boolean; error?: string; data?: unknown } | null

function envelopeOf(body: unknown): Envelope {
  return body as Envelope
}

function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300
}

/** Wraps a network call so any thrown error becomes WizardError('unreachable'), matching the brief's blanket error semantics. */
async function callOrThrowUnreachable<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch {
    throw new WizardError('unreachable')
  }
}

/** Shared success check for the fire-and-forget wizard steps: 2xx status + envelope.success, else WizardError('rejected', envelope.error). */
function assertSuccess(res: { status: number; body: unknown }): void {
  const envelope = envelopeOf(res.body)
  if (!isSuccessStatus(res.status) || !envelope?.success) {
    throw new WizardError('rejected', envelope?.error)
  }
}

// --- Step: slug availability -------------------------------------------------

export async function checkSlugAvailability(
  base: string,
  slug: string,
  get: typeof getJson = getJson,
): Promise<'free' | 'taken' | 'invalid'> {
  const res = await callOrThrowUnreachable(() => get(`${base}/api/family/by-slug/${slug}`))
  if (res.status === 400) return 'invalid'
  // A server that can't answer this question at all (5xx, etc.) is indistinguishable
  // from unreachable for this caller — don't let it silently fall through to 'free'
  // and let the user proceed only to fail later at createFamily.
  if (!isSuccessStatus(res.status)) throw new WizardError('unreachable')
  return envelopeOf(res.body)?.success ? 'taken' : 'free'
}

export async function suggestSlug(
  base: string,
  get: typeof getJson = getJson,
): Promise<string | null> {
  try {
    const res = await get(`${base}/api/family/generate-slug`)
    if (res.status !== 200) return null
    const data = envelopeOf(res.body)?.data as { slug?: unknown } | undefined
    return typeof data?.slug === 'string' ? data.slug : null
  } catch {
    return null
  }
}

// --- Step: setup-link token (admin-generated provisioning links) --------------

export type SetupTokenState = 'valid' | 'invalid' | 'expired' | 'used' | 'unreachable'

/** Admin-generated setup links: 6 hex chars, a stored password, a 7-day expiry.
 *  The three failure statuses are distinct user-facing situations, so they stay distinct here. */
export async function validateSetupToken(
  base: string,
  token: string,
  post: typeof postJson = postJson,
): Promise<SetupTokenState> {
  let res: { status: number; body: unknown }
  try {
    res = await post(`${base}/api/setup/validate-token`, { token })
  } catch {
    return 'unreachable'
  }
  if (res.status === 410) return 'expired'
  if (res.status === 409) return 'used'
  const envelope = envelopeOf(res.body)
  const data = envelope?.data as { valid?: unknown } | undefined
  return isSuccessStatus(res.status) && envelope?.success && data?.valid === true ? 'valid' : 'invalid'
}

export async function exchangeSetupToken(
  base: string,
  token: string,
  password: string,
  post: typeof postJson = postJson,
): Promise<{ ok: true; jwt: string } | { ok: false; error: 'wrong-password' | 'invalid' | 'unreachable' }> {
  let res: { status: number; body: unknown }
  try {
    res = await post(`${base}/api/auth/token`, { token, password })
  } catch {
    return { ok: false, error: 'unreachable' }
  }
  if (res.status === 401) return { ok: false, error: 'wrong-password' }
  const envelope = envelopeOf(res.body)
  const data = envelope?.data as { token?: unknown } | undefined
  if (!isSuccessStatus(res.status) || !envelope?.success || typeof data?.token !== 'string') {
    return { ok: false, error: 'invalid' }
  }
  return { ok: true, jwt: data.token }
}

// --- Step: create family -----------------------------------------------------

export async function createFamily(
  base: string,
  token: string,
  args: { name: string; slug: string; setupToken?: string },
  post: typeof postJson = postJson,
): Promise<{ familyId: string }> {
  const body = args.setupToken
    ? { name: args.name, slug: args.slug, token: args.setupToken, isNewFamily: true }
    : { name: args.name, slug: args.slug }
  const res = await callOrThrowUnreachable(() => post(`${base}/api/setup/start`, body, { token }))
  if (res.status === 409) throw new WizardError('slug-taken')
  const envelope = envelopeOf(res.body)
  const data = envelope?.data as { id?: unknown } | undefined
  if (!isSuccessStatus(res.status) || !envelope?.success || typeof data?.id !== 'string') {
    throw new WizardError('rejected', envelope?.error)
  }
  return { familyId: data.id }
}

// --- Step: security -----------------------------------------------------------

/**
 * Note: the brief's Produces block lists a single `post?: typeof postJson` tail param for
 * this function, but the endpoint mapping requires PUT calls (settings, update-setup-stage)
 * for both pin and caretakers mode, and pin mode makes NO post call at all — a single
 * postJson-shaped injectable cannot let tests observe those PUT calls (which is exactly
 * what Step 1's "pin sequence exact URL/body/order" requirement needs). Mirroring the
 * sibling linkAccountToCaretaker's `{ post, get }` deps bundle, this takes `{ post, put }` instead.
 */
export async function saveSecurity(
  base: string,
  token: string,
  familyId: string,
  config: SecurityConfig,
  deps: { post: typeof postJson; put: typeof putJson } = { post: postJson, put: putJson },
): Promise<void> {
  const { post, put } = deps

  if (config.mode === 'pin') {
    const res = await callOrThrowUnreachable(() =>
      put(`${base}/api/settings?familyId=${familyId}`, { securityPin: config.securityPin, authType: 'SYSTEM' }, { token }),
    )
    assertSuccess(res)
  } else {
    for (const caretaker of config.caretakers) {
      const res = await callOrThrowUnreachable(() =>
        post(
          `${base}/api/caretaker?familyId=${familyId}`,
          {
            loginId: caretaker.loginId,
            name: caretaker.name,
            type: caretaker.type,
            role: caretaker.role,
            securityPin: caretaker.securityPin,
            familyId,
          },
          { token },
        ),
      )
      // A retry of this step (after a later sub-call failed) re-POSTs every caretaker,
      // including ones the server already created on the prior attempt - it replies 400
      // "already in use" for those. Treating that specific 400 as success rather than
      // throwing makes step-2 retries idempotent for a fresh family, where this client is
      // the only writer (so a duplicate loginId can only mean "we already created this one").
      const envelope = envelopeOf(res.body)
      const alreadyCreated = res.status === 400 && typeof envelope?.error === 'string' && envelope.error.includes('already in use')
      if (!alreadyCreated) {
        assertSuccess(res)
      }
    }
    const res = await callOrThrowUnreachable(() =>
      put(`${base}/api/settings?familyId=${familyId}`, { authType: 'CARETAKER' }, { token }),
    )
    assertSuccess(res)
  }

  const stageRes = await callOrThrowUnreachable(() =>
    put(`${base}/api/family/update-setup-stage`, { setupStage: 2, familyId }, { token }),
  )
  assertSuccess(stageRes)
}

// --- Step: baby -----------------------------------------------------------------

/**
 * POSTs the baby record. Split out from the caretaker-linking step (see
 * `linkAccountToCaretaker` below) so a retry after a failure further down the wizard's step-3
 * handler does not repeat this non-idempotent POST - see Wizard.tsx's `handleStep3Complete`,
 * which only calls this once per session and re-runs just the failed remainder on retry.
 */
export async function saveBaby(
  base: string,
  token: string,
  familyId: string,
  baby: BabyConfig,
  post: typeof postJson = postJson,
): Promise<void> {
  const feedTimerTypes =
    baby.feedTimerCategories.length === FEED_TYPE_OPTIONS.length ? null : JSON.stringify(baby.feedTimerCategories)

  const babyRes = await callOrThrowUnreachable(() =>
    post(
      `${base}/api/baby?familyId=${familyId}`,
      {
        firstName: baby.firstName,
        lastName: baby.lastName,
        birthDate: baby.birthDate,
        gender: baby.gender,
        feedWarningTime: baby.feedWarningTime,
        diaperWarningTime: baby.diaperWarningTime,
        feedTimerFrom: baby.feedTimerFrom,
        feedTimerTypes,
        familyId,
      },
      { token },
    ),
  )
  assertSuccess(babyRes)
}

// --- Step: link the account to a caretaker -------------------------------------

/**
 * Finds the right caretaker to attach the just-logged-in account to, then links it.
 * `mode` picks the lookup strategy, but it can be a guess (e.g. the wizard resuming directly
 * at stage 3, where the original security mode wasn't recoverable from the server) - so
 * caretakers-mode falls back to the system caretaker when the family caretaker list has
 * nothing but the reserved '00' entry, rather than failing outright. Every pin-mode family
 * always has a system caretaker, so this fallback is always safe to attempt.
 */
export async function linkAccountToCaretaker(
  base: string,
  token: string,
  familyId: string,
  mode: 'pin' | 'caretakers',
  deps: { post: typeof postJson; get: typeof getJson } = { post: postJson, get: getJson },
): Promise<void> {
  const { post, get } = deps

  async function systemCaretakerId(): Promise<string | undefined> {
    const res = await callOrThrowUnreachable(() => get(`${base}/api/caretaker/system?familyId=${familyId}`, { token }))
    assertSuccess(res)
    const data = envelopeOf(res.body)?.data as { id?: unknown } | undefined
    return typeof data?.id === 'string' ? data.id : undefined
  }

  let caretakerId: string | undefined
  if (mode === 'pin') {
    caretakerId = await systemCaretakerId()
  } else {
    // GET /api/caretaker (not /api/family/{id}/caretakers, which is sysadmin-gated and 403s
    // for account JWTs) - it's ordered by NAME and already excludes the reserved '00' entry, so
    // pick the lowest loginId rather than trusting list order.
    const res = await callOrThrowUnreachable(() => get(`${base}/api/caretaker?familyId=${familyId}`, { token }))
    assertSuccess(res)
    const data = envelopeOf(res.body)?.data as Array<{ id?: unknown; loginId?: unknown }> | undefined
    const candidates = (data ?? []).filter(
      (c): c is { id: string; loginId: string } => typeof c.id === 'string' && typeof c.loginId === 'string' && c.loginId !== '00',
    )
    const lowest = candidates.reduce<{ id: string; loginId: string } | undefined>(
      (min, c) => (!min || c.loginId < min.loginId ? c : min),
      undefined,
    )
    caretakerId = lowest?.id
    if (!caretakerId) {
      caretakerId = await systemCaretakerId()
    }
  }
  if (!caretakerId) throw new WizardError('rejected')

  const linkRes = await callOrThrowUnreachable(() => post(`${base}/api/accounts/link-caretaker`, { caretakerId }, { token }))
  assertSuccess(linkRes)
}

// --- Step: finish (re-login + save server + store creds) ----------------------

export interface FinishDeps {
  login: typeof loginWithCredentials
  saveServer: typeof saveServerToRegistry
  vault: Pick<CredentialVault, 'store'>
}

export async function finishWizard(
  base: string,
  creds: AccountCreds,
  familyName: string,
  biometric: boolean,
  deps?: FinishDeps,
): Promise<{ toast: string }> {
  const { login, saveServer, vault } = deps ?? { login: loginWithCredentials, saveServer: saveServerToRegistry, vault: createVault() }
  const result = await login({ id: `${base}|account`, baseUrl: base, familySlug: '' }, creds)
  if (!result.ok || !result.familySlug) {
    throw new WizardError('rejected', 'relogin')
  }
  const saved = await saveServer({
    baseUrl: base,
    familySlug: result.familySlug,
    familyName,
    deploymentMode: 'saas',
    authType: 'ACCOUNT',
  })
  await vault.store(saved.id, creds, { biometric })
  return { toast: `Welcome home - ${familyName} is set up and saved to this phone.` }
}

/**
 * Setup-link mode's finish: there is no account to link, so this logs in with the
 * PIN/caretaker credential the user just configured in step 2 (rather than an
 * account) and stores that as the saved server's credential.
 */
export async function finishSetupWizard(
  base: string,
  slug: string,
  familyName: string,
  creds: StoredCredentials,
  biometric: boolean,
  deps?: FinishDeps,
): Promise<{ toast: string }> {
  const { login, saveServer, vault } = deps ?? { login: loginWithCredentials, saveServer: saveServerToRegistry, vault: createVault() }
  const result = await login({ id: `${base}|${slug}`, baseUrl: base, familySlug: slug }, creds)
  if (!result.ok) throw new WizardError('rejected', 'relogin')
  const saved = await saveServer({
    baseUrl: base,
    familySlug: slug,
    familyName,
    deploymentMode: 'saas',
    authType: creds.type === 'pin' && creds.loginId === null ? 'SYSTEM' : 'CARETAKER',
  })
  await vault.store(saved.id, creds, { biometric })
  return { toast: `Welcome home - ${familyName} is set up and saved to this phone.` }
}
