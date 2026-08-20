/**
 * Token aggregation from session events.
 *
 * The core reads provider-reported `TokenUsage` from `assistant/message`
 * events (exact when present) and accepts an optional host-supplied
 * `contextPressure` + `contextWindow` (from the official token-meter
 * projection) so it never guesses token counts.
 */

import type { DebriefEvent, TokenTotals } from './types.ts'

const EMPTY: TokenTotals = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  totalTokens: 0,
  contextPressure: null,
  contextWindow: null,
  usageReports: 0,
  precision: 'unavailable',
}

function usageFromData(data: Record<string, unknown>): {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
} | null {
  const usage = data.usage
  if (typeof usage !== 'object' || usage === null) return null
  const u = usage as Record<string, unknown>
  const input = typeof u.inputTokens === 'number' ? u.inputTokens : 0
  const output = typeof u.outputTokens === 'number' ? u.outputTokens : 0
  if (input === 0 && output === 0 && u.cacheReadTokens === undefined && u.cacheWriteTokens === undefined) {
    return null
  }
  return {
    input,
    output,
    cacheRead: typeof u.cacheReadTokens === 'number' ? u.cacheReadTokens : 0,
    cacheWrite: typeof u.cacheWriteTokens === 'number' ? u.cacheWriteTokens : 0,
  }
}

export interface TokenInput {
  /** Provider-reported projected/context pressure, when the host can supply it. */
  contextPressure?: number | null
  contextWindow?: number | null
}

/**
 * Aggregate tokens across a set of events (optionally filtered to a turn).
 * Returns null when no provider usage was observed.
 */
export function aggregateTokens(
  events: readonly DebriefEvent[],
  input?: TokenInput,
): TokenTotals {
  let inputTokens = 0
  let outputTokens = 0
  let cacheReadTokens = 0
  let cacheWriteTokens = 0
  let usageReports = 0

  for (const event of events) {
    if (event.type !== 'assistant/message') continue
    const usage = usageFromData(event.data)
    if (!usage) continue
    inputTokens += usage.input
    outputTokens += usage.output
    cacheReadTokens += usage.cacheRead
    cacheWriteTokens += usage.cacheWrite
    usageReports += 1
  }

  const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens
  const precision = usageReports > 0 ? 'exact' : 'unavailable'
  return {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    totalTokens,
    contextPressure: input?.contextPressure ?? null,
    contextWindow: input?.contextWindow ?? null,
    usageReports,
    precision,
  }
}

/** Sum two TokenTotals (context pressure/window are last-wins). */
export function mergeTokenTotals(a: TokenTotals, b: TokenTotals): TokenTotals {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    contextPressure: b.contextPressure ?? a.contextPressure,
    contextWindow: b.contextWindow ?? a.contextWindow,
    usageReports: a.usageReports + b.usageReports,
    precision: a.usageReports + b.usageReports > 0 ? 'exact' : 'unavailable',
  }
}

export function emptyTokens(): TokenTotals {
  return { ...EMPTY }
}