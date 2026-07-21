import { postJson, getJson, putJson } from '../lib/api-client'
import { loginWithCredentials } from './session'
import { saveServer as saveServerToRegistry } from './server-registry'
import { createVault, type CredentialVault, type AccountCreds } from './credential-vault'

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

// --- Step: create family -----------------------------------------------------

export async function createFamily(
  base: string,
  token: string,
  args: { name: string; slug: string },
  post: typeof postJson = postJson,
): Promise<{ familyId: string }> {
  const res = await callOrThrowUnreachable(() => post(`${base}/api/setup/start`, args, { token }))
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
 * sibling saveBabyAndLink's `{ post, get }` deps bundle, this takes `{ post, put }` instead.
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
      assertSuccess(res)
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

// --- Step: baby + caretaker link ----------------------------------------------

export async function saveBabyAndLink(
  base: string,
  token: string,
  familyId: string,
  baby: BabyConfig,
  mode: 'pin' | 'caretakers',
  deps: { post: typeof postJson; get: typeof getJson } = { post: postJson, get: getJson },
): Promise<void> {
  const { post, get } = deps

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

  let caretakerId: string | undefined
  if (mode === 'pin') {
    const res = await callOrThrowUnreachable(() => get(`${base}/api/caretaker/system?familyId=${familyId}`, { token }))
    assertSuccess(res)
    const data = envelopeOf(res.body)?.data as { id?: unknown } | undefined
    caretakerId = typeof data?.id === 'string' ? data.id : undefined
  } else {
    const res = await callOrThrowUnreachable(() => get(`${base}/api/family/${familyId}/caretakers`, { token }))
    assertSuccess(res)
    const data = envelopeOf(res.body)?.data as Array<{ id?: unknown; loginId?: unknown }> | undefined
    const found = data?.find(c => c.loginId !== '00')
    caretakerId = typeof found?.id === 'string' ? found.id : undefined
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
