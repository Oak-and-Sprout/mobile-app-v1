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
  await user.click(screen.getByRole('button', { name: /yes, clear everything/i }))
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
  await user.click(screen.getByRole('button', { name: /yes, clear everything/i }))
  await waitFor(() => expect(localStorage.getItem(vaultKey)).toBeNull())
})

test('auto-open toggle persists', async () => {
  const user = userEvent.setup()
  render(<Settings navigate={vi.fn()} />)
  const toggle = await screen.findByRole('checkbox', { name: /open my family automatically/i })
  expect(toggle).toBeChecked()
  await user.click(toggle)
  render(<Settings navigate={vi.fn()} />)
  await waitFor(async () => {
    const toggles = await screen.findAllByRole('checkbox', { name: /open my family automatically/i })
    expect(toggles[toggles.length - 1]).not.toBeChecked()
  })
})
