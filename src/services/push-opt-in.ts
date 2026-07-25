import { Preferences } from '@capacitor/preferences'

export type OptIn = 'unasked' | 'granted' | 'declined'

const KEY = 'push-opt-in'
const TOKEN_KEY = 'push-last-token'
const CONNECTED_KEY = 'has-connected-once'
const VALUES: OptIn[] = ['unasked', 'granted', 'declined']

export async function getOptIn(): Promise<OptIn> {
  const { value } = await Preferences.get({ key: KEY })
  return VALUES.includes(value as OptIn) ? (value as OptIn) : 'unasked'
}

export async function setOptIn(value: OptIn): Promise<void> {
  await Preferences.set({ key: KEY, value })
}

/**
 * The last token we successfully registered. Family removal needs a token to
 * unregister with, and re-running acquireToken() there would call register()
 * again - blocking the removal UI for the full timeout when permission is denied.
 */
export async function getLastToken(): Promise<string | null> {
  const { value } = await Preferences.get({ key: TOKEN_KEY })
  return value ?? null
}

export async function setLastToken(token: string): Promise<void> {
  await Preferences.set({ key: TOKEN_KEY, value: token })
}

/**
 * connectToFamily hands the WebView to the remote server as part of a
 * successful connect, so there is no moment "just after connecting" in which
 * the shell can render the push permission intro - its React tree is gone by
 * then. This flag lets the *next* launch know a connect has happened before,
 * so App.tsx can show the intro then (gated on getOptIn() still being
 * 'unasked').
 */
export async function hasConnectedOnce(): Promise<boolean> {
  const { value } = await Preferences.get({ key: CONNECTED_KEY })
  return value === 'true'
}

export async function markConnectedOnce(): Promise<void> {
  await Preferences.set({ key: CONNECTED_KEY, value: 'true' })
}
