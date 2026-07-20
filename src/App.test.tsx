import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { saveServer } from './services/server-registry'
import * as connectService from './services/connect'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

test('renders the app root', () => {
  render(<App />)
  expect(screen.getByTestId('app-root')).toBeInTheDocument()
})

test('shows Welcome when no servers are saved', () => {
  render(<App />)
  expect(screen.getByText(/welcome to sprout track/i)).toBeInTheDocument()
})

test('does not clobber in-progress navigation when servers exist at launch', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  render(<App />)
  // Click synchronously, before the launch-routing effect's listServers() promise has settled.
  fireEvent.click(screen.getByText(/connect to my own server/i))
  expect(screen.getByText(/connect to a family/i)).toBeInTheDocument()
  // Force the launch-routing effect's listServers() promise to settle and its callback to run
  // (rather than racing it with waitFor, which can pass on its first, pre-settlement check).
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  expect(screen.getByText(/connect to a family/i)).toBeInTheDocument()
})

test('offline retry that resolves locked returns to server-list', async () => {
  await saveServer({
    baseUrl: 'https://x.com', familySlug: 'smith-family', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'SYSTEM',
  })
  const connectSpy = vi.spyOn(connectService, 'connectToFamily')
    .mockResolvedValueOnce('offline')
    .mockResolvedValueOnce('locked')
  const user = userEvent.setup()
  render(<App />)
  await screen.findByText(/can't reach the server/i)
  await user.click(screen.getByRole('button', { name: /retry/i }))
  await waitFor(() => expect(screen.getByText(/my families/i)).toBeInTheDocument())
  expect(connectSpy).toHaveBeenCalledTimes(2)
})
