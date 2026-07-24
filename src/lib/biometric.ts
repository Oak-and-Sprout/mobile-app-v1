import { useCallback, useEffect, useRef, useState } from 'react'
import { isBiometricAvailable } from '../services/credential-vault'

/**
 * "Unlock with Face ID" toggle state. Starts on (the secure default), but flips
 * off once we confirm the device can't actually do biometrics — so it isn't
 * confusingly pre-checked on hardware (or a simulator) that can never satisfy it.
 * A user toggle after mount always wins (tracked via a ref so the async check
 * reads its current value, not a stale closure).
 */
export function useBiometricDefault(): [boolean, (v: boolean) => void] {
  const [biometric, setBiometric] = useState(true)
  const touchedRef = useRef(false)
  useEffect(() => {
    void isBiometricAvailable().then(available => {
      if (!available && !touchedRef.current) setBiometric(false)
    })
  }, [])
  const set = useCallback((v: boolean) => {
    touchedRef.current = true
    setBiometric(v)
  }, [])
  return [biometric, set]
}
