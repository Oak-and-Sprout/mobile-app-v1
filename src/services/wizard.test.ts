import { expect, test, vi } from 'vitest'
import {
  checkSlugAvailability,
  suggestSlug,
  createFamily,
  saveSecurity,
  saveBaby,
  linkAccountToCaretaker,
  finishWizard,
  FEED_TYPE_OPTIONS,
  WizardError,
  type BabyConfig,
} from './wizard'

const BASE = 'https://x.com'

function ok(data?: unknown) {
  return { status: 200, body: { success: true, ...(data !== undefined ? { data } : {}) } }
}
function fail(status: number, error?: string) {
  return { status, body: { success: false, ...(error !== undefined ? { error } : {}) } }
}

// --- checkSlugAvailability ---------------------------------------------

test('checkSlugAvailability: 200 + success:true means the slug is taken', async () => {
  const get = vi.fn().mockResolvedValue(ok({ id: 'f1' }))
  const result = await checkSlugAvailability(BASE, 'smith', get)
  expect(result).toBe('taken')
  expect(get).toHaveBeenCalledWith('https://x.com/api/family/by-slug/smith')
})

test('checkSlugAvailability: 200 + success:false means the slug is free', async () => {
  const get = vi.fn().mockResolvedValue(fail(200))
  const result = await checkSlugAvailability(BASE, 'smith', get)
  expect(result).toBe('free')
})

test('checkSlugAvailability: 400 means invalid', async () => {
  const get = vi.fn().mockResolvedValue(fail(400))
  const result = await checkSlugAvailability(BASE, '!!', get)
  expect(result).toBe('invalid')
})

test('checkSlugAvailability: thrown network error becomes WizardError(unreachable)', async () => {
  const get = vi.fn().mockRejectedValue(new TypeError('net'))
  await expect(checkSlugAvailability(BASE, 'smith', get)).rejects.toThrow(WizardError)
  await expect(checkSlugAvailability(BASE, 'smith', get)).rejects.toMatchObject({ kind: 'unreachable' })
})

test('checkSlugAvailability: an unexpected status (e.g. 503) is unreachable, not free', async () => {
  const get = vi.fn().mockResolvedValue(fail(503))
  await expect(checkSlugAvailability(BASE, 'smith', get)).rejects.toMatchObject({ kind: 'unreachable' })
})

// --- suggestSlug ---------------------------------------------------------

test('suggestSlug returns data.slug on success', async () => {
  const get = vi.fn().mockResolvedValue(ok({ slug: 'smith-family-42' }))
  const result = await suggestSlug(BASE, get)
  expect(result).toBe('smith-family-42')
  expect(get).toHaveBeenCalledWith('https://x.com/api/family/generate-slug')
})

test('suggestSlug returns null on any failure', async () => {
  expect(await suggestSlug(BASE, vi.fn().mockResolvedValue(fail(500)))).toBeNull()
  expect(await suggestSlug(BASE, vi.fn().mockRejectedValue(new Error('net')))).toBeNull()
  expect(await suggestSlug(BASE, vi.fn().mockResolvedValue(ok({})))).toBeNull()
})

// --- createFamily ---------------------------------------------------------

test('createFamily happy path posts name/slug with token and returns familyId', async () => {
  const post = vi.fn().mockResolvedValue(ok({ id: 'fam-1' }))
  const result = await createFamily(BASE, 'jwt-1', { name: 'Smith Family', slug: 'smith' }, post)
  expect(result).toEqual({ familyId: 'fam-1' })
  expect(post).toHaveBeenCalledWith('https://x.com/api/setup/start', { name: 'Smith Family', slug: 'smith' }, { token: 'jwt-1' })
})

test('createFamily maps HTTP 409 to WizardError(slug-taken)', async () => {
  const post = vi.fn().mockResolvedValue({ status: 409, body: { success: false } })
  await expect(createFamily(BASE, 'jwt-1', { name: 'Smith', slug: 'smith' }, post)).rejects.toMatchObject({ kind: 'slug-taken' })
})

