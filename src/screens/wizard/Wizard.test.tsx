import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import Wizard from './Wizard'
import { WizardError } from '../../services/wizard'
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
    finishWizard: vi.fn().mockResolvedValue({ toast: 'Welcome home - Smith Family is set up and saved to this phone.' }),
    listServers: vi.fn().mockResolvedValue([{ id: 'srv0' }]),
    ...overrides,
  }
}

async function addFirstCaretaker() {
  fireEvent.change(screen.getByLabelText(/login id/i), { target: { value: '01' } })
  fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Betty' } })
  fireEvent.change(screen.getByLabelText(/^pin/i), { target: { value: '123456' } })
  fireEvent.click(screen.getByRole('button', { name: /add caretaker|create my profile/i }))
}

async function fillBaby() {
  fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Jackson' } })
  fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Sprout' } })
  fireEvent.change(screen.getByLabelText(/birth date/i), { target: { value: '2024-05-01' } })
  fireEvent.change(screen.getByLabelText(/gender/i), { target: { value: 'MALE' } })
}

test('fresh run walks 1 -> 2 -> 3 -> families, calling every service in order with the right args', async () => {
  const deps = makeDeps()
  const navigate = vi.fn()
  render(<Wizard navigate={navigate} token="tok" creds={creds} biometric={true} deps={deps} />)

  // Step 1: name, wait for the debounced availability check to land on "free", then Next.
  fireEvent.change(screen.getByLabelText(/what.s your family.s name/i), { target: { value: 'Smith Family' } })
  const nextBtn1 = screen.getByRole('button', { name: /^next$/i })
  await waitFor(() => expect(nextBtn1).not.toBeDisabled())
  fireEvent.click(nextBtn1)

  await waitFor(() =>
    expect(deps.createFamily).toHaveBeenCalledWith(BASE, 'tok', { name: 'Smith Family', slug: 'smith-family' }),
  )

  // Step 2: default caretakers mode, add the (only) caretaker, then Next.
  expect(await screen.findByText('Family saved')).toBeInTheDocument()
  await addFirstCaretaker()
  const nextBtn2 = screen.getByRole('button', { name: /^next$/i })
  expect(nextBtn2).not.toBeDisabled()
  fireEvent.click(nextBtn2)

  await waitFor(() =>
    expect(deps.saveSecurity).toHaveBeenCalledWith(BASE, 'tok', 'fam1', {
      mode: 'caretakers',
      caretakers: [{ loginId: '01', name: 'Betty', type: '', role: 'ADMIN', securityPin: '123456' }],
    }),
  )

  // Step 3: baby details, then Complete setup.
  expect(await screen.findByText('Security saved')).toBeInTheDocument()
  await fillBaby()
  fireEvent.click(screen.getByRole('button', { name: /complete setup/i }))

  await waitFor(() =>
    expect(deps.saveBaby).toHaveBeenCalledWith(
      BASE, 'tok', 'fam1',
      expect.objectContaining({ firstName: 'Jackson', lastName: 'Sprout', gender: 'MALE' }),
    ),
  )
  await waitFor(() => expect(deps.linkAccountToCaretaker).toHaveBeenCalledWith(BASE, 'tok', 'fam1', 'caretakers'))
  await waitFor(() => expect(deps.finishWizard).toHaveBeenCalledWith(BASE, creds, 'Smith Family', true, undefined))
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith({
      name: 'families',
      toast: 'Welcome home - Smith Family is set up and saved to this phone.',
    }),
  )

  // Services fire in step order, not interleaved.
  const order = [deps.createFamily, deps.saveSecurity, deps.saveBaby, deps.linkAccountToCaretaker, deps.finishWizard]
    .map(fn => fn.mock.invocationCallOrder[0])
  expect(order).toEqual([...order].sort((a, b) => a - b))
})

test('resuming at stage 2 skips createFamily and renders step 2 with the "Family saved" note', async () => {
  const deps = makeDeps()
  const navigate = vi.fn()
  render(
    <Wizard
      navigate={navigate} token="tok" creds={creds} biometric={false} deps={deps}
      resume={{ familyId: 'fam9', stage: 2, familyName: 'Resumed Family', slug: 'resumed-family' }}
    />,
  )

  expect(screen.getByText('Family saved')).toBeInTheDocument()
  expect(screen.getByText('Who can open the book?')).toBeInTheDocument()
  expect(deps.createFamily).not.toHaveBeenCalled()

  await addFirstCaretaker()
  fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
  await waitFor(() => expect(deps.saveSecurity).toHaveBeenCalledWith(BASE, 'tok', 'fam9', expect.anything()))
})

