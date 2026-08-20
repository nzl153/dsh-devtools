import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../../src/core/filter.ts'
import { emptySession, indexScan, filesByCategory, versionTurnsFor, type ScanFile } from '../../src/core/indexer.ts'

const config = { ...DEFAULT_CONFIG, ignoreDirs: ['node_modules', '.git', 'dist', 'build', 'out', 'coverage'] }

const file = (path: string, turn: number, size: number, modified = 'm'): ScanFile => ({
  path,
  absPath: `/ws/${path}`,
  size,
  created: '2026-01-01T00:00:00.000Z',
  modified,
})

describe('indexScan', () => {
  it('adds and changes files across turns', () => {
    const state = emptySession('s1', '/ws', 5)
    const first = indexScan(state, [file('report.md', 5, 100, 'a')], { config, turn: 5, workspace: '/ws' })
    expect(first.added).toBe(1)
    expect(first.changed).toBe(0)
    expect(first.session.files[0].firstSeenTurn).toBe(5)
    expect(first.session.files[0].associatedTurn).toBe(5)

    const second = indexScan(first.session, [file('report.md', 9, 100, 'a'), file('new.png', 9, 50, 'b')], { config, turn: 9, workspace: '/ws' })
    expect(second.added).toBe(1)
    expect(second.changed).toBe(0) // same size+mtime -> no change
    expect(second.session.files.find((f) => f.path === 'report.md')?.versionKeys).toHaveLength(1)

    const third = indexScan(second.session, [file('report.md', 14, 200, 'c')], { config, turn: 14, workspace: '/ws' })
    expect(third.changed).toBe(1)
    expect(versionTurnsFor(third.session, 'report.md')).toEqual([5, 14])
    // new.png was added at turn 9, so the session-level changedTurns includes 9.
    expect(third.session.changedTurns).toEqual([5, 9, 14])
  })

  it('filters ignored dirs via classification? (actually scanner filters; indexer keeps given)', () => {
    // Indexer trusts the scanner for filtering; it tracks what it receives.
    const state = emptySession('s1', '/ws', 1)
    const res = indexScan(state, [file('node_modules/x.js', 1, 1, 'a'), file('app.ts', 1, 2, 'b')], { config, turn: 1, workspace: '/ws' })
    expect(res.session.files.map((f) => f.path).sort()).toEqual(['app.ts', 'node_modules/x.js'])
  })

  it('removes files no longer present', () => {
    const state = emptySession('s1', '/ws', 1)
    const first = indexScan(state, [file('a.txt', 1, 1, 'a'), file('b.txt', 1, 2, 'b')], { config, turn: 1, workspace: '/ws' })
    const second = indexScan(first.session, [file('a.txt', 2, 1, 'a')], { config, turn: 2, workspace: '/ws' })
    expect(second.removed).toBe(1)
    expect(second.session.files.map((f) => f.path)).toEqual(['a.txt'])
  })
})

describe('category helpers', () => {
  it('groups by category', () => {
    const state = emptySession('s1', '/ws', 1)
    const res = indexScan(state, [
      file('a.png', 1, 1, 'a'),
      file('b.md', 1, 2, 'b'),
      file('c.json', 1, 3, 'c'),
      file('d.zip', 1, 4, 'd'),
    ], { config, turn: 1, workspace: '/ws' })
    expect(filesByCategory(res.session, 'images')).toHaveLength(1)
    expect(filesByCategory(res.session, 'documents')).toHaveLength(1)
    expect(filesByCategory(res.session, 'data')).toHaveLength(1)
    expect(filesByCategory(res.session, 'builds')).toHaveLength(1)
  })
})