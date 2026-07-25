import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AccountResetConfirm from './AccountResetConfirm'

const ok = () => ({ valid: true, email: 'a@b.test' })

function setup(over = {}) {
  const navigate = vi.fn()
  const deps = {
    validateResetToken: vi.fn().mockResolvedValue(ok()),
    submitPasswordReset: vi.fn().mockResolvedValue({ ok: true }),
    ...over,
  }
  render(<AccountResetConfirm navigate={navigate} token="tok" deps={deps} />)
  return { navigate, deps }
}

describe('AccountResetConfirm', () => {
  it('shows the account email once the token validates', async () => {
    setup()
    expect(await screen.findByText(/a@b\.test/)).toBeInTheDocument()
  })

  it('explains an expired token and offers a fresh link', async () => {
    const { navigate } = setup({ validateResetToken: vi.fn().mockResolvedValue({ valid: false }) })
    await userEvent.click(await screen.findByRole('button', { name: /new link/i }))
    expect(navigate).toHaveBeenCalledWith({ name: 'acct-reset' })
  })

  it('treats an unreachable server as an invalid token rather than a blank screen', async () => {
    setup({ validateResetToken: vi.fn().mockResolvedValue(null) })
    expect(await screen.findByRole('button', { name: /new link/i })).toBeInTheDocument()
  })

  it('keeps submit disabled until every rule passes', async () => {
    setup()
    const field = await screen.findByLabelText(/new password/i)
    await userEvent.type(field, 'weak')
    expect(screen.getByRole('button', { name: /save new password/i })).toBeDisabled()
    await userEvent.clear(field)
    await userEvent.type(field, 'Abcdef1!')
    expect(screen.getByRole('button', { name: /save new password/i })).toBeEnabled()
  })

  it('navigates to sign in with a notice on success', async () => {
    const { navigate } = setup()
    await userEvent.type(await screen.findByLabelText(/new password/i), 'Abcdef1!')
    await userEvent.click(screen.getByRole('button', { name: /save new password/i }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'acct-signin', notice: expect.stringMatching(/new password/i) }),
    ))
  })

  it('falls back to the invalid state when the token expires mid-flow', async () => {
    setup({ submitPasswordReset: vi.fn().mockResolvedValue({ ok: false, error: 'invalid', message: 'expired' }) })
    await userEvent.type(await screen.findByLabelText(/new password/i), 'Abcdef1!')
    await userEvent.click(screen.getByRole('button', { name: /save new password/i }))
    expect(await screen.findByRole('button', { name: /new link/i })).toBeInTheDocument()
  })

  it('surfaces the lockout message on 429 and keeps the password typed', async () => {
    setup({ submitPasswordReset: vi.fn().mockResolvedValue({ ok: false, error: 'rate-limited', message: 'Too many attempts.' }) })
    const field = await screen.findByLabelText(/new password/i)
    await userEvent.type(field, 'Abcdef1!')
    await userEvent.click(screen.getByRole('button', { name: /save new password/i }))
    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument()
    expect(field).toHaveValue('Abcdef1!')
  })

  it('keeps the password typed after a network failure', async () => {
    setup({ submitPasswordReset: vi.fn().mockResolvedValue({ ok: false, error: 'unreachable' }) })
    const field = await screen.findByLabelText(/new password/i)
    await userEvent.type(field, 'Abcdef1!')
    await userEvent.click(screen.getByRole('button', { name: /save new password/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(field).toHaveValue('Abcdef1!')
  })
})
