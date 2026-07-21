import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { BioCheck } from './BioCheck'

test('renders keychain copy with the secret name and toggles', () => {
  const onChange = vi.fn()
  render(<BioCheck checked={true} onChange={onChange} what="password" />)
  expect(screen.getByText('Unlock with Face ID next time')).toBeTruthy()
  const small = screen.getByText('Unlock with Face ID next time').parentElement?.querySelector('small')
  expect(small?.textContent).toMatch(/Your password lives in this phone’s secure keychain - a glance opens the book\./)
  fireEvent.click(screen.getByRole('checkbox'))
  expect(onChange).toHaveBeenCalledWith(false)
})

test('defaults the secret name to PIN', () => {
  render(<BioCheck checked={false} onChange={() => {}} />)
  const small = screen.getByText('Unlock with Face ID next time').parentElement?.querySelector('small')
  expect(small?.textContent).toMatch(/Your PIN lives in this phone’s secure keychain/)
})