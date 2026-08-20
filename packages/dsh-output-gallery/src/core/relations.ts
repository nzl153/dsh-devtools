/**
 * Related-command recognition: pure logic that maps session tool-call events
 * to a human-readable "related command" for a gallery file.
 *
 * The host hands us a minimal event-shaped array (or the real DSH SessionEvent
 * array; we only read `type` / `seq` / `data`). This module stays DSH-free so
 * it can be unit tested without the harness.
 */

import { normalizeKey } from './version.ts'
import type { GallerySession, RelatedCommand } from './types.ts'

/** Minimal shape of a session event we understand. */
export interface EventLike {
  type?: string
  seq?: number
  data?: {
    name?: string
    arguments?: unknown
    turn?: number
  }
}

/** Known file-writing tool names whose path argument is authoritative. */
const FILE_PATH_TOOLS = new Set([
  'write',
  'edit',
  'write_text_file',
  'write_file',
  'read',
  'read_image',
  'str_replace_editor',
  'str-replace-editor',
])

/** Shell-like tools whose free-text `command` is matched by path mention. */
const COMMAND_TOOLS = new Set(['bash', 'pwsh', 'powershell', 'shell', 'sh'])

/** Path-like argument keys accepted by DSH tools. */
const PATH_KEYS = ['file_path', 'filePath', 'path', 'file', 'filename', 'output', 'outputPath', 'target', 'dest', 'destination']

/** Max command text kept in the UI. */
const COMMAND_MAX = 160

function normalizePath(value: string): string {
  return normalizeKey(value)
}

function isPathLike(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/** Check whether a shell command text mentions the target path or its basename. */
function commandMentionsPath(commandText: string, target: string): boolean {
  const cmd = commandText.replace(/\\/g, '/').toLowerCase()
  const t = normalizeKey(target).toLowerCase()
  if (cmd.includes(t)) return true
  const tBase = t.split('/').pop() ?? t
  if (tBase.length <= 1) return false
  const pattern = new RegExp(`(^|[\\s"'<>|&();$]*)${escapeRegExp(tBase)}($|[\\s"'<>|&();$])`)
  return pattern.test(cmd)
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function pathMatches(target: string, candidate: string): 'exact' | 'suffix' | 'basename' | null {
  const t = normalizePath(target)
  const c = normalizePath(candidate)
  if (c === t) return 'exact'
  // Absolute path pointing at the same file: `/ws/out/report.md` vs `out/report.md`.
  if (c.endsWith(`/${t}`)) return 'suffix'
  if (t.endsWith(`/${c}`)) return 'suffix'
  const tBase = t.split('/').pop() ?? t
  const cBase = c.split('/').pop() ?? c
  if (tBase === cBase && cBase.length > 1) return 'basename'
  return null
}

function parseArguments(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  if (typeof raw !== 'string' || raw.trim().length === 0) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

/** Collect path-like argument values for one tool call. */
function collectPathCandidates(args: Record<string, unknown>): string[] {
  const out: string[] = []
  for (const key of PATH_KEYS) {
    const value = args[key]
    if (isPathLike(value)) out.push(value)
  }
  return out
}

/** Extract the raw command text from bash/pwsh-style arguments. */
function collectCommandText(args: Record<string, unknown>): string | null {
  for (const key of ['command', 'cmd', 'script']) {
    const value = args[key]
    if (isPathLike(value)) return value
  }
  return null
}

/** Render a related command string for the UI. */
export function formatRelatedCommand(tool: string, args: Record<string, unknown>, path?: string): string {
  const commandText = collectCommandText(args)
  if (path) return `${tool} ${path}`
  if (commandText) return `${tool}: ${commandText}`
  const pathValue = collectPathCandidates(args)[0]
  if (pathValue) return `${tool} ${pathValue}`
  return tool
}

function truncate(text: string, max = COMMAND_MAX): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`
}

/**
 * Find the most relevant command related to `targetPath`.
 *
 * Strategy: newest high-confidence match (a file-writing tool whose path
 * argument points at the file) wins; if none exists, the newest shell command
 * that merely mentions the file path/basename is returned. Returns null when
 * nothing can be reliably recognized (UI shows "unknown").
 */
export function findRelatedCommand(events: readonly EventLike[], targetPath: string): RelatedCommand | null {
  const target = normalizeKey(targetPath)
  let bestHigh: RelatedCommand & { seq: number } | null = null
  let bestLow: RelatedCommand & { seq: number } | null = null

  for (const event of events) {
    if (!event || typeof event !== 'object') continue
    const type = event.type ?? ''
    const data = event.data ?? {}
    const name = data.name ?? ''
    if (!name) continue
    const seq = event.seq ?? 0
    const args = parseArguments(data.arguments)
    const turn = typeof data.turn === 'number' ? data.turn : undefined

    if (FILE_PATH_TOOLS.has(name)) {
      const candidates = collectPathCandidates(args)
      for (const candidate of candidates) {
        const match = pathMatches(target, candidate)
        if (match === 'exact' || match === 'suffix') {
          const rc: RelatedCommand = {
            tool: name,
            command: formatRelatedCommand(name, args, candidate),
            confidence: 'high',
            ...(turn !== undefined ? { turn } : {}),
          }
          if (!bestHigh || seq > bestHigh.seq) bestHigh = { ...rc, seq }
          break
        }
      }
      continue
    }

    if (COMMAND_TOOLS.has(name)) {
      const commandText = collectCommandText(args)
      if (!commandText) continue
      if (commandMentionsPath(commandText, target)) {
        const rc: RelatedCommand = {
          tool: name,
          command: truncate(formatRelatedCommand(name, args)),
          confidence: 'low',
          ...(turn !== undefined ? { turn } : {}),
        }
        if (!bestLow || seq > bestLow.seq) bestLow = { ...rc, seq }
      }
      continue
    }

    // Fallback: any tool with a path argument that matches the file.
    const candidates = collectPathCandidates(args)
    for (const candidate of candidates) {
      const match = pathMatches(target, candidate)
      if (match === 'exact' || match === 'suffix') {
        const rc: RelatedCommand = {
          tool: name,
          command: formatRelatedCommand(name, args, candidate),
          confidence: 'high',
          ...(turn !== undefined ? { turn } : {}),
        }
        if (!bestHigh || seq > bestHigh.seq) bestHigh = { ...rc, seq }
        break
      }
    }
  }

  return bestHigh ?? bestLow ?? null
}

/** True when any related command was found for the path. */
export function hasRelatedCommand(events: readonly EventLike[], targetPath: string): boolean {
  return findRelatedCommand(events, targetPath) !== null
}

/**
 * Attach `relatedCommand` to every file in a gallery session based on the
 * session events. When no events are available (e.g. a store-only read), the
 * session is returned unchanged so previously persisted relations survive.
 */
export function applyRelatedCommands(session: GallerySession, events: readonly EventLike[]): GallerySession {
  if (!events || events.length === 0) return session
  const files = session.files.map((file) => ({
    ...file,
    relatedCommand: findRelatedCommand(events, file.path),
  }))
  return { ...session, files }
}