import { expect, test } from 'vitest'
import { slugify, validateSlug, titleFromSlug, digitsOnly } from './slug'

test('slugify lowercases, strips apostrophes, hyphenates', () => {
  expect(slugify("The O'Brien Family!")).toBe('the-obrien-family')
  expect(slugify('  Sprout  Test  ')).toBe('sprout-test')
})
test('validateSlug enforces charset, length, reserved list', () => {
  expect(validateSlug('smith-family')).toEqual({ ok: true })
  expect(validateSlug('')).toEqual({ ok: false, error: 'Your family needs a link - type one or tap the suggest button.' })
  expect(validateSlug('Smith!')).toEqual({ ok: false, error: 'Links can only use lowercase letters, numbers, and hyphens.' })
  expect(validateSlug('ab')).toEqual({ ok: false, error: 'Links need at least 3 characters.' })
  expect(validateSlug('a'.repeat(51))).toEqual({ ok: false, error: 'Links max out at 50 characters.' })
  expect(validateSlug('api')).toEqual({ ok: false, error: 'The system uses /api for itself - pick something else.' })
})
test('titleFromSlug and digitsOnly', () => {
  expect(titleFromSlug('smith-family')).toBe('Smith Family')
  expect(digitsOnly('1a2b3c4d5e6f7', 6)).toBe('123456')
})
