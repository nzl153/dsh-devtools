/**
 * Token estimation utilities.
 *
 * DSH's own token meter uses a 4-char-per-token heuristic; we mirror that so
 * UI estimates are consistent with the rest of the harness. This is an estimate,
 * never a billing number.
 */

/** Rough token count: CJK chars count ~1 token, else 4 chars ≈ 1 token. */
export function estimateTokens(text: string): number {
  if (!text) return 0
  let cjk = 0
  let other = 0
  for (const ch of text) {
    // CJK Unified Ideographs + Hiragana/Katakana/Hangul ranges
    const code = ch.codePointAt(0) ?? 0
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3040 && code <= 0x30ff) ||
      (code >= 0xac00 && code <= 0xd7af)
    ) {
      cjk += 1
    } else {
      other += 1
    }
  }
  return Math.ceil(cjk + other / 4)
}

/** Estimate tokens for an object by JSON serializing (keys included as ASCII). */
export function estimateObjectTokens(value: unknown): number {
  if (typeof value === 'string') return estimateTokens(value)
  try {
    return estimateTokens(JSON.stringify(value))
  } catch {
    return 0
  }
}