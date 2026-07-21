import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import AccountSignUp, { PW_REQS } from './AccountSignUp'

function makeDeps(overrides = {}) {
  return {
    register: vi.fn().mockResolvedValue({ ok: true }),
    login: vi.fn().mockResolvedValue({ ok: true, token: 't', familySlug: '', verified: false }),
    fetchSetupStatus: vi.fn().mockResolvedValue(null),
    fetchFamilyBySlug: vi.fn().mockResolvedValue({ name: 'Sprout Test', slug: 'sprout-test', isActive: true }),
    saveServer: vi.fn().mockResolvedValue({ id: 'id1' }),
    vault: { store: vi.fn().mockResolvedValue(undefined) },
    ...overrides,
  }
}

function reqSpan(label: string) {
  return [...document.querySelectorAll('.reqs span')].find(el => el.textContent?.includes(label))
}

async function fillValidForm() {
  await userEvent.type(screen.getByLabelText('First name'), 'Betty')
  await userEvent.type(screen.getByLabelText('Last name'), 'Sprout')
  await userEvent.type(screen.getByLabelText('Email'), 'me@example.com')
  await userEvent.type(screen.getByLabelText('Password'), 'Hunter2!')
}

describe('AccountSignUp', () => {
  it('renders the create-account copy and fields', () => {
    render(<AccountSignUp navigate={vi.fn()} deps={makeDeps()} />)
    expect(screen.getByRole('heading', { name: 'Create your account.' })).toBeInTheDocument()
    expect(screen.getByText('14 days free, no card needed.')).toBeInTheDocument()
    expect(screen.getByLabelText('First name')).toHaveAttribute('id', 'suF')
    expect(screen.getByLabelText('Last name')).toHaveAttribute('id', 'suL')
    expect(screen.getByLabelText('Email')).toHaveAttribute('id', 'suE')
    expect(screen.getByLabelText('Password')).toHaveAttribute('id', 'suP')
    expect(screen.getByText('By signing up you agree to our Terms and Privacy Policy.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('flips checklist pills to "ok" as the password grows to satisfy each requirement', async () => {
    render(<AccountSignUp navigate={vi.fn()} deps={makeDeps()} />)
    const pw = screen.getByLabelText('Password')
    for (const [label] of PW_REQS) {
      expect(reqSpan(label)?.className).toBe('')
    }
    await userEvent.type(pw, 'h')
    expect(reqSpan('A lowercase letter')?.className).toBe('ok')
    expect(reqSpan('8+ characters')?.className).toBe('')
    await userEvent.type(pw, 'unter2!A')
    for (const [label] of PW_REQS) {
      expect(reqSpan(label)?.className).toBe('ok')
    }
  })

  it('keeps submit disabled until names, a valid email, and all password reqs are satisfied', async () => {
    render(<AccountSignUp navigate={vi.fn()} deps={makeDeps()} />)
    const submit = screen.getByRole('button', { name: 'Start my free trial' })
    expect(submit).toBeDisabled()
    await userEvent.type(screen.getByLabelText('First name'), 'Betty')
    await userEvent.type(screen.getByLabelText('Last name'), 'Sprout')
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email')
    await userEvent.type(screen.getByLabelText('Password'), 'Hunter2!')
    expect(submit).toBeDisabled()
    await userEvent.clear(screen.getByLabelText('Email'))
    await userEvent.type(screen.getByLabelText('Email'), 'me@example.com')
    expect(submit).toBeEnabled()
  })

  it('signs up, logs in, and routes an unverified account with no family to acct-verify', async () => {
    const deps = makeDeps()
    const navigate = vi.fn()
    render(<AccountSignUp navigate={navigate} deps={deps} />)
    await fillValidForm()
    await userEvent.click(screen.getByRole('button', { name: 'Start my free trial' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({
      name: 'acct-verify',
      token: 't',
      creds: { type: 'account', email: 'me@example.com', password: 'Hunter2!' },
      biometric: true,
    }))
    expect(deps.register).toHaveBeenCalledWith('https://sprout-track.com', {
      email: 'me@example.com', password: 'Hunter2!', firstName: 'Betty', lastName: 'Sprout',
    })
    expect(deps.login).toHaveBeenCalledWith(
      { id: 'https://sprout-track.com|account', baseUrl: 'https://sprout-track.com', familySlug: '' },
      { type: 'account', email: 'me@example.com', password: 'Hunter2!' },
    )
  })

  it('routes a verified account with no family to the wizard with firstName prefilled', async () => {
    const deps = makeDeps({ login: vi.fn().mockResolvedValue({ ok: true, token: 't', familySlug: '', verified: true }) })
    const navigate = vi.fn()
    render(<AccountSignUp navigate={navigate} deps={deps} />)
    await fillValidForm()
    await userEvent.click(screen.getByRole('button', { name: 'Start my free trial' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({
      name: 'wizard',
      token: 't',
      creds: { type: 'account', email: 'me@example.com', password: 'Hunter2!' },
      biometric: true,
      resume: undefined,
      firstName: 'Betty',
    }))
  })

  it('shows the rate-limit message', async () => {
    const deps = makeDeps({ register: vi.fn().mockResolvedValue({ ok: false, error: 'rate-limited' }) })
    render(<AccountSignUp navigate={vi.fn()} deps={deps} />)
    await fillValidForm()
    await userEvent.click(screen.getByRole('button', { name: 'Start my free trial' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many tries - the server is taking a breather. Try again in a few minutes.',
    )
  })

  it('shows the unreachable message', async () => {
    const deps = makeDeps({ register: vi.fn().mockResolvedValue({ ok: false, error: 'unreachable' }) })
    render(<AccountSignUp navigate={vi.fn()} deps={deps} />)
    await fillValidForm()
    await userEvent.click(screen.getByRole('button', { name: 'Start my free trial' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Can’t reach that server. Check the address and your connection.',
    )
  })

  it('shows the server-provided message on a rejected registration', async () => {
    const deps = makeDeps({
      register: vi.fn().mockResolvedValue({ ok: false, error: 'rejected', message: 'That email is already registered.' }),
    })
    render(<AccountSignUp navigate={vi.fn()} deps={deps} />)
    await fillValidForm()
    await userEvent.click(screen.getByRole('button', { name: 'Start my free trial' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That email is already registered.')
  })

  it('falls back to a generic message on a rejected registration with no server message', async () => {
    const deps = makeDeps({ register: vi.fn().mockResolvedValue({ ok: false, error: 'rejected' }) })
    render(<AccountSignUp navigate={vi.fn()} deps={deps} />)
    await fillValidForm()
    await userEvent.click(screen.getByRole('button', { name: 'Start my free trial' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That didn’t work - check your details and try again.',
    )
  })

  it('shows an error when signup succeeds but the follow-up login fails', async () => {
    const deps = makeDeps({ login: vi.fn().mockResolvedValue({ ok: false, error: 'invalid' }) })
    render(<AccountSignUp navigate={vi.fn()} deps={deps} />)
    await fillValidForm()
    await userEvent.click(screen.getByRole('button', { name: 'Start my free trial' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Account created - but signing in failed. Try signing in.',
    )
  })

  it('navigates back to acct-signin from the header back button', async () => {
    const navigate = vi.fn()
    render(<AccountSignUp navigate={navigate} deps={makeDeps()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(navigate).toHaveBeenCalledWith({ name: 'acct-signin' })
  })

  it('navigates to acct-signin when the sign-in link is clicked', async () => {
    const navigate = vi.fn()
    render(<AccountSignUp navigate={navigate} deps={makeDeps()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(navigate).toHaveBeenCalledWith({ name: 'acct-signin' })
  })
})
