import { Capacitor, CapacitorHttp } from '@capacitor/core'

export interface HttpResponse { status: number; body: unknown }

/**
 * POST JSON. On native platforms CapacitorHttp performs the request natively:
 * no CORS restrictions, and Set-Cookie responses land in the shared cookie jar
 * the webview uses — so a successful login seeds the refreshToken cookie for
 * the server origin.
 */
export async function postJson(url: string, body: unknown): Promise<HttpResponse> {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.post({
      url,
      headers: { 'Content-Type': 'application/json' },
      data: body,
    })
    return { status: res.status, body: res.data }
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
