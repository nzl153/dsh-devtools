/**
 * Host preview: reads a tracked file's content live from disk and returns a
 * safe, bounded payload for the client. Executable artifacts and disallowed
 * types return metadata-only `none`. HTML is served as text to be rendered in
 * a sandboxed iframe by the client. ZIP is listed from its central directory —
 * never extracted or executed.
 */
import { readFile, stat } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { looksLikeZip } from './zip.ts'
import { classifyPath } from '../core/classify.ts'
import { safetyForPath, previewByteLimit } from '../core/safety.ts'
import type { GalleryConfig, PreviewPayload } from '../core/types.ts'
import type { GalleryFile } from '../core/types.ts'

/** Max bytes read for text previews. */
const TEXT_LIMIT = 256 * 1024

/** Strip UTF-8 BOM and control chars for safe inline rendering. */
function sanitizeText(buf: Buffer): string {
  let text = buf.toString('utf8')
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  // Replace lone control chars (not newlines/tabs) to avoid terminal injection.
  // eslint-disable-next-line no-control-regex
  text = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '\uFFFD')
  return text
}

/** Read first N bytes of a file (capped). */
async function readCapped(absPath: string, limit: number): Promise<Buffer> {
  const { open } = await import('node:fs/promises')
  const handle = await open(absPath, 'r')
  try {
    const buf = Buffer.alloc(limit + 1)
    const { bytesRead } = await handle.read(buf, 0, limit + 1, 0)
    return buf.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

/**
 * Build a preview payload for a tracked file. `workspace` is the resolved
 * session workspace root; the path must resolve inside it (path traversal
 * guard).
 */
export async function buildPreview(
  file: GalleryFile,
  config: GalleryConfig,
  workspace: string,
): Promise<PreviewPayload> {
  const absPath = file.absPath ?? resolveWorkspacePath(workspace, file.path)
  const verdict = safetyForPath(file.path, config.htmlSandbox)

  if (!verdict.allowPreview || verdict.kind === 'none') {
    return { kind: 'none', reason: verdict.reason ?? 'not previewable' }
  }

  try {
    await stat(absPath)
  } catch {
    return { kind: 'none', reason: 'file not found on disk' }
  }

  const kind = verdict.kind
  try {
    if (kind === 'image') {
      const buf = await readFile(absPath)
      const dataUrl = `data:${file.mime};base64,${buf.toString('base64')}`
      return { kind: 'image', dataUrl, mime: file.mime }
    }
    if (kind === 'svg') {
      const buf = await readCapped(absPath, TEXT_LIMIT)
      const content = sanitizeText(buf)
      return { kind: 'svg', content }
    }
    if (kind === 'html') {
      const buf = await readCapped(absPath, TEXT_LIMIT)
      return { kind: 'html', content: sanitizeText(buf), sandbox: true }
    }
    if (kind === 'zip') {
      const entries = await looksLikeZip(absPath)
      return { kind: 'zip', entries }
    }
    if (kind === 'json') {
      const buf = await readCapped(absPath, TEXT_LIMIT)
      const text = sanitizeText(buf)
      let tree: unknown = null
      try {
        tree = JSON.parse(text)
      } catch {
        // fall through to text rendering
        return { kind: 'text', content: text, text }
      }
      return { kind: 'json', tree, content: text }
    }
    if (kind === 'csv') {
      const buf = await readCapped(absPath, TEXT_LIMIT)
      const text = sanitizeText(buf)
      const rows = text
        .split(/\r?\n/)
        .filter((line, idx, arr) => line.length > 0 || idx < arr.length - 1)
        .map((line) => splitCsvLine(line))
      const headers = rows[0] ?? []
      const body = rows.slice(1)
      return { kind: 'csv', headers, rows: body }
    }
    if (kind === 'markdown') {
      // Markdown is rendered as plain, escaped text (or a sandboxed iframe by
      // the client). We never convert raw Markdown to HTML server-side, so no
      // dangerouslySetInnerHTML can ever run model-authored markup.
      const buf = await readCapped(absPath, TEXT_LIMIT)
      const text = sanitizeText(buf)
      return { kind: 'markdown', content: text, text }
    }
    if (kind === 'pdf') {
      return { kind: 'pdf', url: `/plugins/dsh-output-gallery/file/${encodeURIComponent(file.path)}`, inline: true }
    }
    // text / code
    const buf = await readCapped(absPath, TEXT_LIMIT)
    const text = sanitizeText(buf)
    return { kind: 'text', content: text, text }
  } catch (error) {
    return { kind: 'none', reason: error instanceof Error ? error.message : 'preview failed' }
  }
}

/** Resolve a relative gallery path under a workspace, guarding traversal. */
export function resolveWorkspacePath(workspace: string, relPath: string): string {
  const root = resolve(workspace)
  const candidate = resolve(root, relPath)
  const rootParts = root.split(sep)
  const candParts = candidate.split(sep)
  for (let i = 0; i < rootParts.length; i++) {
    if (rootParts[i] !== candParts[i]) throw new Error('path escapes workspace')
  }
  return candidate
}

/** Simple CSV line splitter (handles quoted fields minimally). */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = false
      } else cur += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}
