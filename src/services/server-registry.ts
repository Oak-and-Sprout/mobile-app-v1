import { Preferences } from '@capacitor/preferences'

export interface ServerEntry {
  id: string
  baseUrl: string
  familySlug: string
  familyName: string
  deploymentMode: 'saas' | 'selfhosted'
  authType: 'SYSTEM' | 'CARETAKER' | 'ACCOUNT'
  lastUsedAt: string | null
  isDefault: boolean
}

const KEY = 'server-registry'

async function readAll(): Promise<ServerEntry[]> {
  const { value } = await Preferences.get({ key: KEY })
  if (!value) return []
  try {
    return JSON.parse(value) as ServerEntry[]
  } catch {
    return []
  }
}

async function writeAll(entries: ServerEntry[]): Promise<void> {
  await Preferences.set({ key: KEY, value: JSON.stringify(entries) })
}

export async function listServers(): Promise<ServerEntry[]> {
  const entries = await readAll()
  return entries.sort((a, b) => {
    if (a.lastUsedAt === b.lastUsedAt) return 0
    if (a.lastUsedAt === null) return 1
    if (b.lastUsedAt === null) return -1
    return b.lastUsedAt.localeCompare(a.lastUsedAt)
  })
}

export async function saveServer(
  entry: Omit<ServerEntry, 'id' | 'lastUsedAt' | 'isDefault'>,
): Promise<ServerEntry> {
  const entries = await readAll()
  const existing = entries.find(e => e.baseUrl === entry.baseUrl && e.familySlug === entry.familySlug)
  if (existing) {
    Object.assign(existing, entry)
    await writeAll(entries)
    return existing
  }
  const created: ServerEntry = {
    ...entry,
    id: crypto.randomUUID(),
    lastUsedAt: null,
    isDefault: entries.length === 0,
  }
  entries.push(created)
  await writeAll(entries)
  return created
}

export async function removeServer(id: string): Promise<void> {
  const entries = (await readAll()).filter(e => e.id !== id)
  // If entries remain and none is default, promote the most-recently-used
  if (entries.length > 0 && !entries.some(e => e.isDefault)) {
    // Sort to find the most-recently-used (first in sort order)
    const sorted = entries.sort((a, b) => {
      if (a.lastUsedAt === b.lastUsedAt) return 0
      if (a.lastUsedAt === null) return 1
      if (b.lastUsedAt === null) return -1
      return b.lastUsedAt.localeCompare(a.lastUsedAt)
    })
    sorted[0].isDefault = true
  }
  await writeAll(entries)
}

export async function setDefaultServer(id: string): Promise<void> {
  const entries = await readAll()
  // Only proceed if the id exists in the entries
  if (entries.some(e => e.id === id)) {
    for (const e of entries) e.isDefault = e.id === id
    await writeAll(entries)
  }
}

export async function getDefaultServer(): Promise<ServerEntry | null> {
  return (await readAll()).find(e => e.isDefault) ?? null
}

export async function touchServer(id: string): Promise<void> {
  const entries = await readAll()
  const entry = entries.find(e => e.id === id)
  if (entry) {
    entry.lastUsedAt = new Date().toISOString()
    await writeAll(entries)
  }
}
