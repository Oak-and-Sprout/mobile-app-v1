import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import Step2Security from './Step2Security'

function setup(overrides: Record<string, unknown> = {}) {
  const onNext = vi.fn()
  const props = { busy: false, error: null, onNext, ...overrides }
  render(<Step2Security {...(props as Parameters<typeof Step2Security>[0])} />)
  return { onNext }
}

function addCaretaker(id: string, name: string, pin: string, type = '') {
  fireEvent.change(screen.getByLabelText(/login id/i), { target: { value: id } })
  fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: name } })
  fireEvent.change(screen.getByLabelText(/^pin/i), { target: { value: pin } })
  if (type) fireEvent.change(screen.getByLabelText(/type/i), { target: { value: type } })
  fireEvent.click(screen.getByRole('button', { name: /add caretaker|create my profile/i }))
}

test('defaults to caretakers mode with the first caretaker prefilled from firstName', () => {
  setup({ firstName: 'Rachael' })
  expect(screen.getByLabelText(/^name$/i)).toHaveValue('Rachael')
  expect(screen.getByLabelText(/type/i)).toHaveValue('Account Owner')
  expect(screen.getByRole('button', { name: /create my profile/i })).toBeInTheDocument()
  expect(screen.getByText('Create your profile first')).toBeInTheDocument()
})

test('without a firstName, the first caretaker form starts blank with "Add yourself first" copy', () => {
  setup()
  expect(screen.getByLabelText(/^name$/i)).toHaveValue('')
  expect(screen.getByLabelText(/type/i)).toHaveValue('')
  expect(screen.getByRole('button', { name: /^add caretaker$/i })).toBeInTheDocument()
  expect(screen.getByText('Add yourself first')).toBeInTheDocument()
})

test('idErr: non-digit id shows "Digits only."', () => {
  setup()
  fireEvent.change(screen.getByLabelText(/login id/i), { target: { value: 'a1' } })
  expect(screen.getByText('Digits only.')).toBeInTheDocument()
})

test('idErr: "00" shows the reserved-id message', () => {
  setup()
  fireEvent.change(screen.getByLabelText(/login id/i), { target: { value: '00' } })
  expect(screen.getByText(/is reserved for the system/i)).toBeInTheDocument()
})

test('idErr: an id already used by an existing caretaker shows the taken message', () => {
  setup()
  addCaretaker('01', 'Betty', '123456')
  fireEvent.change(screen.getByLabelText(/login id/i), { target: { value: '01' } })
  expect(screen.getByText(/is taken/i)).toBeInTheDocument()
})

test('addCt validation: two-digit id required', () => {
  setup()
  fireEvent.change(screen.getByLabelText(/login id/i), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Betty' } })
  fireEvent.change(screen.getByLabelText(/^pin/i), { target: { value: '123456' } })
  fireEvent.click(screen.getByRole('button', { name: /add caretaker/i }))
  expect(screen.getByText(/pick a free two-digit id/i)).toBeInTheDocument()
})

test('addCt validation: name required', () => {
  setup()
  fireEvent.change(screen.getByLabelText(/login id/i), { target: { value: '01' } })
  fireEvent.change(screen.getByLabelText(/^pin/i), { target: { value: '123456' } })
  fireEvent.click(screen.getByRole('button', { name: /add caretaker/i }))
  expect(screen.getByText(/give this caretaker a name/i)).toBeInTheDocument()
})

test('addCt validation: pin must be 6-10 digits', () => {
  setup()
  fireEvent.change(screen.getByLabelText(/login id/i), { target: { value: '01' } })
  fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Betty' } })
  fireEvent.change(screen.getByLabelText(/^pin/i), { target: { value: '123' } })
  fireEvent.click(screen.getByRole('button', { name: /add caretaker/i }))
  expect(screen.getByText(/pins are 6.10 digits/i)).toBeInTheDocument()
})

test('the first caretaker is always Admin with no role select; the second onward gets a role select', () => {
  setup()
  expect(screen.queryByLabelText(/role/i)).toBeNull()
  addCaretaker('01', 'Betty', '123456')
  const ctItem = screen.getByText('Betty').closest('.ct-item')
  expect(ctItem).toHaveTextContent('Admin')
  expect(ctItem).toHaveTextContent('ID 01')

  addCaretaker('02', 'Nate', '123456')
  expect(screen.getByLabelText(/role/i)).toBeInTheDocument()
})

test('removing a caretaker frees its ID and shrinks the list', () => {
  setup()
  addCaretaker('01', 'Betty', '123456')
  expect(screen.getByText('Betty')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /remove betty/i }))
  expect(screen.queryByText('Betty')).toBeNull()
})

test('Next is disabled with no caretakers, enabled once one exists, and reports the built config', () => {
  const { onNext } = setup()
  const nextBtn = screen.getByRole('button', { name: /next/i })
  expect(nextBtn).toBeDisabled()
  addCaretaker('01', 'Betty', '123456')
  expect(nextBtn).not.toBeDisabled()
  fireEvent.click(nextBtn)
  expect(onNext).toHaveBeenCalledWith({
    mode: 'caretakers',
    caretakers: [{ loginId: '01', name: 'Betty', type: '', role: 'ADMIN', securityPin: '123456' }],
  })
})

test('pin mode requires a matching 6-10 digit confirmation and strips non-digit keystrokes', () => {
  const { onNext } = setup()
  fireEvent.click(screen.getByLabelText(/one shared family pin/i))
  const nextBtn = screen.getByRole('button', { name: /next/i })
  fireEvent.change(screen.getByLabelText(/^family pin/i), { target: { value: 'ab123456cd' } })
  fireEvent.change(screen.getByLabelText(/confirm pin/i), { target: { value: '123' } })
  expect(nextBtn).toBeDisabled()
  fireEvent.change(screen.getByLabelText(/confirm pin/i), { target: { value: '123456' } })
  expect(nextBtn).not.toBeDisabled()
  fireEvent.click(nextBtn)
  expect(onNext).toHaveBeenCalledWith({ mode: 'pin', securityPin: '123456' })
})

test('shows busy copy and disables Next while saving', () => {
  setup({ busy: true })
  expect(screen.getByRole('button', { name: /saving security/i })).toBeDisabled()
})

test('renders the wizard-level error', () => {
  setup({ error: 'Something went wrong.' })
  expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
})

test('shows the "Family saved" note', () => {
  setup()
  expect(screen.getByText('Family saved')).toBeInTheDocument()
})
