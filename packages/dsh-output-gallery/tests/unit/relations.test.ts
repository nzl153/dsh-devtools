import { describe, expect, it } from 'vitest'
import { applyRelatedCommands, findRelatedCommand, formatRelatedCommand } from '../../src/core/relations.ts'
import { emptySession } from '../../src/core/indexer.ts'
import type { EventLike } from '../../src/core/relations.ts'

const toolCall = (name: string, args: unknown, seq: number, turn = 1): EventLike => ({
  type: 'tool/call',
  seq,
  data: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args), turn },
})

describe('findRelatedCommand', () => {
  it('matches write tool by file_path argument (high confidence)', () => {
    const events = [
      toolCall('write', { file_path: 'out/report.md', content: 'x' }, 3, 7),
      toolCall('read', { file_path: 'out/report.md' }, 5, 8),
    ]
    const rc = findRelatedCommand(events, 'out/report.md')
    expect(rc).not.toBeNull()
    expect(rc!.tool).toBe('read') // newest high-confidence match wins
    expect(rc!.confidence).toBe('high')
    expect(rc!.turn).toBe(8)
  })

  it('prefers high confidence over newer low-confidence shell mention', () => {
    const events = [
      toolCall('write', { file_path: 'out/report.md' }, 2, 7),
      toolCall('bash', { command: 'cat out/report.md' }, 10, 9),
    ]
    const rc = findRelatedCommand(events, 'out/report.md')
    expect(rc!.tool).toBe('write')
    expect(rc!.confidence).toBe('high')
  })

  it('matches absolute paths pointing at the target', () => {
    const events = [toolCall('edit', { file_path: '/ws/out/report.md', old_string: 'a', new_string: 'b' }, 4, 9)]
    const rc = findRelatedCommand(events, 'out/report.md')
    expect(rc).not.toBeNull()
    expect(rc!.confidence).toBe('high')
  })

  it('falls back to shell command that mentions the file basename', () => {
    const events = [toolCall('bash', { command: 'echo report.md > /tmp/list' }, 8, 11)]
    const rc = findRelatedCommand(events, 'docs/report.md')
    expect(rc).not.toBeNull()
    expect(rc!.tool).toBe('bash')
    expect(rc!.confidence).toBe('low')
  })

  it('returns null when nothing reliable is found', () => {
    const events = [toolCall('bash', { command: 'ls -la' }, 1, 1)]
    expect(findRelatedCommand(events, 'out/report.md')).toBeNull()
  })
})

describe('formatRelatedCommand', () => {
  it('formats path-based tool with its path argument', () => {
    expect(formatRelatedCommand('write', { file_path: 'out/report.md' }, 'out/report.md')).toBe('write out/report.md')
  })
  it('formats bash command text', () => {
    expect(formatRelatedCommand('bash', { command: 'npm test' })).toBe('bash: npm test')
  })
})

describe('applyRelatedCommands', () => {
  it('attaches related commands to all files', () => {
    const session = emptySession('s1', '/ws', 1)
    session.files = [
      { path: 'out/report.md', category: 'documents', previewKind: 'markdown', risk: 'safe', mime: 'text/markdown', size: 1, created: '', modified: '', firstSeenTurn: 1, modifiedTurn: null, changed: false, previewAvailable: true, associatedTurn: 1 },
    ]
    const events = [toolCall('write', { file_path: 'out/report.md' }, 1, 7)]
    const updated = applyRelatedCommands(session, events)
    expect(updated.files[0].relatedCommand?.command).toBe('write out/report.md')
    expect(updated.files[0].relatedCommand?.confidence).toBe('high')
  })

  it('keeps existing relations when no events are available', () => {
    const session = emptySession('s1', '/ws', 1)
    session.files = [{ path: 'a.txt', category: 'documents', previewKind: 'text', risk: 'safe', mime: 'text/plain', size: 1, created: '', modified: '', firstSeenTurn: 1, modifiedTurn: null, changed: false, previewAvailable: true, associatedTurn: 1, relatedCommand: { tool: 'write', command: 'write a.txt', confidence: 'high' } }]
    const updated = applyRelatedCommands(session, [])
    expect(updated.files[0].relatedCommand?.command).toBe('write a.txt')
  })
})