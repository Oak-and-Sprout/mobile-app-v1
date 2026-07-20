import { expect, test } from 'vitest'
import { bootActionFromSearch } from './bridge-events'
import { encodeMessage } from '../../shared/bridge-contract'

const search = (msg: Parameters<typeof encodeMessage>[0]) =>
  `?bridge-event=${encodeURIComponent(encodeMessage(msg))}`

test('switch-family shows the server list', () => {
  expect(bootActionFromSearch(search({ type: 'loggedOut', reason: 'switch-family' }))).toBe('show-server-list')
})

test('a 401 logout falls through to auto-open (silent re-login)', () => {
  expect(bootActionFromSearch(search({ type: 'loggedOut', reason: 'logout-401' }))).toBe('auto-open')
})

test('absent or malformed params auto-open', () => {
  expect(bootActionFromSearch('')).toBe('auto-open')
  expect(bootActionFromSearch('?bridge-event=%7Bnot-json')).toBe('auto-open')
})
