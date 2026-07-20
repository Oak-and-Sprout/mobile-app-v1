import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import ServerList from './ServerList'
import { saveServer } from '../services/server-registry'

beforeEach(() => localStorage.clear())

test('lists saved families and connects on tap', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  const connect = vi.fn().mockResolvedValue('navigated')
  const user = userEvent.setup()
  render(<ServerList navigate={vi.fn()} connect={connect} />)
  await user.click(await screen.findByRole('button', { name: /smith family/i }))
  await waitFor(() => expect(connect).toHaveBeenCalledWith(expect.objectContaining({ familySlug: 'smith-family' })))
})

test('offline outcome navigates to the offline screen', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  const navigate = vi.fn()
  const user = userEvent.setup()
  render(<ServerList navigate={navigate} connect={vi.fn().mockResolvedValue('offline')} />)
  await user.click(await screen.findByRole('button', { name: /smith family/i }))
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ name: 'offline' })))
})

test('retry closure from an offline navigation returns to server-list on locked', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  const navigate = vi.fn()
  const connect = vi.fn()
    .mockResolvedValueOnce('offline')
    .mockResolvedValueOnce('locked')
  const user = userEvent.setup()
  render(<ServerList navigate={navigate} connect={connect} />)
  await user.click(await screen.findByRole('button', { name: /smith family/i }))
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ name: 'offline' })))

  const offlineCall = navigate.mock.calls.find(([s]) => s.name === 'offline')
  const retry = offlineCall![0].retry as () => void
  retry()

  await waitFor(() =>
    expect(navigate).toHaveBeenLastCalledWith({ name: 'server-list' }))
})

test('removing a server clears its vault record along with the registry entry', async () => {
  const entry = await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  localStorage.setItem(`sprout-creds:${entry.id}`, JSON.stringify({ biometric: false, creds: { type: 'pin', loginId: null, securityPin: '1234' } }))
  const user = userEvent.setup()
  render(<ServerList navigate={vi.fn()} connect={vi.fn()} />)
  await user.click(await screen.findByRole('button', { name: /^remove /i }))
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: /smith family/i })).not.toBeInTheDocument())
  expect(localStorage.getItem(`sprout-creds:${entry.id}`)).toBeNull()
})

test('two families on the same server have distinct remove-button names', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'jones-family', familyName: 'Jones Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  render(<ServerList navigate={vi.fn()} connect={vi.fn()} />)
  const removeButtons = await screen.findAllByRole('button', { name: /^remove /i })
  expect(removeButtons).toHaveLength(2)
  const names = removeButtons.map(b => b.getAttribute('aria-label'))
  expect(new Set(names).size).toBe(2)
  expect(names).toEqual(expect.arrayContaining([
    expect.stringContaining('smith-family'),
    expect.stringContaining('jones-family'),
  ]))
})
