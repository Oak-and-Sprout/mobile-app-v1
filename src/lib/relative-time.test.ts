import { describe, expect, it } from 'vitest'
import { formatLastOpened } from './relative-time'

const NOW = new Date('2026-07-20T15:00:00')

describe('formatLastOpened', () => {
  it('formats same-day as today with time', () => {
    expect(formatLastOpened('2026-07-20T14:14:00', NOW)).toBe('today, 2:14 pm')
  })
  it('formats yesterday', () => {
    expect(formatLastOpened('2026-07-19T09:00:00', NOW)).toBe('yesterday')
  })
  it('formats within six days as weekday', () => {
    expect(formatLastOpened('2026-07-14T09:00:00', NOW)).toBe('Tuesday')
  })
  it('formats older dates as short month + day', () => {
    expect(formatLastOpened('2026-07-03T09:00:00', NOW)).toBe('Jul 3')
  })
})
