/**
 * Field extraction: filenames, commands, errors, and outcome from DSH events.
 * Pure functions, no DSH import.
 */

const WINDOWS_PATH_RE = /(?:[A-Za-z]:[\\/]|(?:\.{1,2}[\\/])+)[^"'\s<>]*[^"'\s<>\\/.]/g
const POSIX_PATH_RE = /(?:\/[\w.-]+\/|(?:\.{1,2}\/)+)[^"'\s<>]*/g
const EXT_RE = /\.(?:ts|tsx|js|jsx|json|py|md|c|h|cpp|rs|go|java|sh|ps1|yml|yaml|toml|css|html|sql|mjs|cjs|vue|svelte|zig|rb|php|kt|swift|dart|cs|xml)$/i

/** Extract plausible file paths from a text blob. */
export function extractFileMentions(text: string, limit = 40): string[] {
  if (!text) return []
  const out = new Set<string>()
  const push = (m: string): void => {
    const clean = m.trim()
    if (!clean) return
    // drop trailing punctuation
    const norm = clean.replace(/[),"'\]]+$/, '')
    if (norm.length > 1) out.add(norm)
  }
  for (const m of text.matchAll(WINDOWS_PATH_RE)) push(m[0])
  for (const m of text.matchAll(POSIX_PATH_RE)) {
    // only keep token that looks file-like (has extension or is clearly a path)
    if (EXT_RE.test(m[0]) || m[0].includes('/') || m[0].includes('\\')) push(m[0])
  }
  return [...out].slice(0, limit)
}

/** Extract shell command strings from tool arguments (bash/pwsh/git/…). */
export function extractCommands(toolName: string, argumentsText: string, limit = 20): string[] {
  if (!toolName || typeof argumentsText !== 'string') return []
  const lower = toolName.toLowerCase()
  const isShell = ['bash', 'pwsh', 'powershell', 'cmd', 'sh', 'shell', 'zsh', 'git', 'node', 'npm', 'pnpm', 'python'].includes(lower)
  if (!isShell) return []
  const out: string[] = []
  try {
    const parsed = JSON.parse(argumentsText) as Record<string, unknown>
    const candidates = [parsed['command'], parsed['cmd'], parsed['script'], parsed['args']]
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) {
        out.push(c.trim().slice(0, 400))
      } else if (Array.isArray(c)) {
        const joined = c.map((x) => String(x)).join(' ')
        if (joined.trim()) out.push(joined.trim().slice(0, 400))
      }
    }
  } catch {
    // fall through to raw regex scan
  }
  if (out.length === 0) {
    // heuristic: `"command": "..."` in raw JSON-lite text
    const re = /["'](?:command|cmd|script)["']\s*:\s*["']([^"']{1,400})["']/g
    for (const m of argumentsText.matchAll(re)) out.push(m[1])
  }
  return [...new Set(out.map((c) => c.trim()).filter(Boolean))].slice(0, limit)
}

const ERROR_HINTS = [
  'error', 'failed', 'failure', 'exception', 'traceback', 'exit code',
  'non-zero', 'rejected', 'timeout', 'cannot find', 'not found', 'ENOENT',
  'EACCES', 'syntaxerror', 'typeerror', 'referenceerror', 'uncaught',
]

/** Extract error-ish fragments ("summary") from a tool result or assistant text. */
export function extractErrors(text: string, limit = 8): string[] {
  if (!text) return []
  const out: string[] = []
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  for (const line of lines) {
    const lower = line.toLowerCase()
    if (lower.length > 240) continue
    if (ERROR_HINTS.some((h) => lower.includes(h))) {
      // dedupe with short signature
      const sig = line.slice(0, 60)
      if (!out.some((o) => o.slice(0, 60) === sig)) out.push(line)
      if (out.length >= limit) break
    }
  }
  return out
}

/** Classify turn/end reason into a human outcome string. */
export function outcomeText(reason: unknown): string | null {
  if (reason && typeof reason === 'object') {
    const r = reason as { kind?: string }
    if (typeof r.kind === 'string') return r.kind
  }
  if (typeof reason === 'string') return reason
  return null
}
