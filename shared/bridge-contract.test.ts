import { BRIDGE_CONTRACT_VERSION, decodeMessage, encodeMessage } from './bridge-contract'

test('round-trips a keepAwake message', () => {
  const decoded = decodeMessage(encodeMessage({ type: 'keepAwake', on: true }))
  expect(decoded).toEqual({ v: BRIDGE_CONTRACT_VERSION, msg: { type: 'keepAwake', on: true } })
})

test('returns null for malformed JSON', () => {
  expect(decodeMessage('{not json')).toBeNull()
})

test('returns null for unknown message type', () => {
  expect(decodeMessage(JSON.stringify({ v: 1, msg: { type: 'teleport' } }))).toBeNull()
})

test('returns null for a newer contract version', () => {
  const raw = JSON.stringify({ v: BRIDGE_CONTRACT_VERSION + 1, msg: { type: 'appResumed' } })
  expect(decodeMessage(raw)).toBeNull()
})

test('returns null for known type with wrong-typed field', () => {
  expect(decodeMessage(JSON.stringify({ v: 1, msg: { type: 'keepAwake', on: 'yes' } }))).toBeNull()
})

test('returns null for known type with missing required field', () => {
  expect(decodeMessage(JSON.stringify({ v: 1, msg: { type: 'loggedOut' } }))).toBeNull()
})

test('round-trips a loggedOut message', () => {
  const decoded = decodeMessage(encodeMessage({ type: 'loggedOut', reason: 'user request' }))
  expect(decoded).toEqual({ v: BRIDGE_CONTRACT_VERSION, msg: { type: 'loggedOut', reason: 'user request' } })
})

it('round-trips sessionInjected with token and optional caretakerId', () => {
  const msg = { type: 'sessionInjected', slug: 'smith-family', token: 'jwt123' } as const
  expect(decodeMessage(encodeMessage(msg))?.msg).toEqual(msg)
  const withId = { ...msg, caretakerId: '42' }
  expect(decodeMessage(encodeMessage(withId))?.msg).toEqual(withId)
})

it('rejects sessionInjected without a token', () => {
  expect(decodeMessage(JSON.stringify({ v: 1, msg: { type: 'sessionInjected', slug: 's' } }))).toBeNull()
})

it('rejects sessionInjected with a non-string caretakerId', () => {
  expect(decodeMessage(JSON.stringify({
    v: 1, msg: { type: 'sessionInjected', slug: 's', token: 't', caretakerId: 7 },
  }))).toBeNull()
})
