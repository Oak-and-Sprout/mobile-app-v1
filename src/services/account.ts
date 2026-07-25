import { postJson, getJson } from '../lib/api-client'

export const SAAS_BASE = 'https://sprout-track.com'

export type RegisterResult =
  | { ok: true }
  | { ok: false; error: 'rate-limited' | 'unreachable' | 'rejected'; message?: string }

export async function registerAccount(
  base: string,
  args: { email: string; password: string; firstName: string; lastName: string },
  post: typeof postJson = postJson,
): Promise<RegisterResult> {
  let res: { status: number; body: unknown }
  try {
    res = await post(`${base}/api/accounts/register`, args)
  } catch {
    return { ok: false, error: 'unreachable' }
  }

  if (res.status === 429) {
    return { ok: false, error: 'rate-limited' }
  }

  const envelope = res.body as { success?: boolean; error?: string; data?: { success?: boolean; message?: string } } | null
  const data = envelope?.data
  if (envelope?.success && data?.success !== false) {
    return { ok: true }
  }
  const message = envelope?.error ?? data?.message
  return {
    ok: false,
    error: 'rejected',
    ...(typeof message === 'string' ? { message } : {}),
  }
}

export interface AccountStatus {
  verified: boolean
  hasFamily: boolean
  familySlug?: string
  firstName?: string
}

export async function fetchAccountStatus(
  base: string,
  token: string,
  get: typeof getJson = getJson,
): Promise<AccountStatus | null> {
  try {
    const res = await get(`${base}/api/accounts/status`, { token })
    if (res.status !== 200) return null
    const envelope = res.body as
      | { success?: boolean; data?: { verified?: boolean; hasFamily?: boolean; familySlug?: string; firstName?: string } }
      | null
    const data = envelope?.data
    if (!envelope?.success || !data || typeof data.verified !== 'boolean' || typeof data.hasFamily !== 'boolean') {
      return null
    }
    return {
      verified: data.verified,
      hasFamily: data.hasFamily,
      ...(typeof data.familySlug === 'string' ? { familySlug: data.familySlug } : {}),
      ...(typeof data.firstName === 'string' ? { firstName: data.firstName } : {}),
    }
  } catch {
    return null
  }
}

export async function resendVerification(
  base: string,
  email: string,
  post: typeof postJson = postJson,
): Promise<boolean> {
  try {
    const res = await post(`${base}/api/accounts/resend-verification`, { email })
    const envelope = res.body as { success?: boolean; data?: { success?: boolean } } | null
    return Boolean(envelope?.success && envelope.data?.success)
  } catch {
    return false
  }
}

export async function requestPasswordReset(
  base: string,
  email: string,
  post: typeof postJson = postJson,
): Promise<boolean> {
  try {
    const res = await post(`${base}/api/accounts/forgot-password`, { email })
    const envelope = res.body as { success?: boolean; data?: { success?: boolean } } | null
    return Boolean(envelope?.success && envelope.data?.success)
  } catch {
    return false
  }
}

export interface SetupStatus {
  setupStage: number
  currentStage: 2 | 3
  familyId: string
  familyName: string
  familySlug: string
  /** The family's chosen security mode, when the server reports one. null when absent or an
   *  unrecognized value - callers (account-routing's wizard resume) must treat that as unknown,
   *  not assume a default here. */
  authType: 'SYSTEM' | 'CARETAKER' | null
}

export async function fetchSetupStatus(
  base: string,
  token: string,
  get: typeof getJson = getJson,
): Promise<SetupStatus | null> {
  try {
    const res = await get(`${base}/api/family/setup-status`, { token })
    if (res.status !== 200) return null
    const envelope = res.body as
      | {
          success?: boolean
          data?: {
            setupStage?: number
            currentStage?: number
            familyData?: { id?: string; name?: string; slug?: string; authType?: unknown }
          }
        }
      | null
    const data = envelope?.data
    const familyData = data?.familyData
    if (
      !envelope?.success ||
      typeof data?.setupStage !== 'number' ||
      (data?.currentStage !== 2 && data?.currentStage !== 3) ||
      typeof familyData?.id !== 'string' ||
      typeof familyData?.name !== 'string' ||
      typeof familyData?.slug !== 'string'
    ) {
      return null
    }
    const authType =
      familyData.authType === 'SYSTEM' || familyData.authType === 'CARETAKER' ? familyData.authType : null
    return {
      setupStage: data.setupStage,
      currentStage: data.currentStage,
      familyId: familyData.id,
      familyName: familyData.name,
      familySlug: familyData.slug,
      authType,
    }
  } catch {
    return null
  }
}

