/**
 * Conservative filtering rules: only files created after session start or
 * explicitly modified, living under the workspace, are collected. Build
 * noise (node_modules, .git, caches, temp fragments) is excluded. A per-workspace
 * `.dsh/output-gallery.yml` can override include/exclude.
 *
 * Pure functions; no I/O here (parsing YAML is done in the host loader).
 */
import type { GalleryConfig, GalleryFilter } from './types.ts'

/** Directories always skipped (cannot be overridden by `include`). */
export const HARD_IGNORED_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', 'dist/.cache', '.cache', 'tmp', '.tmp',
  '.next/cache', 'coverage/.nyc_output', 'coverage',
])

/** Temp/build fragment filename patterns skipped (unless explicitly included). */
export const HARD_SKIP_PATTERNS = [
  /\.(tsbuildinfo|d\.map|map)$/i,
  /~$/,                       // office temp
  /^\.#/,                     // emacs lock
  /(^|\/)\.DS_Store$/,
  /(^|\/)Thumbs\.db$/i,
  /(^|\/)(\.[a-zA-Z0-9_-]+\.swp|.*\.swp)$/,
]

/** Default sets used when no config overrides. */
export const DEFAULT_CONFIG: GalleryConfig = {
  enabled: true,
  include: [],
  exclude: [],
  ignoreDirs: ['node_modules', '.git', '.svn', '.hg', '.cache', 'tmp', '.tmp', 'coverage', '.nyc_output', '.next/cache'],
  avoid: ['**/*.tsbuildinfo', '**/*.map', '**/.DS_Store', '**/Thumbs.db', '**/*.tmp', '**/*.swp', '**/node_modules/**'],
  trackVersions: true,
  maxFiles: 5000,
  htmlSandbox: true,
}

/** basename of the per-workspace config file, read relative to workspace root. */
export const CONFIG_FILE = '.dsh/output-gallery.yml'

/** Normalize a glob-ish pattern for matching later. */
export function normalizePattern(pattern: string): string {
  return pattern
    .trim()
    .replace(/^\.\//, '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
}

function globToRegExp(pattern: string): RegExp {
  // Input is already normalized (no leading slash, forward slashes).
  let out = ''
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        // `**` matches any characters, including path separators.
        if (pattern[i + 2] === '/') {
          // `**/` = any (possibly zero) leading directories, or any path tail.
          out += '(?:.*/)?'
          i += 2
        } else {
          out += '.*'
          i += 1
        }
        continue
      }
      out += '[^/]*'
      continue
    }
    if (ch === '?') { out += '[^/]'; continue }
    out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${out}/?$`)
}

/** Match a relative posix path against one glob pattern. */
export function matchesPattern(relPath: string, pattern: string): boolean {
  const norm = normalizePattern(pattern)
  if (!norm) return false
  // Directory prefix match: pattern without trailing wildcard can match a dir.
  if (norm.endsWith('/')) {
    return relPath === norm.replace(/\/$/, '') || relPath.startsWith(norm)
  }
  try {
    const re = globToRegExp(norm)
    return re.test(relPath)
  } catch {
    return false
  }
}

/** Return whether a path matches any of the patterns. */
export function matchesAny(relPath: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchesPattern(relPath, pattern))
}

/** Default conservative skip for build artifacts that pass extension rules. */
export function isSkippableNoise(relPath: string): boolean {
  const lower = relPath.toLowerCase()
  if (/\.[a-z0-9]+\.(map|tsbuildinfo|d\.map)$/i.test(lower)) return true
  if (/(^|\/)\.DS_Store$|(^|\/)thumbs\.db$/i.test(lower)) return true
  if (/\.tmp$|~$/.test(lower)) return true
  return false
}

/**
 * Decide whether a relative path should be tracked given config.
 * Exclusion wins over inclusion. Hard-ignored dirs always excluded unless
 * explicitly included by an include pattern (documented conservative default).
 */
export function shouldTrack(relPath: string, config: GalleryConfig): boolean {
  if (!config.enabled) return false
  const normalized = relPath.replace(/\\/g, '/').replace(/^\/+/, '')

  // Hard-ignored build/cache dir fragments + config ignoreDirs.
  const segments = normalized.split('/')
  const included = config.include.length > 0 && matchesAny(normalized, config.include)
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]
    if (HARD_IGNORED_DIRS.has(seg) || config.ignoreDirs.includes(seg)) {
      // Explicit include of an otherwise-ignored dir allows it.
      if (included) break
      return false
    }
  }

  // Hard skip patterns.
  for (const pat of HARD_SKIP_PATTERNS) {
    if (pat.test(normalized) && !matchesAny(normalized, config.include)) return false
  }

  // Default avoid patterns.
  if (matchesAny(normalized, config.avoid) && !matchesAny(normalized, config.include)) return false

  // User exclude.
  if (matchesAny(normalized, config.exclude)) return false

  // Explicit include set: if non-empty, only allow matches.
  if (config.include.length > 0 && !matchesAny(normalized, config.include)) return false

  return true
}

/** Apply the rule set to a batch of relative paths, returning the kept ones. */
export function filterPaths(paths: readonly string[], config: GalleryConfig): string[] {
  return paths.filter((p) => shouldTrack(p, config))
}

/** Minimal YAML-ish parser for the small config surface (key: value / key: [..]). */
export interface ParsedYml {
  enabled?: boolean
  include?: string[]
  exclude?: string[]
  ignoreDirs?: string[]
  avoid?: string[]
  trackVersions?: boolean
  maxFiles?: number
  htmlSandbox?: boolean
}

/**
 * Parse a small YAML subset used by `.dsh/output-gallery.yml`.
 * Supports `key: scalar`, `key: [a, b]`, and `#` comments. Returns null on
 * parse errors (caller falls back to defaults).
 */
