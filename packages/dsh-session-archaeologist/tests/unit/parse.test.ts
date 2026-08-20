import { describe, it, expect } from 'vitest'
import { parseSession } from '../../src/core/session-parse.ts'
import { extractCommands, extractErrors, extractFileMentions } from '../../src/core/fields.ts'
import { buildTimeline } from '../../src/core/timeline.ts'
import { estimateTokens } from '../../src/core/token.ts'

const SESSION_LINES = [
  '{"type":"session","version":0,"id":"s1","createdAt":1700000000000,"delegationDepth":0}',
  '{"type":"session/title","seq":1,"time":1700000000000,"data":{"title":"fix build"}}',
  '{"type":"user/message","seq":2,"time":1700000002000,"data":{"content":[{"type":"text","text":"修复 react 插件构建错误"}],"source":{"kind":"user"},"role":"user","id":"u1"}}',
  '{"type":"assistant/message","seq":3,"time":1700000003000,"data":{"turn":1,"message":{"role":"assistant","content":[{"type":"reasoning","text":"let me think"},{"type":"text","text":"我会先检查 tsdown.config.ts"}],"source":{"kind":"model"}},"id":"a1"}}',
  '{"type":"tool/call","seq":4,"time":1700000004000,"data":{"turn":1,"name":"bash","arguments":"{\\"command\\":\\"pnpm build\\",\\"file_path\\":\\"E:\\\\proj\\\\tsdown.config.ts\\"}"}}',
  '{"type":"tool/result","seq":5,"time":1700000005000,"data":{"message":{"content":[{"type":"tool-result","toolCallId":"c1","content":[{"type":"text","text":"Error: build failed with exit code 1"}]}]}}}',
  '{"type":"reasoning-chunks","seq0":6,"time0":1700000006000,"data":{"texts":["thinking"," about"," the"," fix"]}}',
  '{"type":"turn/end","seq":7,"time":1700000007000,"data":{"turn":1,"reason":{"kind":"failed"}}}',
]

describe('session-parse', () => {
  it('extracts docs with correct source kinds', () => {
    const parsed = parseSession(SESSION_LINES, 's1', 0)
    const sources = parsed.docs.map((d) => d.source)
    expect(sources).toContain('user')
    expect(sources).toContain('assistant')
    expect(sources).toContain('tool')
    expect(sources).toContain('tool-result')
    expect(sources).toContain('reasoning')
    expect(sources).toContain('outcome')
    expect(parsed.title).toBe('fix build')
    expect(parsed.outcome).toBe('failed')
  })

  it('skips system-injected user messages by default', () => {
    const withSystem = [
      '{"type":"session","version":0,"id":"s2","createdAt":1,"delegationDepth":0}',
      '{"type":"user/message","seq":1,"time":1,"data":{"content":[{"type":"text","text":"<system-reminder>skills</system-reminder>"}],"source":{"kind":"plugin"},"role":"user","id":"p1"}}',
    ]
    const parsed = parseSession(withSystem, 's2', 0)
    expect(parsed.docs.filter((d) => d.source === 'user')).toHaveLength(0)
    expect(parsed.docs.filter((d) => d.source === 'system')).toHaveLength(0)
  })

  it('indexes real user source but excludes plugin-injected by default', () => {
    const lines = [
      '{"type":"session","version":0,"id":"s3","createdAt":1,"delegationDepth":0}',
      '{"type":"user/message","seq":1,"time":1,"data":{"content":[{"type":"text","text":"hi"}],"source":{"kind":"user"},"role":"user","id":"u1"}}',
    ]
    const parsed = parseSession(lines, 's3', 0)
    expect(parsed.docs.some((d) => d.source === 'user')).toBe(true)
  })
})

describe('fields', () => {
  it('extracts commands from shell tool args', () => {
    const cmds = extractCommands('bash', '{"command":"pnpm install --frozen-lockfile","file_path":"E:\\\\a\\\\b.ts"}')
    expect(cmds).toContain('pnpm install --frozen-lockfile')
  })
  it('does not extract commands from non-shell tools', () => {
    expect(extractCommands('glob', '{"command":"rm -rf /"}')).toHaveLength(0)
  })
  it('extracts errors from result text', () => {
    const errs = extractErrors('line1 ok\nError: failed to build\nanother Error: nope')
    expect(errs.length).toBeGreaterThan(0)
    expect(errs.some((e) => e.startsWith('Error:'))).toBe(true)
  })
  it('extracts file mentions', () => {
    const files = extractFileMentions('read E:\\proj\\src\\index.ts and /home/x/main.ts')
    expect(files.some((f) => f.includes('index.ts'))).toBe(true)
  })
})

describe('timeline', () => {
  it('builds deterministic stages without invoking any model', () => {
    const parsed = parseSession(SESSION_LINES, 's1', 0)
    const tl = buildTimeline('s1', parsed.title, parsed.createdAt, parsed.docs, parsed.files, parsed.commands)
    expect(tl.stages.map((s) => s.label)).toEqual(['Problem', 'Investigation', 'Files inspected', 'Edits', 'Test', 'Result'])
    expect(tl.local).toBe(true)
    expect(tl.stages.every((s) => ['known', 'estimated', 'unknown'].includes(s.confidence))).toBe(true)
  })
})

describe('token', () => {
  it('estimates tokens for CJK and ASCII', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens('abc')).toBe(1)
    expect(estimateTokens('你好世界')).toBe(4)
    expect(estimateTokens('abc 你好')).toBe(3) // 4 ascii => 1, + 2 cjk = 3
  })
})
