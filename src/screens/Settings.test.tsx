import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import Settings, { notificationRowState } from './Settings'
import { permissionState, unregisterFrom } from '../services/push'
import { getOptIn, setOptIn, getLastToken, setLastToken } from '../services/push-opt-in'
import { listServers, saveServer } from '../services/server-registry'

vi.mock('../services/push', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/push')>()
  // permissionState is fully mocked - jsdom has no real OS permission state to
  // read. unregisterFrom wraps the actual implementation (which already
  // swallows its own network failures) so tests can assert call args while
  // still exercising the real best-effort behavior.
  return { ...actual, permissionState: vi.fn(), unregisterFrom: vi.fn(actual.unregisterFrom) }
})

vi.mock('../services/push-opt-in', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/push-opt-in')>()
  // getLastToken wraps the actual (Preferences-backed) implementation so most
  // tests exercise the real read, while specific tests can force it to reject
  // to prove a failed read can't block clearAll.
  return { ...actual, getLastToken: vi.fn(actual.getLastToken) }
})

beforeEach(() => {
  localStorage.clear()
  vi.mocked(permissionState).mockReset().mockResolvedValue('prompt')
  vi.mocked(unregisterFrom).mockClear()
  vi.mocked(getLastToken).mockClear()
})

describe('notificationRowState', () => {
  test('is on only when the OS granted and the user opted in', () => {
    expect(notificationRowState('granted', 'granted')).toBe('on')
  })

  test('is off when the user declined even though the OS would allow it', () => {
    expect(notificationRowState('granted', 'declined')).toBe('off')
  })

  test('is blocked when the OS denied - Settings is the only recovery', () => {
    expect(notificationRowState('denied', 'granted')).toBe('blocked')
    expect(notificationRowState('denied', 'unasked')).toBe('blocked')
  })

  test('is off when nothing has been asked yet', () => {
    expect(notificationRowState('prompt', 'unasked')).toBe('off')
  })
})

describe('notifications row', () => {
  test('shows "on" copy and a checked switch when granted and opted in', async () => {
    vi.mocked(permissionState).mockResolvedValue('granted')
    await setOptIn('granted')
    render(<Settings navigate={vi.fn()} />)
    expect(await screen.findByText(/on for this phone/i)).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /notifications/i })).toHaveAttribute('aria-checked', 'true')
  })

  test('turning the switch off records declined and swaps to the "off" row', async () => {
    vi.mocked(permissionState).mockResolvedValue('granted')
    await setOptIn('granted')
    const user = userEvent.setup()
    render(<Settings navigate={vi.fn()} />)
    const toggle = await screen.findByRole('switch', { name: /notifications/i })
    await user.click(toggle)
    expect(await screen.findByRole('button', { name: /turn on notifications/i })).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: /notifications/i })).not.toBeInTheDocument()
    await waitFor(async () => expect(await getOptIn()).toBe('declined'))
  })

  test('shows a turn-on button when off, which opens the intro screen', async () => {
    vi.mocked(permissionState).mockResolvedValue('prompt')
    const navigate = vi.fn()
    const user = userEvent.setup()
    render(<Settings navigate={navigate} />)
    await user.click(await screen.findByRole('button', { name: /turn on notifications/i }))
    expect(navigate).toHaveBeenCalledWith({ name: 'push-intro', next: { name: 'settings' } })
  })

  test('on iOS: shows the blocked copy and a settings link when the OS denied, even if opt-in was granted', async () => {
    vi.mocked(permissionState).mockResolvedValue('denied')
    await setOptIn('granted')
    render(<Settings navigate={vi.fn()} platform="ios" />)
    expect(await screen.findByText(/turned off in your phone.s settings/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open settings/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /turn on notifications/i })).not.toBeInTheDocument()
  })

  test('on iOS: the settings link opens the OS settings app', async () => {
    vi.mocked(permissionState).mockResolvedValue('denied')
    const assign = vi.fn()
    const originalLocation = window.location
    // jsdom's window.location.assign is non-configurable, so it can't be
    // spied on directly - swap the whole object out for the duration of the test.
    Object.defineProperty(window, 'location', { value: { ...originalLocation, assign }, writable: true })
    const user = userEvent.setup()
    render(<Settings navigate={vi.fn()} platform="ios" />)
    await user.click(await screen.findByRole('button', { name: /open settings/i }))
    expect(assign).toHaveBeenCalledWith('app-settings:')
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
  })

  test('on Android: shows guidance text instead of a dead settings button when the OS denied', async () => {
    vi.mocked(permissionState).mockResolvedValue('denied')
    render(<Settings navigate={vi.fn()} platform="android" />)
    expect(await screen.findByText(/turned off in your phone.s settings/i)).toBeInTheDocument()
    expect(screen.getByText(/find sprout track, and turn notifications back on/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /open settings/i })).not.toBeInTheDocument()
  })
})

