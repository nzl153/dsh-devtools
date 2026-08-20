/**
 * Host file-system abstraction.
 *
 * The core engine depends on this narrow interface instead of node:fs directly
 * so unit tests can use an in-memory implementation without touching the real
 * disk. The real implementation lives in `nodeFs.ts` and is the default.
 */
import type { FileKind } from './types.ts'

export interface FsFileInfo {
  readonly size: number
  readonly mtimeMs: number
  readonly isDirectory: boolean
  readonly isFile: boolean
}

export interface HostFs {
  stat(absPath: string): Promise<FsFileInfo>
  readFile(absPath: string): Promise<Buffer>
  readdir(absPath: string): Promise<string[]>
  writeFile(absPath: string, data: Buffer): Promise<void>
  mkdirp(absPath: string): Promise<void>
  unlink(absPath: string): Promise<void>
  rename(from: string, to: string): Promise<void>
  /** Optional: expose whether a path exists (defaults to stat-throw semantics). */
  exists?(absPath: string): Promise<boolean>
}

/** Default kind detection by extension / content sniffing. */
export function kindFromBuffer(buf: Buffer): FileKind {
  if (buf.length === 0) return 'text'
  if (buf.includes(0)) return 'binary'
  return 'text'
}

/** sha256 hex of a buffer. */
export async function sha256(buf: Buffer): Promise<string> {
  const { createHash } = await import('node:crypto')
  return createHash('sha256').update(buf).digest('hex')
}
