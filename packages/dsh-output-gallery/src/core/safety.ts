/**
 * Preview safety: decides whether a file may be previewed and what content is
 * safe to return. Dangerous/executable files only show metadata. HTML is only
 * shown inside a sandboxed iframe. ZIP is listed, never extracted/executed.
 *
 * Pure decision logic; reading file bytes happens in the host preview module.
 */
import type { PreviewKind, RiskLevel } from './types.ts'
import { classifyPath } from './classify.ts'

/** Preview kinds that require reading actual file content. */
export const CONTENT_PREVIEWS: ReadonlySet<PreviewKind> = new Set([
  'text', 'code', 'json', 'html', 'svg', 'csv', 'zip', 'markdown',
])

/** Whether a given preview kind reads file bytes (vs metadata-only). */
export function readsContent(kind: PreviewKind): boolean {
  return CONTENT_PREVIEWS.has(kind)
}

/** Default max bytes read for a text/JSON/HTML preview. */
export const TEXT_PREVIEW_LIMIT = 256 * 1024 // 256 KB

/** Default max bytes read for ZIP entry listing (header only). */
export const ZIP_PREVIEW_LIMIT = 4 * 1024 * 1024 // 4 MB (whole archive read to list entries)

/**
 * Compute a preview kind's safe status.
 * - risk === 'danger' -> never preview content.
 * - html -> sandboxed (iframe sandbox=""), still served as text.
 * - everything else -> previewable under read limits.
 */
export interface SafetyVerdict {
  kind: PreviewKind
  risk: RiskLevel
  allowPreview: boolean
  allowDownload: boolean
  sandboxed: boolean
  reason: string | null
}

/** Determine preview/download safety for a path. */
export function safetyForPath(path: string, htmlSandbox: boolean): SafetyVerdict {
  const { previewKind, risk } = classifyPath(path)

  if (risk === 'danger') {
    return {
      kind: previewKind,
      risk,
      allowPreview: false,
      allowDownload: false,
      sandboxed: false,
      reason: 'executable artifact — metadata only, not previewed or executed',
    }
  }

  if (previewKind === 'html') {
    if (!htmlSandbox) {
      return {
        kind: previewKind,
        risk,
        allowPreview: false,
        allowDownload: false,
        sandboxed: false,
        reason: 'HTML preview disabled by config (htmlSandbox=false)',
      }
    }
    return {
      kind: previewKind,
      risk,
      allowPreview: true,
      allowDownload: true,
      sandboxed: true,
      reason: null,
    }
  }

  const sandboxed = previewKind === 'svg' // inlined SVG is treated as inert markup
  return {
    kind: previewKind,
    risk,
    allowPreview: previewKind !== 'none',
    allowDownload: true,
    sandboxed,
    reason: previewKind === 'none' ? 'no preview available for this type' : null,
  }
}

/** Largest allowed preview byte size for a kind (host reads capped). */
export function previewByteLimit(kind: PreviewKind): number {
  if (kind === 'zip') return ZIP_PREVIEW_LIMIT
  return TEXT_PREVIEW_LIMIT
}

/** Whether a path's MIME would be served as an image data URL (image kinds). */
export function isImageKind(kind: PreviewKind): boolean {
  return kind === 'image' || kind === 'svg'
}
