/**
 * Pure file classification: extension -> category / preview kind / mime / risk.
 *
 * No I/O. Used by both the host scanner and unit tests.
 */
import type { GalleryCategory, PreviewKind, RiskLevel } from './types.ts'

interface ExtRule {
  category: GalleryCategory
  preview?: PreviewKind
  mime: string
  risk?: RiskLevel
}

/** Executable / dangerous-to-execute extensions: metadata only, never executed,
 * and never opened as a sandbox preview. */
const DANGEROUS = new Set([
  'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'ps1', 'psm1', 'dll', 'so', 'dylib',
  'sh', 'bash', 'zsh', 'fish', 'pyc', 'pyo', 'class', 'jar', 'app', 'appimage',
  'deb', 'rpm', 'apk', 'msix', 'dmg', 'pkg', 'vb', 'vbs', 'js' /* note: js is both code and executable in host — we keep it as code preview, no execution */,
])

const RULES: Record<string, ExtRule> = {
  // Images
  png: { category: 'images', preview: 'image', mime: 'image/png' },
  jpg: { category: 'images', preview: 'image', mime: 'image/jpeg' },
  jpeg: { category: 'images', preview: 'image', mime: 'image/jpeg' },
  gif: { category: 'images', preview: 'image', mime: 'image/gif' },
  webp: { category: 'images', preview: 'image', mime: 'image/webp' },
  bmp: { category: 'images', preview: 'image', mime: 'image/bmp' },
  avif: { category: 'images', preview: 'image', mime: 'image/avif' },
  ico: { category: 'images', preview: 'image', mime: 'image/x-icon' },
  svg: { category: 'images', preview: 'svg', mime: 'image/svg+xml' },

  // Documents
  html: { category: 'documents', preview: 'html', mime: 'text/html', risk: 'watch' },
  htm: { category: 'documents', preview: 'html', mime: 'text/html', risk: 'watch' },
  pdf: { category: 'documents', preview: 'pdf', mime: 'application/pdf' },
  md: { category: 'documents', preview: 'markdown', mime: 'text/markdown' },
  markdown: { category: 'documents', preview: 'markdown', mime: 'text/markdown' },
  txt: { category: 'documents', preview: 'text', mime: 'text/plain' },
  rtf: { category: 'documents', preview: 'text', mime: 'application/rtf' },
  docx: { category: 'documents', preview: 'none', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  doc: { category: 'documents', preview: 'none', mime: 'application/msword' },
  pptx: { category: 'documents', preview: 'none', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  xlsx: { category: 'documents', preview: 'none', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },

  // Builds (executable artifacts / archives / compiled output)
  zip: { category: 'builds', preview: 'zip', mime: 'application/zip' },
  tar: { category: 'builds', preview: 'zip', mime: 'application/x-tar' },
  gz: { category: 'builds', preview: 'zip', mime: 'application/gzip' },
  'tar.gz': { category: 'builds', preview: 'zip', mime: 'application/gzip' },
  'tgz': { category: 'builds', preview: 'zip', mime: 'application/gzip' },
  '7z': { category: 'builds', preview: 'zip', mime: 'application/x-7z-compressed' },
  rar: { category: 'builds', preview: 'zip', mime: 'application/vnd.rar' },
  exe: { category: 'builds', preview: 'none', mime: 'application/x-msdownload', risk: 'danger' },
  msi: { category: 'builds', preview: 'none', mime: 'application/x-msi', risk: 'danger' },
  apk: { category: 'builds', preview: 'none', mime: 'application/vnd.android.package-archive', risk: 'danger' },
  dmg: { category: 'builds', preview: 'none', mime: 'application/x-apple-diskimage', risk: 'danger' },
  deb: { category: 'builds', preview: 'none', mime: 'application/vnd.debian.binary-package', risk: 'danger' },
  rpm: { category: 'builds', preview: 'none', mime: 'application/x-rpm', risk: 'danger' },
  jar: { category: 'builds', preview: 'none', mime: 'application/java-archive', risk: 'danger' },
  wasm: { category: 'builds', preview: 'none', mime: 'application/wasm', risk: 'watch' },

  // Data
  json: { category: 'data', preview: 'json', mime: 'application/json' },
  csv: { category: 'data', preview: 'csv', mime: 'text/csv' },
  tsv: { category: 'data', preview: 'csv', mime: 'text/tab-separated-values' },
  yaml: { category: 'data', preview: 'code', mime: 'application/yaml' },
  yml: { category: 'data', preview: 'code', mime: 'application/yaml' },
  xml: { category: 'data', preview: 'code', mime: 'application/xml' },
  toml: { category: 'data', preview: 'code', mime: 'application/toml' },
  ini: { category: 'data', preview: 'code', mime: 'text/plain' },
  cfg: { category: 'data', preview: 'code', mime: 'text/plain' },
  conf: { category: 'data', preview: 'code', mime: 'text/plain' },
  log: { category: 'data', preview: 'text', mime: 'text/plain' },

  // Code (documents, non-executed)
  ts: { category: 'documents', preview: 'code', mime: 'text/typescript' },
  tsx: { category: 'documents', preview: 'code', mime: 'text/typescript-jsx' },
  js: { category: 'documents', preview: 'code', mime: 'text/javascript', risk: 'watch' },
  jsx: { category: 'documents', preview: 'code', mime: 'text/jsx', risk: 'watch' },
  mjs: { category: 'documents', preview: 'code', mime: 'text/javascript', risk: 'watch' },
  cjs: { category: 'documents', preview: 'code', mime: 'text/javascript', risk: 'watch' },
  py: { category: 'documents', preview: 'code', mime: 'text/x-python', risk: 'watch' },
  rs: { category: 'documents', preview: 'code', mime: 'text/rust' },
  go: { category: 'documents', preview: 'code', mime: 'text/x-go' },
  java: { category: 'documents', preview: 'code', mime: 'text/x-java' },
  c: { category: 'documents', preview: 'code', mime: 'text/x-c' },
  h: { category: 'documents', preview: 'code', mime: 'text/x-c-header' },
  cpp: { category: 'documents', preview: 'code', mime: 'text/x-c++' },
  cs: { category: 'documents', preview: 'code', mime: 'text/x-csharp' },
  css: { category: 'documents', preview: 'code', mime: 'text/css' },
  scss: { category: 'documents', preview: 'code', mime: 'text/x-scss' },
  sql: { category: 'documents', preview: 'code', mime: 'text/x-sql' },
  graphql: { category: 'documents', preview: 'code', mime: 'application/graphql' },
  dockerfile: { category: 'documents', preview: 'code', mime: 'text/plain' },
  jsonc: { category: 'data', preview: 'json', mime: 'application/json' },
}

/** Known printable text/code extensions for generic fallback. */
const TEXT_CODES = new Set([
  'txt', 'md', 'markdown', 'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'rs',
  'go', 'java', 'c', 'h', 'cpp', 'cs', 'css', 'scss', 'sql', 'graphql', 'yaml',
  'yml', 'xml', 'toml', 'ini', 'cfg', 'conf', 'log', 'json', 'jsonc', 'csv',
  'tsv', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd', 'html', 'htm',
])

/** Extract a normalized extension (lowercase, handles dotted like tar.gz). */
export function extensionOf(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? filename
  const lower = base.toLowerCase()
  // multi-part extensions first
  for (const ext of ['tar.gz', 'tar.xz']) {
    if (lower.endsWith(`.${ext}`)) return ext
  }
  const idx = lower.lastIndexOf('.')
  return idx > 0 ? lower.slice(idx + 1) : ''
}

/** Guess an overall MIME for files with no rule. */
function guessMime(ext: string): string {
  if (ext === 'ts' || ext === 'tsx') return 'text/typescript'
  if (TEXT_CODES.has(ext)) return 'text/plain'
  if (/^[0-9a-z]{2,4}$/.test(ext)) return `application/octet-stream`
  return 'application/octet-stream'
}

/** Classify a filename into category/preview/mime/risk. */
export function classifyPath(filename: string): {
  category: GalleryCategory
  previewKind: PreviewKind
  mime: string
  risk: RiskLevel
} {
  const ext = extensionOf(filename)
  const rule = RULES[ext]
  if (rule) {
    return {
      category: rule.category,
      previewKind: rule.preview ?? 'none',
      mime: rule.mime,
      risk: rule.risk ?? (DANGEROUS.has(ext) ? 'danger' : 'safe'),
    }
  }
  if (DANGEROUS.has(ext)) {
    return { category: 'builds', previewKind: 'none', mime: guessMime(ext), risk: 'danger' }
  }
  if (TEXT_CODES.has(ext)) {
    return { category: 'documents', previewKind: 'code', mime: guessMime(ext), risk: 'safe' }
  }
  return { category: 'data', previewKind: 'none', mime: guessMime(ext), risk: 'safe' }
}

/** Human-readable byte size formatting (client display). */
export function formatBytes(size: number): string {
  if (size < 0) return '0 B'
  if (size < 1024) return `${size} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = size
  let unit = ''
  for (const u of units) {
    value /= 1024
    unit = u
    if (value < 1024) break
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${unit}`
}
