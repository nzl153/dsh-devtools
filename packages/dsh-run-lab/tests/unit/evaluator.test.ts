import { describe, it, expect } from 'vitest'
import { parseJunit, summarizeEvaluator, parseEvaluatorConfig, parseRegexAssertions } from '../../src/core/evaluator.ts'

describe('evaluator parsing', () => {
  it('parses junit summary', () => {
    const xml = `<testsuite name="demo" tests="6" failures="2" errors="1" skipped="1">...</testsuite>`
    const j = parseJunit(xml)
    expect(j).not.toBeNull()
    expect(j!.tests).toBe(6)
    expect(j!.failures).toBe(2)
    expect(j!.errors).toBe(1)
    expect(j!.skipped).toBe(1)
    expect(j!.passed).toBe(false)
  })

  it('parses junit with fallback testcase count', () => {
    const xml = `<testsuite name="x"><testcase/><testcase/><testcase/></testsuite>`
    const j = parseJunit(xml)
    expect(j!.tests).toBe(3)
    expect(j!.passed).toBe(true)
  })

  it('regex assertions match output', () => {
    const res = parseRegexAssertions(['passed', 'ok'], 'all tests passed: ok')
    expect(res.map((r) => r.matched)).toEqual([true, true])
  })

  it('summarizeEvaluator requires all checks', () => {
    const r = summarizeEvaluator(
      {
        command: 'x',
        expectExitCode: 0,
        regexAssertions: ['pass'],
        expectFileExists: ['out.txt'],
      },
      0,
      'all pass',
      null,
      [{ path: 'out.txt', exists: true }],
    )
    expect(r.passed).toBe(true)
    expect(r.expectExitCodeOk).toBe(true)

    const r2 = summarizeEvaluator(
      { command: 'x', expectExitCode: 0 },
      1,
      '',
      null,
      [],
    )
    expect(r2.passed).toBe(false)
    expect(r2.expectExitCodeOk).toBe(false)
  })

  it('parseEvaluatorConfig tolerates bad input', () => {
    expect(parseEvaluatorConfig(null).command).toBe('')
    expect(parseEvaluatorConfig('nope').command).toBe('')
    expect(parseEvaluatorConfig({ command: 'npm test', expectFileExists: ['a', 1] }).expectFileExists).toEqual(['a'])
  })
})
