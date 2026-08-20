import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../../src/core/filter.ts'
import { emptySession, indexScan, pinnedFiles, type ScanFile } from '../../src/core/indexer.ts'

const config = { ...DEFAULT_CONFIG }

const file = (path: string, turn: number, size = 1): ScanFile => ({
  path,
  absPath: `/ws/${path}`,
  size,
  created: '2026-01-01T00:00:00.000Z',
  modified: `m${turn}`,
})

describe('deliverables pinning', () => {
  it('initializes an empty pin map', () => {
    const session = emptySession('s1', '/ws', 1)
    expect(session.pins).toEqual({})
  })

  it('pinnedFiles returns only user-pinned files', () => {
    const session = emptySession('s1', '/ws', 1)
    const result = indexScan(session, [file('out/report.md', 1), file('assets/hero.png', 1)], { config, turn: 1, workspace: '/ws' })
    const withPins = { ...result.session, pins: { 'out/report.md': true } }
    const pinned = pinnedFiles(withPins)
    expect(pinned.map((f) => f.path)).toEqual(['out/report.md'])
  })

  it('indexScan preserves pin state onto rebuilt files', () => {
    const first = indexScan(emptySession('s1', '/ws', 1), [file('out/report.md', 1)], { config, turn: 1, workspace: '/ws' })
    const pinnedSession = { ...first.session, pins: { 'out/report.md': true } }
    const second = indexScan(pinnedSession, [file('out/report.md', 2, 2)], { config, turn: 2, workspace: '/ws' })
    expect(second.session.files[0].pinned).toBe(true)
    expect(second.session.pins['out/report.md']).toBe(true)
  })

  it('does not auto-pin files during a build/scan', () => {
    const result = indexScan(emptySession('s1', '/ws', 1), [file('build/bundle.js.map', 1), file('out/report.md', 1)], { config, turn: 1, workspace: '/ws' })
    expect(result.session.files.every((f) => !f.pinned)).toBe(true)
    expect(Object.keys(result.session.pins)).toHaveLength(0)
  })
})