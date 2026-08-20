/**
 * Evaluator：配置解析 + 结果解析。
 * 纯函数，可单测。JUnit 用轻量正则/字符串提取（不引额外依赖，避免 C 扩展）。
 */
import type { EvaluatorConfig, EvaluatorResult, FileExistsResult, JunitSummary, RegexAssertionResult } from './types.ts'

/** 解析 EvaluatorConfig（容错：未知字段忽略，类型不对则取默认）。 */
export function parseEvaluatorConfig(input: unknown): EvaluatorConfig {
  if (input === null || input === undefined || typeof input !== 'object') return { command: '' }
  const o = input as Record<string, unknown>
  return {
    command: typeof o['command'] === 'string' ? o['command'] : '',
    expectExitCode: o['expectExitCode'] === undefined || o['expectExitCode'] === null
      ? null
      : typeof o['expectExitCode'] === 'number' ? o['expectExitCode'] : null,
    expectFileExists: Array.isArray(o['expectFileExists'])
      ? o['expectFileExists'].filter((v) => typeof v === 'string')
      : undefined,
    junitFile: typeof o['junitFile'] === 'string' ? o['junitFile'] : undefined,
    regexAssertions: Array.isArray(o['regexAssertions'])
      ? o['regexAssertions'].filter((v) => typeof v === 'string')
      : undefined,
    junitRoot: typeof o['junitRoot'] === 'string' ? o['junitRoot'] : undefined,
  }
}

/** 解析 JUnit XML 字符串 -> 汇总（tests/failures/errors/skipped）。 */
export function parseJunit(xml: string): JunitSummary | null {
  // 兼容 <testsuite ... tests="N" failures="N" errors="N" skipped="N"> 自闭合或块。
  const suiteMatch = xml.match(/<testsuite\b[^>]*>/i)
  if (!suiteMatch) return null
  const attrs = suiteMatch[0]
  const num = (name: string): number => {
    const m = attrs.match(new RegExp(`${name}\\s*=\\s*["']([0-9]+)["']`, 'i'))
    return m ? Number(m[1]) : 0
  }
  // 若 testsuite 缺少 tests 属性，回退统计 <testcase> 数量。
  const testsRaw = num('tests')
  const tests = testsRaw > 0 ? testsRaw : (xml.match(/<testcase\b/g) ?? []).length
  const failures = num('failures')
  const errors = num('errors')
  const skipped = num('skipped')
  const passed = tests > 0 && failures === 0 && errors === 0
  return { tests, failures, errors, skipped, passed }
}

/** 未配置 evaluator 时，只基于退出码得到的基础结果。 */
export function emptyEvaluatorResult(exitCode: number | null): EvaluatorResult {
  return {
    passed: exitCode === 0,
    exitCode,
    expectExitCodeOk: null,
    junit: null,
    regexAssertions: [],
    fileExists: [],
  }
}

/** 汇总 evaluator 判定：exit code + junit + regex + file exists 全通过才算 passed。 */
export function summarizeEvaluator(
  config: EvaluatorConfig,
  exitCode: number | null,
  output: string,
  junitXml: string | null,
  fileChecks: FileExistsResult[],
): EvaluatorResult {
  // 未配置 expectExitCode 时，默认要求退出码为 0。
  const expectExitCodeOk = config.expectExitCode === undefined || config.expectExitCode === null
    ? exitCode === 0
    : exitCode === config.expectExitCode

  const junit = junitXml ? parseJunit(junitXml) : null

  const regexAssertions: RegexAssertionResult[] = (config.regexAssertions ?? []).map((pattern) => {
    let matched = false
    try {
      matched = new RegExp(pattern).test(output)
    } catch {
      matched = false
    }
    return { pattern, matched }
  })

  let passed = true
  passed = passed && expectExitCodeOk
  if (junit) passed = passed && junit.passed
  if (regexAssertions.length > 0) passed = passed && regexAssertions.every((r) => r.matched)
  if (fileChecks.length > 0) passed = passed && fileChecks.every((f) => f.exists)

  return {
    passed,
    exitCode,
    expectExitCodeOk,
    junit,
    regexAssertions,
    fileExists: fileChecks,
  }
}

/** 解析 regexAssertions / junit 配置的纯函数入口（供单测）。 */
export function parseRegexAssertions(patterns: string[], output: string): RegexAssertionResult[] {
  return patterns.map((pattern) => {
    let matched = false
    try {
      matched = new RegExp(pattern).test(output)
    } catch {
      matched = false
    }
    return { pattern, matched }
  })
}