test('createFamily maps envelope failure to WizardError(rejected, error) and network throw to unreachable', async () => {
  const post = vi.fn().mockResolvedValue(fail(400, 'Bad request'))
  await expect(createFamily(BASE, 'jwt-1', { name: 'Smith', slug: 'smith' }, post)).rejects.toMatchObject({ kind: 'rejected', message: 'Bad request' })
  const postErr = vi.fn().mockRejectedValue(new TypeError('net'))
  await expect(createFamily(BASE, 'jwt-1', { name: 'Smith', slug: 'smith' }, postErr)).rejects.toMatchObject({ kind: 'unreachable' })
})

// --- saveSecurity ----------------------------------------------------------

test('saveSecurity pin mode: exact URL/body/order — PUT settings then PUT update-setup-stage', async () => {
  const calls: Array<{ method: string; url: string; body: unknown }> = []
  const put = vi.fn(async (url: string, body: unknown) => {
    calls.push({ method: 'PUT', url, body })
    return ok()
  })
  const post = vi.fn(async (url: string, body: unknown) => {
    calls.push({ method: 'POST', url, body })
    return ok()
  })

  await saveSecurity(BASE, 'jwt-1', 'fam-1', { mode: 'pin', securityPin: '445566' }, { post, put })

  expect(post).not.toHaveBeenCalled()
  expect(calls).toEqual([
    { method: 'PUT', url: 'https://x.com/api/settings?familyId=fam-1', body: { securityPin: '445566', authType: 'SYSTEM' } },
    { method: 'PUT', url: 'https://x.com/api/family/update-setup-stage', body: { setupStage: 2, familyId: 'fam-1' } },
  ])
  // token propagated to every call
  expect(put).toHaveBeenNthCalledWith(1, 'https://x.com/api/settings?familyId=fam-1', { securityPin: '445566', authType: 'SYSTEM' }, { token: 'jwt-1' })
  expect(put).toHaveBeenNthCalledWith(2, 'https://x.com/api/family/update-setup-stage', { setupStage: 2, familyId: 'fam-1' }, { token: 'jwt-1' })
})

test('saveSecurity caretakers mode with 2 caretakers: exact URL/body/order', async () => {
  const calls: Array<{ method: string; url: string; body: unknown }> = []
  const put = vi.fn(async (url: string, body: unknown) => {
    calls.push({ method: 'PUT', url, body })
    return ok()
  })
  const post = vi.fn(async (url: string, body: unknown) => {
    calls.push({ method: 'POST', url, body })
    return ok()
  })

  const caretakers = [
    { loginId: '01', name: 'Alice', type: 'Parent', role: 'ADMIN' as const, securityPin: '1111' },
    { loginId: '02', name: 'Bob', type: 'Parent', role: 'USER' as const, securityPin: '2222' },
  ]
  await saveSecurity(BASE, 'jwt-1', 'fam-1', { mode: 'caretakers', caretakers }, { post, put })

  expect(calls).toEqual([
    { method: 'POST', url: 'https://x.com/api/caretaker?familyId=fam-1', body: { loginId: '01', name: 'Alice', type: 'Parent', role: 'ADMIN', securityPin: '1111', familyId: 'fam-1' } },
    { method: 'POST', url: 'https://x.com/api/caretaker?familyId=fam-1', body: { loginId: '02', name: 'Bob', type: 'Parent', role: 'USER', securityPin: '2222', familyId: 'fam-1' } },
    { method: 'PUT', url: 'https://x.com/api/settings?familyId=fam-1', body: { authType: 'CARETAKER' } },
    { method: 'PUT', url: 'https://x.com/api/family/update-setup-stage', body: { setupStage: 2, familyId: 'fam-1' } },
  ])
  // token propagated to every call
  expect(post).toHaveBeenNthCalledWith(1, 'https://x.com/api/caretaker?familyId=fam-1',
    { loginId: '01', name: 'Alice', type: 'Parent', role: 'ADMIN', securityPin: '1111', familyId: 'fam-1' }, { token: 'jwt-1' })
  expect(post).toHaveBeenNthCalledWith(2, 'https://x.com/api/caretaker?familyId=fam-1',
    { loginId: '02', name: 'Bob', type: 'Parent', role: 'USER', securityPin: '2222', familyId: 'fam-1' }, { token: 'jwt-1' })
  expect(put).toHaveBeenNthCalledWith(1, 'https://x.com/api/settings?familyId=fam-1', { authType: 'CARETAKER' }, { token: 'jwt-1' })
  expect(put).toHaveBeenNthCalledWith(2, 'https://x.com/api/family/update-setup-stage', { setupStage: 2, familyId: 'fam-1' }, { token: 'jwt-1' })
})

