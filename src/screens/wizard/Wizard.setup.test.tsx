// Setup-link mode's branching inside Wizard.tsx (mode === 'setup' vs the default 'account')
// is otherwise only exercised indirectly - through the lower-level wizard.ts functions and
// SetupLink's hand-off params - so a regression in the mode branching itself could pass the
// rest of the suite. Kept in its own file (rather than added to Wizard.test.tsx) so that file,
// which covers the pre-existing account-mode flow, stays completely untouched.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import Wizard from './Wizard'
import type { AccountCreds } from '../../services/credential-vault'

const creds: AccountCreds = { type: 'account', email: 'a@b.com', password: 'x' }
const BASE = 'https://sprout-track.com'

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    checkSlugAvailability: vi.fn().mockResolvedValue('free'),
    suggestSlug: vi.fn().mockResolvedValue(null),
    createFamily: vi.fn().mockResolvedValue({ familyId: 'fam1' }),
    saveSecurity: vi.fn().mockResolvedValue(undefined),
    saveBaby: vi.fn().mockResolvedValue(undefined),
    linkAccountToCaretaker: vi.fn().mockResolvedValue(undefined),
    finishWizard: vi.fn().mockResolvedValue({ toast: 'account toast' }),
    finishSetupWizard: vi.fn().mockResolvedValue({ toast: 'setup toast' }),
    listServers: vi.fn().mockResolvedValue([{ id: 'srv0' }]),
    ...overrides,
  }
}

async function fillStep1(name = 'Smith Family') {
  fireEvent.change(screen.getByLabelText(/what.s your family.s name/i), { target: { value: name } })
  const nextBtn = screen.getByRole('button', { name: /^next$/i })
  await waitFor(() => expect(nextBtn).not.toBeDisabled())
  fireEvent.click(nextBtn)
}

async function choosePinMode(pin = '445566') {
  fireEvent.click(await screen.findByLabelText(/one shared family pin/i))
  fireEvent.change(screen.getByLabelText(/^family pin/i), { target: { value: pin } })
  fireEvent.change(screen.getByLabelText(/confirm pin/i), { target: { value: pin } })
  fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
}

async function addCaretaker(id: string, name: string, pin: string, role?: 'ADMIN' | 'USER') {
  fireEvent.change(screen.getByLabelText(/login id/i), { target: { value: id } })
  fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: name } })
  fireEvent.change(screen.getByLabelText(/^pin/i), { target: { value: pin } })
  if (role) fireEvent.change(screen.getByLabelText(/^role$/i), { target: { value: role } })
  fireEvent.click(screen.getByRole('button', { name: /add caretaker|create my profile/i }))
}

async function fillBaby() {
  fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Jackson' } })
  fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Sprout' } })
  fireEvent.change(screen.getByLabelText(/birth date/i), { target: { value: '2024-05-01' } })
  fireEvent.change(screen.getByLabelText(/gender/i), { target: { value: 'MALE' } })
}

test('setup mode passes the setup token through to createFamily', async () => {
  const deps = makeDeps()
  render(
    <Wizard
      navigate={vi.fn()} token="setup-jwt" creds={null} biometric={false}
      mode="setup" setupToken="a1b2c3" deps={deps}
    />,
  )

  await fillStep1()

  await waitFor(() =>
    expect(deps.createFamily).toHaveBeenCalledWith(
      BASE, 'setup-jwt',
      { name: 'Smith Family', slug: 'smith-family', setupToken: 'a1b2c3' },
    ),
  )
})

