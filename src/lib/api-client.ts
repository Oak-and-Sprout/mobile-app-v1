import { Capacitor, CapacitorHttp } from '@capacitor/core'

export interface HttpResponse { status: number; body: unknown }

/**
 * POST JSON. On native platforms CapacitorHttp performs the request natively:
 * no CORS restrictions, and Set-Cookie responses land in the shared cookie jar
 * the webview uses — so a successful login seeds the refreshToken cookie for
 * the server origin.
 */
export async function postJson(url: string, body: unknown, opts: { token?: string } = {}): Promise<HttpResponse> {
  const authHeaders: Record<string, string> = opts.token ? { Authorization: `Bearer ${opts.token}` } : {}
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.post({
      url,
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      data: body,
    })
    return { status: res.status, body: res.data }
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  let parsed: unknown = null
  try {
    parsed = await res.json()
  } catch {
    parsed = null
  }
  return { status: res.status, body: parsed }
}

/**
 * PUT JSON. Mirrors postJson's dual native/fetch shape and JSON-parse-or-null
 * behavior on the fetch path — some server endpoints (settings, setup-stage
 * updates) require PUT rather than POST.
 */
export async function putJson(url: string, body: unknown, opts: { token?: string } = {}): Promise<HttpResponse> {
  const authHeaders: Record<string, string> = opts.token ? { Authorization: `Bearer ${opts.token}` } : {}
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.put({
      url,
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      data: body,
    })
    return { status: res.status, body: res.data }
  }
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  let parsed: unknown = null
  try {
    parsed = await res.json()
  } catch {
    parsed = null
  }
  return { status: res.status, body: parsed }
}

/**
 * GET JSON. Mirrors postJson's dual native/fetch shape and JSON-parse-or-null
 * behavior on the fetch path.
 */
export async function getJson(url: string, opts: { token?: string } = {}): Promise<HttpResponse> {
  const authHeaders: Record<string, string> = opts.token ? { Authorization: `Bearer ${opts.token}` } : {}
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({
      url,
      headers: { ...authHeaders },
    })
    return { status: res.status, body: res.data }
  }
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', ...authHeaders },
    credentials: 'include',
  })
  let parsed: unknown = null
  try {
    parsed = await res.json()
  } catch {
    parsed = null
  }
  return { status: res.status, body: parsed }
}