test('saveSecurity caretakers mode: a mid-loop failure after some caretakers were created throws', async () => {
  const post = vi.fn().mockResolvedValue(ok())
  const put = vi.fn().mockResolvedValue(fail(400, 'settings blew up'))
  const caretakers = [
    { loginId: '01', name: 'Alice', type: 'Parent', role: 'ADMIN' as const, securityPin: '1111' },
    { loginId: '02', name: 'Bob', type: 'Parent', role: 'USER' as const, securityPin: '2222' },
  ]
  await expect(saveSecurity(BASE, 'jwt-1', 'fam-1', { mode: 'caretakers', caretakers }, { post, put }))
    .rejects.toMatchObject({ kind: 'rejected', message: 'settings blew up' })
  expect(post).toHaveBeenCalledTimes(2)
  expect(put).toHaveBeenCalledTimes(1) // never reached update-setup-stage
})

test('saveSecurity caretakers mode: retrying after a partial failure treats "already in use" 400s as already-created and proceeds', async () => {
  const post = vi.fn().mockResolvedValue(fail(400, 'Login ID is already in use in this family'))
  const put = vi.fn().mockResolvedValue(ok())
  const caretakers = [
    { loginId: '01', name: 'Alice', type: 'Parent', role: 'ADMIN' as const, securityPin: '1111' },
    { loginId: '02', name: 'Bob', type: 'Parent', role: 'USER' as const, securityPin: '2222' },
  ]
  await saveSecurity(BASE, 'jwt-1', 'fam-1', { mode: 'caretakers', caretakers }, { post, put })
  expect(post).toHaveBeenCalledTimes(2)
  expect(put).toHaveBeenNthCalledWith(1, 'https://x.com/api/settings?familyId=fam-1', { authType: 'CARETAKER' }, { token: 'jwt-1' })
  expect(put).toHaveBeenNthCalledWith(2, 'https://x.com/api/family/update-setup-stage', { setupStage: 2, familyId: 'fam-1' }, { token: 'jwt-1' })
})

test('saveSecurity surfaces envelope rejection and network unreachable', async () => {
  const put = vi.fn().mockResolvedValue(fail(400, 'nope'))
  await expect(saveSecurity(BASE, 'jwt-1', 'fam-1', { mode: 'pin', securityPin: '1' }, { post: vi.fn(), put })).rejects.toMatchObject({ kind: 'rejected', message: 'nope' })
  const putErr = vi.fn().mockRejectedValue(new TypeError('net'))
  await expect(saveSecurity(BASE, 'jwt-1', 'fam-1', { mode: 'pin', securityPin: '1' }, { post: vi.fn(), put: putErr })).rejects.toMatchObject({ kind: 'unreachable' })
})

// --- saveBaby ----------------------------------------------------------------

function baby(overrides: Partial<BabyConfig> = {}): BabyConfig {
  return {
    firstName: 'Jo',
    lastName: 'Smith',
    birthDate: '2026-01-01',
    gender: 'FEMALE',
    feedWarningTime: '03:00',
    diaperWarningTime: '02:00',
    feedTimerFrom: 'start',
    feedTimerCategories: FEED_TYPE_OPTIONS.map(o => o.category),
    ...overrides,
  }
}

test('saveBaby posts the exact baby payload with token', async () => {
  const post = vi.fn().mockResolvedValue(ok())

  await saveBaby(BASE, 'jwt-1', 'fam-1', baby(), post)

  expect(post).toHaveBeenCalledWith('https://x.com/api/baby?familyId=fam-1', {
    firstName: 'Jo', lastName: 'Smith', birthDate: '2026-01-01', gender: 'FEMALE',
    feedWarningTime: '03:00', diaperWarningTime: '02:00', feedTimerFrom: 'start',
    feedTimerTypes: null, familyId: 'fam-1',
  }, { token: 'jwt-1' })
})

