#!/usr/bin/env node
/**
 * Generate benchmark/test fixtures: hundreds of fake DSH sessions.
 *
 * Writes to tests/fixtures/generated/ in the same layout the real harness uses:
 *   <root>/<--normalized-cwd-->/<sessionId>/session.jsonl.zstd
 *
 * Each session is one zstd frame containing a JSONL transcript (header + events).
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { zstdCompressSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), 'generated')
rmSync(rootDir, { recursive: true, force: true })

const WAFFLE = [
  'fix the react plugin build error',
  'implement cross-session search with sqlite',
  'debug the tsdown configuration for dual half build',
  'write a dashboard using canvas svg',
  'refactor the agent preset minimal',
  'diagnose the zstd session persistence failure',
  'add a CLI command for history search',
  'optimize token estimation heuristic',
  'build a timeline summary for the session',
  'exclude a workspace from the index',
  'handle the approval policy rejection',
  'make the sidebar footer action panel',
  'reproduce the bm25 ranking behavior',
  'migrate the store to sqlite fts5',
  'review the file sandbox policy',
]

const N_SESSIONS = Number(process.env.BENCH_SESSIONS ?? 300)
let seq = 0
let totalDocs = 0

function wsDir(i) {
  const names = ['E~0020deepseek~0020harness--', 'E~0020dsh-test--', 'E~0020projects--']
  return `--${names[i % names.length]}`
}

function sessionId(i) {
  return `session-${randomBytes(8).toString('hex')}`
}

function event(type, data, extra = {}) {
  return JSON.stringify({ type, seq: seq++, time: Date.now(), data, ...extra })
}

function userMsg(text) {
  return event('user/message', {
    content: [{ type: 'text', text }],
    source: { kind: 'user', rpcId: randomBytes(6).toString('hex') },
    role: 'user',
    id: randomBytes(8).toString('hex'),
  })
}

function assistantMsg(text) {
  return event('assistant/message', {
    turn: 1,
    step: 1,
    message: { role: 'assistant', content: [{ type: 'text', text }], source: { kind: 'model', provider: 'deepseek-official', model: 'test' } },
    id: randomBytes(8).toString('hex'),
  })
}

function toolCall(name, args) {
  return event('tool/call', { turn: 1, step: 1, callId: randomBytes(6).toString('hex'), name, arguments: JSON.stringify(args) })
}

function toolResult(text) {
  return event('tool/result', {
    turn: 1,
    step: 1,
    message: { source: { kind: 'tool', callId: randomBytes(6).toString('hex') }, content: [{ type: 'tool-result', toolCallId: 'x', content: [{ type: 'text', text }] }] },
  })
}

for (let i = 0; i < N_SESSIONS; i++) {
  const id = sessionId(i)
  const lines = []
  seq = i * 1000 // reset per session
  lines.push(JSON.stringify({
    type: 'session', version: 0, id, createdAt: Date.now() - i * 86400000,
    cwd: ['E:\\deepseek harness', 'E:\\dsh-test', 'E:\\projects'][i % 3],
    delegationDepth: 0, agentPreset: 'minimal',
  }))
  const nMsgs = 3 + (i % 6)
  for (let m = 0; m < nMsgs; m++) {
    const topic = WAFFLE[(i + m) % WAFFLE.length]
    lines.push(userMsg(`user #${m}: ${topic}`))
    lines.push(assistantMsg(`assistant investigating: ${topic} — checking files and running commands`))
    if (m % 2 === 0) {
      lines.push(toolCall('glob', { pattern: '**/*.ts', path: `E:\\dsh-test\\proj${i}` }))
      lines.push(toolResult('Found config.ts, index.ts, main.ts'))
    }
    if (m % 3 === 0) {
      lines.push(toolCall('bash', { command: `pnpm test --filter proj${i}` }))
      lines.push(toolResult(i % 5 === 0
        ? `Error: test failed with exit code 1 in proj${i}`
        : `All tests passed in proj${i}`))
    }
  }
  lines.push(event('turn/end', { turn: 1, reason: { kind: i % 5 === 0 ? 'failed' : 'completed' } }))

  const dir = join(rootDir, wsDir(i), id)
  mkdirSync(dir, { recursive: true })
  const jsonl = lines.join('\n') + '\n'
  // single zstd frame with checksum
  const compressed = zstdCompressSync(Buffer.from(jsonl, 'utf8'), { level: 1 })
  writeFileSync(join(dir, 'session.jsonl.zstd'), compressed)
  totalDocs += nMsgs * 3
}

console.log(`fixtures: ${N_SESSIONS} sessions, ~${totalDocs} docs → ${rootDir}`)
