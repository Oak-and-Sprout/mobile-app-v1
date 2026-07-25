import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SetupLink from './SetupLink'

function setup(over = {}) {
  const navigate = vi.fn()
  const deps = {
    validateSetupToken: vi.fn().mockResolvedValue('valid'),
    exchangeSetupToken: vi.fn().mockResolvedValue({ ok: true, jwt: 'jwt-setup' }),
    ...over,
  }
  render(<SetupLink navigate={navigate} token="a1b2c3" deps={deps} />)
  return { navigate, deps }
}

describe('SetupLink', () => {
  it('asks for the setup password once the token validates', async () => {
    setup()
    expect(await screen.findByLabelText(/setup password/i)).toBeInTheDocument()
  })

  it('distinguishes an expired link from an invalid one', async () => {
    setup({ validateSetupToken: vi.fn().mockResolvedValue('expired') })
    expect(await screen.findByText(/expired/i)).toBeInTheDocument()
  })

  it('says so when the link was already used', async () => {
    setup({ validateSetupToken: vi.fn().mockResolvedValue('used') })
    expect(await screen.findByText(/already been used/i)).toBeInTheDocument()
  })

  it('hands off to the wizard in setup mode with the exchanged jwt', async () => {
    const { navigate } = setup()
    await userEvent.type(await screen.findByLabelText(/setup password/i), 'hunter22')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'wizard', token: 'jwt-setup', mode: 'setup', setupToken: 'a1b2c3' }),
    ))
  })

  it('keeps the user on the password step after a wrong password', async () => {
    const { navigate } = setup({ exchangeSetupToken: vi.fn().mockResolvedValue({ ok: false, error: 'wrong-password' }) })
    await userEvent.type(await screen.findByLabelText(/setup password/i), 'nope')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/setup password/i)).toBeInTheDocument()
  })
})