test('feedTimerTypes is null when all 5 categories selected, JSON string otherwise', async () => {
  expect(FEED_TYPE_OPTIONS.length).toBe(5)
  const post = vi.fn().mockResolvedValue(ok())

  await saveBaby(BASE, 'jwt-1', 'fam-1', baby({ feedTimerCategories: ['BREAST', 'FOOD'] }), post)
  expect(post).toHaveBeenCalledWith('https://x.com/api/baby?familyId=fam-1', expect.objectContaining({
    feedTimerTypes: JSON.stringify(['BREAST', 'FOOD']),
  }), { token: 'jwt-1' })
})

test('saveBaby surfaces envelope rejection and network unreachable', async () => {
  await expect(saveBaby(BASE, 'jwt-1', 'fam-1', baby(), vi.fn().mockResolvedValue(fail(400, 'nope'))))
    .rejects.toMatchObject({ kind: 'rejected', message: 'nope' })
  await expect(saveBaby(BASE, 'jwt-1', 'fam-1', baby(), vi.fn().mockRejectedValue(new TypeError('net'))))
    .rejects.toMatchObject({ kind: 'unreachable' })
})

// --- linkAccountToCaretaker ----------------------------------------------------

test('linkAccountToCaretaker pin mode: fetches the system caretaker, links account', async () => {
  const post = vi.fn().mockResolvedValue(ok())
  const get = vi.fn().mockResolvedValue(ok({ id: 'ct-system' }))

  await linkAccountToCaretaker(BASE, 'jwt-1', 'fam-1', 'pin', { post, get })

  expect(get).toHaveBeenCalledWith('https://x.com/api/caretaker/system?familyId=fam-1', { token: 'jwt-1' })
  expect(post).toHaveBeenCalledWith('https://x.com/api/accounts/link-caretaker', { caretakerId: 'ct-system' }, { token: 'jwt-1' })
})

test('linkAccountToCaretaker caretakers mode: skips loginId 00 and links the lowest-loginId caretaker', async () => {
  const post = vi.fn().mockResolvedValue(ok())
  const get = vi.fn().mockResolvedValue(ok([
    { id: 'ct-system', loginId: '00' },
    { id: 'ct-01', loginId: '01' },
    { id: 'ct-02', loginId: '02' },
  ]))

  await linkAccountToCaretaker(BASE, 'jwt-1', 'fam-1', 'caretakers', { post, get })

  expect(get).toHaveBeenCalledWith('https://x.com/api/caretaker?familyId=fam-1', { token: 'jwt-1' })
  expect(get).toHaveBeenCalledTimes(1) // a real caretaker was found - no system-caretaker fallback needed
  expect(post).toHaveBeenCalledWith('https://x.com/api/accounts/link-caretaker', { caretakerId: 'ct-01' }, { token: 'jwt-1' })
})

test('linkAccountToCaretaker caretakers mode: the endpoint orders by name, so it picks the lowest loginId, not the first entry', async () => {
  const post = vi.fn().mockResolvedValue(ok())
  const get = vi.fn().mockResolvedValue(ok([
    { loginId: '02', name: 'Betty', id: 'c2' },
    { loginId: '01', name: 'Rachael', id: 'c1' },
  ]))

  await linkAccountToCaretaker(BASE, 'jwt-1', 'fam-1', 'caretakers', { post, get })

  expect(get).toHaveBeenCalledWith('https://x.com/api/caretaker?familyId=fam-1', { token: 'jwt-1' })
  expect(post).toHaveBeenCalledWith('https://x.com/api/accounts/link-caretaker', { caretakerId: 'c1' }, { token: 'jwt-1' })
})

