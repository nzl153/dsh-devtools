/**
 * Pure turn-to-turn diff helpers.
 * Given two history points it produces the per-category deltas and a short
 * "major growth" summary for the UI.
 */
import type { CategoryMetric, TurnPoint } from '../types.ts'

export interface CategoryDelta {
  readonly key: string
  readonly label: string
  readonly tokens: number
  readonly delta: number
  /** Locale key for a short human explanation of what the category measures. */
  readonly explanationKey: string
}

export interface TurnDiff {
  readonly deltas: readonly CategoryDelta[]
  readonly totalDelta: number
  readonly majorGain: readonly string[]
}

const CATEGORY_EXPLANATION_KEYS: Readonly<Record<string, string>> = {
  system: 'delta.system',
  conversation: 'delta.conversation',
  tools: 'delta.tools',
  skills: 'delta.skills',
  memory: 'delta.memory',
  workspace: 'delta.workspace',
  attachments: 'delta.attachments',
  other: 'delta.other',
}

export function explanationKeyForCategory(key: string): string {
  return CATEGORY_EXPLANATION_KEYS[key] ?? 'delta.other'
}

export function categoryMap(entries: readonly CategoryMetric[]): ReadonlyMap<string, CategoryMetric> {
  return new Map(entries.map((entry) => [entry.key, entry]))
}

export function diffTurns(prev: TurnPoint | undefined, next: TurnPoint): TurnDiff {
  const prevMap = categoryMap(prev?.categories ?? [])
  const deltas = next.categories.map((entry) => {
    const prevTokens = prevMap.get(entry.key)?.tokens ?? 0
    return {
      key: entry.key,
      label: entry.label,
      tokens: entry.tokens,
      delta: entry.tokens - prevTokens,
      explanationKey: explanationKeyForCategory(entry.key),
    } satisfies CategoryDelta
  })

  const totalDelta = deltas.reduce((sum, d) => sum + d.delta, 0)

  const majorGain = deltas
    .filter((d) => d.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3)
    .map((d) => `${d.delta >= 1000 ? `${(d.delta / 1000).toFixed(1)}k` : d.delta} ${d.label.toLowerCase()}`)

  return { deltas, totalDelta, majorGain }
}

export function formatTokens(value: number): string {
  if (value >= 1000) {
    const scaled = value / 1000
    return `${Number.isInteger(scaled) ? Math.round(scaled) : scaled.toFixed(1)}k`
  }
  return String(value)
}

export function formatSignedTokens(value: number): string {
  if (value === 0) return '±0'
  const sign = value > 0 ? '+' : '-'
  const abs = Math.abs(value)
  return `${sign}${formatTokens(abs)}`
}