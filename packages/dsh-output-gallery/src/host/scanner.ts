/**
 * Host workspace scanner: walks the session workspace conservatively, applying
 * include/exclude filtering and build-noise avoidance. Incremental by design —
 * the caller passes the last observed state and a current turn; this module
 * only reports current files + stats, and the indexer detects new/modified.
 *
 * No content is read here (stat only), which keeps scans cheap.
 */
import { lstat, readdir, readFile, stat } from 'node:fs/promises'
import { join, resolve, sep, posix } from 'node:path'
import { DEFAULT_CONFIG, parseConfigYml, mergeConfig, shouldTrack, CONFIG_FILE, type ParsedYml } from '../core/filter.ts'
import type { GalleryConfig } from '../core/types.ts'
import type { ScanFile } from '../core/indexer.ts'

export interface ScanOptions {
  workspace: string
  turn: number
  maxFiles?: number
  /** Override config; when undefined the workspace `.dsh/output-gallery.yml` is loaded. */
  config?: GalleryConfig
}

export interface ScanOutcome {
  files: ScanFile[]
  config: GalleryConfig
  configSource: 'default' | 'file'
  configPath: string | null
}

/** Walk rule: `**` matches any number of dirs, `*` any within a segment. */
function segmentRegExp(segment: string): RegExp | null {
  if (segment === '**') return /.*/
  if (!segment.includes('*') && !segment.includes('?')) return null
  let out = '^'
  for (const ch of segment) {
    if (ch === '*') out += '[^/]*'
    else if (ch === '?') out += '[^/]'
    else out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  out += '$'
  return new RegExp(out)
}

function dirMatchesInclude(relDir: string, include: readonly string[]): boolean {
  return include.some((pattern) => {
    const norm = pattern.replace(/\\/g, '/').replace(/\/$/, '')
    const hasGlob = norm.includes('*') || norm.includes('?')
    if (!hasGlob) return relDir === norm || relDir.startsWith(`${norm}/`)
    const parts = norm.split('/')
    const dirParts = relDir.split('/')
    let pi = 0
    for (let di = 0; di < dirParts.length; di++) {
      if (pi >= parts.length) break
      if (parts[pi] === '**') { pi++; di--; continue }
      const re = segmentRegExp(parts[pi])
      if (re && re.test(dirParts[di])) { pi++; continue }
      if (!re && parts[pi] === dirParts[di]) { pi++; continue }
      return false
    }
    return pi === parts.length
  })
}

/** Whether an include pattern targets a path under the given rel dir. */
function matchesIncludeDir(relDir: string, config: GalleryConfig): boolean {
  return config.include.some((pattern) => {
    const norm = pattern.replace(/\\/g, '/').replace(/\.\//, '').replace(/\/$/, '')
    const hasGlob = norm.includes('*') || norm.includes('?')
    if (!hasGlob) return relDir === norm || relDir.startsWith(`${norm}/`)
    return dirMatchesInclude(relDir, [norm])
  })
}

/**
 * Recursively walk a workspace, applying filter rules, returning scan files.
 * Only files (not dirs) are returned; directories are pruned when ignored.
 */
export async function scanWorkspace(options: ScanOptions): Promise<ScanOutcome> {
  const workspace = resolve(options.workspace)
  let config: GalleryConfig = options.config ?? DEFAULT_CONFIG
  let configSource: 'default' | 'file' = 'default'
  let configPath: string | null = null

  if (!options.config) {
    const cfgFile = join(workspace, ...CONFIG_FILE.split('/'))
    try {
      const raw = await readFile(cfgFile, 'utf8')
      const parsed = parseConfigYml(raw)
      if (parsed !== null) {
        config = mergeConfig(DEFAULT_CONFIG, parsed)
        configSource = 'file'
        configPath = cfgFile
      }
    } catch {
      // no config file — defaults
    }
  }

  const files: ScanFile[] = []
  const max = config.maxFiles
  const seen = new Set<string>()

  /** Whether a directory (relative posix path) may be descended into. */
  function dirAllowed(relPath: string, name: string): boolean {
    // Explicit include of a path under this dir forces descent regardless of
    // default ignore dirs.
    if (config.include.length > 0 && matchesIncludeDir(relPath, config)) return true
    // Config ignore dirs + core hard-ignored dirs prune.
    if (config.ignoreDirs.includes(name)) return false
    return shouldTrack(`${relPath}/__dir_probe__`, config) || config.include.length > 0
  }

  async function walk(dir: string, relDir: string): Promise<void> {
    if (files.length >= max) return
    let entries: import('node:fs').Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      if (files.length >= max) return
      const name = entry.name
      const relPath = relDir ? `${posix.join(relDir, name)}` : name

      if (entry.isDirectory()) {
        if (!dirAllowed(relPath, name)) continue
        await walk(join(dir, name), relPath)
        continue
      }

      if (!entry.isFile() && !entry.isSymbolicLink()) continue
      if (!shouldTrack(relPath, config)) continue
      if (seen.has(relPath)) continue
      seen.add(relPath)

      const abs = join(dir, name)
      try {
        const st = await lstat(abs)
        if (!st.isFile() && !st.isSymbolicLink()) continue
        const realStat = st.isSymbolicLink() ? await stat(abs) : st
        files.push({
          path: relPath.replace(/\\/g, '/'),
          absPath: abs,
          size: realStat.size,
          created: new Date(realStat.birthtime ?? realStat.ctime).toISOString(),
          modified: new Date(realStat.mtime).toISOString(),
        })
      } catch {
        // unreadable / broken symlink — skip
      }
    }
  }

  await walk(workspace, '')

  return { files, config, configSource, configPath }
}
