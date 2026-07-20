import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import AddServer from './AddServer'
import { CredentialVault, type VaultBackend } from '../services/credential-vault'
import { ProbeError } from '../services/server-probe'

function makeDeps(overrides: Record<string, unknown> = {}) {
  const backend: VaultBackend = {
    get: async () => null, set: vi.fn(async () => {}), delete: async () => {}, verifyIdentity: async () => true,
  }
  return {
    probeDeployment: vi.fn().mockResolvedValue({
      deploymentMode: 'selfhosted', enableAccounts: false, allowAccountRegistration: false,
    }),
    fetchFamilyBySlug: vi.fn().mockResolvedValue({ name: 'Smith Family', slug: 'smith-family', isActive: true }),
    fetchAuthType: vi.fn().mockResolvedValue('SYSTEM'),
    saveServer: vi.fn().mockResolvedValue({ id: 'srv1', isDefault: true }),
    login: vi.fn().mockResolvedValue({ ok: true, token: 'jwt', familySlug: 'smith-family' }),
    vault: new CredentialVault(backend),
    ...overrides,
  }
}

test('happy path: locate family, enter PIN, save, navigate to server list', async () => {
  const user = userEvent.setup()
  const deps = makeDeps()
  const navigate = vi.fn()
  render(<AddServer navigate={navigate} deps={deps} />)

  await user.type(screen.getByLabelText(/server address/i), 'https://myhost.com/smith-family')
  await user.click(screen.getByRole('button', { name: /find family/i }))
  expect(await screen.findByText(/smith family/i)).toBeInTheDocument()

  await user.type(screen.getByLabelText(/pin/i), '123456')
  await user.click(screen.getByRole('button', { name: /verify & save/i }))

  await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'server-list' }))
  expect(deps.saveServer).toHaveBeenCalledWith(expect.objectContaining({ familySlug: 'smith-family' }))
})

test('shows an error when the server is not Sprout Track', async () => {
  const user = userEvent.setup()
  const deps = makeDeps({ probeDeployment: vi.fn().mockRejectedValue(new ProbeError('not-sprout-track')) })
  render(<AddServer navigate={vi.fn()} deps={deps} />)
  await user.type(screen.getByLabelText(/server address/i), 'https://example.com/x')
  await user.click(screen.getByRole('button', { name: /find family/i }))
  expect(await screen.findByText(/doesn't look like a sprout track server/i)).toBeInTheDocument()
})

test('shows lockout message on 429', async () => {
  const user = userEvent.setup()
  const deps = makeDeps({ login: vi.fn().mockResolvedValue({ ok: false, error: 'locked' }) })
  render(<AddServer navigate={vi.fn()} deps={deps} />)
  await user.type(screen.getByLabelText(/server address/i), 'https://myhost.com/smith-family')
  await user.click(screen.getByRole('button', { name: /find family/i }))
  await screen.findByText(/smith family/i)
  await user.type(screen.getByLabelText(/pin/i), '123456')
  await user.click(screen.getByRole('button', { name: /verify & save/i }))
  expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument()
})

test('warns about unencrypted http servers', async () => {
  const user = userEvent.setup()
  render(<AddServer navigate={vi.fn()} deps={makeDeps()} />)
  await user.type(screen.getByLabelText(/server address/i), 'http://192.168.1.10:3000/smith-family')
  await user.click(screen.getByRole('button', { name: /find family/i }))
  expect(await screen.findByText(/not encrypted/i)).toBeInTheDocument()
})
