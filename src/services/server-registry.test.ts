import { beforeEach, expect, test } from 'vitest'
import {
  getDefaultServer, listServers, removeServer, saveServer, setDefaultServer, touchServer,
} from './server-registry'

const smith = {
  baseUrl: 'https://myhost.com', familySlug: 'smith-family', familyName: 'Smith Family',
  deploymentMode: 'selfhosted' as const, authType: 'CARETAKER' as const,
}

beforeEach(() => localStorage.clear())

test('saves and lists a server; first entry becomes default', async () => {
  const saved = await saveServer(smith)
  expect(saved.id).toBeTruthy()
  expect(saved.isDefault).toBe(true)
  expect(await listServers()).toHaveLength(1)
})

test('upserts by baseUrl + slug instead of duplicating', async () => {
  await saveServer(smith)
  await saveServer({ ...smith, familyName: 'Smith Family Renamed' })
  const servers = await listServers()
  expect(servers).toHaveLength(1)
  expect(servers[0].familyName).toBe('Smith Family Renamed')
})

test('setDefaultServer keeps exactly one default', async () => {
  const a = await saveServer(smith)
  const b = await saveServer({ ...smith, familySlug: 'jones-family', familyName: 'Jones' })
  await setDefaultServer(b.id)
  const servers = await listServers()
  expect(servers.filter(s => s.isDefault).map(s => s.id)).toEqual([b.id])
  expect((await getDefaultServer())?.id).toBe(b.id)
  expect(servers.find(s => s.id === a.id)?.isDefault).toBe(false)
})

test('removeServer deletes the entry', async () => {
  const a = await saveServer(smith)
  await removeServer(a.id)
  expect(await listServers()).toHaveLength(0)
  expect(await getDefaultServer()).toBeNull()
})

test('touchServer bumps lastUsedAt and sorts most-recent first', async () => {
  await saveServer(smith)
  const b = await saveServer({ ...smith, familySlug: 'jones-family', familyName: 'Jones' })
  await touchServer(b.id)
  const servers = await listServers()
  expect(servers[0].id).toBe(b.id)
  expect(servers[0].lastUsedAt).not.toBeNull()
})

test('setDefaultServer with nonexistent id leaves default unchanged', async () => {
  const a = await saveServer(smith)
  const b = await saveServer({ ...smith, familySlug: 'jones-family', familyName: 'Jones' })
  await setDefaultServer(b.id)
  expect((await getDefaultServer())?.id).toBe(b.id)
  // Try to set a nonexistent id as default
  await setDefaultServer('nonexistent-id')
  // Should still have b as default
  expect((await getDefaultServer())?.id).toBe(b.id)
  const servers = await listServers()
  expect(servers.filter(s => s.isDefault).map(s => s.id)).toEqual([b.id])
})

test('removeServer promoting default entry promotes most-recently-used', async () => {
  const a = await saveServer(smith)
  const b = await saveServer({ ...smith, familySlug: 'jones-family', familyName: 'Jones' })
  // Set b as default
  await setDefaultServer(b.id)
  // Touch a to make it most recent
  await touchServer(a.id)
  // Remove b (the current default)
  await removeServer(b.id)
  // a should become the new default (it's the most recently used)
  expect((await getDefaultServer())?.id).toBe(a.id)
  const servers = await listServers()
  expect(servers.filter(s => s.isDefault).map(s => s.id)).toEqual([a.id])
})
