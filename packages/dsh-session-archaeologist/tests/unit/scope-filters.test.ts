import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, unlinkSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionIndex } from '../../src/host/sqlite.ts'
import type { IndexedDoc } from '../../src/core/types.ts'

let dir: string
let index: SessionIndex

function doc(sessionId: string, seq: number, source: IndexedDoc['source'], content: string, title = 't', time = 1700000000000 + seq): IndexedDoc {
  return { sessionId, seq, time, title, role: source === 'user' || source === 'assistant' ? source : 'user', source, content, meta: '' }
}

function setSeed(s1: IndexedDoc[], s2: IndexedDoc[]): void {
  index.clear()
  index.upsertSession({
    sessionId: 's1', workspace: 'E:\\proj-a', path: '/f/s1', title: 'fix build', createdAt: 1,
    fileSize: 10, mtimeMs: 10, docCount: s1.length, lastIndexedAt: 'x',
  })
  index.upsertSession({
    sessionId: 's2', workspace: 'E:\\proj-a', path: '/f/s2', title: 'search', createdAt: 2,
    fileSize: 10, mtimeMs: 10, docCount: s2.length, lastIndexedAt: 'x',
  })
  index.upsertSession({
    sessionId: 's3', workspace: 'E:\\other', path: '/f/s3', title: 'misc', createdAt: 3,
    fileSize: 10, mtimeMs: 10, docCount: 1, lastIndexedAt: 'x',
  })
  index.insertDocs('s1', s1)
  index.insertDocs('s2', s2)
  index.insertDocs('s3', [{ sessionId: 's3', seq: 1, time: 1700000000000, title: 'misc', role: 'user', source: 'user', content: 'unrelated react note', meta: '' }])
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'archaeologist-scope-'))
  index = new SessionIndex(join(dir, 'test.db'))
})

afterAll(() => {
  index.close()
  if (existsSync(join(dir, 'test.db'))) unlinkSync(join(dir, 'test.db'))
})

describe('search scope filters', () => {
  it('filters by workspace', () => {
    const s1 = [doc('s1', 1, 'user', 'react build fix', 'fix build')]
    const s2 = [doc('s2', 1, 'user', 'react search implement', 'search')]
    setSeed(s1, s2)
    const res = index.search('react', { filters: { workspaces: ['E:\\proj-a'] } })
    expect(res.results.some((r) => r.sessionId === 's1')).toBe(true)
    expect(res.results.some((r) => r.sessionId === 's2')).toBe(true)
    expect(res.results.some((r) => r.sessionId === 's3')).toBe(false)
  })

  it('filters by current project path prefix', () => {
    const s1 = [doc('s1', 1, 'user', 'react build fix', 'fix build')]
    const s2 = [doc('s2', 1, 'user', 'react search implement', 'search')]
    setSeed(s1, s2)
    // project path matches both proj-a sessions
    const res = index.search('react', { filters: { projectPath: 'E:\\proj-a' } })
    expect(res.results.some((r) => r.sessionId === 's1')).toBe(true)
    expect(res.results.some((r) => r.sessionId === 's2')).toBe(true)
    expect(res.results.some((r) => r.sessionId === 's3')).toBe(false)
  })

  it('filters by date range', () => {
    const s1 = [
      doc('s1', 1, 'user', 'react one', 'one', 1700000100000),
      doc('s1', 2, 'user', 'react two', 'two', 1700000200000),
      doc('s1', 3, 'user', 'react three', 'three', 1700000300000),
    ]
    setSeed(s1, [doc('s2', 1, 'user', 'react other', 'other', 1700000400000)])
    const res = index.search('react', { filters: { after: 1700000150000, before: 1700000250000 } })
    // only 'two' (1700000200000) falls in [after, before); 'one' and 'three' are outside.
    expect(res.hits.length).toBeGreaterThan(0)
    const hitSnippets = res.hits.map((h) => h.snippet)
    expect(hitSnippets.some((s) => s.includes('two'))).toBe(true)
    expect(hitSnippets.some((s) => s.includes('one'))).toBe(false)
    expect(hitSnippets.some((s) => s.includes('three'))).toBe(false)
  })

  it('filters by source field', () => {
    const s1 = [
      doc('s1', 1, 'user', 'react user message', 'a'),
      doc('s1', 2, 'command', 'pnpm build', 'a'),
      doc('s1', 3, 'error', 'Error: compilation failed', 'a'),
    ]
    const s2 = [doc('s2', 1, 'assistant', 'react assistant note', 'b')]
    setSeed(s1, s2)
    const errs = index.search('react', { filters: { source: ['error'] } })
    expect(errs.hits.every((h) => h.source === 'error')).toBe(true)
    const cmds = index.search('react', { filters: { source: ['command'] } })
    expect(cmds.hits.every((h) => h.source === 'command')).toBe(true)
    const users = index.search('react', { filters: { source: ['user'] } })
    expect(users.hits.every((h) => h.source === 'user')).toBe(true)
  })
})