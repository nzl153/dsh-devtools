import { describe, it, expect } from 'vitest'
import { toFtsQuery } from '../../src/host/sqlite.ts'

describe('toFtsQuery', () => {
  it('splits and quotes tokens, ANDing them', () => {
    expect(toFtsQuery('react plugin build')).toBe('"react" "plugin" "build"')
  })
  it('escapes embedded double quotes', () => {
    expect(toFtsQuery('a"b')).toBe('"a""b"')
  })
  it('returns empty for blank input', () => {
    expect(toFtsQuery('   ')).toBe('')
  })
})
