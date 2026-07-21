import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { CredentialFields } from './CredentialFields'

test('SYSTEM: one Family PIN field, reports pin creds when filled and null when empty', () => {
  const onChange = vi.fn()
  render(<CredentialFields authType="SYSTEM" onChange={onChange} />)
  expect(onChange).toHaveBeenLastCalledWith(null)
  fireEvent.change(screen.getByLabelText('Family PIN'), { target: { value: '123456' } })
  expect(onChange).toHaveBeenLastCalledWith({ type: 'pin', loginId: null, securityPin: '123456' })
})

test('CARETAKER: reports creds only once both Login ID and PIN are filled', () => {
  const onChange = vi.fn()
  render(<CredentialFields authType="CARETAKER" onChange={onChange} />)
  fireEvent.change(screen.getByLabelText('Login ID'), { target: { value: '07' } })
  expect(onChange).toHaveBeenLastCalledWith(null) // pin still empty
  fireEvent.change(screen.getByLabelText('PIN'), { target: { value: '654321' } })
  expect(onChange).toHaveBeenLastCalledWith({ type: 'pin', loginId: '07', securityPin: '654321' })
})

test('ACCOUNT: reports account creds once email and password are filled', () => {
  const onChange = vi.fn()
  render(<CredentialFields authType="ACCOUNT" onChange={onChange} />)
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } })
  expect(onChange).toHaveBeenLastCalledWith({ type: 'account', email: 'a@b.com', password: 'pw' })
})

test('prefills the identifier from initial without exposing a secret', () => {
  render(<CredentialFields authType="CARETAKER" initial={{ loginId: '07' }} onChange={vi.fn()} />)
  expect((screen.getByLabelText('Login ID') as HTMLInputElement).value).toBe('07')
  expect((screen.getByLabelText('PIN') as HTMLInputElement).value).toBe('')
})
