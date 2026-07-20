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
