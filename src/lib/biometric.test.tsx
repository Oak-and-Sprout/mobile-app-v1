import { renderHook, act, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { useBiometricDefault } from './biometric'
import * as vault from '../services/credential-vault'

afterEach(() => vi.restoreAllMocks())

test('defaults on, and stays on when the device can do biometrics', async () => {
  vi.spyOn(vault, 'isBiometricAvailable').mockResolvedValue(true)
  const { result } = renderHook(() => useBiometricDefault())
  expect(result.current[0]).toBe(true)
  await waitFor(() => expect(vault.isBiometricAvailable).toHaveBeenCalled())
  expect(result.current[0]).toBe(true)
})

test('flips off once we learn the device cannot do biometrics', async () => {
  vi.spyOn(vault, 'isBiometricAvailable').mockResolvedValue(false)
  const { result } = renderHook(() => useBiometricDefault())
  expect(result.current[0]).toBe(true) // optimistic default before the async check resolves
  await waitFor(() => expect(result.current[0]).toBe(false))
})

test('a user toggle wins over the availability check', async () => {
  let resolveAvail: (v: boolean) => void = () => {}
  vi.spyOn(vault, 'isBiometricAvailable').mockReturnValue(new Promise(r => { resolveAvail = r }))
  const { result } = renderHook(() => useBiometricDefault())
  // User turns it on explicitly before availability resolves...
  act(() => result.current[1](true))
  // ...then the device reports biometric unavailable.
  await act(async () => { resolveAvail(false) })
  expect(result.current[0]).toBe(true) // the user's choice is not overridden
})
