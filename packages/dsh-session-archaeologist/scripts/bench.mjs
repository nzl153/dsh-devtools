#!/usr/bin/env node
/**
 * Benchmark: generate synthetic session fixtures, index them with the real
 * core/host engine, and measure FTS search latency.
 *
 * Requires a successful `pnpm build` first (imports lib/index.js).
 * Usage: pnpm bench  (BENCH_SESSIONS=500 pnpm bench to scale)
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { SessionIndex, scanSessions, runIndex } from '../lib/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const genScript = join(root, 'tests', 'fixtures', 'gen-sessions.mjs')
const fixturesRoot = join(root, 'tests', 'fixtures', 'generated')
const nSessions = Number(process.env.BENCH_SESSIONS ?? 500)

// 1. Generate fixtures
console.log(`generating ${nSessions} synthetic sessions...`)
execFileSync(process.execPath, [genScript], {
  cwd: root,
  env: { ...process.env, BENCH_SESSIONS: String(nSessions) },
  stdio: 'inherit',
})

// 2. Fresh temp DB
const tmp = mkdtempSync(join(tmpdir(), 'archaeologist-bench-'))
const dbPath = join(tmp, 'bench.db')
const index = new SessionIndex(dbPath)

// 3. Index
const sessions = scanSessions(fixturesRoot, new Map())
console.log(`discovered ${sessions.length} session files`)
const t0 = performance.now()
const result = runIndex(index, sessions, { force: true })
const t1 = performance.now()
console.log(`indexing: ${result.indexed} sessions, ${result.docCount} docs, ${(t1 - t0).toFixed(1)} ms`)

// 4. Query latency
const QUERIES = ['react', 'sqlite', 'error', 'pnpm build', 'tsdown']
console.log('\nquery latency (5 runs each):')
for (const q of QUERIES) {
  const times = []
  let last = null
  for (let i = 0; i < 5; i++) {
    const s = performance.now()
    last = index.search(q, { limit: 20 })
    const e = performance.now()
    times.push(e - s)
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  const max = Math.max(...times)
  console.log(`  ${JSON.stringify(q).padEnd(14)} avg ${avg.toFixed(1)} ms  max ${max.toFixed(1)} ms  hits ${last?.hits.length ?? 0}`)
}

// 5. Cleanup
index.close()
rmSync(tmp, { recursive: true, force: true })
if (existsSync(fixturesRoot)) rmSync(fixturesRoot, { recursive: true, force: true })
console.log('\nbenchmark complete')