import { postJson } from '../lib/api-client'
import type { StoredCredentials } from './credential-vault'

export type LoginResult =
  | { ok: true; token: string; familySlug: string; caretakerId?: string }
  | { ok: false; error: 'invalid' | 'locked' | 'unreachable'; retryAfterSeconds?: number }

interface LoginTarget { id: string; baseUrl: string; familySlug: string }

const inFlight = new Map<string, Promise<LoginResult>>()

export async function loginWithCredentials(
  entry: LoginTarget,
  creds: StoredCredentials,
  post: typeof postJson = postJson,
): Promise<LoginResult> {
  const existing = inFlight.get(entry.id)
  if (existing) return existing
  const promise = doLogin(entry, creds, post).finally(() => inFlight.delete(entry.id))
  inFlight.set(entry.id, promise)
  return promise
}

async function doLogin(entry: LoginTarget, creds: StoredCredentials, post: typeof postJson): Promise<LoginResult> {
  const [url, body] =
    creds.type === 'pin'
      ? [
          `${entry.baseUrl}/api/auth`,
          creds.loginId === null
            ? { securityPin: creds.securityPin, familySlug: entry.familySlug }
            : { loginId: creds.loginId, securityPin: creds.securityPin, familySlug: entry.familySlug },
        ]
      : [`${entry.baseUrl}/api/accounts/login`, { email: creds.email, password: creds.password }]

  let res: { status: number; body: unknown }
  try {
    res = await post(url, body)
  } catch {
    return { ok: false, error: 'unreachable' }
  }

  if (res.status === 429) {
    const remaining = (res.body as { data?: { remainingTime?: number } } | null)?.data?.remainingTime
    return { ok: false, error: 'locked', retryAfterSeconds: remaining }
  }

  const envelope = res.body as
    | {
        success?: boolean
        data?: {
          token?: string
          familySlug?: string
          id?: unknown
          user?: { id?: unknown; familySlug?: string }
        }
      }
    | null
  if (res.status !== 200 || !envelope?.success || !envelope.data?.token) {
    return { ok: false, error: 'invalid' }
  }
  const data = envelope.data
  const token = envelope.data.token
  // PIN logins return a flat envelope (familySlug/id at the top level). Account logins
  // return a nested envelope (familySlug/id under data.user). Prefer the flat fields when
  // present, then fall back to the nested user object.
  const familySlug =
    typeof data.familySlug === 'string'
      ? data.familySlug
      : typeof data.user?.familySlug === 'string'
        ? data.user.familySlug
        : undefined
  // caretakerId comes only from the flat PIN envelope. Account logins' data.user.id is the
  // ACCOUNT id, not a caretaker id — the web app's own account login never sets caretakerId,
  // and injecting it would make shell-opened sessions carry state the web flow never produces.
  const caretakerId = typeof data.id === 'string' ? data.id : undefined
  return {
    ok: true,
    token,
    familySlug: familySlug ?? entry.familySlug,
    ...(caretakerId !== undefined ? { caretakerId } : {}),
  }
}
