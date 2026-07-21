import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import AccountSignIn from './AccountSignIn'

function makeDeps(overrides = {}) {
  return {
    login: vi.fn().mockResolvedValue({ ok: true, token: 't', familySlug: 'sprout-test' }),
    fetchFamilyBySlug: vi.fn().mockResolvedValue({ name: 'Sprout Test', slug: 'sprout-test', isActive: true }),
    saveServer: vi.fn().mockResolvedValue({ id: 'id1' }),
    vault: { store: vi.fn().mockResolvedValue(undefined) },
    ...overrides,
  }
}

async function fillAndSubmit() {
  await userEvent.type(screen.getByLabelText('Email'), 'me@example.com')
  await userEvent.type(screen.getByLabelText('Password'), 'hunter22')
  await userEvent.click(screen.getByRole('button', { name: 'Sign me in' }))
}

describe('AccountSignIn', () => {
  it('logs in against sprout-track.com, saves the family, navigates with a toast', async () => {
    const deps = makeDeps()
    const navigate = vi.fn()
    render(<AccountSignIn navigate={navigate} deps={deps} />)
    await fillAndSubmit()
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({
      name: 'families', toast: 'Saved — Sprout Test is on this phone now.',
    }))
    expect(deps.login).toHaveBeenCalledWith(
      { id: 'https://sprout-track.com|account', baseUrl: 'https://sprout-track.com', familySlug: '' },
      { type: 'account', email: 'me@example.com', password: 'hunter22' },
    )
    expect(deps.saveServer).toHaveBeenCalledWith({
      baseUrl: 'https://sprout-track.com', familySlug: 'sprout-test',
      familyName: 'Sprout Test', deploymentMode: 'saas', authType: 'ACCOUNT',
    })
    expect(deps.vault.store).toHaveBeenCalledWith('id1',
      { type: 'account', email: 'me@example.com', password: 'hunter22' }, { biometric: true })
  })

  it('shows the mismatch error on bad credentials', async () => {
    const deps = makeDeps({ login: vi.fn().mockResolvedValue({ ok: false, error: 'invalid' }) })
    render(<AccountSignIn navigate={vi.fn()} deps={deps} />)
    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent(/didn’t match/)
  })

  it('shows the lockout error on 429', async () => {
    const deps = makeDeps({ login: vi.fn().mockResolvedValue({ ok: false, error: 'locked' }) })
    render(<AccountSignIn navigate={vi.fn()} deps={deps} />)
    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent(/taking a breather/)
  })

  it('disables submit until both fields are filled', () => {
    render(<AccountSignIn navigate={vi.fn()} deps={makeDeps()} />)
    expect(screen.getByRole('button', { name: 'Sign me in' })).toBeDisabled()
  })
})
