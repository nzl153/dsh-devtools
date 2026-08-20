import { describe, it, expect } from 'vitest'
import { buildExcerpt, buildMultiExcerpt } from '../../src/core/excerpt.ts'
import { parseSession } from '../../src/core/session-parse.ts'
import { estimateTokens } from '../../src/core/token.ts'
import type { ExcerptSelection } from '../../src/core/types.ts'

const LINES = [
  '{"type":"session","version":0,"id":"s1","createdAt":1700000000000,"delegationDepth":0}',
  '{"type":"session/title","seq":0,"time":1,"data":{"title":"fix build"}}',
  '{"type":"user/message","seq":1,"time":2,"data":{"content":[{"type":"text","text":"修复 react 插件构建错误"}],"source":{"kind":"user"},"role":"user","id":"u"}}',
  '{"type":"assistant/message","seq":2,"time":3,"data":{"turn":1,"message":{"role":"assistant","content":[{"type":"text","text":"我检查一下 tsdown.config.ts"}]},"id":"a"}}',
  '{"type":"tool/call","seq":3,"time":4,"data":{"turn":1,"name":"bash","arguments":"{\\"command\\":\\"pnpm build\\"}"}}',
  '{"type":"tool/result","seq":4,"time":5,"data":{"message":{"content":[{"type":"tool-result","toolCallId":"c","content":[{"type":"text","text":"All tests passed"}]}]}}}',
  '{"type":"user/message","seq":5,"time":6,"data":{"content":[{"type":"text","text":"再跑一次测试"}],"source":{"kind":"user"},"role":"user","id":"u2"}}',
  '{"type":"turn/end","seq":6,"time":7,"data":{"turn":1,"reason":{"kind":"completed"}}}',
]

const LINES2 = [
  '{"type":"session","version":0,"id":"s2","createdAt":1700100000000,"delegationDepth":0}',
  '{"type":"session/title","seq":0,"time":1,"data":{"title":"implement search"}}',
  '{"type":"user/message","seq":1,"time":2,"data":{"content":[{"type":"text","text":"做一个跨 session 搜索"}],"source":{"kind":"user"},"role":"user","id":"u2"}}',
  '{"type":"assistant/message","seq":2,"time":3,"data":{"turn":1,"message":{"role":"assistant","content":[{"type":"text","text":"用 SQLite FTS5 建索引"}]},"id":"a2"}}',
  '{"type":"tool/result","seq":3,"time":4,"data":{"message":{"content":[{"type":"tool-result","toolCallId":"c2","content":[{"type":"text","text":"error: timeout"}]}]}}}',
  '{"type":"turn/end","seq":4,"time":5,"data":{"turn":1,"reason":{"kind":"completed"}}}',
]

function sel1(): ExcerptSelection {
  const parsed = parseSession(LINES, 's1', 0)
  return { sessionId: 's1', title: parsed.title, createdAt: parsed.createdAt, workspace: 'E:\\a', docs: parsed.docs, hitIds: [3] }
}

function sel2(): ExcerptSelection {
  const parsed = parseSession(LINES2, 's2', 0)
  return { sessionId: 's2', title: parsed.title, createdAt: parsed.createdAt, workspace: 'E:\\b', docs: parsed.docs, hitIds: [3] }
}

describe('excerpt builder', () => {
  it('builds a bounded excerpt with original prompt, context, and token estimate', () => {
    const parsed = parseSession(LINES, 's1', 0)
    const excerpt = buildExcerpt('s1', parsed.title, parsed.createdAt, parsed.docs, [3], { contextRadius: 2 })
    expect(excerpt.sessionId).toBe('s1')
    expect(excerpt.originalPrompt).toContain('修复 react 插件构建错误')
    // context includes messages around seq 3 (radius 2 → seqs 1..5)
    const seqs = excerpt.hits.map((h) => h.seq)
    expect(seqs).toContain(1)
    expect(seqs).toContain(5)
    expect(excerpt.tokenEstimate).toBe(estimateTokens(excerpt.text))
    expect(excerpt.charCount).toBe(excerpt.text.length)
    expect(excerpt.codePaths.length).toBeGreaterThanOrEqual(0)
    expect(excerpt.text).toContain('# Session Excerpt')
  })

  it('properly bounds output to maxChars', () => {
    const excerpt = buildExcerpt('s1', 'fix build', 1700000000000, parseSession(LINES, 's1', 0).docs, [3], { maxChars: 200 })
    expect(excerpt.text.length).toBeLessThanOrEqual(220)
    expect(excerpt.truncated).toBe(true)
  })

  it('properly bounds output to maxTokens', () => {
    const excerpt = buildMultiExcerpt([sel1()], { maxTokens: 5, maxChars: 8000 })
    expect(excerpt.tokenEstimate).toBeLessThanOrEqual(5)
    expect(excerpt.text.length).toBeLessThanOrEqual(8000)
    expect(excerpt.truncated).toBe(true)
  })

  it('builds a multi-session excerpt with per-source metadata', () => {
    const excerpt = buildMultiExcerpt([sel1(), sel2()], { contextRadius: 1 })
    expect(excerpt.sources.length).toBe(2)
    expect(excerpt.selectedHitCount).toBe(2)
    expect(excerpt.hits.length).toBeGreaterThanOrEqual(2)
    expect(excerpt.text).toContain('## Source 1')
    expect(excerpt.text).toContain('## Source 2')
    expect(excerpt.text).toContain('workspace: E:\\a')
    expect(excerpt.text).toContain('workspace: E:\\b')
    expect(excerpt.sources[0]).toMatchObject({ sessionId: 's1', workspace: 'E:\\a' })
    expect(excerpt.sources[1]).toMatchObject({ sessionId: 's2', workspace: 'E:\\b' })
  })
})