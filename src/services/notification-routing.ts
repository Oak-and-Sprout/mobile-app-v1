import type { ServerEntry } from './server-registry'

/**
 * Mirrors sprout-track/src/lib/notifications/routes.ts (NOTIFICATION_ROUTES) —
 * keep both lists identical. The route is concatenated into the URL that
 * carries the session token in its #bridge-session= fragment, so an
 * unvalidated value is a token-redirection primitive. Always resolve
 * through safeRoute - never use a payload value directly.
 */
export const NOTIFICATION_ROUTES = ['log-entry', 'medicine', 'calendar'] as const

export function safeRoute(value: unknown): string {
  return typeof value === 'string' && (NOTIFICATION_ROUTES as readonly string[]).includes(value)
    ? value
    : 'log-entry'
}

export function entryForNotification(
  data: unknown,
  servers: ServerEntry[],
): { entry: ServerEntry; route: string } | null {
  if (typeof data !== 'object' || data === null) return null
  const { familySlug, route } = data as { familySlug?: unknown; route?: unknown }
  if (typeof familySlug !== 'string') return null
  const entry = servers.find(s => s.familySlug === familySlug)
  return entry ? { entry, route: safeRoute(route) } : null
}