describe('clear all data unregisters push tokens, best effort', () => {
  test('unregisters the stored token against every saved family before clearing', async () => {
    await saveServer({
      baseUrl: 'https://a.example.com', familySlug: 'a', familyName: 'A',
      deploymentMode: 'selfhosted', authType: 'SYSTEM',
    })
    await saveServer({
      baseUrl: 'https://b.example.com', familySlug: 'b', familyName: 'B',
      deploymentMode: 'selfhosted', authType: 'SYSTEM',
    })
    await setLastToken('tok-1')
    const user = userEvent.setup()
    render(<Settings navigate={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /clear all data/i }))
    await user.click(screen.getByRole('button', { name: /yes, clear it/i }))
    await waitFor(() => expect(unregisterFrom).toHaveBeenCalledTimes(2))
    expect(unregisterFrom).toHaveBeenCalledWith('https://a.example.com', 'tok-1')
    expect(unregisterFrom).toHaveBeenCalledWith('https://b.example.com', 'tok-1')
  })

  test('skips unregister when there is no stored token', async () => {
    await saveServer({
      baseUrl: 'https://a.example.com', familySlug: 'a', familyName: 'A',
      deploymentMode: 'selfhosted', authType: 'SYSTEM',
    })
    const user = userEvent.setup()
    render(<Settings navigate={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /clear all data/i }))
    await user.click(screen.getByRole('button', { name: /yes, clear it/i }))
    await waitFor(async () => expect(await listServers()).toHaveLength(0))
    expect(unregisterFrom).not.toHaveBeenCalled()
  })

  test('still clears every family and navigates to fork even when the unregister network call fails', async () => {
    await saveServer({
      baseUrl: 'https://a.example.com', familySlug: 'a', familyName: 'A',
      deploymentMode: 'selfhosted', authType: 'SYSTEM',
    })
    await setLastToken('tok-1')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    const navigate = vi.fn()
    const user = userEvent.setup()
    render(<Settings navigate={navigate} />)
    await user.click(screen.getByRole('button', { name: /clear all data/i }))
    await user.click(screen.getByRole('button', { name: /yes, clear it/i }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'fork' }))
    expect(await listServers()).toHaveLength(0)
    fetchSpy.mockRestore()
  })

  test('still clears every family and navigates to fork even when reading the stored token rejects', async () => {
    await saveServer({
      baseUrl: 'https://a.example.com', familySlug: 'a', familyName: 'A',
      deploymentMode: 'selfhosted', authType: 'SYSTEM',
    })
    vi.mocked(getLastToken).mockRejectedValueOnce(new Error('native preferences failure'))
    const navigate = vi.fn()
    const user = userEvent.setup()
    render(<Settings navigate={navigate} />)
    await user.click(screen.getByRole('button', { name: /clear all data/i }))
    await user.click(screen.getByRole('button', { name: /yes, clear it/i }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'fork' }))
    expect(await listServers()).toHaveLength(0)
  })
})

test('clear all data wipes the registry', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 's', familyName: 'S',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  const user = userEvent.setup()
  render(<Settings navigate={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: /clear all data/i }))
  await user.click(screen.getByRole('button', { name: /yes, clear it/i }))
  await waitFor(async () => expect(await listServers()).toHaveLength(0))
})

test('clear all data also clears vault credentials', async () => {
  const entry = await saveServer({
    baseUrl: 'https://x.com', familySlug: 's', familyName: 'S',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  const vaultKey = `sprout-creds:${entry.id}`
  localStorage.setItem(vaultKey, JSON.stringify({
    biometric: false,
    creds: { type: 'pin', loginId: null, securityPin: '1234' },
  }))
  const user = userEvent.setup()
  render(<Settings navigate={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: /clear all data/i }))
  await user.click(screen.getByRole('button', { name: /yes, clear it/i }))
  await waitFor(() => expect(localStorage.getItem(vaultKey)).toBeNull())
})

test('clear all data navigates to fork after clearing', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 's', familyName: 'S',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  const navigate = vi.fn()
  const user = userEvent.setup()
  render(<Settings navigate={navigate} />)
  await user.click(screen.getByRole('button', { name: /clear all data/i }))
  await user.click(screen.getByRole('button', { name: /yes, clear it/i }))
  await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'fork' }))
})

test('clear confirm shows the "keep it" fallback which backs out without clearing', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 's', familyName: 'S',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  const user = userEvent.setup()
  render(<Settings navigate={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: /clear all data/i }))
  expect(screen.getByText(/this clears the book from this phone - the server keeps everything\. sure\?/i)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /keep it/i }))
  expect(screen.queryByText(/this clears the book from this phone/i)).not.toBeInTheDocument()
  expect(await listServers()).toHaveLength(1)
})

test('auto-open toggle is a switch and persists', async () => {
  const user = userEvent.setup()
  render(<Settings navigate={vi.fn()} />)
  const toggle = await screen.findByRole('switch', { name: /open my starred family automatically/i })
  expect(toggle).toHaveAttribute('aria-checked', 'true')
  await user.click(toggle)
  expect(toggle).toHaveAttribute('aria-checked', 'false')
  render(<Settings navigate={vi.fn()} />)
  await waitFor(async () => {
    const toggles = await screen.findAllByRole('switch', { name: /open my starred family automatically/i })
    expect(toggles[toggles.length - 1]).toHaveAttribute('aria-checked', 'false')
  })
})

test('description names the default family when one exists', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  render(<Settings navigate={vi.fn()} />)
  expect(await screen.findByText(/skip the list/i)).toBeInTheDocument()
  expect(screen.getByText('Smith Family')).toBeInTheDocument()
})

test('description falls back when there is no default family', async () => {
  render(<Settings navigate={vi.fn()} />)
  expect(await screen.findByText(/opens the moment the app does/i)).toBeInTheDocument()
  expect(screen.queryByText('Smith Family')).not.toBeInTheDocument()
})

test('footer shows the app version', () => {
  render(<Settings navigate={vi.fn()} />)
  expect(screen.getByText(/sprout track mobile v0\.1\.0/i)).toBeInTheDocument()
})
