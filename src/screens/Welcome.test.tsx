import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import Welcome from './Welcome'

describe('Welcome', () => {
  it('offers the three entry paths', async () => {
    const navigate = vi.fn()
    render(<Welcome navigate={navigate} />)
    expect(screen.getByText(/The family page,/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Sign in with my account' }))
    expect(navigate).toHaveBeenCalledWith({ name: 'account-signin' })

    await userEvent.click(screen.getByRole('button', { name: 'Join with a family link' }))
    expect(navigate).toHaveBeenCalledWith({ name: 'add-family', prefillInput: 'sprout-track.com/' })

    await userEvent.click(screen.getByRole('button', { name: 'I run my own server' }))
    expect(navigate).toHaveBeenCalledWith({ name: 'add-family' })
  })
})
