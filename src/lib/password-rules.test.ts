import { describe, it, expect } from 'vitest'
import { PW_REQS, passwordMeetsRules } from './password-rules'

describe('password rules', () => {
  it('mirrors the register endpoint - 8+, lower, upper, number, symbol', () => {
    expect(PW_REQS.map(([label]) => label)).toEqual([
      '8+ characters', 'A number', 'A lowercase letter', 'A symbol', 'An uppercase letter',
    ])
  })

  it('accepts a password meeting every rule', () => {
    expect(passwordMeetsRules('Abcdef1!')).toBe(true)
  })

  it('rejects one missing a symbol', () => {
    expect(passwordMeetsRules('Abcdefg1')).toBe(false)
  })

  it('rejects one that is too short', () => {
    expect(passwordMeetsRules('Ab1!')).toBe(false)
  })
})
