import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import Fork from './Fork'

test('renders headline, two choice cards, keychain footnote', () => {
  render(<Fork navigate={() => {}} />)
  expect(screen.getByText(/Everyone you love,/)).toBeTruthy()
  expect(screen.getByText('How do you sign in to your family?')).toBeTruthy()
  expect(screen.getByText('With my Sprout Track account')).toBeTruthy()
  expect(screen.getByText('Family link shared with you?')).toBeTruthy()
  expect(screen.getByText(/Either way, your sign-in stays in this phone's secure keychain\./)).toBeTruthy()
})
test('cards navigate to acct-signin and add-family', () => {
  const navigate = vi.fn()
  render(<Fork navigate={navigate} />)
  fireEvent.click(screen.getByText('With my Sprout Track account'))
  expect(navigate).toHaveBeenCalledWith({ name: 'acct-signin' })
  fireEvent.click(screen.getByText('Family link shared with you?'))
  expect(navigate).toHaveBeenCalledWith({ name: 'add-family', prefillInput: '' })
})
