/**
 * Real node:fs implementation of HostFs (default adapter).
 */
import { promises as fs, type Stats } from 'node:fs'
import { dirname } from 'node:path'
import type { FsFileInfo, HostFs } from './fsh.ts'

function toInfo(st: Stats): FsFileInfo {
  return { size: st.size, mtimeMs: st.mtimeMs, isDirectory: st.isDirectory(), isFile: st.isFile() }
}

export const nodeFs: HostFs = {
  async stat(absPath) {
    return toInfo(await fs.stat(absPath))
  },
  async readFile(absPath) {
    return fs.readFile(absPath)
  },
  async readdir(absPath) {
    return fs.readdir(absPath)
  },
  async writeFile(absPath, data) {
    await fs.writeFile(absPath, data)
  },
  async mkdirp(absPath) {
    await fs.mkdir(absPath, { recursive: true })
  },
  async unlink(absPath) {
    await fs.unlink(absPath)
  },
  async rename(from, to) {
    await fs.rename(from, to)
  },
  async exists(absPath) {
    try {
      await fs.access(absPath)
      return true
    } catch {
      return false
    }
  },
}

export function parentDir(absFilePath: string): string {
  return dirname(absFilePath)
}
