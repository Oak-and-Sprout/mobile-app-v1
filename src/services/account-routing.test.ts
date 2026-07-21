import { expect, test, vi } from 'vitest'
import { routeAfterAccountLogin } from './account-routing'

const creds = { type: 'account' as const, email: 'a@b.com', password: 'pw' }
const base = 'https://sprout-track.com'

function deps(over: Partial<Parameters<typeof routeAfterAccountLogin>[1]> = {}) {
  return {
    fetchSetupStatus: vi.fn().mockResolvedValue({ setupStage: 3, currentStage: 3, familyId: 'f1', familyName: 'Smith', familySlug: 'smith', authType: 'CARETAKER' }),
    fetchFamilyBySlug: vi.fn().mockResolvedValue({ name: 'Smith Family', slug: 'smith', isActive: true }),
    saveServer: vi.fn().mockResolvedValue({ id: 'srv1' }),
    vault: { store: vi.fn().mockResolvedValue(undefined) },
    ...over,
  }
}

test('complete family: saves, vaults, returns saved toast', async () => {
  const d = deps()
  const r = await routeAfterAccountLogin({ base, token: 't', creds, biometric: true, familySlug: 'smith', verified: true }, d)
  expect(r).toEqual({ kind: 'saved', toast: 'Saved - Smith Family is on this phone now.' })
  expect(d.saveServer).toHaveBeenCalledWith({ baseUrl: base, familySlug: 'smith', familyName: 'Smith Family', deploymentMode: 'saas', authType: 'ACCOUNT' })
  expect(d.vault.store).toHaveBeenCalledWith('srv1', creds, { biometric: true })
})
test('incomplete family: wizard resume at currentStage, carrying mode SYSTEM -> pin', async () => {
  const d = deps({ fetchSetupStatus: vi.fn().mockResolvedValue({ setupStage: 1, currentStage: 2, familyId: 'f1', familyName: 'Smith', familySlug: 'smith', authType: 'SYSTEM' }) })
  expect(await routeAfterAccountLogin({ base, token: 't', creds, biometric: false, familySlug: 'smith', verified: true }, d))
    .toEqual({ kind: 'wizard', resume: { familyId: 'f1', stage: 2, familyName: 'Smith', slug: 'smith', mode: 'pin' } })
})
test('incomplete family: wizard resume carries mode CARETAKER -> caretakers', async () => {
  const d = deps({ fetchSetupStatus: vi.fn().mockResolvedValue({ setupStage: 1, currentStage: 2, familyId: 'f1', familyName: 'Smith', familySlug: 'smith', authType: 'CARETAKER' }) })
  expect(await routeAfterAccountLogin({ base, token: 't', creds, biometric: false, familySlug: 'smith', verified: true }, d))
    .toEqual({ kind: 'wizard', resume: { familyId: 'f1', stage: 2, familyName: 'Smith', slug: 'smith', mode: 'caretakers' } })
})
test('incomplete family: wizard resume omits mode when authType is null/unrecognized', async () => {
  const d = deps({ fetchSetupStatus: vi.fn().mockResolvedValue({ setupStage: 1, currentStage: 2, familyId: 'f1', familyName: 'Smith', familySlug: 'smith', authType: null }) })
  const result = await routeAfterAccountLogin({ base, token: 't', creds, biometric: false, familySlug: 'smith', verified: true }, d)
  expect(result).toEqual({ kind: 'wizard', resume: { familyId: 'f1', stage: 2, familyName: 'Smith', slug: 'smith' } })
  expect(result).toMatchObject({ resume: expect.not.objectContaining({ mode: expect.anything() }) })
})
test('no family, verified → wizard; unverified → verify', async () => {
  expect(await routeAfterAccountLogin({ base, token: 't', creds, biometric: true, verified: true }, deps())).toEqual({ kind: 'wizard' })
  expect(await routeAfterAccountLogin({ base, token: 't', creds, biometric: true, verified: false }, deps())).toEqual({ kind: 'verify' })
})
test('setup-status failure and save failure surface errors', async () => {
  expect((await routeAfterAccountLogin({ base, token: 't', creds, biometric: true, familySlug: 's', verified: true },
    deps({ fetchSetupStatus: vi.fn().mockResolvedValue(null) }))).kind).toBe('error')
  expect((await routeAfterAccountLogin({ base, token: 't', creds, biometric: true, familySlug: 'smith', verified: true },
    deps({ saveServer: vi.fn().mockRejectedValue(new Error()) }))).kind).toBe('error')
})
test('name falls back to titleFromSlug when by-slug fails', async () => {
  const d = deps({ fetchFamilyBySlug: vi.fn().mockRejectedValue(new Error()) })
  expect(await routeAfterAccountLogin({ base, token: 't', creds, biometric: true, familySlug: 'smith', verified: true }, d))
    .toEqual({ kind: 'saved', toast: 'Saved - Smith is on this phone now.' })
})
