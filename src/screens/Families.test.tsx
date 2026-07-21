import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import Families from './Families'
import { saveServer } from '../services/server-registry'

beforeEach(() => localStorage.clear())

test('lists saved families and navigates to connecting on tap', async () => {
  const entry = await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  const navigate = vi.fn()
  const user = userEvent.setup()
  render(<Families navigate={navigate} />)
  await user.click(await screen.findByRole('button', { name: /smith family/i }))
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith({ name: 'connecting', entry: expect.objectContaining({ id: entry.id }) }))
})

test('removing a server clears its vault record along with the registry entry', async () => {
  const entry = await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  localStorage.setItem(`sprout-creds:${entry.id}`, JSON.stringify({ biometric: false, creds: { type: 'pin', loginId: null, securityPin: '1234' } }))
  const user = userEvent.setup()
  render(<Families navigate={vi.fn()} />)
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
  render(<Families navigate={vi.fn()} />)
  const removeButtons = await screen.findAllByRole('button', { name: /^remove /i })
  expect(removeButtons).toHaveLength(2)
  const names = removeButtons.map(b => b.getAttribute('aria-label'))
  expect(new Set(names).size).toBe(2)
  expect(names).toEqual(expect.arrayContaining([
    expect.stringContaining('smith-family'),
    expect.stringContaining('jones-family'),
  ]))
})

test('shows a locked notice when navigated with notice="locked"', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  render(<Families navigate={vi.fn()} notice="locked" />)
  expect(await screen.findByRole('alert')).toHaveTextContent(/too many attempts/i)
})

test('shows a toast when navigated with a toast message', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  render(<Families navigate={vi.fn()} toast="Family removed" />)
  expect(await screen.findByText('Family removed')).toBeInTheDocument()
})
