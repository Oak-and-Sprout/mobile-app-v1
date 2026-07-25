import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Preferences } from '@capacitor/preferences'
import type { ActionPerformed } from '@capacitor/push-notifications'
import App from './App'
import { saveServer, touchServer } from './services/server-registry'
import { AUTO_OPEN_KEY } from './screens/Settings'
import * as connectService from './services/connect'
import * as accountService from './services/account'
import * as sessionService from './services/session'
import { encodeMessage } from '../shared/bridge-contract'

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
  vi.useRealTimers()
})

// Flushes the boot effect's promise chain (listServers/getDefaultServer/isAutoOpenEnabled)
// without moving the splash's own HOLD_MS/FADE_MS timers forward.
async function flushBootEffect() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

// A fake `PushActionPlugin` that captures the listener App.tsx registers, so
// tests can fire a "tap" without vi.mock('@capacitor/...') - none exists in
// this repo, and the real plugin has no web implementation to exercise.
function fakePushPlugin() {
  let handler: ((action: ActionPerformed) => void) | null = null
  return {
    plugin: {
      addListener: vi.fn(async (_event: string, cb: typeof handler) => {
        handler = cb
        return { remove: async () => {} }
      }),
    },
    async fire(data: unknown) {
      await act(async () => {
        handler?.({ actionId: 'tap', notification: { id: 'n1', data } })
        await vi.advanceTimersByTimeAsync(0)
      })
    },
  }
}

// A fake `DeepLinkPlugin` that captures the listener App.tsx registers for
// `appUrlOpen`, mirroring fakePushPlugin above - same rationale (no
// vi.mock('@capacitor/...') in this repo, no web implementation to exercise).
function fakeDeepLinkPlugin() {
  let handler: ((event: { url: string }) => void) | null = null
  return {
    plugin: {
      addListener: vi.fn(async (_event: string, cb: typeof handler) => {
        handler = cb
        return { remove: async () => {} }
      }),
    },
    async open(url: string) {
      await act(async () => {
        handler?.({ url })
        await vi.advanceTimersByTimeAsync(0)
      })
    },
  }
}

// Runs the splash to completion (HOLD_MS 2150 + FADE_MS 550 = 2700ms) so the resolved
// boot target is applied.
async function finishSplash() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2700)
  })
}

test('renders the app root', () => {
  render(<App />)
  expect(screen.getByTestId('app-root')).toBeInTheDocument()
})

test('shows the splash immediately on launch', () => {
  const { container } = render(<App />)
  expect(container.querySelector('.splash')).toBeTruthy()
})

test('boot resolving before the splash finishes does not swap the screen early', async () => {
  // No saved servers, so the boot effect resolves its target (fork) almost immediately -
  // well before the splash's own 2700ms timers fire.
  const { container } = render(<App />)
  await flushBootEffect()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000)
  })
  expect(container.querySelector('.splash')).toBeTruthy()
  expect(screen.queryByText(/Everyone you love,/)).toBeNull()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(700)
  })
  expect(screen.getByText(/Everyone you love,/)).toBeInTheDocument()
})

test('with no saved servers, the splash resolves to Fork', async () => {
  render(<App />)
  await finishSplash()
  expect(screen.getByText(/Everyone you love,/)).toBeInTheDocument()
})

test('with saved servers and auto-open disabled, the splash resolves to the families list', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  await Preferences.set({ key: AUTO_OPEN_KEY, value: 'false' })
  render(<App />)
  await finishSplash()
  expect(screen.getByText(/my families/i)).toBeInTheDocument()
})

test('with a default server and auto-open enabled, the splash resolves to Connecting', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  // Never resolves, so the app stays on the Connecting screen for the assertion below.
  vi.spyOn(connectService, 'connectToFamily').mockReturnValue(new Promise(() => {}))
  render(<App />)
  await finishSplash()
  expect(screen.getByText(/opening smith family/i)).toBeInTheDocument()
})

test('a ?bridge-event= switch-family param resolves to the families list instead of auto-opening', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  const connectSpy = vi.spyOn(connectService, 'connectToFamily')
  const bridgeEvent = encodeURIComponent(encodeMessage({ type: 'loggedOut', reason: 'switch-family' }))
  window.history.replaceState(null, '', `/?bridge-event=${bridgeEvent}`)
  render(<App />)
  await finishSplash()
  expect(screen.getByText(/my families/i)).toBeInTheDocument()
  expect(connectSpy).not.toHaveBeenCalled()
})

