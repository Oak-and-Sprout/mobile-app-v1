import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import AccountSignIn from './AccountSignIn'

function makeDeps(overrides = {}) {
  return {
    login: vi.fn().mockResolvedValue({ ok: true, token: 't', familySlug: 'sprout-test', verified: true }),
    fetchSetupStatus: vi.fn().mockResolvedValue({
      setupStage: 3, currentStage: 3, familyId: 'f1', familyName: 'Sprout Test', familySlug: 'sprout-test',
    }),
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
  it('renders the new copy and the signup/reset links', () => {
    render(<AccountSignIn navigate={vi.fn()} deps={makeDeps()} />)
    expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument()
    expect(screen.getByText('Sign in to your family’s page with your sprout-track.com account.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('id', 'aiEm')
    expect(screen.getByLabelText('Password')).toHaveAttribute('id', 'aiPw')
    expect(screen.getByRole('button', { name: 'Start your free trial' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset it' })).toBeInTheDocument()
  })

  it('navigates to acct-signup when the signup link is clicked', async () => {
    const navigate = vi.fn()
    render(<AccountSignIn navigate={navigate} deps={makeDeps()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Start your free trial' }))
    expect(navigate).toHaveBeenCalledWith({ name: 'acct-signup' })
  })

  it('navigates to acct-reset when the reset link is clicked', async () => {
    const navigate = vi.fn()
    render(<AccountSignIn navigate={navigate} deps={makeDeps()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Reset it' }))
    expect(navigate).toHaveBeenCalledWith({ name: 'acct-reset' })
  })

  it('logs in, routes through routeAfterAccountLogin, and navigates to families with a toast', async () => {
    const deps = makeDeps()
    const navigate = vi.fn()
    render(<AccountSignIn navigate={navigate} deps={deps} />)
    await fillAndSubmit()
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({
      name: 'families', toast: 'Saved - Sprout Test is on this phone now.',
    }))
    expect(deps.login).toHaveBeenCalledWith(
      { id: 'https://sprout-track.com|account', baseUrl: 'https://sprout-track.com', familySlug: '' },
      { type: 'account', email: 'me@example.com', password: 'hunter22' },
    )
    expect(deps.fetchSetupStatus).toHaveBeenCalledWith('https://sprout-track.com', 't')
    expect(deps.saveServer).toHaveBeenCalledWith({
      baseUrl: 'https://sprout-track.com', familySlug: 'sprout-test',
      familyName: 'Sprout Test', deploymentMode: 'saas', authType: 'ACCOUNT',
    })
    expect(deps.vault.store).toHaveBeenCalledWith('id1',
      { type: 'account', email: 'me@example.com', password: 'hunter22' }, { biometric: true })
  })

  it('routes an account with no family to the wizard, treating a missing verified flag as verified', async () => {
    const deps = makeDeps({ login: vi.fn().mockResolvedValue({ ok: true, token: 't', familySlug: '' }) })
    const navigate = vi.fn()
    render(<AccountSignIn navigate={navigate} deps={deps} />)
    await fillAndSubmit()
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({
      name: 'wizard',
      token: 't',
      creds: { type: 'account', email: 'me@example.com', password: 'hunter22' },
      biometric: true,
      resume: undefined,
      firstName: undefined,
    }))
    expect(deps.fetchSetupStatus).not.toHaveBeenCalled()
    expect(deps.saveServer).not.toHaveBeenCalled()
  })

  it('routes an unverified account with no family to acct-verify', async () => {
    const deps = makeDeps({ login: vi.fn().mockResolvedValue({ ok: true, token: 't', familySlug: '', verified: false }) })
    const navigate = vi.fn()
    render(<AccountSignIn navigate={navigate} deps={deps} />)
    await fillAndSubmit()
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({
      name: 'acct-verify',
      token: 't',
      creds: { type: 'account', email: 'me@example.com', password: 'hunter22' },
      biometric: true,
    }))
  })

  it('shows the mismatch error on bad credentials', async () => {
    const deps = makeDeps({ login: vi.fn().mockResolvedValue({ ok: false, error: 'invalid' }) })
    render(<AccountSignIn navigate={vi.fn()} deps={deps} />)
    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That email and password didn’t match. Give it another look and try again.',
    )
  })

  it('shows the lockout error on 429', async () => {
    const deps = makeDeps({ login: vi.fn().mockResolvedValue({ ok: false, error: 'locked' }) })
    render(<AccountSignIn navigate={vi.fn()} deps={deps} />)
    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many tries - the server is taking a breather. Try again in a few minutes.',
    )
  })

  it('shows a routing error when setup status cannot be fetched, without navigating', async () => {
    const deps = makeDeps({ fetchSetupStatus: vi.fn().mockResolvedValue(null) })
    const navigate = vi.fn()
    render(<AccountSignIn navigate={navigate} deps={deps} />)
    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t check your family’s setup/)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('renders a Toast when a notice is supplied', () => {
    render(<AccountSignIn navigate={vi.fn()} notice="Signed out" deps={makeDeps()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Signed out')
  })

  it('disables submit until both fields are filled', () => {
    render(<AccountSignIn navigate={vi.fn()} deps={makeDeps()} />)
    expect(screen.getByRole('button', { name: 'Sign me in' })).toBeDisabled()
  })
})
