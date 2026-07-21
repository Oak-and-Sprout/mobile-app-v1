import { expect, it } from 'vitest'
import { encodeMessage } from '../../shared/bridge-contract'
import { bootActionFromSearch } from './bridge-events'

const search = (msg: Parameters<typeof encodeMessage>[0]) =>
  `?bridge-event=${encodeURIComponent(encodeMessage(msg))}`

it.each([
  ['switch-family', 'show-server-list'],
  ['logout-user', 'show-server-list'],
  ['logout-idle', 'reconnect'],
  ['logout-refresh-failed', 'reconnect'],
  ['logout-jwt-error', 'reconnect'],
  ['something-new', 'show-server-list'],
] as const)('loggedOut reason %s -> %s', (reason, expected) => {
  expect(bootActionFromSearch(search({ type: 'loggedOut', reason }))).toBe(expected)
})

it('sessionExpired -> reconnect', () => {
  expect(bootActionFromSearch(search({ type: 'sessionExpired' }))).toBe('reconnect')
})

it('no param -> auto-open', () => {
  expect(bootActionFromSearch('')).toBe('auto-open')
})

it('undecodable param -> auto-open', () => {
  expect(bootActionFromSearch('?bridge-event=garbage')).toBe('auto-open')
})
