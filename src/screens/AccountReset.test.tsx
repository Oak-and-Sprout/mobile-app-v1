import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import AccountReset from './AccountReset'

function makeDeps(overrides = {}) {
  return {
    requestPasswordReset: vi.fn().mockResolvedValue(true),
    ...overrides,
  }
}

describe('AccountReset', () => {
  it('renders the copy: header, intro, email field, button, and auth-alt link', () => {
    const navigate = vi.fn()
    render(<AccountReset navigate={navigate} deps={makeDeps()} />)
    expect(screen.getByRole('heading', { name: 'Reset your password.' })).toBeInTheDocument()
    expect(screen.getByText('We’ll email you a link. It works for one hour.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('id', 'rsE')
    expect(screen.getByRole('button', { name: 'Email me the link' })).toBeDisabled()
    expect(screen.getByText('Remembered it?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to sign in' })).toBeInTheDocument()
  })

  it('navigates back to acct-signin when the back button is pressed', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    render(<AccountReset navigate={navigate} deps={makeDeps()} />)
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(navigate).toHaveBeenCalledWith({ name: 'acct-signin' })
  })

  it('navigates back to acct-signin via the "Back to sign in" link', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    render(<AccountReset navigate={navigate} deps={makeDeps()} />)
    await user.click(screen.getByRole('button', { name: 'Back to sign in' }))
    expect(navigate).toHaveBeenCalledWith({ name: 'acct-signin' })
  })

  it('enables the button once an email is entered, and disables it while busy', async () => {
    const user = userEvent.setup()
    let resolve: (v: boolean) => void = () => {}
    const requestPasswordReset = vi.fn().mockReturnValue(new Promise<boolean>(r => { resolve = r }))
    const navigate = vi.fn()
    render(<AccountReset navigate={navigate} deps={makeDeps({ requestPasswordReset })} />)
    const button = screen.getByRole('button', { name: 'Email me the link' })
    expect(button).toBeDisabled()
    await user.type(screen.getByLabelText('Email'), 'betty@example.com')
    expect(button).toBeEnabled()
    await user.click(button)
    expect(button).toBeDisabled()
    resolve(true)
    await waitFor(() => expect(navigate).toHaveBeenCalled())
  })

  it('on success, navigates to acct-signin with the exact notice string', async () => {
    const user = userEvent.setup()
    const requestPasswordReset = vi.fn().mockResolvedValue(true)
    const navigate = vi.fn()
    render(<AccountReset navigate={navigate} deps={makeDeps({ requestPasswordReset })} />)
    await user.type(screen.getByLabelText('Email'), 'betty@example.com')
    await user.click(screen.getByRole('button', { name: 'Email me the link' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({
      name: 'acct-signin',
      notice: 'Reset link sent to betty@example.com - it works for one hour.',
    }))
    expect(requestPasswordReset).toHaveBeenCalledWith('https://sprout-track.com', 'betty@example.com')
  })

  it('on failure, shows an ErrBox and stays on the screen', async () => {
    const user = userEvent.setup()
    const requestPasswordReset = vi.fn().mockResolvedValue(false)
    const navigate = vi.fn()
    render(<AccountReset navigate={navigate} deps={makeDeps({ requestPasswordReset })} />)
    await user.type(screen.getByLabelText('Email'), 'betty@example.com')
    await user.click(screen.getByRole('button', { name: 'Email me the link' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Can’t reach Sprout Track right now. Check your connection.',
    )
    expect(navigate).not.toHaveBeenCalled()
  })
})
