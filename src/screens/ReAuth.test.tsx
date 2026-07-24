import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import ReAuth from './ReAuth'
import type { ServerEntry } from '../services/server-registry'

function entry(over: Partial<ServerEntry> = {}): ServerEntry {
  return {
    id: 'e1', baseUrl: 'https://x.com', familySlug: 'smith', familyName: 'Smith Family',
    deploymentMode: 'selfhosted', authType: 'CARETAKER', lastUsedAt: null, isDefault: false,
    ...over,
  }
}

function deps(over: Record<string, unknown> = {}) {
  return {
    login: vi.fn().mockResolvedValue({ ok: true, token: 't', familySlug: 'smith' }),
    vault: {
      store: vi.fn().mockResolvedValue(undefined),
      isBiometric: vi.fn().mockResolvedValue(true),
      peekIdentifier: vi.fn().mockResolvedValue({ loginId: '07' }),
    },
    touch: vi.fn().mockResolvedValue(undefined),
    openUrl: vi.fn(),
    ...over,
  }
}

test('verifies the new credential, re-vaults it, and hands off directly to the web app', async () => {
  const d = deps()
  const user = userEvent.setup()
  render(<ReAuth navigate={vi.fn()} entry={entry()} deps={d} />)
  await waitFor(() => expect((screen.getByLabelText('Login ID') as HTMLInputElement).value).toBe('07'))
  await user.type(screen.getByLabelText('PIN'), '654321')
  await user.click(screen.getByRole('button', { name: 'Verify & save' }))
  await waitFor(() => expect(d.login).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'e1', baseUrl: 'https://x.com', familySlug: 'smith' }),
    { type: 'pin', loginId: '07', securityPin: '654321' },
  ))
  expect(d.vault.store).toHaveBeenCalledWith('e1', { type: 'pin', loginId: '07', securityPin: '654321' }, { biometric: true })
  // Hands off with the token it already has — never re-reads the vault (no biometric loop).
  await waitFor(() => expect(d.openUrl).toHaveBeenCalled())
  expect((d.openUrl.mock.calls[0][0] as string).startsWith('https://x.com/smith/log-entry#bridge-session=')).toBe(true)
})

test('shows an error and does not hand off when the new credential is still wrong', async () => {
  const d = deps({ login: vi.fn().mockResolvedValue({ ok: false, error: 'invalid' }) })
  const navigate = vi.fn()
  const user = userEvent.setup()
  render(<ReAuth navigate={navigate} entry={entry()} deps={d} />)
  await waitFor(() => expect((screen.getByLabelText('Login ID') as HTMLInputElement).value).toBe('07'))
  await user.type(screen.getByLabelText('PIN'), '000000')
  await user.click(screen.getByRole('button', { name: 'Verify & save' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/didn’t work/))
  expect(navigate).not.toHaveBeenCalled()
  expect(d.openUrl).not.toHaveBeenCalled()
  expect(d.vault.store).not.toHaveBeenCalled()
})

test('an account family prompts for email + password, prefilling the email', async () => {
  const d = deps({
    vault: { store: vi.fn(), isBiometric: vi.fn().mockResolvedValue(false), peekIdentifier: vi.fn().mockResolvedValue({ email: 'a@b.com' }) },
  })
  render(<ReAuth navigate={vi.fn()} entry={entry({ authType: 'ACCOUNT', deploymentMode: 'saas' })} deps={d} />)
  await waitFor(() => expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('a@b.com'))
  expect(screen.getByLabelText('Password')).toBeInTheDocument()
})

test('back returns to My Families', async () => {
  const navigate = vi.fn()
  const user = userEvent.setup()
  render(<ReAuth navigate={navigate} entry={entry()} deps={deps()} />)
  await user.click(screen.getByRole('button', { name: 'Back' }))
  expect(navigate).toHaveBeenCalledWith({ name: 'families' })
})
