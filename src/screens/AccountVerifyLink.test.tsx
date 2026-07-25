import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AccountVerifyLink from './AccountVerifyLink'

function setup(over = {}) {
  const navigate = vi.fn()
  const deps = {
    verifyEmailToken: vi.fn().mockResolvedValue({ ok: true }),
    ...over,
  }
  render(<AccountVerifyLink navigate={navigate} token="tok" deps={deps} />)
  return { navigate, deps }
}

describe('AccountVerifyLink', () => {
  it('shows a verifying state while the request is in flight', () => {
    setup({ verifyEmailToken: vi.fn().mockReturnValue(new Promise(() => {})) })
    expect(screen.getByRole('heading', { name: 'Verifying your email.' })).toBeInTheDocument()
  })

  it('confirms success and routes to sign-in with a notice', async () => {
    const { navigate } = setup()
    await userEvent.click(await screen.findByRole('button', { name: /continue to sign in/i }))
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'acct-signin', notice: expect.stringMatching(/verified/i) }),
    )
  })

  it('treats an invalid or expired token as a dead end with a message and a way back', async () => {
    setup({ verifyEmailToken: vi.fn().mockResolvedValue({ ok: false, error: 'invalid', message: 'Invalid or expired verification token' }) })
    expect(await screen.findByText(/invalid or expired verification token/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to sign in/i })).toBeInTheDocument()
  })

  it('treats an unreachable server the same as an invalid token, not a blank screen', async () => {
    setup({ verifyEmailToken: vi.fn().mockResolvedValue({ ok: false, error: 'unreachable' }) })
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to sign in/i })).toBeInTheDocument()
  })

  it('lets the user get back to sign-in from the failed state', async () => {
    const { navigate } = setup({ verifyEmailToken: vi.fn().mockResolvedValue({ ok: false, error: 'invalid' }) })
    await userEvent.click(await screen.findByRole('button', { name: /back to sign in/i }))
    expect(navigate).toHaveBeenCalledWith({ name: 'acct-signin' })
  })
})
