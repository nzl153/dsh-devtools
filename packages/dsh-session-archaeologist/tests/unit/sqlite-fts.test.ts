import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, unlinkSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionIndex } from '../../src/host/sqlite.ts'
import type { IndexedDoc } from '../../src/core/types.ts'

let dir: string
let index: SessionIndex

function doc(sessionId: string, seq: number, source: IndexedDoc['source'], content: string, title = 't'): IndexedDoc {
  return { sessionId, seq, time: 1700000000000 + seq, title, role: 'user', source, content, meta: '' }
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'archaeologist-'))
  index = new SessionIndex(join(dir, 'test.db'))
})

afterAll(() => {
  index.close()
  if (existsSync(join(dir, 'test.db'))) unlinkSync(join(dir, 'test.db'))
})

describe('SessionIndex FTS search', () => {
  it('indexes docs and finds matches', () => {
    const docs: IndexedDoc[] = [
      doc('s1', 1, 'user', '修复 react 插件构建错误'),
      doc('s1', 2, 'tool', 'tool: bash pnpm build'),
      doc('s2', 1, 'assistant', 'implement cross-session sqlite search'),
      doc('s2', 2, 'tool', 'tool: bash pnpm install'),
    ]
    index.upsertSession({
      sessionId: 's1', workspace: 'E:\\a', path: '/f/s1', title: 'fix build', createdAt: 1,
      fileSize: 10, mtimeMs: 10, docCount: docs.filter((d) => d.sessionId === 's1').length, lastIndexedAt: 'x',
    })
    index.upsertSession({
      sessionId: 's2', workspace: 'E:\\b', path: '/f/s2', title: 'search', createdAt: 2,
      fileSize: 10, mtimeMs: 10, docCount: docs.filter((d) => d.sessionId === 's2').length, lastIndexedAt: 'x',
    })
    index.insertDocs('s1', docs.filter((d) => d.sessionId === 's1'))
    index.insertDocs('s2', docs.filter((d) => d.sessionId === 's2'))

    const res = index.search('react')
    expect(res.total).toBeGreaterThan(0)
    expect(res.results.some((r) => r.sessionId === 's1')).toBe(true)
    expect(res.hits.length).toBeGreaterThan(0)
  })

  it('applies session exclusion filter', () => {
    index.addExcludedSession('s1')
    const res = index.search('build')
    expect(res.results.some((r) => r.sessionId === 's1')).toBe(false)
    index.removeExcludedSession('s1')
    const res2 = index.search('build')
    expect(res2.results.some((r) => r.sessionId === 's1')).toBe(true)
  })

  it('applies workspace exclusion filter', () => {
    index.addExcludedWorkspace('E:\\b')
    const res = index.search('pnpm')
    expect(res.results.some((r) => r.sessionId === 's2')).toBe(false)
    index.removeExcludedWorkspace('E:\\b')
  })

  it('clear wipes the index', () => {
    index.clear()
    const status = index.getStatus()
    expect(status.indexedSessions).toBe(0)
    expect(status.indexedDocs).toBe(0)
  })
})