test('resuming at stage 3 goes straight to the baby step, skipping createFamily and saveSecurity, and links via the default mode when none was given', async () => {
  const deps = makeDeps()
  const navigate = vi.fn()
  render(
    <Wizard
      navigate={navigate} token="tok" creds={creds} biometric={true} deps={deps}
      resume={{ familyId: 'fam9', stage: 3, familyName: 'Resumed Family', slug: 'resumed-family' }}
    />,
  )

  expect(screen.getByText('Security saved')).toBeInTheDocument()
  expect(screen.getByText('Add your baby.')).toBeInTheDocument()
  expect(deps.createFamily).not.toHaveBeenCalled()
  expect(deps.saveSecurity).not.toHaveBeenCalled()

  await fillBaby()
  fireEvent.click(screen.getByRole('button', { name: /complete setup/i }))

  await waitFor(() => expect(deps.saveBaby).toHaveBeenCalledWith(BASE, 'tok', 'fam9', expect.anything()))
  await waitFor(() => expect(deps.linkAccountToCaretaker).toHaveBeenCalledWith(BASE, 'tok', 'fam9', 'caretakers'))
  await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'families', toast: expect.any(String) }))
})

test('resuming at stage 3 with resume.mode "pin" links via the pin-mode lookup, not the default', async () => {
  const deps = makeDeps()
  const navigate = vi.fn()
  render(
    <Wizard
      navigate={navigate} token="tok" creds={creds} biometric={true} deps={deps}
      resume={{ familyId: 'fam9', stage: 3, familyName: 'Resumed Family', slug: 'resumed-family', mode: 'pin' }}
    />,
  )

  await fillBaby()
  fireEvent.click(screen.getByRole('button', { name: /complete setup/i }))

  await waitFor(() => expect(deps.linkAccountToCaretaker).toHaveBeenCalledWith(BASE, 'tok', 'fam9', 'pin'))
})

test('a linking failure on step 3 retries only the failed remainder - saveBaby fires exactly once across both attempts', async () => {
  const linkAccountToCaretaker = vi.fn()
    .mockRejectedValueOnce(new WizardError('rejected', 'link failed'))
    .mockResolvedValueOnce(undefined)
  const deps = makeDeps({ linkAccountToCaretaker })
  const navigate = vi.fn()
  render(
    <Wizard
      navigate={navigate} token="tok" creds={creds} biometric={true} deps={deps}
      resume={{ familyId: 'fam9', stage: 3, familyName: 'Resumed Family', slug: 'resumed-family' }}
    />,
  )

  await fillBaby()
  const completeBtn = screen.getByRole('button', { name: /complete setup/i })
  fireEvent.click(completeBtn)

  expect(await screen.findByText('link failed')).toBeInTheDocument()
  expect(deps.saveBaby).toHaveBeenCalledTimes(1)

  // Retry: same button, same handler - saveBaby must not run again since it already succeeded.
  fireEvent.click(screen.getByRole('button', { name: /complete setup/i }))
  await waitFor(() => expect(linkAccountToCaretaker).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'families', toast: expect.any(String) }))
  expect(deps.saveBaby).toHaveBeenCalledTimes(1)
})

test('a slug-taken error from createFamily lands in an ErrBox and keeps the user on step 1', async () => {
  // Same fn reference for both calls - the button retries by re-invoking the identical handler.
  const createFamily = vi.fn()
    .mockRejectedValueOnce(new WizardError('slug-taken'))
    .mockResolvedValueOnce({ familyId: 'fam2' })
  const deps = makeDeps({ createFamily })
  render(<Wizard navigate={vi.fn()} token="tok" creds={creds} biometric={true} deps={deps} />)

  fireEvent.change(screen.getByLabelText(/what.s your family.s name/i), { target: { value: 'Smith Family' } })
  const nextBtn = screen.getByRole('button', { name: /^next$/i })
  await waitFor(() => expect(nextBtn).not.toBeDisabled())
  fireEvent.click(nextBtn)

  expect(await screen.findByText(/already lives at/i)).toBeInTheDocument()
  expect(screen.getByText('/smith-family')).toBeInTheDocument()
  // Still on step 1 - the family name field (unique to step 1) is present.
  expect(screen.getByLabelText(/what.s your family.s name/i)).toBeInTheDocument()

  // Retry: the button re-runs the same handler, which succeeds this time.
  fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
  await waitFor(() => expect(createFamily).toHaveBeenCalledTimes(2))
  expect(await screen.findByText('Family saved')).toBeInTheDocument()
})

test('Cancel navigates to the families list with a paused-setup toast when saved families exist', async () => {
  const deps = makeDeps({ listServers: vi.fn().mockResolvedValue([{ id: 'srv0' }]) })
  const navigate = vi.fn()
  render(<Wizard navigate={navigate} token="tok" creds={creds} biometric={true} deps={deps} />)
  await waitFor(() => expect(deps.listServers).toHaveBeenCalled())
  fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
  expect(navigate).toHaveBeenCalledWith({
    name: 'families',
    toast: 'Setup paused - sign back in anytime to finish.',
  })
})

test('Cancel navigates to the fork when there are no saved families', async () => {
  const deps = makeDeps({ listServers: vi.fn().mockResolvedValue([]) })
  const navigate = vi.fn()
  render(<Wizard navigate={navigate} token="tok" creds={creds} biometric={true} deps={deps} />)
  await waitFor(() => expect(deps.listServers).toHaveBeenCalled())
  fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
  expect(navigate).toHaveBeenCalledWith({ name: 'fork' })
})
