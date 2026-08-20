/**
 * Workspace scanner: walks a directory tree, applies ignore rules, and computes
 * per-file scan entries (kind / hash / size / mtime). Pure logic over HostFs —
 * never touches DSH, so it is unit-testable in isolation.
 */
import path from 'node:path'
import { kindFromBuffer, sha256, type HostFs } from './fsh.ts'
import type { EngineConfig, ScanEntry } from './types.ts'

export class WorkspaceScanner {
  private readonly fs: HostFs
  private readonly config: EngineConfig

  constructor(fs: HostFs, config: EngineConfig) {
    this.fs = fs
    this.config = config
  }

  private normalize(parts: string[]): string {
    return parts.join('/')
  }

  private isIgnored(rel: string, isDir: boolean): boolean {
    const base = path.basename(rel)
    if (isDir) {
      return this.config.ignoreDirs.some((d) => d === base || d === rel)
    }
    return this.config.ignoreFiles.some((f) => f === base || f === rel)
  }

  /**
   * Scan the workspace tree. Returns entries keyed by relative path (forward
   * slashes). Stops early once `maxScannedFiles` is exceeded.
   */
  async scan(workspace: string): Promise<Map<string, ScanEntry>> {
    const out = new Map<string, ScanEntry>()
    let budget = this.config.maxScannedFiles
    const walk = async (dir: string, parts: string[]): Promise<void> => {
      if (budget <= 0) return
      let names: string[]
      try {
        names = await this.fs.readdir(dir)
      } catch {
        return
      }
      names.sort()
      for (const name of names) {
        if (budget <= 0) return
        const abs = path.join(dir, name)
        let info
        try {
          info = await this.fs.stat(abs)
        } catch {
          continue
        }
        const nextParts = [...parts, name]
        const rel = this.normalize(nextParts)
        if (info.isDirectory) {
          if (this.isIgnored(rel, true)) continue
          await walk(abs, nextParts)
          continue
        }
        if (!info.isFile) continue
        if (this.isIgnored(rel, false)) continue
        budget--
        let content: Buffer | null = null
        try {
          content = await this.fs.readFile(abs)
        } catch {
          continue
        }
        const kind = kindFromBuffer(content)
        const hash = await sha256(content)
        out.set(rel, {
          relPath: rel,
          kind,
          hash,
          size: info.size,
          mtimeMs: info.mtimeMs,
        })
      }
    }
    try {
      const info = await this.fs.stat(workspace)
      if (!info.isDirectory) throw new Error(`workspace is not a directory: ${workspace}`)
    } catch (error) {
      throw new Error(`cannot scan workspace ${workspace}: ${error instanceof Error ? error.message : String(error)}`)
    }
    await walk(workspace, [])
    return out
  }

  async readBytes(absPath: string): Promise<Buffer> {
    return this.fs.readFile(absPath)
  }
}
