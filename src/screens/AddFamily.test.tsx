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
    listServers: vi.fn().mockResolvedValue([{ id: 'srv0' }]),
    login: vi.fn().mockResolvedValue({ ok: true, token: 'jwt', familySlug: 'smith-family' }),
    vault: new CredentialVault(backend),
    ...overrides,
  }
}

test('shows the located family card with host and deployment chip', async () => {
  const user = userEvent.setup()
  const deps = makeDeps()
  render(<AddFamily navigate={vi.fn()} deps={deps} />)

  await user.type(screen.getByLabelText(/server address/i), 'track.example.com/smith-family')
  await user.click(screen.getByRole('button', { name: /find my family/i }))

  expect(await screen.findByText('Smith Family')).toBeInTheDocument()
  expect(screen.getByText('track.example.com')).toBeInTheDocument()
  expect(screen.getByText('Self-hosted')).toBeInTheDocument()
})

test('navigates to families with a toast after verify & save', async () => {
  const user = userEvent.setup()
  const deps = makeDeps()
  const navigate = vi.fn()
  render(<AddFamily navigate={navigate} deps={deps} />)

  await user.type(screen.getByLabelText(/server address/i), 'https://myhost.com/smith-family')
  await user.click(screen.getByRole('button', { name: /find my family/i }))
  expect(await screen.findByText('Smith Family')).toBeInTheDocument()

  await user.type(screen.getByLabelText(/family pin/i), '123456')
  await user.click(screen.getByRole('button', { name: /verify & save/i }))

  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith({ name: 'families', toast: 'Saved — Smith Family is on this phone now.' }),
  )
  expect(deps.saveServer).toHaveBeenCalledWith(expect.objectContaining({ familySlug: 'smith-family' }))
})

test('shows an error when the server is not Sprout Track', async () => {
  const user = userEvent.setup()
  const deps = makeDeps({ probeDeployment: vi.fn().mockRejectedValue(new ProbeError('not-sprout-track')) })
  render(<AddFamily navigate={vi.fn()} deps={deps} />)
  await user.type(screen.getByLabelText(/server address/i), 'https://example.com/x')
  await user.click(screen.getByRole('button', { name: /find my family/i }))
  expect(await screen.findByText(/isn’t a Sprout Track server/)).toBeInTheDocument()
})

test('shows an error when the family is not found on the server', async () => {
  const user = userEvent.setup()
  const deps = makeDeps({ fetchFamilyBySlug: vi.fn().mockRejectedValue(new ProbeError('family-not-found')) })
  render(<AddFamily navigate={vi.fn()} deps={deps} />)
  await user.type(screen.getByLabelText(/server address/i), 'https://myhost.com/smith-family')
  await user.click(screen.getByRole('button', { name: /find my family/i }))
  expect(await screen.findByText(/No family by that name on this server/)).toBeInTheDocument()
})

test('shows lockout message on 429', async () => {
  const user = userEvent.setup()
  const deps = makeDeps({ login: vi.fn().mockResolvedValue({ ok: false, error: 'locked' }) })
  render(<AddFamily navigate={vi.fn()} deps={deps} />)
  await user.type(screen.getByLabelText(/server address/i), 'https://myhost.com/smith-family')
  await user.click(screen.getByRole('button', { name: /find my family/i }))
  await screen.findByText('Smith Family')
  await user.type(screen.getByLabelText(/family pin/i), '123456')
  await user.click(screen.getByRole('button', { name: /verify & save/i }))
  expect(await screen.findByText(/taking a breather/)).toBeInTheDocument()
})

test('shows an invalid-PIN message on failed login', async () => {
  const user = userEvent.setup()
  const deps = makeDeps({ login: vi.fn().mockResolvedValue({ ok: false, error: 'invalid' }) })
  render(<AddFamily navigate={vi.fn()} deps={deps} />)
  await user.type(screen.getByLabelText(/server address/i), 'https://myhost.com/smith-family')
  await user.click(screen.getByRole('button', { name: /find my family/i }))
  await screen.findByText('Smith Family')
  await user.type(screen.getByLabelText(/family pin/i), '123456')
  await user.click(screen.getByRole('button', { name: /verify & save/i }))
  expect(await screen.findByText(/That PIN didn’t work/)).toBeInTheDocument()
})

test('warns about cleartext http addresses', async () => {
  const user = userEvent.setup()
  render(<AddFamily navigate={vi.fn()} deps={makeDeps()} />)
  await user.type(screen.getByLabelText(/server address/i), 'http://10.0.2.2:3000/smith-family')
  await user.click(screen.getByRole('button', { name: /find my family/i }))
  expect(await screen.findByText(/isn’t encrypted/)).toBeInTheDocument()
})

