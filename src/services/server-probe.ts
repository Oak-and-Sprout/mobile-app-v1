export interface ParsedServerInput { baseUrl: string; familySlug: string | null }

export interface DeploymentConfig {
  deploymentMode: 'saas' | 'selfhosted'
  enableAccounts: boolean
  allowAccountRegistration: boolean
}

export interface PublicFamily { name: string; slug: string; isActive: boolean }
export type AuthType = 'SYSTEM' | 'CARETAKER'

export class ProbeError extends Error {
  constructor(public kind: 'unreachable' | 'not-sprout-track' | 'family-not-found') {
    super(kind)
    this.name = 'ProbeError'
  }
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/i

export function parseServerInput(input: string): ParsedServerInput {
  const trimmed = input.trim()
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    throw new Error('invalid-url')
  }
  if (!url.hostname || url.hostname.includes(' ')) throw new Error('invalid-url')
  const segments = url.pathname.split('/').filter(Boolean)
  const familySlug = segments.length > 0 && SLUG_RE.test(segments[0]) ? segments[0] : null
  return { baseUrl: `${url.protocol}//${url.host}`, familySlug }
}

/** Accept either a raw payload or the Sprout Track `{ success, data }` envelope. */
function unwrap(body: unknown): unknown {
  if (typeof body === 'object' && body !== null && 'data' in body && 'success' in body) {
    return (body as { data: unknown }).data
  }
  return body
}

async function getJson(url: string, fetchFn: typeof fetch): Promise<{ status: number; payload: unknown }> {
  let res: Response
  try {
    res = await fetchFn(url, { headers: { Accept: 'application/json' } })
  } catch {
    throw new ProbeError('unreachable')
  }
  let payload: unknown = null
  try {
    payload = unwrap(await res.json())
  } catch {
    payload = null
  }
  return { status: res.status, payload }
}

export async function probeDeployment(baseUrl: string, fetchFn: typeof fetch = fetch): Promise<DeploymentConfig> {
  const { status, payload } = await getJson(`${baseUrl}/api/deployment-config`, fetchFn)
  const config = payload as DeploymentConfig | null
  if (status !== 200 || !config || (config.deploymentMode !== 'saas' && config.deploymentMode !== 'selfhosted')) {
    throw new ProbeError('not-sprout-track')
  }
  return {
    deploymentMode: config.deploymentMode,
    enableAccounts: Boolean(config.enableAccounts),
    allowAccountRegistration: Boolean(config.allowAccountRegistration),
  }
}

export async function fetchFamilyBySlug(baseUrl: string, slug: string, fetchFn: typeof fetch = fetch): Promise<PublicFamily> {
  const { status, payload } = await getJson(`${baseUrl}/api/family/by-slug/${encodeURIComponent(slug)}`, fetchFn)
  const family = payload as PublicFamily | null
  if (status === 404 || !family || typeof family.slug !== 'string') throw new ProbeError('family-not-found')
  return { name: family.name, slug: family.slug, isActive: Boolean(family.isActive) }
}

export async function fetchAuthType(baseUrl: string, slug: string, fetchFn: typeof fetch = fetch): Promise<AuthType> {
  const { payload } = await getJson(
    `${baseUrl}/api/auth/caretaker-exists?familySlug=${encodeURIComponent(slug)}`, fetchFn,
  )
  const exists = Boolean((payload as { exists?: unknown } | null)?.exists)
  return exists ? 'CARETAKER' : 'SYSTEM'
}
