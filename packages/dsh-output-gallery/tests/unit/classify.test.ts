import { describe, expect, it } from 'vitest'
import { classifyPath, extensionOf, formatBytes } from '../../src/core/classify.ts'

describe('classifyPath', () => {
  it('classifies image files', () => {
    const c = classifyPath('out/hero.png')
    expect(c.category).toBe('images')
    expect(c.previewKind).toBe('image')
    expect(c.mime).toBe('image/png')
    expect(c.risk).toBe('safe')
  })

  it('classifies svg as image preview', () => {
    const c = classifyPath('logo.svg')
    expect(c.category).toBe('images')
    expect(c.previewKind).toBe('svg')
    expect(c.mime).toBe('image/svg+xml')
  })

  it('classifies html with watch risk', () => {
    const c = classifyPath('report.html')
    expect(c.category).toBe('documents')
    expect(c.previewKind).toBe('html')
    expect(c.risk).toBe('watch')
  })

  it('classifies markdown/code as documents', () => {
    expect(classifyPath('README.md').category).toBe('documents')
    expect(classifyPath('README.md').previewKind).toBe('markdown')
    expect(classifyPath('src/main.ts').category).toBe('documents')
    expect(classifyPath('src/main.ts').previewKind).toBe('code')
  })

  it('classifies data files', () => {
    expect(classifyPath('data.json').category).toBe('data')
    expect(classifyPath('data.json').previewKind).toBe('json')
    expect(classifyPath('table.csv').category).toBe('data')
    expect(classifyPath('table.csv').previewKind).toBe('csv')
  })

  it('classifies build archives', () => {
    expect(classifyPath('dist/app.zip').category).toBe('builds')
    expect(classifyPath('dist/app.zip').previewKind).toBe('zip')
  })

  it('marks executable artifacts dangerous', () => {
    const c = classifyPath('bin/app.exe')
    expect(c.category).toBe('builds')
    expect(c.risk).toBe('danger')
    expect(c.previewKind).toBe('none')
  })
})

describe('extensionOf', () => {
  it('handles dotted extensions', () => {
    expect(extensionOf('a.tar.gz')).toBe('tar.gz')
    expect(extensionOf('a.TAR.GZ')).toBe('tar.gz')
  })
  it('handles no extension', () => {
    expect(extensionOf('Makefile')).toBe('')
  })
  it('handles case', () => {
    expect(extensionOf('PIC.PNG')).toBe('png')
  })
})

describe('formatBytes', () => {
  it('formats sizes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1023)).toBe('1023 B')
    expect(formatBytes(2048)).toContain('KB')
    expect(formatBytes(5 * 1024 * 1024)).toContain('MB')
  })
})