test('shows an error and does not navigate when saving fails after a successful login', async () => {
  const user = userEvent.setup()
  const deps = makeDeps({ saveServer: vi.fn().mockRejectedValue(new Error('disk full')) })
  const navigate = vi.fn()
  render(<AddFamily navigate={navigate} deps={deps} />)
  await user.type(screen.getByLabelText(/server address/i), 'https://myhost.com/smith-family')
  await user.click(screen.getByRole('button', { name: /find my family/i }))
  await screen.findByText('Smith Family')
  await user.type(screen.getByLabelText(/family pin/i), '123456')
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
  await user.click(screen.getByRole('button', { name: /find my family/i }))
  await screen.findByText('Smith Family')
  await user.type(screen.getByLabelText(/family pin/i), '123456')

  await user.clear(input)
  await user.type(input, 'https://otherhost.com/smith-family')
  await user.click(screen.getByRole('button', { name: /find my family/i }))

  await waitFor(() => expect(screen.queryByText('Smith Family')).not.toBeInTheDocument())
  expect(await screen.findByText(/Can’t reach that server/)).toBeInTheDocument()
})

test('CARETAKER auth type shows the Login ID field and passes it through to login', async () => {
  const user = userEvent.setup()
  const deps = makeDeps({ fetchAuthType: vi.fn().mockResolvedValue('CARETAKER') })
  render(<AddFamily navigate={vi.fn()} deps={deps} />)
  await user.type(screen.getByLabelText(/server address/i), 'https://myhost.com/smith-family')
  await user.click(screen.getByRole('button', { name: /find my family/i }))
  await screen.findByText('Smith Family')

  expect(screen.getByLabelText(/login id/i)).toBeInTheDocument()
  await user.type(screen.getByLabelText(/login id/i), '01')
  await user.type(screen.getByLabelText(/^pin$/i), '123456')
  await user.click(screen.getByRole('button', { name: /verify & save/i }))

  await waitFor(() =>
    expect(deps.login).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'pin', loginId: '01', securityPin: '123456' }),
    ),
  )
})

test('account toggle appears when the server allows accounts and swaps in email/password', async () => {
  const user = userEvent.setup()
  const deps = makeDeps({
    probeDeployment: vi.fn().mockResolvedValue({ deploymentMode: 'saas', enableAccounts: true, allowAccountRegistration: false }),
  })
  render(<AddFamily navigate={vi.fn()} deps={deps} />)
  await user.type(screen.getByLabelText(/server address/i), 'https://myhost.com/smith-family')
  await user.click(screen.getByRole('button', { name: /find my family/i }))
  await screen.findByText('Smith Family')

  expect(screen.getByLabelText(/sign in with my sprout track account/i)).toBeInTheDocument()
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

test('unchecking "Unlock with Face ID next time" stores credentials without biometric', async () => {
  const user = userEvent.setup()
  const deps = makeDeps()
  const storeSpy = vi.spyOn(deps.vault, 'store')
  render(<AddFamily navigate={vi.fn()} deps={deps} />)
  await user.type(screen.getByLabelText(/server address/i), 'https://myhost.com/smith-family')
  await user.click(screen.getByRole('button', { name: /find my family/i }))
  await screen.findByText('Smith Family')
  await user.type(screen.getByLabelText(/family pin/i), '123456')
  await user.click(screen.getByLabelText(/unlock with face id next time/i))
  await user.click(screen.getByRole('button', { name: /verify & save/i }))

  await waitFor(() =>
    expect(storeSpy).toHaveBeenCalledWith(expect.any(String), expect.anything(), { biometric: false }),
  )
})

test('Back button navigates to the families list', async () => {
  const navigate = vi.fn()
  render(<AddFamily navigate={navigate} deps={makeDeps()} />)
  await userEvent.setup().click(screen.getByRole('button', { name: /back/i }))
  expect(navigate).toHaveBeenCalledWith({ name: 'families' })
})

test('Back button navigates to welcome when there are no saved families', async () => {
  const navigate = vi.fn()
  const deps = makeDeps({ listServers: vi.fn().mockResolvedValue([]) })
  render(<AddFamily navigate={navigate} deps={deps} />)
  await waitFor(() => expect(deps.listServers).toHaveBeenCalled())
  await userEvent.setup().click(screen.getByRole('button', { name: /back/i }))
  expect(navigate).toHaveBeenCalledWith({ name: 'welcome' })
})
