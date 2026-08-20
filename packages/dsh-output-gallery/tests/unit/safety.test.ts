import { describe, expect, it } from 'vitest'
import { safetyForPath, previewByteLimit, readsContent } from '../../src/core/safety.ts'

describe('safetyForPath', () => {
  it('dangerous files never preview', () => {
    const v = safetyForPath('bin/run.exe', true)
    expect(v.allowPreview).toBe(false)
    expect(v.allowDownload).toBe(false)
    expect(v.risk).toBe('danger')
  })

  it('html is sandboxed when enabled', () => {
    const on = safetyForPath('page.html', true)
    expect(on.allowPreview).toBe(true)
    expect(on.sandboxed).toBe(true)
  })

  it('html disabled by config', () => {
    const off = safetyForPath('page.html', false)
    expect(off.allowPreview).toBe(false)
    expect(off.sandboxed).toBe(false)
  })

  it('image previewable and downloadable', () => {
    const v = safetyForPath('pic.png', true)
    expect(v.allowPreview).toBe(true)
    expect(v.allowDownload).toBe(true)
    expect(v.sandboxed).toBe(false)
  })

  it('zip is listed not executed (still previewable as listing)', () => {
    const v = safetyForPath('bundle.zip', true)
    expect(v.allowPreview).toBe(true)
    expect(v.kind).toBe('zip')
  })

  it('unknown binary not previewable', () => {
    const v = safetyForPath('data.bin', true)
    expect(v.allowPreview).toBe(false)
  })
})

describe('readsContent / limits', () => {
  it('content kinds read bytes', () => {
    expect(readsContent('text')).toBe(true)
    expect(readsContent('json')).toBe(true)
    expect(readsContent('zip')).toBe(true)
    expect(readsContent('image')).toBe(false)
    expect(readsContent('none')).toBe(false)
  })
  it('zip gets bigger limit', () => {
    expect(previewByteLimit('zip')).toBeGreaterThan(previewByteLimit('text'))
  })
})