test('a session-expiry ?bridge-event= reconnects to the most recent family via Connecting', async () => {
  const entry = await saveServer({
    baseUrl: 'https://x.com', familySlug: 'recent-family', familyName: 'Recent Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  await touchServer(entry.id)
  // Never resolves, so the app stays on the Connecting screen for the assertion below.
  vi.spyOn(connectService, 'connectToFamily').mockReturnValue(new Promise(() => {}))
  const bridgeEvent = encodeURIComponent(encodeMessage({ type: 'loggedOut', reason: 'logout-idle' }))
  window.history.replaceState(null, '', `/?bridge-event=${bridgeEvent}`)
  render(<App />)
  await finishSplash()
  expect(screen.getByText(/opening recent family/i)).toBeInTheDocument()
})

test('offline retry that resolves locked returns to families', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  const connectSpy = vi.spyOn(connectService, 'connectToFamily')
    .mockResolvedValueOnce('offline')
    .mockResolvedValueOnce('locked')
  render(<App />)
  await finishSplash()
  await flushBootEffect()
  expect(screen.getByText(/can’t reach your server/i)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /try again/i }))
  await flushBootEffect()
  expect(screen.getByText(/my families/i)).toBeInTheDocument()
  expect(connectSpy).toHaveBeenCalledTimes(2)
})

test('navigating fork -> acct-signin -> acct-signup renders the create-account screen', async () => {
  render(<App />)
  await finishSplash()
  fireEvent.click(screen.getByText('With my Sprout Track account'))
  fireEvent.click(screen.getByRole('button', { name: 'Start your free trial' }))
  expect(screen.getByRole('heading', { name: 'Create your account.' })).toBeInTheDocument()
})

test('navigating fork -> acct-signin -> acct-reset renders the reset-password screen', async () => {
  render(<App />)
  await finishSplash()
  fireEvent.click(screen.getByText('With my Sprout Track account'))
  fireEvent.click(screen.getByRole('button', { name: 'Reset it' }))
  expect(screen.getByRole('heading', { name: 'Reset your password.' })).toBeInTheDocument()
})

test('with a prior connect and an unasked opt-in, the splash resolves to the push intro', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  await Preferences.set({ key: 'has-connected-once', value: 'true' })
  // push-opt-in left unset -> getOptIn() === 'unasked'
  render(<App />)
  await finishSplash()
  expect(screen.getByRole('button', { name: /turn on/i })).toBeInTheDocument()
})

test('a bridge-event logout still wins over a pending push intro', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  await Preferences.set({ key: 'has-connected-once', value: 'true' })
  const bridgeEvent = encodeURIComponent(encodeMessage({ type: 'loggedOut', reason: 'switch-family' }))
  window.history.replaceState(null, '', `/?bridge-event=${bridgeEvent}`)
  render(<App />)
  await finishSplash()
  expect(screen.getByText(/my families/i)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /turn on/i })).not.toBeInTheDocument()
})

test('with a prior connect but opt-in already granted, the intro never re-shows', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  await Preferences.set({ key: 'has-connected-once', value: 'true' })
  await Preferences.set({ key: 'push-opt-in', value: 'granted' })
  await Preferences.set({ key: AUTO_OPEN_KEY, value: 'false' })
  render(<App />)
  await finishSplash()
  expect(screen.getByText(/my families/i)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /turn on/i })).not.toBeInTheDocument()
})

test('a fresh account with no family routes straight from signup into the wizard', async () => {
  // Spies must be in place before AccountSignUp mounts - its deps are captured once at mount.
  vi.spyOn(accountService, 'registerAccount').mockResolvedValue({ ok: true })
  vi.spyOn(sessionService, 'loginWithCredentials').mockResolvedValue({ ok: true, token: 'tok', familySlug: '' })
  render(<App />)
  await finishSplash()
  fireEvent.click(screen.getByText('With my Sprout Track account'))
  fireEvent.click(screen.getByRole('button', { name: 'Start your free trial' }))

  fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Betty' } })
  fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Sprout' } })
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'betty@example.com' } })
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'Abcdef1!' } })
  fireEvent.click(screen.getByRole('button', { name: /start my free trial/i }))
  await flushBootEffect()

  expect(screen.getByRole('heading', { name: 'Create your family.' })).toBeInTheDocument()
})

test('a queued push tap routes to the tapped family with its route', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  const push = fakePushPlugin()
  // Never resolves, so the app stays on Connecting for the assertion below.
  const connectSpy = vi.spyOn(connectService, 'connectToFamily').mockReturnValue(new Promise(() => {}))
  render(<App pushPlugin={push.plugin} />)
  await flushBootEffect()
  await push.fire({ familySlug: 'smith-family', route: 'medicine' })
  await finishSplash()
  expect(screen.getByText(/opening smith family/i)).toBeInTheDocument()
  expect(connectSpy).toHaveBeenCalledWith(
    expect.objectContaining({ familySlug: 'smith-family' }),
    undefined,
    'medicine',
  )
})