test('setup mode (pin): skips linkAccountToCaretaker and finishes via finishSetupWizard with the pin credential', async () => {
  const deps = makeDeps()
  const navigate = vi.fn()
  render(
    <Wizard
      navigate={navigate} token="setup-jwt" creds={null} biometric={true}
      mode="setup" setupToken="a1b2c3" deps={deps}
    />,
  )

  await fillStep1()
  expect(await screen.findByText('Family saved')).toBeInTheDocument()
  await choosePinMode('445566')

  expect(await screen.findByText('Security saved')).toBeInTheDocument()
  await fillBaby()
  fireEvent.click(screen.getByRole('button', { name: /complete setup/i }))

  await waitFor(() => expect(deps.finishSetupWizard).toHaveBeenCalledWith(
    BASE, 'smith-family', 'Smith Family',
    { type: 'pin', loginId: null, securityPin: '445566' },
    true, undefined,
  ))
  expect(deps.linkAccountToCaretaker).not.toHaveBeenCalled()
  expect(deps.finishWizard).not.toHaveBeenCalled()
  await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'families', toast: 'setup toast' }))
})

test('setup mode (caretakers): finishSetupWizard gets the ADMIN caretaker’s credential, selected by role rather than list position', async () => {
  // Regression coverage for the position-vs-role bug: A is added first (forced ADMIN at
  // position 0), B is added next as USER, C is added as ADMIN, then A is removed - leaving
  // [B (USER), C (ADMIN)]. The real admin (C) is no longer at position 0, so a position-based
  // pick (caretakers[0]) would wrongly select B's credential; the fix must select by role.
  const deps = makeDeps()
  const navigate = vi.fn()
  render(
    <Wizard
      navigate={navigate} token="setup-jwt" creds={null} biometric={false}
      mode="setup" setupToken="a1b2c3" deps={deps}
    />,
  )

  await fillStep1()
  expect(await screen.findByText('Family saved')).toBeInTheDocument()

  await addCaretaker('01', 'Alice', '111111')
  await addCaretaker('02', 'Bob', '222222', 'USER')
  await addCaretaker('03', 'Carla', '333333', 'ADMIN')
  fireEvent.click(screen.getByRole('button', { name: /Remove Alice/i }))
  fireEvent.click(screen.getByRole('button', { name: /^next$/i }))

  expect(await screen.findByText('Security saved')).toBeInTheDocument()
  await fillBaby()
  fireEvent.click(screen.getByRole('button', { name: /complete setup/i }))

  await waitFor(() => expect(deps.finishSetupWizard).toHaveBeenCalledWith(
    BASE, 'smith-family', 'Smith Family',
    { type: 'pin', loginId: '03', securityPin: '333333' },
    false, undefined,
  ))
  expect(deps.linkAccountToCaretaker).not.toHaveBeenCalled()
})

test('account mode still calls linkAccountToCaretaker', async () => {
  const deps = makeDeps()
  render(<Wizard navigate={vi.fn()} token="tok" creds={creds} biometric={true} deps={deps} />)

  await fillStep1()
  expect(await screen.findByText('Family saved')).toBeInTheDocument()
  await addCaretaker('01', 'Betty', '123456')
  fireEvent.click(screen.getByRole('button', { name: /^next$/i }))

  expect(await screen.findByText('Security saved')).toBeInTheDocument()
  await fillBaby()
  fireEvent.click(screen.getByRole('button', { name: /complete setup/i }))

  await waitFor(() => expect(deps.linkAccountToCaretaker).toHaveBeenCalledWith(BASE, 'tok', 'fam1', 'caretakers'))
  expect(deps.finishSetupWizard).not.toHaveBeenCalled()
})

test('account mode still calls finishWizard with the account credentials, not finishSetupWizard', async () => {
  const deps = makeDeps()
  const navigate = vi.fn()
  render(<Wizard navigate={navigate} token="tok" creds={creds} biometric={true} deps={deps} />)

  await fillStep1()
  expect(await screen.findByText('Family saved')).toBeInTheDocument()
  await addCaretaker('01', 'Betty', '123456')
  fireEvent.click(screen.getByRole('button', { name: /^next$/i }))

  expect(await screen.findByText('Security saved')).toBeInTheDocument()
  await fillBaby()
  fireEvent.click(screen.getByRole('button', { name: /complete setup/i }))

  await waitFor(() => expect(deps.finishWizard).toHaveBeenCalledWith(BASE, creds, 'Smith Family', true, undefined))
  expect(deps.finishSetupWizard).not.toHaveBeenCalled()
  await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'families', toast: 'account toast' }))
})
