import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, unlinkSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionIndex } from '../../src/host/sqlite.ts'
import { parseSession } from '../../src/core/session-parse.ts'
import type { IndexedDoc } from '../../src/core/types.ts'

const SESSION_LINES = [
  '{"type":"session","version":0,"id":"s1","createdAt":1700000000000,"delegationDepth":0}',
  '{"type":"session/title","seq":0,"time":1,"data":{"title":"fix build"}}',
  '{"type":"user/message","seq":1,"time":2,"data":{"content":[{"type":"text","text":"修复 react 插件构建错误"}],"source":{"kind":"user"},"role":"user","id":"u"}}',
  '{"type":"assistant/message","seq":2,"time":3,"data":{"turn":1,"message":{"role":"assistant","content":[{"type":"text","text":"我检查一下 tsdown.config.ts"}]},"id":"a"}}',
  '{"type":"tool/call","seq":3,"time":4,"data":{"turn":1,"name":"bash","arguments":"{\\"command\\":\\"pnpm build\\"}"}}',
  '{"type":"tool/result","seq":4,"time":5,"data":{"message":{"content":[{"type":"tool-result","toolCallId":"c","content":[{"type":"text","text":"Error: build failed with exit code 1"}]}]}}}',
  '{"type":"turn/end","seq":5,"time":6,"data":{"turn":1,"reason":{"kind":"completed"}}}',
]

let dir: string
let index: SessionIndex

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'archaeologist-struct-'))
  index = new SessionIndex(join(dir, 'test.db'))
})

afterAll(() => {
  index.close()
  if (existsSync(join(dir, 'test.db'))) unlinkSync(join(dir, 'test.db'))
})

function seed(docs: readonly IndexedDoc[]): void {
  index.clear()
  index.upsertSession({
    sessionId: 's1', workspace: 'E:\\proj', path: '/f/s1', title: 'fix build', createdAt: 1,
    fileSize: 10, mtimeMs: 10, docCount: docs.length, lastIndexedAt: 'x',
  })
  index.insertDocs('s1', docs)
}

describe('structured results', () => {
  it('reports hitFields, workspace, and structured context on results/hits', () => {
    const parsed = parseSession(SESSION_LINES, 's1', 0)
    seed(parsed.docs)
    const res = index.search('react', { filters: { source: ['user'] } })
    const result = res.results.find((r) => r.sessionId === 's1')
    expect(result).toBeDefined()
    expect(result!.workspace).toBe('E:\\proj')
    // hitFields contains all sources that matched this session (user here, filtered to user)
    expect(result!.hitFields).toContain('user')
    // hits carry workspace and context
    const hit = res.hits.find((h) => h.sessionId === 's1')
    expect(hit).toBeDefined()
    expect(hit!.workspace).toBe('E:\\proj')
    expect(Array.isArray(hit!.contextBefore)).toBe(true)
    expect(Array.isArray(hit!.contextAfter)).toBe(true)
  })

  it('synthesizes command/error/file docs so field scopes match directly', () => {
    const parsed = parseSession(SESSION_LINES, 's1', 0)
    seed(parsed.docs)
    // synthetic docs exist in index
    const cmdRes = index.search('pnpm', { filters: { source: ['command'] } })
    expect(cmdRes.hits.some((h) => h.source === 'command')).toBe(true)
    const errRes = index.search('error', { filters: { source: ['error'] } })
    expect(errRes.hits.some((h) => h.source === 'error')).toBe(true)
    // File extraction only captures path-like mentions (with separators).
    const withFile = [
      ...parsed.docs,
      { sessionId: 's1', seq: 200, time: 7, title: 'fix build', role: 'user' as const, source: 'file' as const, content: 'E:\\proj\\src\\index.ts\nE:\\proj\\src\\app.tsx', meta: '' },
    ]
    seed(withFile)
    const fileRes = index.search('index.ts', { filters: { source: ['file'] } })
    expect(fileRes.hits.some((h) => h.source === 'file')).toBe(true)
  })

  it('filters out commands when only user/assistant sources selected', () => {
    const parsed = parseSession(SESSION_LINES, 's1', 0)
    seed(parsed.docs)
    const res = index.search('pnpm build', { filters: { source: ['user', 'assistant'] } })
    expect(res.hits.every((h) => h.source === 'user' || h.source === 'assistant')).toBe(true)
  })
})