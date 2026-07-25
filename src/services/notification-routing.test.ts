import { describe, it, expect } from 'vitest'
import { safeRoute, entryForNotification } from './notification-routing'

const SERVERS = [
  { id: '1', baseUrl: 'https://a.test', familySlug: 'smith', familyName: 'Smith' },
  { id: '2', baseUrl: 'https://b.test', familySlug: 'jones', familyName: 'Jones' },
] as never

describe('safeRoute', () => {
  it('passes an allow-listed route through', () => {
    expect(safeRoute('medicine')).toBe('medicine')
  })

  it('rejects an unknown route', () => {
    expect(safeRoute('evil')).toBe('log-entry')
  })

  it('rejects a traversal attempt - the route lands in a token-bearing URL', () => {
    expect(safeRoute('../../evil.test/steal')).toBe('log-entry')
    expect(safeRoute('//evil.test')).toBe('log-entry')
  })

  it('rejects non-strings', () => {
    expect(safeRoute(undefined)).toBe('log-entry')
    expect(safeRoute(42)).toBe('log-entry')
  })

  // NOTIFICATION_ROUTES is an array (Array.prototype.includes), so it doesn't
  // have the plain-object-lookup hazard that bit the server's twin module
  // (sprout-track/src/lib/notifications/routes.ts: `BY_KIND[kind]` resolved
  // through Object.prototype for keys like 'constructor', returning a truthy
  // non-string that skipped the `?? 'log-entry'` fallback). Prove it here
  // rather than assume it: every Object.prototype member name must still
  // fall back to the safe default and come back as a string.
  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'])(
    'treats the prototype key %s as an unknown route, not an escape',
    key => {
      const result = safeRoute(key)
      expect(result).toBe('log-entry')
      expect(typeof result).toBe('string')
    },
  )
})

describe('entryForNotification', () => {
  it('matches a saved server by family slug', () => {
    expect(entryForNotification({ familySlug: 'jones', route: 'medicine' }, SERVERS))
      .toEqual({ entry: SERVERS[1], route: 'medicine' })
  })

  it('returns null for an unsaved family', () => {
    expect(entryForNotification({ familySlug: 'nobody' }, SERVERS)).toBeNull()
  })

  it('defaults the route when the payload omits it', () => {
    expect(entryForNotification({ familySlug: 'smith' }, SERVERS)?.route).toBe('log-entry')
  })

  it('returns null for a malformed payload', () => {
    expect(entryForNotification(null, SERVERS)).toBeNull()
    expect(entryForNotification({}, SERVERS)).toBeNull()
  })

  it('does not let a prototype-key route escape the allow-list', () => {
    expect(entryForNotification({ familySlug: 'smith', route: '__proto__' }, SERVERS)?.route).toBe('log-entry')
    expect(entryForNotification({ familySlug: 'smith', route: 'constructor' }, SERVERS)?.route).toBe('log-entry')
  })
})
