// E2E：构造一个模拟 session event 数组（JSON），通过 core debrief 生成摘要并断言统计正确。
// 不启动 DSH。要求先 `pnpm build`（从 lib/index.js 导入纯 core）。
//
// 运行：pnpm test:e2e   （或 node scripts/e2e.mjs）

import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const lib = join(root, 'lib', 'index.js')
if (!existsSync(lib)) {
  console.error('未找到 lib/index.js。请先运行 `pnpm build` 再执行 E2E。')
  process.exit(1)
}

const { computeTurnDebrief, computeSessionDebrief, DEFAULT_CONFIG } = await import(pathToFileURL(lib).href)

// ---------------------------------------------------------------------------
// 构造模拟 session event 数组（与 DSH session event 同构的最小 JSON）。
// ---------------------------------------------------------------------------
let seq = 0
const ev = (type, time, data) => {
  seq += 1
  return { seq, time, type, data }
}
const turnStart = (turn, time) => ev('turn/start', time, { turn })
const turnEnd = (turn, time) => ev('turn/end', time, { turn, reason: { kind: 'completed' } })
const stepStart = (turn, step, time) => ev('step/start', time, { turn, step })
const assistant = (turn, step, time, usage) => ev('assistant/message', time, {
  turn,
  step,
  message: { id: `m${seq}`, role: 'assistant', content: [], source: { kind: 'model', provider: 'x', model: 'y' } },
  ...(usage ? { usage } : {}),
})
const toolCall = (turn, step, callId, name, args, time) => ev('tool/call', time, { turn, step, callId, name, arguments: JSON.stringify(args) })
const toolResult = (turn, step, callId, text, time, extra = {}) => ev('tool/result', time, {
  turn,
  step,
  callId,
  message: { id: `r${callId}`, role: 'user', content: [{ type: 'text', text }], source: { kind: 'tool', callId } },
  ...extra,
})

const sessionId = 'e2e-session-1'
const events = [
  turnStart(1, 1000),
  stepStart(1, 0, 1050),
  assistant(1, 0, 1100, { inputTokens: 50, outputTokens: 20 }),
  toolCall(1, 0, 'c1', 'bash', { cmd: 'pnpm test' }, 1200),
  toolResult(1, 0, 'c1', 'tests passed\n[exit code: 0]', 2000),
  toolCall(1, 0, 'c2', 'edit', { file_path: 'src/app.ts' }, 2100),
  toolResult(1, 0, 'c2', 'applied', 2500, { meta: { diffs: [{ path: 'src/app.ts', oldText: 'a', newText: 'b' }] } }),
  toolCall(1, 0, 'c3', 'bash', { cmd: 'make build' }, 2600),
  toolResult(1, 0, 'c3', '[exit code: 2]', 3200),
  assistant(1, 0, 3300, { inputTokens: 250, outputTokens: 80 }),
  turnEnd(1, 4000),

  turnStart(2, 5000),
  stepStart(2, 0, 5050),
  toolCall(2, 0, 'c4', 'bash', { cmd: 'pytest tests/' }, 5100),
  toolResult(2, 0, 'c4', '1 failed\n[exit code: 1]', 5400),
  turnEnd(2, 6000),
]

const config = DEFAULT_CONFIG

// 断言集合
let failures = 0
const check = (label, actual, expected) => {
  const ok = actual === expected
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  (got=${JSON.stringify(actual)}, expected=${JSON.stringify(expected)})`)
  if (!ok) failures++
}

// ---- Session 摘要 ----
const session = computeSessionDebrief(sessionId, events, config)
check('session.turnCount', session.turnCount, 2)
check('session.stepCount', session.stepCount, 2)
check('session.toolCallCount', session.toolCallCount, 4)
check('session.commandCount', session.commandCount, 3) // pnpm test, make build, pytest
check('session.tests.length', session.tests.length, 2) // pnpm test + pytest
check('session.failedCommands.length', session.failedCommands.length, 2) // make + pytest
check('session.tokens.inputTokens', session.tokens.inputTokens, 300)
check('session.tokens.outputTokens', session.tokens.outputTokens, 100)
check('session.changedFiles[0].path', session.changedFiles[0]?.path, 'src/app.ts')

// ---- Turn 1 摘要 ----
const turn1 = computeTurnDebrief(sessionId, events, 1, config)
check('turn1.turn', turn1.turn, 1)
check('turn1.toolCallCount', turn1.toolCallCount, 3)
check('turn1.commandCount', turn1.commandCount, 2)
check('turn1.failedCommands.length', turn1.failedCommands.length, 1) // make build
check('turn1.tokens.inputTokens', turn1.tokens.inputTokens, 300)
check('turn1.durationMs', turn1.durationMs, 3000)

// ---- Turn 2 摘要 ----
const turn2 = computeTurnDebrief(sessionId, events, 2, config)
check('turn2.commandCount', turn2.commandCount, 1)
check('turn2.failedCommands.length', turn2.failedCommands.length, 1)
check('turn2.tests[0].status', turn2.tests[0]?.status, 'failed')

console.log(failures === 0
  ? '\nE2E 全部通过 ✅'
  : `\nE2E ${failures} 项失败 ❌`)
process.exit(failures === 0 ? 0 : 1)