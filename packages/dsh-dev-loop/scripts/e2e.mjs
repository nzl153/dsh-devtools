// dsh-dev-loop E2E：不启动 DSH，直接通过 core runner 执行 build/test 并验证。
// 前置：pnpm build（e2e 会检查 lib/，缺失时自动构建）。
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const libIndex = join(root, 'lib', 'index.js')

function ensureBuild() {
  if (existsSync(libIndex)) return
  console.log('lib/index.js 不存在，先构建…')
  const bin = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsdown.cmd' : 'tsdown')
  const res = spawnSync(bin, ['--config', './tsdown.config.ts'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
  if (res.status !== 0) {
    console.error('E2E 前置构建失败，请先运行 pnpm build')
    process.exit(1)
  }
}

ensureBuild()
const { CommandRunner } = await import(pathToFileURL(libIndex).href)

let failures = 0
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? `  — ${extra}` : ''}`)
  if (!ok) failures++
}

// 创建临时项目
const project = join(tmpdir(), `dsh-dev-loop-e2e-${Date.now()}`)
const dshDir = join(project, '.dsh')
mkdirSync(dshDir, { recursive: true })

writeFileSync(join(project, 'build.js'), `console.log('[build] ok, value=42');\n`, 'utf8')
writeFileSync(join(project, 'test.js'), `console.error('[test] reconstruction failed: expected 3, got 1');\nprocess.exit(1);\n`, 'utf8')

const config = `name: E2E Project
actions:
  build:
    command: node build.js
  test:
    command: node test.js
    dependsOn: [build]
`
writeFileSync(join(dshDir, 'devloop.yml'), config, 'utf8')

const logDir = join(project, '.devloop-logs')
const runner = new CommandRunner(logDir)

try {
  // build：期望成功
  const buildAction = {
    name: 'build',
    command: 'node build.js',
  }
  const buildRun = runner.run({ root: project, actionName: 'build', action: buildAction, logDir })
  await waitSettled(runner, buildRun.id)
  const buildFinal = runner.getRun(buildRun.id)

  check('build 退出码为 0', buildFinal.exitCode === 0, `exit=${buildFinal.exitCode}`)
  check('build 状态 succeeded', buildFinal.status === 'succeeded', `status=${buildFinal.status}`)
  check('build 输出包含内容', /value=42/.test(buildFinal.output ?? ''), `output=${JSON.stringify((buildFinal.output ?? '').slice(0, 60))}`)
  check('build 持续时长 > 0', (buildFinal.durationMs ?? 0) > 0, `duration=${buildFinal.durationMs}`)
  check('build 日志已落盘', existsSync(buildFinal.logFile ?? ''), `log=${buildFinal.logFile}`)
  if (buildFinal.logFile && existsSync(buildFinal.logFile)) {
    const raw = readFileSync(buildFinal.logFile, 'utf8')
    check('build 日志含原始输出', raw.includes('[build] ok'), '')
  }

  // test：期望失败并被捕获
  const testAction = {
    name: 'test',
    command: 'node test.js',
    dependsOn: ['build'],
  }
  const testRun = runner.run({ root: project, actionName: 'test', action: testAction, logDir })
  await waitSettled(runner, testRun.id)
  const testFinal = runner.getRun(testRun.id)

  check('test 退出码非 0', testFinal.exitCode !== 0 && testFinal.exitCode !== null, `exit=${testFinal.exitCode}`)
  check('test 状态 failed', testFinal.status === 'failed', `status=${testFinal.status}`)
  check('test 输出包含报错', /reconstruction failed/.test(testFinal.output ?? ''), '')
  check('test 捕获了失败上下文', (testFinal.lastError ?? '').length > 0, `lastError=${JSON.stringify((testFinal.lastError ?? '').slice(0, 60))}`)
  check('test 日志已落盘', existsSync(testFinal.logFile ?? ''), `log=${testFinal.logFile}`)

  // 取消场景：启动一个长命令并取消
  const sleepAction = { name: 'sleep', command: process.platform === 'win32' ? 'ping -n 30 127.0.0.1 >nul' : 'sleep 30' }
  const sleepRun = runner.run({ root: project, actionName: 'sleep', action: sleepAction, logDir })
  await new Promise((r) => setTimeout(r, 300))
  const cancelled = runner.cancel(sleepRun.id)
  check('可取消运行', cancelled === true, '')
  await waitSettled(runner, sleepRun.id, 8000)
  const sleepFinal = runner.getRun(sleepRun.id)
  check('取消后状态 cancelled', sleepFinal.status === 'cancelled', `status=${sleepFinal.status}`)
} finally {
  rmSync(project, { recursive: true, force: true })
}

console.log(failures === 0 ? '\nE2E 全部通过' : `\nE2E ${failures} 项失败`)
process.exit(failures === 0 ? 0 : 1)

async function waitSettled(runner, id, timeoutMs = 8000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const run = runner.getRun(id)
    if (run && (run.status === 'succeeded' || run.status === 'failed' || run.status === 'cancelled')) return
    await new Promise((r) => setTimeout(r, 100))
  }
}
