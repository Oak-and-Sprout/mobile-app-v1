import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import Step3Baby from './Step3Baby'
import { FEED_TYPE_OPTIONS } from '../../services/wizard'

function setup(overrides: Record<string, unknown> = {}) {
  const onComplete = vi.fn()
  const props = { busy: false, error: null, onComplete, ...overrides }
  render(<Step3Baby {...(props as Parameters<typeof Step3Baby>[0])} />)
  return { onComplete }
}

function fillRequired() {
  fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Jackson' } })
  fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Sprout' } })
  fireEvent.change(screen.getByLabelText(/birth date/i), { target: { value: '2024-05-01' } })
  fireEvent.change(screen.getByLabelText(/gender/i), { target: { value: 'MALE' } })
}

test('Complete setup is disabled until every required field is filled', () => {
  setup()
  const btn = screen.getByRole('button', { name: /complete setup/i })
  expect(btn).toBeDisabled()
  fillRequired()
  expect(btn).not.toBeDisabled()
})

test('Complete setup stays disabled while any single required field is missing', () => {
  setup()
  const btn = screen.getByRole('button', { name: /complete setup/i })
  fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Jackson' } })
  fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Sprout' } })
  fireEvent.change(screen.getByLabelText(/birth date/i), { target: { value: '2024-05-01' } })
  // gender still unset
  expect(btn).toBeDisabled()
})

test('invalid hh:mm nudge times are flagged inline and gate the button', () => {
  setup()
  fillRequired()
  const btn = screen.getByRole('button', { name: /complete setup/i })
  expect(btn).not.toBeDisabled()
  fireEvent.change(screen.getByLabelText(/since last feed/i), { target: { value: '2:00' } })
  expect(screen.getByText('Use hh:mm, like 02:00.')).toBeInTheDocument()
  expect(btn).toBeDisabled()
  fireEvent.change(screen.getByLabelText(/since last feed/i), { target: { value: '02:00' } })
  expect(screen.queryByText('Use hh:mm, like 02:00.')).toBeNull()
  expect(btn).not.toBeDisabled()

  fireEvent.change(screen.getByLabelText(/since last diaper/i), { target: { value: 'abc' } })
  expect(screen.getByText('Use hh:mm, like 03:00.')).toBeInTheDocument()
  expect(btn).toBeDisabled()
})

test('all feed types default checked; unchecking one drops it from the reported categories', () => {
  const { onComplete } = setup()
  fillRequired()
  const otherBottles = FEED_TYPE_OPTIONS.find(o => o.label === 'Other bottles')!
  fireEvent.click(screen.getByLabelText('Other bottles'))
  fireEvent.click(screen.getByRole('button', { name: /complete setup/i }))
  const arg = onComplete.mock.calls[0][0]
  expect(arg.feedTimerCategories).not.toContain(otherBottles.category)
  expect(arg.feedTimerCategories).toHaveLength(FEED_TYPE_OPTIONS.length - 1)
})

test('maps Boy/Girl to MALE/FEMALE and Start/End of feeding to start/end, and reports the full payload', () => {
  const { onComplete } = setup()
  fillRequired()
  fireEvent.change(screen.getByLabelText(/feed timer counts from/i), { target: { value: 'end' } })
  fireEvent.click(screen.getByRole('button', { name: /complete setup/i }))
  expect(onComplete).toHaveBeenCalledWith({
    firstName: 'Jackson',
    lastName: 'Sprout',
    birthDate: '2024-05-01',
    gender: 'MALE',
    feedWarningTime: '02:00',
    diaperWarningTime: '03:00',
    feedTimerFrom: 'end',
    feedTimerCategories: FEED_TYPE_OPTIONS.map(o => o.category),
  })
})

test('shows busy copy and disables the button while saving', () => {
  setup({ busy: true })
  expect(screen.getByRole('button', { name: /planting your sprout/i })).toBeDisabled()
})

test('renders the wizard-level error', () => {
  setup({ error: 'Something went wrong.' })
  expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
})

test('shows the "Security saved" note', () => {
  setup()
  expect(screen.getByText('Security saved')).toBeInTheDocument()
})
