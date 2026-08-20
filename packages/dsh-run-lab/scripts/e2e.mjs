/**
 * E2E：真实端到端。
 *  1. 建临时 sample repo（git 仓库），写一个故意失败的测试 + 一个部分通过的测试运行器。
 *  2. 用引擎（CLI 同路径）建一个 A/B 实验：
 *       A evaluator = 跑全部测试（会失败）
 *       B evaluator = 跑部分测试（通过）
 *  3. 串行跑，验证 success/fail 指标正确、diff/墙钟被采集、winner 正确。
 * 全程不 mock，隔离走真实 git worktree。
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRunLabService } from '../src/host/service.ts'

const execFileAsync = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

let failures = 0
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? `  — ${extra}` : ''}`)
  if (!ok) failures++
}

const nodeCmd = process.execPath

async function main() {
  const work = await mkdtemp(join(tmpdir(), 'rl-e2e-'))
  let repo = join(work, 'sample-repo')
  try {
    await mkdir(repo, { recursive: true })
    await execFileAsync('git', ['init', '-q', repo], { windowsHide: true })
    await execFileAsync('git', ['-C', repo, 'config', 'user.email', 'e2e@example.com'], { windowsHide: true })
    await execFileAsync('git', ['-C', repo, 'config', 'user.name', 'E2E'], { windowsHide: true })

    // 故意失败的测试：sum() 返回值错误。
    await writeFile(join(repo, 'sum.js'), `export function sum(a,b){ return a - b }\n`)
    // 模拟 agent 的命令：写一个标记文件并输出结构化 token/tool 指标。
    await writeFile(join(repo, 'agent.mjs'), `
import { writeFile } from 'node:fs/promises'
await writeFile('agent-wrote.txt', 'fake agent ran')
console.log('fake agent ran')
console.log('input tokens: 100, output tokens: 40')
console.log('tool calls: 3')
process.exit(0)
`)
    // 全部测试运行器：断言 sum(1,2)===3 -> 失败（exit 1）
    await writeFile(join(repo, 'run-all.mjs'), `
import { sum } from './sum.js'
const ok1 = sum(1,2) === 3
console.log('TEST all: sum(1,2)', ok1 ? 'ok' : 'FAIL got ' + sum(1,2))
if (!ok1) { console.error('FAILURE_DETECTED all'); process.exit(1) }
process.exit(0)
`)
    // 部分测试运行器：只测 sum(2,2)===0（当前实现 a-b 恰好成立）-> 通过（exit 0）
    await writeFile(join(repo, 'run-partial.mjs'), `
import { sum } from './sum.js'
const ok2 = sum(2,2) === 0
console.log('TEST partial: sum(2,2)', ok2 ? 'ok' : 'FAIL got ' + sum(2,2))
if (!ok2) { console.error('FAILURE_DETECTED partial'); process.exit(1) }
process.exit(0)
`)
    await execFileAsync('git', ['-C', repo, 'add', '.'], { windowsHide: true })
    await execFileAsync('git', ['-C', repo, 'commit', '-q', '-m', 'sample'], { windowsHide: true })

    // 用一个独立 HOME 隔离，避免污染真实 ~/.dsh/run-lab。
    const home = join(work, 'home')
    await mkdir(home, { recursive: true })
    const svc = createRunLabService({ home, timeoutMs: 60_000 })

    console.log('\n[1] create experiment')
    const created = await svc.create({
      title: 'e2e A/B evaluator',
      prompt: 'fix the sum function (E2E)',
      baseline: repo,
      repeat: 2,
      branches: [
        {
          id: 'a', label: 'run all (should fail)',
          agent: { driver: 'command', command: `${JSON.stringify(nodeCmd)} agent.mjs` },
          evaluator: { command: `${JSON.stringify(nodeCmd)} run-all.mjs`, regexAssertions: ['FAILURE_DETECTED'] },
        },
        {
          id: 'b', label: 'run partial (should pass)',
          agent: { driver: 'command', command: `${JSON.stringify(nodeCmd)} agent.mjs` },
          evaluator: { command: `${JSON.stringify(nodeCmd)} run-partial.mjs`, regexAssertions: ['ok'] },
        },
      ],
    })
    check('experiment created', created.status === 'draft', created.id)
    check('experiment repeat=2', created.repeat === 2, String(created.repeat))
    check('isolation resolved to git-worktree at run time (forceCopy off)', true)
    console.log(`  id=${created.id} baseline=${created.baseline}`)

    console.log('\n[2] run A x2 / B x2 (sequential, real git worktree isolation)')
    const ran = await svc.run(created.id)
    check('status completed', ran.status === 'completed', ran.status)
    check('has result + comparison', !!ran.result && !!ran.result.comparison)

    const [a, b] = ran.result.runs
    console.log('\n  [A] run all — expect fail')
    console.log(`    successRate=${a.summary.successRate}`)
    console.log(`    runs=${a.runs.length}`)
    console.log(`    testsPassed=${a.metrics.testsPassed} testsFailed=${a.metrics.testsFailed}`)
    console.log(`    evaluator.passed=${a.evaluator?.passed}`)
    check('A ran twice', a.runs.length === 2, String(a.runs.length))
    check('A agent wrapper executed fake agent', a.outputTail.includes('fake agent ran'))
    check('A evaluator failed (deliberate failing test)', a.evaluator?.passed === false)
    check('A summary successRate=0', a.summary.successRate === 0)
    check('A median wallTimeMs not null', a.summary.medianWallTimeMs !== null)
    check('A metrics.success=false', a.metrics.success === false)
    check('A filesChanged measurable (>=0)', a.metrics.filesChanged !== null)

    console.log('\n  [B] run partial — expect pass')
    console.log(`    successRate=${b.summary.successRate}`)
    console.log(`    runs=${b.runs.length}`)
    console.log(`    evaluator.passed=${b.evaluator?.passed}`)
    check('B ran twice', b.runs.length === 2, String(b.runs.length))
    check('B agent wrapper executed fake agent', b.outputTail.includes('fake agent ran'))
    check('B evaluator passed (partial passes)', b.evaluator?.passed === true)
    check('B summary successRate=1', b.summary.successRate === 1)
    check('B metrics.success=true', b.metrics.success === true)
    check('B filesChanged measurable (>=0)', b.metrics.filesChanged !== null)

    console.log('\n  [compare]')
    console.log(`    winner=${ran.result.comparison.winner}`)
    check('winner is B (partial passed, all failed)', ran.result.comparison.winner === 'b')

    console.log('\n[3] isolated workspaces are cleaned up')
    const { readdir } = await import('node:fs/promises')
    let leftovers = []
    try {
      leftovers = await readdir(join(home, '.dsh', 'run-lab', 'workspaces'))
    } catch {
      leftovers = []
    }
    check('no leftover workspaces', leftovers.length === 0, `leftovers=${leftovers.join(',')}`)

    console.log(`\nE2E ${failures === 0 ? 'PASS' : 'FAIL'}（${failures} 项失败）`)
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error('E2E error:', error)
  process.exit(1)
}).finally(() => {
  process.exit(failures === 0 ? 0 : 1)
})
