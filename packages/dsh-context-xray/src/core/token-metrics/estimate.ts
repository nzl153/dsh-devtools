/**
 * Fixed-density heuristic token pricing, intentionally identical to the
 * official @deepseek-ai/dsh-token-meter estimator:
 *   4 characters ≈ 1 token, plus structural overhead.
 * This keeps our per-section/per-tool numbers comparable with the official
 * contextBreakdown projection. All values are ESTIMATED unless a provider
 * reports exact usage.
 */

const CHARS_PER_TOKEN = 4
const BLOCK_OVERHEAD = 4

export function estimateText(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN) + BLOCK_OVERHEAD
}

export function estimateJson(value: unknown): number {
  return Math.ceil(JSON.stringify(value).length / CHARS_PER_TOKEN) + BLOCK_OVERHEAD
}

export function estimateBlocks(blocks: readonly unknown[]): number {
  let tokens = 0
  for (const block of blocks as Array<{ type?: string; text?: string; name?: string; arguments?: string; content?: unknown[] }>) {
    switch (block?.type) {
      case 'text':
      case 'reasoning':
        tokens += Math.ceil((block.text ?? '').length / CHARS_PER_TOKEN) + BLOCK_OVERHEAD
        break
      case 'tool-call':
        tokens += Math.ceil((block.name ?? '').length / CHARS_PER_TOKEN)
          + Math.ceil((block.arguments ?? '').length / CHARS_PER_TOKEN)
          + BLOCK_OVERHEAD
        break
      case 'tool-result':
        tokens += estimateBlocks(block.content ?? []) + BLOCK_OVERHEAD
        break
      default:
        tokens += BLOCK_OVERHEAD + Math.ceil(JSON.stringify(block).length / CHARS_PER_TOKEN)
    }
  }
  return tokens
}

export interface EstimableMessage {
  content?: readonly unknown[] | unknown
}

export function estimateMessage(message: EstimableMessage | null | undefined): number {
  if (!message) return 0
  const content = message.content ?? []
  if (!Array.isArray(content)) return estimateText(String(content)) + 4
  return estimateBlocks(content) + 4
}