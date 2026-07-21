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
            familyData?: { id?: string; name?: string; slug?: string }
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
    return {
      setupStage: data.setupStage,
      currentStage: data.currentStage,
      familyId: familyData.id,
      familyName: familyData.name,
      familySlug: familyData.slug,
    }
  } catch {
    return null
  }
}
