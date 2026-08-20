/**
 * 客观指标：构造空指标、累加进程指标、A/B 对比汇总。
 * 纯函数，可单测。
 */
import type { Comparison, Metrics } from './types.ts'

export function emptyMetrics(): Metrics {
  return {
    success: false,
    wallTimeMs: null,
    turns: null,
    llmCalls: null,
    toolCalls: null,
    inputTokens: null,
    outputTokens: null,
    filesChanged: null,
    diffSize: null,
    testsPassed: null,
    testsFailed: null,
    testsSkipped: null,
    errors: 0,
    retries: null,
    compactionCount: null,
  }
}

/** 从文本中尽可能提取结构化号码（turns/llm calls/tool calls/tokens 等）。 */
export function extractNumber(text: string, pattern: RegExp): number | null {
  const m = text.match(pattern)
  if (!m || m[1] === undefined) return null
  const n = Number(m[1].replace(/[,_]/g, ''))
  return Number.isFinite(n) ? n : null
}

/** 结合 evaluator：若 evaluator 解析出 tests，则回填 testsPassed/Failed/Skipped。 */
export function mergeEvaluatorMetrics(base: Metrics, evalResult: {
  exitCode: number | null
  junit: { tests: number; failures: number; errors: number; skipped: number } | null
}): Metrics {
  const next = { ...base }
  if (evalResult.exitCode !== null) {
    next.success = next.success && evalResult.exitCode === 0
  }
  if (evalResult.junit) {
    next.testsPassed = evalResult.junit.tests
    next.testsFailed = evalResult.junit.failures + evalResult.junit.errors
    next.testsSkipped = evalResult.junit.skipped
    // JUnit 有解析结果时，成功与否以 JUnit 为准（tests>0 且无失败错误）。
    next.success = next.success && evalResult.junit.tests > 0
      && evalResult.junit.failures === 0 && evalResult.junit.errors === 0
  }
  return next
}

/** 对两个分支结果做逐指标对比，判定 winner。 */
export function compare(a: Metrics, b: Metrics, aStatus = 'completed', bStatus = 'completed'): Comparison {
  const metricKeys: { key: keyof Metrics; betterWhen: 'low' | 'high' }[] = [
    { key: 'wallTimeMs', betterWhen: 'low' },
    { key: 'turns', betterWhen: 'low' },
    { key: 'llmCalls', betterWhen: 'low' },
    { key: 'toolCalls', betterWhen: 'low' },
    { key: 'inputTokens', betterWhen: 'low' },
    { key: 'outputTokens', betterWhen: 'low' },
    { key: 'filesChanged', betterWhen: 'low' },
    { key: 'diffSize', betterWhen: 'low' },
    { key: 'testsPassed', betterWhen: 'high' },
    { key: 'errors', betterWhen: 'low' },
    { key: 'retries', betterWhen: 'low' },
    { key: 'compactionCount', betterWhen: 'low' },
  ]
  const metrics: Comparison['metrics'] = {}
  let aScore = 0
  let bScore = 0
  let compared = 0
  for (const { key, betterWhen } of metricKeys) {
    const av = a[key] as number | null
    const bv = b[key] as number | null
    if (av === null || bv === null) {
      metrics[key] = { a: av, b: bv, better: 'na' }
      continue
    }
    const tie = av === bv
    const aBetter = betterWhen === 'low' ? av < bv : av > bv
    const better: 'a' | 'b' | 'tie' = tie ? 'tie' : aBetter ? 'a' : 'b'
    metrics[key] = { a: av, b: bv, better }
    if (!tie) {
      compared++
      if (better === 'a') aScore++
      else bScore++
    }
  }

  // 成功与否单独加权（高优先级）。
  const aOk = a.success ? 1 : 0
  const bOk = b.success ? 1 : 0
  if (aOk !== bOk) {
    if (aOk > bOk) aScore += 3
    else bScore += 3
  }

  let winner: Comparison['winner']
  if (aScore === bScore && compared === 0 && aOk === bOk) winner = 'tie'
  else if (aScore === bScore) winner = 'tie'
  else winner = aScore > bScore ? 'a' : 'b'
  if (aStatus !== 'completed' || bStatus !== 'completed') winner = 'incomplete'

  return { winner, metrics }
}

/** 判定一个分支的最终 success（结合进程退出码 + evaluator 结果）。 */
export function branchSuccess(exitCode: number | null, evaluatorPassed: boolean | null): boolean {
  if (evaluatorPassed !== null) return evaluatorPassed
  return exitCode === 0
}
