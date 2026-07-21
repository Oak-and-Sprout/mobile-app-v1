import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Preferences } from '@capacitor/preferences'
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
