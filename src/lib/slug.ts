export const RESERVED_URLS = ['account','api','coming-soon','family-manager','family-select','setup','sphome','login','auth','context','globals','layout','metadata','page','template','features','home','pricing','privacy','terms','health','logs','maintenance','status','update','uptime','version'] as const

export function slugify(s: string): string {
  return s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function validateSlug(slug: string): { ok: true } | { ok: false; error: string } {
  if (!slug.trim()) return { ok: false, error: 'Your family needs a link - type one or tap the suggest button.' }
  if (!/^[a-z0-9-]+$/.test(slug)) return { ok: false, error: 'Links can only use lowercase letters, numbers, and hyphens.' }
  if (slug.length < 3) return { ok: false, error: 'Links need at least 3 characters.' }
  if (slug.length > 50) return { ok: false, error: 'Links max out at 50 characters.' }
  if ((RESERVED_URLS as readonly string[]).includes(slug.toLowerCase())) {
    return { ok: false, error: `The system uses /${slug} for itself - pick something else.` }
  }
  return { ok: true }
}

export function titleFromSlug(slug: string): string {
  return slug.split(/[-_]/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

export const digitsOnly = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max)
