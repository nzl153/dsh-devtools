/**
 * Minimal Zstandard multi-frame reader for DSH session logs.
 *
 * DSH JSONL persistence writes a checksummed Zstandard frame per append batch.
 * Node's zstdDecompressSync / createZstdDecompress only decode the first frame of
 * a concatenated stream, so we must split frame boundaries first and decode each
 * complete frame individually. This module is pure Node built-ins: node:zlib.
 *
 * Reference: DSH dsh-session-persistence-jsonl scanZstdFrames.
 */
import { zstdDecompressSync } from 'node:zlib'

const ZSTD_MAGIC = 0xfd2fb528

/** One complete Zstandard frame byte range. */
export interface ZstdFrameRange {
  readonly start: number
  readonly end: number
}

/** Scan result: complete frames plus an optional torn-frame start. */
export interface ZstdFrameScan {
  readonly frames: readonly ZstdFrameRange[]
  readonly tornStart?: number
}

function leakyBufferReadUIntLE(buf: Buffer, offset: number, byteLength: number): number {
  return buf.readUIntLE(offset, byteLength)
}

/**
 * Locate complete frames without decompressing their blocks.
 * Throws on structurally corrupt complete frames; returns tornStart when EOF
 * cuts a frame short.
 */
export function scanZstdFrames(buffer: Buffer, maxFrames = Number.POSITIVE_INFINITY): ZstdFrameScan {
  const frames: ZstdFrameRange[] = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) return { frames, tornStart: start }
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) {
      throw new Error(`corrupt zstd session log: invalid frame magic at byte ${offset}`)
    }
    offset += 4
    if (offset === buffer.length) return { frames, tornStart: start }
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    if ((descriptor & 24) !== 0) {
      throw new Error(`corrupt zstd session log: reserved frame-header bit at byte ${offset - 1}`)
    }
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 32) !== 0
    const checksum = (descriptor & 4) !== 0
    const dictionaryFlag = descriptor & 3
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    if (buffer.length - offset < remainingHeaderBytes) return { frames, tornStart: start }
    offset += remainingHeaderBytes
    for (;;) {
      if (buffer.length - offset < 3) return { frames, tornStart: start }
      const blockHeader = leakyBufferReadUIntLE(buffer, offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = (blockHeader >>> 1) & 3
      const blockSize = blockHeader >>> 3
      if (blockType === 3) {
        throw new Error(`corrupt zstd session log: reserved block type at byte ${offset - 3}`)
      }
      const payloadBytes = blockType === 1 ? 1 : blockSize
      if (buffer.length - offset < payloadBytes) return { frames, tornStart: start }
      offset += payloadBytes
      if (lastBlock) break
    }
    if (checksum) {
      if (buffer.length - offset < 4) return { frames, tornStart: start }
      offset += 4
    }
    frames.push({ start, end: offset })
    if (frames.length >= maxFrames) break
  }
  return { frames }
}

/**
 * Decompress a concatenated Zstandard stream into one plain-text Buffer.
 * Each complete frame is decoded with zstdDecompressSync (which validates the
 * per-frame checksum) and the results are concatenated in order.
 */
export function decompressAll(input: Buffer): Buffer {
  const { frames, tornStart } = scanZstdFrames(input)
  if (tornStart !== undefined) {
    throw new Error(`incomplete zstd frame at byte ${tornStart}`)
  }
  const parts: Buffer[] = []
  for (const { start, end } of frames) {
    parts.push(zstdDecompressSync(input.subarray(start, end)))
  }
  return Buffer.concat(parts)
}

/** Convenience: read a session log file and return decoded UTF-8 lines. */
export function decodeSessionLog(file: Buffer | Uint8Array): string[] {
  const raw = file instanceof Uint8Array && !Buffer.isBuffer(file) ? Buffer.from(file) : file as Buffer
  const text = decompressAll(raw).toString('utf8')
  return text.split('\n').filter((line) => line.trim().length > 0)
}