test('a push tap for an unsaved family is ignored and the normal boot destination wins', async () => {
  const push = fakePushPlugin()
  render(<App pushPlugin={push.plugin} />)
  await flushBootEffect()
  await push.fire({ familySlug: 'nobody', route: 'medicine' })
  await finishSplash()
  // No saved servers -> the normal boot destination is Fork.
  expect(screen.getByText(/Everyone you love,/)).toBeInTheDocument()
})

test('a bridge event beats a queued push tap for a different family', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  await saveServer({
    baseUrl: 'https://y.com', familySlug: 'jones-family', familyName: 'Jones Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  const push = fakePushPlugin()
  const connectSpy = vi.spyOn(connectService, 'connectToFamily')
  const bridgeEvent = encodeURIComponent(encodeMessage({ type: 'loggedOut', reason: 'switch-family' }))
  window.history.replaceState(null, '', `/?bridge-event=${bridgeEvent}`)
  render(<App pushPlugin={push.plugin} />)
  await flushBootEffect()
  await push.fire({ familySlug: 'jones-family', route: 'medicine' })
  await finishSplash()
  expect(screen.getByText(/my families/i)).toBeInTheDocument()
  expect(connectSpy).not.toHaveBeenCalled()
})

test('a bridge event beats a concurrent deep link', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  const deepLink = fakeDeepLinkPlugin()
  const bridgeEvent = encodeURIComponent(encodeMessage({ type: 'loggedOut', reason: 'switch-family' }))
  window.history.replaceState(null, '', `/?bridge-event=${bridgeEvent}`)
  render(<App deepLinkPlugin={deepLink.plugin} />)
  await flushBootEffect()
  // Without the bootAction guard, this would win and land on AccountResetConfirm instead.
  await deepLink.open('https://sprout-track.com/passwordreset?token=abc123')
  await finishSplash()
  expect(screen.getByText(/my families/i)).toBeInTheDocument()
})

test('a Universal Link for password reset routes to the reset-confirm screen', async () => {
  const deepLink = fakeDeepLinkPlugin()
  // AccountResetConfirm isn't given injectable deps from App.tsx, so it calls the
  // real validateResetToken on mount - stub fetch to keep this test off the network.
  vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}))
  render(<App deepLinkPlugin={deepLink.plugin} />)
  await flushBootEffect()
  await deepLink.open('https://sprout-track.com/passwordreset?token=abc123')
  await finishSplash()
  expect(screen.getByRole('heading', { name: 'Set a new password.' })).toBeInTheDocument()
})

test('a Universal Link the shell does not claim leaves the normal boot destination alone', async () => {
  const deepLink = fakeDeepLinkPlugin()
  render(<App deepLinkPlugin={deepLink.plugin} />)
  await flushBootEffect()
  // /account is deliberately unclaimed (App Store payment compliance) - screenForDeepLink
  // returns null, so this must not disturb the boot target already in flight.
  await deepLink.open('https://sprout-track.com/account')
  await finishSplash()
  expect(screen.getByText(/Everyone you love,/)).toBeInTheDocument()
})

test('a deep link tapped after landing on the push intro does not clobber it', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  await Preferences.set({ key: 'has-connected-once', value: 'true' })
  // push-opt-in left unset -> getOptIn() === 'unasked' -> boots to push-intro.
  const deepLink = fakeDeepLinkPlugin()
  render(<App deepLinkPlugin={deepLink.plugin} />)
  await finishSplash()
  expect(screen.getByRole('button', { name: /turn on/i })).toBeInTheDocument()
  // Once splash is done, applyBootTarget only swaps the live screen while it's
  // still 'splash' - a link tapped after landing on a real screen can't override it.
  await deepLink.open('https://sprout-track.com/passwordreset?token=abc123')
  expect(screen.getByRole('button', { name: /turn on/i })).toBeInTheDocument()
})

test('a push tap with a malicious route degrades to log-entry', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  const push = fakePushPlugin()
  const connectSpy = vi.spyOn(connectService, 'connectToFamily').mockReturnValue(new Promise(() => {}))
  render(<App pushPlugin={push.plugin} />)
  await flushBootEffect()
  await push.fire({ familySlug: 'smith-family', route: '../evil' })
  await finishSplash()
  expect(screen.getByText(/opening smith family/i)).toBeInTheDocument()
  expect(connectSpy).toHaveBeenCalledWith(
    expect.objectContaining({ familySlug: 'smith-family' }),
    undefined,
    'log-entry',
  )
})
