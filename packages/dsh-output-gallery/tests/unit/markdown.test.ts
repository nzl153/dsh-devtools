import { describe, expect, it } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildPreview } from '../../src/host/preview.ts'
import { DEFAULT_CONFIG } from '../../src/core/filter.ts'
import type { GalleryFile } from '../../src/core/types.ts'

function markdownFile(absPath: string, content: string): GalleryFile {
  return {
    path: 'README.md',
    absPath,
    category: 'documents',
    previewKind: 'markdown',
    risk: 'safe',
    mime: 'text/markdown',
    size: Buffer.byteLength(content),
    created: '2026-01-01T00:00:00.000Z',
    modified: '2026-01-01T00:00:00.000Z',
    firstSeenTurn: 1,
    modifiedTurn: null,
    changed: false,
    previewAvailable: true,
    associatedTurn: 1,
  }
}

describe('markdown safe preview', () => {
  it('returns markdown payload as plain text (never rendered HTML)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gallery-md-'))
    const filePath = join(dir, 'README.md')
    const content = '# Hello\n\n<script>alert(1)</script>\n\n**bold**'
    await writeFile(filePath, content, 'utf8')
    try {
      const payload = await buildPreview(markdownFile(filePath, content), DEFAULT_CONFIG, dir)
      expect(payload.kind).toBe('markdown')
      expect(payload.kind === 'markdown' && payload.content).toContain('<script>')
      // The raw Markdown is preserved for the client to render as a text node;
      // no HTML conversion happens on the server.
      expect(payload.kind === 'markdown' && payload.content).toBe(content)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('classifies .md as markdown preview kind', async () => {
    const { classifyPath } = await import('../../src/core/classify.ts')
    expect(classifyPath('README.md').previewKind).toBe('markdown')
  })
})