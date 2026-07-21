import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import AddFamily from './AddFamily'
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
  render(<AddFamily navigate={navigate} deps={deps} />)

  await user.type(screen.getByLabelText(/server address/i), 'https://myhost.com/smith-family')
  await user.click(screen.getByRole('button', { name: /find family/i }))
  expect(await screen.findByText(/smith family/i)).toBeInTheDocument()

  await user.type(screen.getByLabelText(/pin/i), '123456')
  await user.click(screen.getByRole('button', { name: /verify & save/i }))

  await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'families' }))
  expect(deps.saveServer).toHaveBeenCalledWith(expect.objectContaining({ familySlug: 'smith-family' }))
})

test('shows an error when the server is not Sprout Track', async () => {
  const user = userEvent.setup()
  const deps = makeDeps({ probeDeployment: vi.fn().mockRejectedValue(new ProbeError('not-sprout-track')) })
  render(<AddFamily navigate={vi.fn()} deps={deps} />)
  await user.type(screen.getByLabelText(/server address/i), 'https://example.com/x')
  await user.click(screen.getByRole('button', { name: /find family/i }))
  expect(await screen.findByText(/doesn't look like a sprout track server/i)).toBeInTheDocument()
})

test('shows lockout message on 429', async () => {
  const user = userEvent.setup()
  const deps = makeDeps({ login: vi.fn().mockResolvedValue({ ok: false, error: 'locked' }) })
  render(<AddFamily navigate={vi.fn()} deps={deps} />)
  await user.type(screen.getByLabelText(/server address/i), 'https://myhost.com/smith-family')
  await user.click(screen.getByRole('button', { name: /find family/i }))
  await screen.findByText(/smith family/i)
  await user.type(screen.getByLabelText(/pin/i), '123456')
  await user.click(screen.getByRole('button', { name: /verify & save/i }))
  expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument()
})

test('warns about unencrypted http servers', async () => {
  const user = userEvent.setup()
  render(<AddFamily navigate={vi.fn()} deps={makeDeps()} />)
  await user.type(screen.getByLabelText(/server address/i), 'http://192.168.1.10:3000/smith-family')
  await user.click(screen.getByRole('button', { name: /find family/i }))
  expect(await screen.findByText(/not encrypted/i)).toBeInTheDocument()
})

test('shows an error and does not navigate when saving fails after a successful login', async () => {
  const user = userEvent.setup()
  const deps = makeDeps({ saveServer: vi.fn().mockRejectedValue(new Error('disk full')) })
  const navigate = vi.fn()
  render(<AddFamily navigate={navigate} deps={deps} />)
  await user.type(screen.getByLabelText(/server address/i), 'https://myhost.com/smith-family')
  await user.click(screen.getByRole('button', { name: /find family/i }))
  await screen.findByText(/smith family/i)
  await user.type(screen.getByLabelText(/pin/i), '123456')
  await user.click(screen.getByRole('button', { name: /verify & save/i }))

  expect(await screen.findByText(/saving the family failed/i)).toBeInTheDocument()
  expect(navigate).not.toHaveBeenCalled()
})

test('clears the located family/credentials section when a subsequent locate attempt fails', async () => {
  const user = userEvent.setup()
  const probeDeployment = vi
    .fn()
    .mockResolvedValueOnce({ deploymentMode: 'selfhosted', enableAccounts: false, allowAccountRegistration: false })
    .mockRejectedValueOnce(new ProbeError('unreachable'))
  const deps = makeDeps({ probeDeployment })
  render(<AddFamily navigate={vi.fn()} deps={deps} />)

  const input = screen.getByLabelText(/server address/i)
  await user.type(input, 'https://myhost.com/smith-family')
  await user.click(screen.getByRole('button', { name: /find family/i }))
  await screen.findByText(/smith family/i)
  await user.type(screen.getByLabelText(/pin/i), '123456')

  await user.clear(input)
  await user.type(input, 'https://otherhost.com/smith-family')
  await user.click(screen.getByRole('button', { name: /find family/i }))

  await waitFor(() => expect(screen.queryByText(/smith family/i)).not.toBeInTheDocument())
})

test('CARETAKER auth type shows the Login ID field and passes it through to login', async () => {
  const user = userEvent.setup()
  const deps = makeDeps({ fetchAuthType: vi.fn().mockResolvedValue('CARETAKER') })
  render(<AddFamily navigate={vi.fn()} deps={deps} />)
  await user.type(screen.getByLabelText(/server address/i), 'https://myhost.com/smith-family')
  await user.click(screen.getByRole('button', { name: /find family/i }))
  await screen.findByText(/smith family/i)

  expect(screen.getByLabelText(/login id/i)).toBeInTheDocument()
  await user.type(screen.getByLabelText(/login id/i), '01')
  await user.type(screen.getByLabelText(/pin/i), '123456')
  await user.click(screen.getByRole('button', { name: /verify & save/i }))

  await waitFor(() =>
    expect(deps.login).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'pin', loginId: '01', securityPin: '123456' }),
    ),
  )
})

test('account login: checking "sign in with account" swaps in email/password and saves with ACCOUNT auth type', async () => {
  const user = userEvent.setup()
  const deps = makeDeps({
    probeDeployment: vi.fn().mockResolvedValue({ deploymentMode: 'saas', enableAccounts: true, allowAccountRegistration: false }),
  })
  render(<AddFamily navigate={vi.fn()} deps={deps} />)
  await user.type(screen.getByLabelText(/server address/i), 'https://myhost.com/smith-family')
  await user.click(screen.getByRole('button', { name: /find family/i }))
  await screen.findByText(/smith family/i)

  await user.click(screen.getByLabelText(/sign in with my sprout track account/i))
  await user.type(screen.getByLabelText(/email/i), 'a@b.com')
  await user.type(screen.getByLabelText(/password/i), 'hunter2')
  await user.click(screen.getByRole('button', { name: /verify & save/i }))

  await waitFor(() =>
    expect(deps.login).toHaveBeenCalledWith(
      expect.anything(),
      { type: 'account', email: 'a@b.com', password: 'hunter2' },
    ),
  )
  expect(deps.saveServer).toHaveBeenCalledWith(expect.objectContaining({ authType: 'ACCOUNT' }))
})

test('unchecking "Remember with Face ID / fingerprint" stores credentials without biometric', async () => {
  const user = userEvent.setup()
  const deps = makeDeps()
  const storeSpy = vi.spyOn(deps.vault, 'store')
  render(<AddFamily navigate={vi.fn()} deps={deps} />)
  await user.type(screen.getByLabelText(/server address/i), 'https://myhost.com/smith-family')
  await user.click(screen.getByRole('button', { name: /find family/i }))
  await screen.findByText(/smith family/i)
  await user.type(screen.getByLabelText(/pin/i), '123456')
  await user.click(screen.getByLabelText(/remember with face id/i))
  await user.click(screen.getByRole('button', { name: /verify & save/i }))

  await waitFor(() =>
    expect(storeSpy).toHaveBeenCalledWith(expect.any(String), expect.anything(), { biometric: false }),
  )
})
