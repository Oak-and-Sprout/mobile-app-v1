import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import AccountVerify from './AccountVerify'

const CREDS = { type: 'account' as const, email: 'me@example.com', password: 'hunter22' }

function makeDeps(overrides = {}) {
  return {
    fetchAccountStatus: vi.fn().mockResolvedValue(null),
    resendVerification: vi.fn().mockResolvedValue(true),
    fetchSetupStatus: vi.fn().mockResolvedValue({
      setupStage: 3, currentStage: 3, familyId: 'f1', familyName: 'Sprout Test', familySlug: 'sprout-test',
    }),
    fetchFamilyBySlug: vi.fn().mockResolvedValue({ name: 'Sprout Test', slug: 'sprout-test', isActive: true }),
    saveServer: vi.fn().mockResolvedValue({ id: 'id1' }),
    vault: { store: vi.fn().mockResolvedValue(undefined) },
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('AccountVerify', () => {
  it('renders the waiting copy with the email address and a back button to acct-signin', () => {
    const navigate = vi.fn()
    render(<AccountVerify navigate={navigate} token="t" creds={CREDS} biometric={true} deps={makeDeps()} />)
    expect(screen.getByRole('heading', { name: 'Check your email.' })).toBeInTheDocument()
    expect(screen.getByText(/me@example.com/)).toBeInTheDocument()
    expect(screen.getByText(/Waiting for your click/)).toBeInTheDocument()
  })

  it('checks status immediately on mount, then again every pollMs', async () => {
    const deps = makeDeps()
    render(<AccountVerify navigate={vi.fn()} token="t" creds={CREDS} biometric={true} deps={deps} pollMs={5000} />)
    await waitFor(() => expect(deps.fetchAccountStatus).toHaveBeenCalledTimes(1))
    expect(deps.fetchAccountStatus).toHaveBeenCalledWith('https://sprout-track.com', 't')

    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(deps.fetchAccountStatus).toHaveBeenCalledTimes(2)

    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(deps.fetchAccountStatus).toHaveBeenCalledTimes(3)
  })

  it('ignores a null status and keeps polling', async () => {
    const deps = makeDeps({ fetchAccountStatus: vi.fn().mockResolvedValue(null) })
    const navigate = vi.fn()
    render(<AccountVerify navigate={navigate} token="t" creds={CREDS} biometric={true} deps={deps} pollMs={5000} />)
    await waitFor(() => expect(deps.fetchAccountStatus).toHaveBeenCalledTimes(1))
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(deps.fetchAccountStatus).toHaveBeenCalledTimes(2)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('routes a verified status with a family through to the families list, clearing the interval', async () => {
    const deps = makeDeps({
      fetchAccountStatus: vi.fn().mockResolvedValue({ verified: true, hasFamily: true, familySlug: 'sprout-test' }),
    })
    const navigate = vi.fn()
    render(<AccountVerify navigate={navigate} token="t" creds={CREDS} biometric={true} deps={deps} pollMs={5000} />)
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({
      name: 'families', toast: 'Saved - Sprout Test is on this phone now.',
    }))
    expect(deps.fetchSetupStatus).toHaveBeenCalledWith('https://sprout-track.com', 't')

    const callsAfterRoute = deps.fetchAccountStatus.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(20000) })
    expect(deps.fetchAccountStatus).toHaveBeenCalledTimes(callsAfterRoute)
  })

  it('routes a verified status with no family to the wizard, passing firstName through', async () => {
    const deps = makeDeps({
      fetchAccountStatus: vi.fn().mockResolvedValue({ verified: true, hasFamily: false, firstName: 'Betty' }),
    })
    const navigate = vi.fn()
    render(<AccountVerify navigate={navigate} token="t" creds={CREDS} biometric={true} deps={deps} pollMs={5000} />)
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({
      name: 'wizard',
      token: 't',
      creds: CREDS,
      biometric: true,
      resume: undefined,
      firstName: 'Betty',
    }))
    expect(deps.fetchSetupStatus).not.toHaveBeenCalled()
  })

  it('shows an inline error when routing fails after verification', async () => {
    const deps = makeDeps({
      fetchAccountStatus: vi.fn().mockResolvedValue({ verified: true, hasFamily: true, familySlug: 'sprout-test' }),
      fetchSetupStatus: vi.fn().mockResolvedValue(null),
    })
    const navigate = vi.fn()
    render(<AccountVerify navigate={navigate} token="t" creds={CREDS} biometric={true} deps={deps} pollMs={5000} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t check your family’s setup/)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('resends the verification email and shows a confirmation note on success', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const deps = makeDeps({ resendVerification: vi.fn().mockResolvedValue(true) })
    render(<AccountVerify navigate={vi.fn()} token="t" creds={CREDS} biometric={true} deps={deps} />)
    await user.click(screen.getByRole('button', { name: 'Resend the email' }))
    await waitFor(() => expect(screen.getByText('Sent - check your inbox.')).toBeInTheDocument())
    expect(deps.resendVerification).toHaveBeenCalledWith('https://sprout-track.com', 'me@example.com')
  })

  it('shows an inline error when resending fails', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const deps = makeDeps({ resendVerification: vi.fn().mockResolvedValue(false) })
    render(<AccountVerify navigate={vi.fn()} token="t" creds={CREDS} biometric={true} deps={deps} />)
    await user.click(screen.getByRole('button', { name: 'Resend the email' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Couldn’t resend just now - try again in a minute.',
    )
  })

  it('clears the interval on unmount without further status checks or act warnings', async () => {
    const deps = makeDeps()
    const { unmount } = render(
      <AccountVerify navigate={vi.fn()} token="t" creds={CREDS} biometric={true} deps={deps} pollMs={5000} />,
    )
    await waitFor(() => expect(deps.fetchAccountStatus).toHaveBeenCalledTimes(1))
    unmount()
    const callsAtUnmount = deps.fetchAccountStatus.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(20000) })
    expect(deps.fetchAccountStatus).toHaveBeenCalledTimes(callsAtUnmount)
  })
})
