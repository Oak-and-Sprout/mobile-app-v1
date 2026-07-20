export const BRIDGE_CONTRACT_VERSION = 1

export type WebToNativeMessage =
  | { type: 'keepAwake'; on: boolean }
  | { type: 'capturePhoto' }
  | { type: 'sessionExpired' }
  | { type: 'loggedOut'; reason: string }
  | { type: 'registerPushToken'; jwt: string }

export type NativeToWebMessage =
  | { type: 'sessionInjected'; slug: string }
  | { type: 'appResumed' }

type AnyMessage = WebToNativeMessage | NativeToWebMessage

const KNOWN_TYPES: ReadonlySet<string> = new Set([
  'keepAwake', 'capturePhoto', 'sessionExpired', 'loggedOut', 'registerPushToken',
  'sessionInjected', 'appResumed',
])

export function encodeMessage(msg: AnyMessage): string {
  return JSON.stringify({ v: BRIDGE_CONTRACT_VERSION, msg })
}

export function decodeMessage(raw: string): { v: number; msg: AnyMessage } | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const { v, msg } = parsed as { v?: unknown; msg?: unknown }
  if (typeof v !== 'number' || v > BRIDGE_CONTRACT_VERSION) return null
  if (typeof msg !== 'object' || msg === null) return null
  const type = (msg as { type?: unknown }).type
  if (typeof type !== 'string' || !KNOWN_TYPES.has(type)) return null
  return { v, msg: msg as AnyMessage }
}