export async function validateResetToken(
  base: string,
  token: string,
  get: typeof getJson = getJson,
): Promise<{ valid: boolean; email?: string } | null> {
  try {
    const res = await get(`${base}/api/accounts/reset-password?token=${encodeURIComponent(token)}`)
    if (res.status !== 200) return null
    const data = (res.body as { success?: boolean; data?: { valid?: boolean; email?: string } } | null)?.data
    if (typeof data?.valid !== 'boolean') return null
    return { valid: data.valid, ...(typeof data.email === 'string' ? { email: data.email } : {}) }
  } catch {
    return null
  }
}

export type ResetSubmitResult =
  | { ok: true }
  | { ok: false; error: 'invalid' | 'rate-limited' | 'unreachable'; message?: string }

export async function submitPasswordReset(
  base: string,
  token: string,
  password: string,
  post: typeof postJson = postJson,
): Promise<ResetSubmitResult> {
  let res: { status: number; body: unknown }
  try {
    res = await post(`${base}/api/accounts/reset-password`, { token, password })
  } catch {
    return { ok: false, error: 'unreachable' }
  }
  const envelope = res.body as { success?: boolean; error?: string; data?: { success?: boolean } } | null
  if (res.status === 200 && envelope?.success && envelope.data?.success) return { ok: true }
  const message = envelope?.error
  if (res.status === 429) {
    return { ok: false, error: 'rate-limited', ...(typeof message === 'string' ? { message } : {}) }
  }
  // 400 (malformed request) and 404 (unknown/expired token) both mean the
  // link itself can't be honored. Anything else (500, an unparseable
  // response) means the request didn't complete, not that the token is bad -
  // same shape as verifyEmailToken above.
  if (res.status === 400 || res.status === 404) {
    return { ok: false, error: 'invalid', ...(typeof message === 'string' ? { message } : {}) }
  }
  return { ok: false, error: 'unreachable', ...(typeof message === 'string' ? { message } : {}) }
}

export type VerifyEmailResult =
  | { ok: true }
  | { ok: false; error: 'invalid' | 'unreachable'; message?: string }

/**
 * Consumes the one-time token from an emailed `/verify?token=` link
 * (POST /api/accounts/verify on the server). Unauthenticated and distinct
 * from fetchAccountStatus's polling, which needs an account JWT from a
 * fresh login - a cold deep-link tap has neither a JWT nor stored
 * credentials, only this token.
 */
export async function verifyEmailToken(
  base: string,
  token: string,
  post: typeof postJson = postJson,
): Promise<VerifyEmailResult> {
  let res: { status: number; body: unknown }
  try {
    res = await post(`${base}/api/accounts/verify`, { token })
  } catch {
    return { ok: false, error: 'unreachable' }
  }
  const envelope = res.body as
    | { success?: boolean; error?: string; data?: { success?: boolean; message?: string } }
    | null
  if (res.status === 200 && envelope?.success && envelope.data?.success) {
    return { ok: true }
  }
  const message = envelope?.error ?? envelope?.data?.message
  // 400 (malformed request - missing token) and 404 (unknown/expired token) both
  // mean the link itself can't be honored. Anything else (500, an unparseable
  // response) means the request didn't complete, not that the token is bad.
  if (res.status === 400 || res.status === 404) {
    return { ok: false, error: 'invalid', ...(typeof message === 'string' ? { message } : {}) }
  }
  return { ok: false, error: 'unreachable', ...(typeof message === 'string' ? { message } : {}) }
}
