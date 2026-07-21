import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import Settings from './Settings'
import { listServers, saveServer } from '../services/server-registry'

beforeEach(() => localStorage.clear())

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