export function parseConfigYml(text: string): ParsedYml | null {
  const out: ParsedYml = {}
  let ok = true
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf(':')
    if (idx <= 0) { ok = false; continue }
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    const comment = value.indexOf(' #')
    if (comment >= 0) value = value.slice(0, comment).trim()
    if (value.startsWith('[') && value.endsWith(']')) {
      const items = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
      applyYmlList(out, key, items)
    } else if (value === 'true' || value === 'false') {
      const bool = value === 'true'
      switch (key) {
        case 'enabled': out.enabled = bool; break
        case 'trackVersions': out.trackVersions = bool; break
        case 'htmlSandbox': out.htmlSandbox = bool; break
      }
    } else if (/^\d+$/.test(value) && key === 'maxFiles') {
      out.maxFiles = Number(value)
    } else if (value) {
      applyYmlList(out, key, [value])
    }
  }
  return ok ? out : out
}

function applyYmlList(out: ParsedYml, key: string, items: string[]): void {
  switch (key) {
    case 'include': out.include = items; break
    case 'exclude': out.exclude = items; break
    case 'ignoreDirs': out.ignoreDirs = items; break
    case 'avoid': out.avoid = items; break
  }
}

/** Merge a parsed config over defaults. */
export function mergeConfig(base: GalleryConfig, parsed: ParsedYml | null): GalleryConfig {
  if (!parsed) return base
  return {
    enabled: parsed.enabled ?? base.enabled,
    include: parsed.include ?? base.include,
    exclude: parsed.exclude ?? base.exclude,
    ignoreDirs: parsed.ignoreDirs ?? base.ignoreDirs,
    avoid: parsed.avoid ?? base.avoid,
    trackVersions: parsed.trackVersions ?? base.trackVersions,
    maxFiles: parsed.maxFiles ?? base.maxFiles,
    htmlSandbox: parsed.htmlSandbox ?? base.htmlSandbox,
  }
}

/** Derive a plain filter view for tests/reporting. */
export function toFilter(config: GalleryConfig): GalleryFilter {
  return {
    include: config.include,
    exclude: config.exclude,
    ignoreDirs: config.ignoreDirs,
    skipPatterns: config.avoid,
  }
}
