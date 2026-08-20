import { describe, expect, it } from 'vitest'
import { buildVersionHistory, changedTurns, mergeVersionHistory, normalizeKey, sameVersion } from '../../src/core/version.ts'
import type { Observation, VersionRecord } from '../../src/core/types.ts'

const obs = (key: string, turn: number, size: number, modified: string): Observation => ({
  key, turn, size, modified, created: '2026-01-01T00:00:00.000Z',
})

describe('normalizeKey / sameVersion', () => {
  it('normalizes separators', () => {
    expect(normalizeKey('a\\b\\c.txt')).toBe('a/b/c.txt')
    expect(normalizeKey('/x/y')).toBe('x/y')
  })
  it('compares size+mtime', () => {
    expect(sameVersion({ size: 1, modified: 'a' }, { size: 1, modified: 'a' })).toBe(true)
    expect(sameVersion({ size: 1, modified: 'a' }, { size: 2, modified: 'a' })).toBe(false)
  })
})

describe('buildVersionHistory', () => {
  it('tracks turns on content change', () => {
    const versions = buildVersionHistory([
      obs('report.md', 5, 100, 'a'),
      obs('report.md', 9, 100, 'a'), // unchanged
      obs('report.md', 14, 200, 'b'), // changed
    ])
    expect(versions).toHaveLength(1)
    expect(versions[0].turns).toEqual([5, 14])
    expect(versions[0].size).toBe(200)
  })

  it('single observation yields one turn', () => {
    const v = buildVersionHistory([obs('a.jpg', 3, 10, 'x')])
    expect(v[0].turns).toEqual([3])
  })

  it('separates distinct files', () => {
    const v = buildVersionHistory([
      obs('a.txt', 1, 1, 'x'),
      obs('b.txt', 2, 2, 'y'),
    ])
    expect(v.map((x) => x.key).sort()).toEqual(['a.txt', 'b.txt'])
  })
})

describe('mergeVersionHistory / changedTurns', () => {
  it('merges existing with new observations', () => {
    const existing: VersionRecord[] = buildVersionHistory([obs('r.md', 5, 10, 'a')])
    const merged = mergeVersionHistory(existing, [obs('r.md', 9, 11, 'b'), obs('new.json', 9, 5, 'c')])
    const r = merged.find((v) => v.key === 'r.md')
    expect(r?.turns).toEqual([5, 9])
    const n = merged.find((v) => v.key === 'new.json')
    expect(n?.turns).toEqual([9])
  })

  it('changedTurns dedupes and sorts', () => {
    const versions = buildVersionHistory([
      obs('a.md', 5, 1, 'a'),
      obs('a.md', 9, 2, 'b'),
      obs('b.md', 5, 1, 'c'),
      obs('b.md', 14, 2, 'd'),
    ])
    expect(changedTurns(versions)).toEqual([5, 9, 14])
  })
})