test('linkAccountToCaretaker caretakers mode with only the "00" caretaker falls back to the system caretaker', async () => {
  // Covers a wizard resumed at stage 3 with a mis-guessed mode: a pin-mode family's caretaker
  // list has nothing but the reserved system entry, so this must not throw - it should recover
  // via GET /api/caretaker/system, same as pin mode would have used directly.
  const post = vi.fn().mockResolvedValue(ok())
  const get = vi.fn()
    .mockResolvedValueOnce(ok([{ id: 'ct-system', loginId: '00' }]))
    .mockResolvedValueOnce(ok({ id: 'ct-system' }))

  await linkAccountToCaretaker(BASE, 'jwt-1', 'fam-1', 'caretakers', { post, get })

  expect(get).toHaveBeenNthCalledWith(1, 'https://x.com/api/caretaker?familyId=fam-1', { token: 'jwt-1' })
  expect(get).toHaveBeenNthCalledWith(2, 'https://x.com/api/caretaker/system?familyId=fam-1', { token: 'jwt-1' })
  expect(post).toHaveBeenCalledWith('https://x.com/api/accounts/link-caretaker', { caretakerId: 'ct-system' }, { token: 'jwt-1' })
})

test('linkAccountToCaretaker throws WizardError(rejected) when neither the list nor the fallback yields an id', async () => {
  const post = vi.fn()
  const get = vi.fn()
    .mockResolvedValueOnce(ok([{ id: 'ct-system', loginId: '00' }]))
    .mockResolvedValueOnce(ok({})) // fallback succeeds but carries no id
  await expect(linkAccountToCaretaker(BASE, 'jwt-1', 'fam-1', 'caretakers', { post, get })).rejects.toMatchObject({ kind: 'rejected' })
  expect(post).not.toHaveBeenCalled()
})

test('linkAccountToCaretaker treats a link-POST failure as WizardError(rejected)', async () => {
  const post = vi.fn().mockResolvedValue(fail(400, 'link failed'))
  const get = vi.fn().mockResolvedValue(ok({ id: 'ct-system' }))
  await expect(linkAccountToCaretaker(BASE, 'jwt-1', 'fam-1', 'pin', { post, get })).rejects.toMatchObject({ kind: 'rejected' })
})

// --- finishWizard ------------------------------------------------------------

test('finishWizard happy path logs in, saves server, stores creds, returns toast', async () => {
  const creds = { type: 'account' as const, email: 'a@b.com', password: 'pw' }
  const login = vi.fn().mockResolvedValue({ ok: true, token: 'jwt-x', familySlug: 'smith-family' })
  const saveServer = vi.fn().mockResolvedValue({ id: 'srv-9', baseUrl: BASE, familySlug: 'smith-family', familyName: 'Smith Family', deploymentMode: 'saas', authType: 'ACCOUNT', lastUsedAt: null, isDefault: true })
  const store = vi.fn().mockResolvedValue(undefined)

  const result = await finishWizard(BASE, creds, 'Smith Family', true, { login, saveServer, vault: { store } })

  expect(login).toHaveBeenCalledWith({ id: 'https://x.com|account', baseUrl: BASE, familySlug: '' }, creds)
  expect(saveServer).toHaveBeenCalledWith({ baseUrl: BASE, familySlug: 'smith-family', familyName: 'Smith Family', deploymentMode: 'saas', authType: 'ACCOUNT' })
  expect(store).toHaveBeenCalledWith('srv-9', creds, { biometric: true })
  expect(result).toEqual({ toast: 'Welcome home - Smith Family is set up and saved to this phone.' })
})

test('finishWizard: login failure throws WizardError(rejected)', async () => {
  const creds = { type: 'account' as const, email: 'a@b.com', password: 'pw' }
  const login = vi.fn().mockResolvedValue({ ok: false, error: 'invalid' })
  const saveServer = vi.fn()
  const store = vi.fn()

  await expect(finishWizard(BASE, creds, 'Smith Family', false, { login, saveServer, vault: { store } }))
    .rejects.toMatchObject({ kind: 'rejected' })
  expect(saveServer).not.toHaveBeenCalled()
  expect(store).not.toHaveBeenCalled()
})

test('finishWizard: ok but missing familySlug throws WizardError(rejected)', async () => {
  const creds = { type: 'account' as const, email: 'a@b.com', password: 'pw' }
  const login = vi.fn().mockResolvedValue({ ok: true, token: 'jwt-x', familySlug: '' })
  const saveServer = vi.fn()
  const store = vi.fn()

  await expect(finishWizard(BASE, creds, 'Smith Family', false, { login, saveServer, vault: { store } }))
    .rejects.toMatchObject({ kind: 'rejected' })
  expect(saveServer).not.toHaveBeenCalled()
})
