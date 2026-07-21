const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function formatLastOpened(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const dayDiff = Math.round((startOfDay(now) - startOfDay(then)) / DAY_MS)
  if (dayDiff === 0) {
    const time = then
      .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      .toLowerCase()
    return `today, ${time}`
  }
  if (dayDiff === 1) return 'yesterday'
  if (dayDiff <= 6) return then.toLocaleDateString('en-US', { weekday: 'long' })
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
