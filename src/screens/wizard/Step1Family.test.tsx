import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import Step1Family from './Step1Family'
import { WizardError } from '../../services/wizard'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function setup(overrides: Record<string, unknown> = {}) {
  const checkSlugAvailability = vi.fn().mockResolvedValue('free')
  const suggestSlug = vi.fn().mockResolvedValue(null)
  const onNext = vi.fn()
  const onCancel = vi.fn()
  const props = {
    base: 'https://sprout-track.com',
    busy: false,
    error: null,
    onCancel,
    onNext,
    deps: { checkSlugAvailability, suggestSlug },
    ...overrides,
  }
  render(<Step1Family {...(props as Parameters<typeof Step1Family>[0])} />)
  return { checkSlugAvailability, suggestSlug, onNext, onCancel }
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

test('typing a name auto-fills a slugified link until the link is edited directly', () => {
  setup()
  fireEvent.change(screen.getByLabelText(/what.s your family.s name/i), { target: { value: "O'Brien Family" } })
  expect(screen.getByLabelText(/family link/i)).toHaveValue('obrien-family')
  fireEvent.change(screen.getByLabelText(/what.s your family.s name/i), { target: { value: "O'Brien Family 2" } })
  expect(screen.getByLabelText(/family link/i)).toHaveValue('obrien-family-2')
})

test('editing the link directly stops auto-fill and turns spaces into hyphens', () => {
  setup()
  fireEvent.change(screen.getByLabelText(/family link/i), { target: { value: 'my family' } })
  expect(screen.getByLabelText(/family link/i)).toHaveValue('my-family')
  fireEvent.change(screen.getByLabelText(/what.s your family.s name/i), { target: { value: 'Totally Different' } })
  expect(screen.getByLabelText(/family link/i)).toHaveValue('my-family')
})

test('shows a checking note, then queries the server, then shows the free note', async () => {
  const { checkSlugAvailability } = setup()
  fireEvent.change(screen.getByLabelText(/family link/i), { target: { value: 'smith-family' } })
  expect(screen.getByText(/checking if that link is free/i)).toBeInTheDocument()
  expect(checkSlugAvailability).not.toHaveBeenCalled()
  await advance(500)
  expect(checkSlugAvailability).toHaveBeenCalledWith('https://sprout-track.com', 'smith-family')
  expect(screen.getByText(/is free - it.s yours/i)).toBeInTheDocument()
})

test('flags a reserved slug locally without calling the network check', () => {
  const { checkSlugAvailability } = setup()
  fireEvent.change(screen.getByLabelText(/family link/i), { target: { value: 'api' } })
  expect(screen.getByText(/uses \/api for itself/i)).toBeInTheDocument()
  expect(checkSlugAvailability).not.toHaveBeenCalled()
})

test('shows the taken message (matching the create-family slug-taken copy) when the server reports taken', async () => {
  const checkSlugAvailability = vi.fn().mockResolvedValue('taken')
  setup({ deps: { checkSlugAvailability, suggestSlug: vi.fn() } })
  fireEvent.change(screen.getByLabelText(/family link/i), { target: { value: 'smith-family' } })
  await advance(500)
  expect(screen.getByText(/already lives at/i)).toBeInTheDocument()
  expect(screen.getByText('/smith-family')).toBeInTheDocument()
  expect(screen.getByText(/try a different one/i)).toBeInTheDocument()
})

test('shows the unreachable message when the availability check throws', async () => {
  const checkSlugAvailability = vi.fn().mockRejectedValue(new WizardError('unreachable'))
  setup({ deps: { checkSlugAvailability, suggestSlug: vi.fn() } })
  fireEvent.change(screen.getByLabelText(/family link/i), { target: { value: 'smith-family' } })
  await advance(500)
  expect(screen.getByText(/can.t reach that server/i)).toBeInTheDocument()
})

test('Next stays disabled until the name is set and the slug is confirmed free, then calls onNext with the trimmed name', async () => {
  const { onNext } = setup()
  const nextBtn = screen.getByRole('button', { name: /next/i })
  expect(nextBtn).toBeDisabled()
  fireEvent.change(screen.getByLabelText(/what.s your family.s name/i), { target: { value: '  Smith Family  ' } })
  await advance(500)
  expect(nextBtn).not.toBeDisabled()
  fireEvent.click(nextBtn)
  expect(onNext).toHaveBeenCalledWith({ name: 'Smith Family', slug: 'smith-family' })
})

test('shows busy copy and disables both buttons while saving', () => {
  setup({ busy: true })
  expect(screen.getByRole('button', { name: /saving your family/i })).toBeDisabled()
  expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
})

test('Cancel invokes onCancel', () => {
  const { onCancel } = setup()
  fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
  expect(onCancel).toHaveBeenCalledOnce()
})

test('a wizard-level error takes precedence over the local slug-check note', async () => {
  setup({ error: 'Something went wrong saving that.' })
  expect(screen.getByText('Something went wrong saving that.')).toBeInTheDocument()
  expect(screen.queryByText(/checking if that link is free/i)).toBeNull()
})

test('the suggest button uses the server-suggested slug', async () => {
  const suggestSlug = vi.fn().mockResolvedValue('smith-742')
  setup({ deps: { checkSlugAvailability: vi.fn().mockResolvedValue('free'), suggestSlug } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /suggest another link/i }))
  })
  expect(suggestSlug).toHaveBeenCalledWith('https://sprout-track.com')
  expect(screen.getByLabelText(/family link/i)).toHaveValue('smith-742')
})

test('the suggest button falls back to a local slug when suggestSlug resolves null', async () => {
  const suggestSlug = vi.fn().mockResolvedValue(null)
  setup({ deps: { checkSlugAvailability: vi.fn().mockResolvedValue('free'), suggestSlug } })
  fireEvent.change(screen.getByLabelText(/what.s your family.s name/i), { target: { value: 'Smith Family' } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /suggest another link/i }))
  })
  const slugInput = screen.getByLabelText(/family link/i) as HTMLInputElement
  expect(slugInput.value).toMatch(/^smith-family-\d{3}$/)
})
