import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import Families from './Families'
import { formatLastOpened } from '../lib/relative-time'
import { createVault, type CredentialVault } from '../services/credential-vault'
import { listServers, removeServer, setDefaultServer, type ServerEntry } from '../services/server-registry'

vi.mock('../services/server-registry', () => ({
  listServers: vi.fn(),
  removeServer: vi.fn(),
  setDefaultServer: vi.fn(),
}))

vi.mock('../services/credential-vault', () => ({
  createVault: vi.fn(),
}))

function entry(overrides: Partial<ServerEntry> = {}): ServerEntry {
  return {
    id: 'e1', baseUrl: 'https://track.example.com', familySlug: 'smith-family',
    familyName: 'Smith Family', deploymentMode: 'selfhosted', authType: 'SYSTEM',
    lastUsedAt: null, isDefault: false,
    ...overrides,
  }
}

function famCard(name: string): HTMLElement {
  const card = screen.getAllByRole('button').find(b => b.className === 'fam-card' && b.textContent?.includes(name))
  if (!card) throw new Error(`no fam-card button found for "${name}"`)
  return card
}

function fakeVault(biometric: Record<string, boolean> = {}): CredentialVault {
  return {
    isBiometric: vi.fn((id: string) => Promise.resolve(biometric[id] ?? false)),
    clear: vi.fn().mockResolvedValue(undefined),
    store: vi.fn(),
    retrieve: vi.fn(),
    has: vi.fn(),
  } as unknown as CredentialVault
}

beforeEach(() => {
  vi.mocked(listServers).mockReset().mockResolvedValue([])
  vi.mocked(removeServer).mockReset().mockResolvedValue(undefined)
  vi.mocked(setDefaultServer).mockReset().mockResolvedValue(undefined)
  vi.mocked(createVault).mockReset().mockReturnValue(fakeVault())
})

test('shows the empty state when there are no saved families', async () => {
  render(<Families navigate={vi.fn()} />)
  expect(await screen.findByText('No families on this phone yet.')).toBeInTheDocument()
})

test('shows an "Opens first" chip on the default entry only', async () => {
  vi.mocked(listServers).mockResolvedValue([
    entry({ id: 'e1', familyName: 'Smith Family', isDefault: true }),
    entry({ id: 'e2', familySlug: 'jones-family', familyName: 'Jones Family', isDefault: false }),
  ])
  render(<Families navigate={vi.fn()} />)
  await screen.findByText('Smith Family')
  expect(screen.getByText('Opens first')).toBeInTheDocument()
  const jonesCard = famCard('Jones Family')
  expect(jonesCard).not.toHaveTextContent('Opens first')
})

test('shows "not opened yet" for a never-used family and a formatted last-opened line otherwise', async () => {
  const lastUsedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  vi.mocked(listServers).mockResolvedValue([
    entry({ id: 'e1', familyName: 'Smith Family', lastUsedAt: null }),
    entry({ id: 'e2', familySlug: 'jones-family', familyName: 'Jones Family', lastUsedAt }),
  ])
  render(<Families navigate={vi.fn()} />)
  await screen.findByText('Smith Family')
  expect(screen.getByText(/not opened yet/)).toBeInTheDocument()
  expect(screen.getByText(new RegExp(`opened ${formatLastOpened(lastUsedAt)}`))).toBeInTheDocument()
})

test('tapping a family card navigates to connecting', async () => {
  vi.mocked(listServers).mockResolvedValue([entry({ id: 'e1', familyName: 'Smith Family' })])
  const navigate = vi.fn()
  const user = userEvent.setup()
  render(<Families navigate={navigate} />)
  await screen.findByText('Smith Family')
  await user.click(famCard('Smith Family'))
  expect(navigate).toHaveBeenCalledWith({ name: 'connecting', entry: expect.objectContaining({ id: 'e1' }) })
})

test('the dashed "Add a family" button navigates to fork', async () => {
  const navigate = vi.fn()
  const user = userEvent.setup()
  render(<Families navigate={navigate} />)
  await user.click(await screen.findByRole('button', { name: /add a family/i }))
  expect(navigate).toHaveBeenCalledWith({ name: 'fork' })
})

test('star button is labeled by family name and sets the entry as default', async () => {
  vi.mocked(listServers).mockResolvedValue([entry({ id: 'e1', familyName: 'Smith Family', isDefault: false })])
  const user = userEvent.setup()
  render(<Families navigate={vi.fn()} />)
  const star = await screen.findByRole('button', { name: 'Make Smith Family the default' })
  await user.click(star)
  await waitFor(() => expect(setDefaultServer).toHaveBeenCalledWith('e1'))
})

test('remove button is labeled by family name and removes the entry from registry and vault', async () => {
  const vault = fakeVault()
  vi.mocked(createVault).mockReturnValue(vault)
  vi.mocked(listServers).mockResolvedValue([entry({ id: 'e1', familyName: 'Smith Family' })])
  const user = userEvent.setup()
  render(<Families navigate={vi.fn()} />)
  const remove = await screen.findByRole('button', { name: 'Remove Smith Family' })
  await user.click(remove)
  await waitFor(() => expect(removeServer).toHaveBeenCalledWith('e1'))
  expect(vault.clear).toHaveBeenCalledWith('e1')
})

test('two families have distinct, name-based star/remove aria-labels', async () => {
  vi.mocked(listServers).mockResolvedValue([
    entry({ id: 'e1', familyName: 'Smith Family' }),
    entry({ id: 'e2', familySlug: 'jones-family', familyName: 'Jones Family' }),
  ])
  render(<Families navigate={vi.fn()} />)
  await screen.findByText('Smith Family')
  expect(screen.getByRole('button', { name: 'Remove Smith Family' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Remove Jones Family' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Make Smith Family the default' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Make Jones Family the default' })).toBeInTheDocument()
})

test('renders the toast passed in via props', async () => {
  render(<Families navigate={vi.fn()} toast="Saved — Smith Family is on this phone now." />)
  expect(await screen.findByText('Saved — Smith Family is on this phone now.')).toBeInTheDocument()
})

test('shows the lockout copy in an alert when notice is "locked"', async () => {
  render(<Families navigate={vi.fn()} notice="locked" />)
  expect(await screen.findByRole('alert')).toHaveTextContent(/taking a breather/i)
})
