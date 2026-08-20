import { describe, expect, it } from 'vitest'
import { passesFilter } from '../../src/client/filters.ts'
import type { FileChange } from '../../src/core/types.ts'

function change(over: Partial<FileChange>): FileChange {
  return {
    relPath: 'a.ts',
    status: 'modified',
    kind: 'text',
    fromHash: 'old',
    toHash: 'new',
    size: 1,
    mtimeMs: 0,
    addedLines: 1,
    removedLines: 1,
    diff: null,
    source: { turn: 1, toolName: 'edit', callId: 'c1' },
    ...over,
  }
}

describe('timeline filters (pure client logic)', () => {
  it('filters by file substring', () => {
    const c = change({ relPath: 'src/foo.ts' })
    expect(passesFilter(c, { fileFilter: 'foo', mode: 'all', turn: null })).toBe(true)
    expect(passesFilter(c, { fileFilter: 'bar', mode: 'all', turn: null })).toBe(false)
  })

  it('filters by turn', () => {
    const c = change({ source: { turn: 2, toolName: 'write', callId: 'c2' } })
    expect(passesFilter(c, { fileFilter: '', mode: 'all', turn: 2 })).toBe(true)
    expect(passesFilter(c, { fileFilter: '', mode: 'all', turn: 1 })).toBe(false)
  })

  it('only agent edits excludes ambient source null', () => {
    const agent = change({})
    const ambient = change({ source: null })
    expect(passesFilter(agent, { fileFilter: '', mode: 'agent', turn: null })).toBe(true)
    expect(passesFilter(ambient, { fileFilter: '', mode: 'agent', turn: null })).toBe(false)
  })

  it('changed-since-baseline includes modified/deleted/renamed only', () => {
    expect(passesFilter(change({ status: 'modified' }), { fileFilter: '', mode: 'baseline', turn: null })).toBe(true)
    expect(passesFilter(change({ status: 'deleted' }), { fileFilter: '', mode: 'baseline', turn: null })).toBe(true)
    expect(passesFilter(change({ status: 'renamed' }), { fileFilter: '', mode: 'baseline', turn: null })).toBe(true)
    expect(passesFilter(change({ status: 'added' }), { fileFilter: '', mode: 'baseline', turn: null })).toBe(false)
  })

  it('conflict filter selects high-risk statuses', () => {
    expect(passesFilter(change({ status: 'modified' }), { fileFilter: '', mode: 'conflict', turn: null })).toBe(true)
    expect(passesFilter(change({ status: 'added' }), { fileFilter: '', mode: 'conflict', turn: null })).toBe(false)
  })
})