/**
 * Minimal ZIP reader: lists central-directory entries from a ZIP archive.
 * No extraction, no code execution. Reads the End of Central Directory (EOCD)
 * and walks central directory entries.
 *
 * Only used for preview listing; supports the common local file header +
 * central directory layout used by typical ZIP tools.
 */
import { open } from 'node:fs/promises'
import type { ZipEntry } from '../core/types.ts'

/** Read bytes at an absolute offset. */
async function readAt(handle: Awaited<ReturnType<typeof open>>, offset: number, length: number): Promise<Buffer> {
  const buf = Buffer.alloc(length)
  const { bytesRead } = await handle.read(buf, 0, length, offset)
  return buf.subarray(0, bytesRead)
}

interface FoundEocd {
  offset: number
  count: number
  centralSize: number
  centralOffset: number
}

async function findEocd(handle: Awaited<ReturnType<typeof open>>, fileSize: number): Promise<FoundEocd | null> {
  const maxSearch = Math.min(fileSize, 65557)
  const start = Math.max(0, fileSize - maxSearch)
  const tail = await readAt(handle, start, fileSize - start)
  const sig = Buffer.from([0x50, 0x4b, 0x05, 0x06])
  const idx = tail.lastIndexOf(sig)
  if (idx < 0) return null
  const eocdPos = start + idx
  if (eocdPos + 22 > fileSize) return null
  const buf = await readAt(handle, eocdPos, 22)
  const count = buf.readUInt16LE(10)
  const centralSize = buf.readUInt32LE(12)
  const centralOffset = buf.readUInt32LE(16)
  return { offset: eocdPos, count, centralSize, centralOffset }
}

/** List ZIP central directory entries. Throws if the file is not a ZIP. */
export async function looksLikeZip(absPath: string): Promise<ZipEntry[]> {
  const handle = await open(absPath, 'r')
  try {
    const st = await handle.stat()
    if (st.size < 22) throw new Error('not a zip archive')
    const eocd = await findEocd(handle, st.size)
    if (!eocd) throw new Error('zip end-of-central-directory not found')
    if (eocd.count > 100000) throw new Error('zip entry count too large')

    const entries: ZipEntry[] = []
    const buf = await readAt(handle, eocd.centralOffset, Math.min(eocd.centralSize, 8 * 1024 * 1024))
    let pos = 0
    for (let i = 0; i < eocd.count; i++) {
      if (buf.readUInt32LE(pos) !== 0x02014b50) {
        // If we ran out of buffer (multi-disk or overflow), stop gracefully.
        break
      }
      const method = buf.readUInt16LE(pos + 10)
      const compressedSize = buf.readUInt32LE(pos + 20)
      const uncompressedSize = buf.readUInt32LE(pos + 24)
      const nameLen = buf.readUInt16LE(pos + 28)
      const extraLen = buf.readUInt16LE(pos + 30)
      const commentLen = buf.readUInt16LE(pos + 32)
      const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen)
      entries.push({
        name,
        size: method === 0 ? uncompressedSize : compressedSize,
        isDirectory: name.endsWith('/'),
      })
      pos += 46 + nameLen + extraLen + commentLen
      if (pos > buf.length) break
    }
    return entries
  } finally {
    await handle.close()
  }
}