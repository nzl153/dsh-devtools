import { describe, it, expect } from 'vitest'
import { zstdCompressSync, constants as zstdConstants } from 'node:zlib'
import { decodeSessionLog, scanZstdFrames } from '../../src/core/zstd.ts'

function compress(text: string): Buffer {
  return zstdCompressSync(Buffer.from(text, 'utf8'), { params: { [zstdConstants.ZSTD_c_compressionLevel]: 1 } })
}

describe('zstd multi-frame decode', () => {
  it('decodes a single-frame session log', () => {
    const text = '{"type":"session","id":"a"}\n{"type":"user/message","data":{}}\n'
    const compressed = compress(text)
    const lines = decodeSessionLog(compressed)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('"type":"session"')
  })

  it('decodes a concatenated multi-frame stream (like DSH append batches)', () => {
    const header = '{"type":"session","version":0,"id":"s1","createdAt":1,"delegationDepth":0}\n'
    const batch1 = '{"type":"user/message","seq":0,"data":{"content":[]}}\n'
    const batch2 = '{"type":"tool/call","seq":1,"data":{"name":"bash"}}\n'
    const f0 = compress(header)
    const f1 = compress(batch1)
    const f2 = compress(batch2)
    // concatenate frames exactly as DSH persistence does
    const combined = Buffer.concat([f0, f1, f2])
    const lines = decodeSessionLog(combined)
    expect(lines).toHaveLength(3)
    expect(lines[1]).toContain('user/message')
    expect(lines[2]).toContain('tool/call')
  })

  it('scanZstdFrames finds the correct byte ranges', () => {
    const f0 = compress('a\n')
    const f1 = compress('b\n')
    const combined = Buffer.concat([f0, f1])
    const { frames } = scanZstdFrames(combined)
    expect(frames).toHaveLength(2)
    expect(frames[0].start).toBe(0)
    expect(frames[0].end).toBe(f0.length)
    expect(frames[1].start).toBe(f0.length)
    expect(frames[1].end).toBe(f0.length + f1.length)
  })

  it('throws on corrupt magic', () => {
    const bad = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff])
    expect(() => decodeSessionLog(bad)).toThrow(/magic/)
  })
})
