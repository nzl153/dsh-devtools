/**
 * In-memory HostFs implementation for unit tests. No disk, no git subprocess.
 */
import type { FsFileInfo, HostFs } from '../../src/core/fsh.ts'

interface MemEntry {
  kind: 'file' | 'dir'
  data: Buffer | null
  mtimeMs: number
}

export class MemFs implements HostFs {
  private root = new Map<string, MemEntry>()

  constructor(seed: Record<string, string | Buffer> = {}) {
    this.mkdirpSync('/')
    for (const [rel, content] of Object.entries(seed)) {
      this.writeFileSync('/' + rel, Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8'))
    }
  }

  private mkdirpSync(absPath: string): void {
    const parts = this.key(absPath).split('/').filter(Boolean)
    let cur = '/'
    this.root.set('/', { kind: 'dir', data: null, mtimeMs: Date.now() })
    for (const part of parts) {
      cur = cur === '/' ? '/' + part : cur + '/' + part
      if (!this.root.has(cur)) {
        this.root.set(cur, { kind: 'dir', data: null, mtimeMs: Date.now() })
      }
    }
  }

  private writeFileSync(absPath: string, data: Buffer): void {
    const k = this.key(absPath)
    this.mkdirpSync(this.parentKey(absPath))
    this.root.set(k, { kind: 'file', data: Buffer.from(data), mtimeMs: Date.now() })
  }

  private key(abs: string): string {
    const norm = abs.replaceAll('\\', '/').replace(/\/+$/, '')
    return norm
  }

  private parentKey(abs: string): string {
    const k = this.key(abs)
    const idx = k.lastIndexOf('/')
    return idx <= 0 ? '/' : k.slice(0, idx)
  }

  async mkdirp(absPath: string): Promise<void> {
    this.mkdirpSync(absPath)
  }

  async stat(absPath: string): Promise<FsFileInfo> {
    const k = this.key(absPath)
    const entry = this.root.get(k)
    if (!entry) throw new Error(`ENOENT: ${absPath}`)
    return {
      size: entry.data?.length ?? 0,
      mtimeMs: entry.mtimeMs,
      isDirectory: entry.kind === 'dir',
      isFile: entry.kind === 'file',
    }
  }

  async readFile(absPath: string): Promise<Buffer> {
    const k = this.key(absPath)
    const entry = this.root.get(k)
    if (!entry || entry.kind !== 'file') throw new Error(`ENOENT: ${absPath}`)
    return entry.data!
    // copy to avoid mutation surprises
  }

  async readdir(absPath: string): Promise<string[]> {
    const k = this.key(absPath)
    if (!this.root.has(k) || this.root.get(k)!.kind !== 'dir') throw new Error(`ENOTDIR: ${absPath}`)
    const prefix = k === '/' ? '/' : k + '/'
    const names = new Set<string>()
    for (const key of this.root.keys()) {
      if (key === k) continue
      if (key.startsWith(prefix)) {
        const rest = key.slice(prefix.length)
        const first = rest.split('/')[0]
        if (first) names.add(first)
      }
    }
    return Array.from(names).sort()
  }

  async writeFile(absPath: string, data: Buffer): Promise<void> {
    this.writeFileSync(absPath, data)
  }

  async unlink(absPath: string): Promise<void> {
    const k = this.key(absPath)
    if (!this.root.delete(k)) throw new Error(`ENOENT: ${absPath}`)
  }

  async rename(from: string, to: string): Promise<void> {
    const fk = this.key(from)
    const tk = this.key(to)
    const entry = this.root.get(fk)
    if (!entry) throw new Error(`ENOENT: ${from}`)
    this.root.delete(fk)
    await this.mkdirp(this.parentKey(to))
    this.root.set(tk, entry)
  }

  async exists(absPath: string): Promise<boolean> {
    return this.root.has(this.key(absPath))
  }

  /** Test helper: read a file's text. */
  async readText(rel: string): Promise<string> {
    return (await this.readFile(rel)).toString('utf8')
  }
}
