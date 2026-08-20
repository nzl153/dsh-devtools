/** Small pure formatting helpers shared by the client UI (and unit tests). */

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${Math.round(seconds * 10) / 10}s`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`
}

export function formatTokens(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${Math.round(n / 100) / 10}k`
  return `${Math.round(n / 100_000) / 10}M`
}

export function formatClock(epochMs: number): string {
  if (!epochMs) return '—'
  const date = new Date(epochMs)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function plural(n: number, singular: string, pluralWord?: string): string {
  return `${n} ${n === 1 ? singular : (pluralWord ?? singular + 's')}`
}