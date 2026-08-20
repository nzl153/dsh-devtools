/**
 * E2E: core engine against a REAL temporary git repo (read-only git usage).
 *
 * Does NOT start DSH. It exercises baseline / diff / conflict logic with real
 * filesystem + real git status, proving the safety rules hold outside unit
 * tests.
 *
 * Run: node tests/e2e.mjs
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, renameSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { TimeMachineEngine } = await import('../src/core/engine.ts')
const { nodeFs } = await import('../src/core/nodeFs.ts')
const { createSidecarStore } = await import('../src/core/store.ts')

let failures = 0
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  — ${extra}` : ''}`)
  if (!cond) failures++
}

const tmp = mkdtempSync(join(tmpdir(), 'time-machine-e2e-'))
const ws = join(tmp, 'workspace')
const storeDir = join(tmp, 'store')
mkdirSync(ws, { recursive: true })

function git(...args) {
  execFileSync('git', args, { cwd: ws, stdio: 'pipe' })
}

async function act(engine, sessionId, wsDir, turn, toolName, callId, mutate) {
  const ev = { turn, toolName, callId }
  await engine.recordPreTool(sessionId, wsDir, ev)
  mutate()
  const { record } = await engine.recordPostTool(sessionId, wsDir, ev)
  return record
}

try {
  // ---- Set up a real git repo with an initial committed file ----
  git('init', '-q')
  git('config', 'user.email', 'e2e@example.com')
  git('config', 'user.name', 'e2e')
  writeFileSync(join(ws, 'existing.txt'), 'line1\nline2\nline3\n', 'utf8')
  git('add', '.')
  git('commit', '-qm', 'initial')

  const SID = 'e2e-session'
  const engine = new TimeMachineEngine(nodeFs, await createSidecarStore(nodeFs, storeDir))

  // ---- Baseline ----
  await engine.establishBaseline(SID, ws)
  let rec = await engine.readSession(SID)
  const bl = rec?.baseline.find((b) => b.relPath === 'existing.txt')
  check('baseline created with existing.txt tracked & clean', !!bl && bl.git?.tracked && bl.git.dirty === false)

  // ---- Agent: new file ----
  rec = await act(engine, SID, ws, 1, 'write', 'c1', () => {
    writeFileSync(join(ws, 'new.txt'), 'hello\n', 'utf8')
  })
  check('new file recorded as added', rec.turns[0].changes.some((c) => c.relPath === 'new.txt' && c.status === 'added'))

  // ---- Agent: edit ----
  rec = await act(engine, SID, ws, 1, 'edit', 'c2', () => {
    writeFileSync(join(ws, 'existing.txt'), 'line1\nLINE2-CHANGED\nline3\n', 'utf8')
  })
  const edit = rec.turns[0].changes.find((c) => c.relPath === 'existing.txt')
  check('edit recorded with diff', !!edit && edit.status === 'modified' && (edit.diff ?? '').includes('-line2'))

  // ---- Agent: rename new.txt -> renamed.txt (content preserved) ----
  rec = await act(engine, SID, ws, 1, 'mv', 'c3', () => {
    renameSync(join(ws, 'new.txt'), join(ws, 'renamed.txt'))
  })
  const renameChange = rec.turns[0].changes.find((c) => c.status === 'renamed')
  check('rename recorded as renamed (not delete + add)',
    !!renameChange && renameChange.oldPath === 'new.txt' && renameChange.relPath === 'renamed.txt')

  // ---- User edits after agent -> conflict ----
  writeFileSync(join(ws, 'existing.txt'), 'USER-EDITED\n', 'utf8')
  const conflictPreview = await engine.previewRestore(rec, { kind: 'file', relPath: 'existing.txt', to: 'baseline' })
  check('user edit after agent -> CONFLICT (not overwritten)', conflictPreview[0].problem === 'conflict')

  // ---- Baseline restore preview for an agent-created file is safe (delete) ----
  rec = await act(engine, SID, ws, 2, 'write', 'c4', () => {
    writeFileSync(join(ws, 'agent-created.txt'), 'agent made this\n', 'utf8')
  })
  const baselinePreview = await engine.previewRestore(rec, { kind: 'baseline' })
  const ac = baselinePreview.find((p) => p.relPath === 'agent-created.txt')
  check('baseline preview: agent-created file -> safe delete', ac?.action === 'delete' && ac?.problem === 'ok')

  // ---- Commit the actual restore for the agent-created file ----
  const commitNoop = await engine.commitRestore(rec, [ac])
  check('commit restore deletes agent-created file', commitNoop.performed === 1 && !existsSync(join(ws, 'agent-created.txt')))

  // ---- Non-git repo also works ----
  const ws2 = join(tmp, 'workspace-nongit')
  mkdirSync(ws2, { recursive: true })
  writeFileSync(join(ws2, 'a.txt'), 'x\n', 'utf8')
  const engine2 = new TimeMachineEngine(nodeFs, await createSidecarStore(nodeFs, join(tmp, 'store2')))
  await engine2.establishBaseline('nongit-session', ws2)
  const nongit = await act(engine2, 'nongit-session', ws2, 1, 'write', 'c1', () => {
    writeFileSync(join(ws2, 'b.txt'), 'y\n', 'utf8')
  })
  check('non-git repo records changes', nongit.turns[0].changes.some((c) => c.relPath === 'b.txt'))
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

console.log(`\n${failures === 0 ? 'E2E 全部通过' : `${failures} 项失败`}`)
process.exit(failures === 0 ? 0 : 1)
