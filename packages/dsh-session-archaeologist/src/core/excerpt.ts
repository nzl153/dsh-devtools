/**
 * Bounded excerpt builder ("Bring to Current Context").
 *
 * Produces a compact, token-estimated text block from selected session hits.
 * Supports multi-session selection: each selection contributes a section, and
 * a global character/token budget caps the final text so the user can never
 * accidentally paste an entire old session into the model.
 */
import type { Excerpt, ExcerptHit, ExcerptSelection, ExcerptSource, IndexedDoc, SourceKind } from './types.ts'
import { estimateTokens } from './token.ts'

export interface ExcerptBuildOptions {
  /** How many surrounding messages to include around each hit. */
  contextRadius?: number
  /** Maximum output chars before forced truncation. */
  maxChars?: number
  /** Maximum estimated output tokens before forced truncation. */
  maxTokens?: number
}

const DEFAULT_OPTIONS: { contextRadius: number; maxChars: number; maxTokens: number } = {
  contextRadius: 4,
  maxChars: 8000,
  maxTokens: 2000,
}

function formatDate(ms: number): string {
  if (!ms) return 'unknown'
  return new Date(ms).toISOString()
}

/** Extract the first N actual user/assistant text blocks from docs. */
function originalPrompt(docs: readonly IndexedDoc[]): string {
  for (const doc of docs) {
    if (doc.source === 'user' && doc.content.trim()) return doc.content.trim().slice(0, 1500)
  }
  return ''
}

function hitDocs(docs: readonly IndexedDoc[], hitIds: readonly number[], radius: number): IndexedDoc[] {
  const bySeq = new Map<number, IndexedDoc>()
  for (const d of docs) bySeq.set(d.seq, d)
  const selected = new Set<number>()
  for (const seq of hitIds) {
    const doc = bySeq.get(seq)
    if (!doc) continue
    selected.add(doc.seq)
    // add surrounding docs by seq order
    const seqs = [...bySeq.keys()].sort((a, b) => a - b)
    const idx = seqs.indexOf(doc.seq)
    for (let i = Math.max(0, idx - radius); i <= Math.min(seqs.length - 1, idx + radius); i++) {
      const s = seqs[i]
      if (s !== undefined) selected.add(s)
    }
  }
  return [...selected].sort((a, b) => a - b).map((seq) => bySeq.get(seq)!).filter(Boolean)
}

const SOURCE_LABEL: Record<SourceKind, string> = {
  user: 'user',
  assistant: 'assistant',
  reasoning: 'reasoning',
  tool: 'tool',
  'tool-result': 'tool result',
  system: 'system',
  file: 'file',
  command: 'command',
  error: 'error',
  outcome: 'outcome',
  title: 'title',
}

function formatDoc(doc: IndexedDoc): string {
  const label = SOURCE_LABEL[doc.source] ?? doc.role
  const content = doc.content.trim().replace(/\n+/g, '\n').slice(0, 600)
  const time = doc.time ? ` [${formatDate(doc.time)}]` : ''
  return `<${label}${time}> ${content}`
}

function extractCodePaths(docs: readonly IndexedDoc[], limit = 20): string[] {
  return [...new Set(
    docs
      .filter((d) => d.source === 'tool' || d.source === 'tool-result')
      .flatMap((d) => d.content.match(/(?:[A-Za-z]:[\\/]|\/)[^\s"']+\.(?:ts|tsx|js|jsx|json|py|md|c|cpp|rs|go|java|sh|ps1|yml|yaml|toml|css|html|sql|mjs|cjs)(?=[\s"')\]]|$)/g) ?? []),
  )].slice(0, limit)
}

function findConclusion(docs: readonly IndexedDoc[]): string | null {
  const outcomeDoc = [...docs].sort((a, b) => b.seq - a.seq).find((d) => d.source === 'outcome')
  return outcomeDoc?.content ?? null
}

interface BuiltSection {
  text: string
  hits: ExcerptHit[]
  prompt: string
  codePaths: string[]
  conclusion: string | null
  hitCount: number
}

function buildSection(selection: ExcerptSelection, index: number, options: Required<ExcerptBuildOptions>): BuiltSection {
  const { docs, hitIds } = selection
  const selected = hitDocs(docs, hitIds, options.contextRadius)
  const prompt = originalPrompt(docs)
  const codePaths = extractCodePaths(docs)
  const conclusion = findConclusion(docs)

  const lines: string[] = [
    `## Source ${index}: ${selection.title || '(untitled)'}`,
    `sessionId: ${selection.sessionId}`,
    `date: ${formatDate(selection.createdAt)}`,
  ]
  if (selection.workspace) lines.push(`workspace: ${selection.workspace}`)
  lines.push('', '### Original user request', prompt || '(none)', '', '### Related messages')
  for (const doc of selected) lines.push(formatDoc(doc))
  if (codePaths.length > 0) {
    lines.push('', '### Related code paths')
    for (const p of codePaths) lines.push(`- ${p}`)
  }
  if (conclusion) {
    lines.push('', '### Conclusion', conclusion)
  }

  return {
    text: lines.join('\n'),
    hits: selected.map((doc) => ({
      sessionId: selection.sessionId,
      source: doc.source,
      role: doc.role,
      seq: doc.seq,
      time: doc.time,
      snippet: doc.content.trim().slice(0, 500),
    })),
    prompt,
    codePaths,
    conclusion,
    hitCount: hitIds.filter((seq) => docs.some((d) => d.seq === seq)).length,
  }
}

/**
 * Apply both character and token budgets to a text block.
 * Returns the largest prefix that fits both budgets. The returned text is
 * never longer than `maxChars` and its token estimate never exceeds
 * `maxTokens`.
 */
function applyBudgets(text: string, maxChars: number, maxTokens: number): string {
  const capChars = Math.max(1, Math.floor(maxChars))
  const capTokens = Math.max(1, Math.floor(maxTokens))
  if (text.length === 0) return ''
  const fits = (len: number): boolean => {
    const part = text.slice(0, len)
    return part.length <= capChars && estimateTokens(part) <= capTokens
  }
  const high = Math.min(text.length, capChars)
  if (fits(high)) return text.slice(0, high)
  let lo = 0
  let hi = high
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (fits(mid)) lo = mid
    else hi = mid - 1
  }
  return text.slice(0, lo)
}

/**
 * Build a bounded excerpt from one or more session selections, applying a
 * global char/token budget across the combined output.
 */
export function buildMultiExcerpt(
  selections: readonly ExcerptSelection[],
  options: ExcerptBuildOptions = {},
): Excerpt {
  const opts: Required<ExcerptBuildOptions> = {
    contextRadius: options.contextRadius ?? DEFAULT_OPTIONS.contextRadius,
    maxChars: options.maxChars ?? DEFAULT_OPTIONS.maxChars,
    maxTokens: options.maxTokens ?? DEFAULT_OPTIONS.maxTokens,
  }
  const sections = selections.map((selection, i) => buildSection(selection, i + 1, opts))
  const header = [
    '# Session Excerpt',
    `sources: ${selections.length}`,
    `selected hits: ${sections.reduce((sum, s) => sum + s.hitCount, 0)}`,
    `budget: maxChars=${opts.maxChars}, maxTokens=${opts.maxTokens}`,
    '',
  ].join('\n')

  const raw = sections.length > 0
    ? `${header}\n\n${sections.map((s) => s.text).join('\n\n')}`
    : `${header}\n\n(no selections)`
  const text = applyBudgets(raw, opts.maxChars, opts.maxTokens)
  const truncated = text.length < raw.length
  const allHits = sections.flatMap((s) => s.hits)
  const allCodePaths = [...new Set(sections.flatMap((s) => s.codePaths))].slice(0, 20)
  const firstPrompt = sections.find((s) => s.prompt)?.prompt ?? ''
  const conclusion = sections.find((s) => s.conclusion)?.conclusion ?? null

  return {
    sessionId: selections[0]?.sessionId ?? '',
    date: selections[0] ? formatDate(selections[0].createdAt) : '',
    title: selections[0]?.title ?? '(untitled)',
    originalPrompt: firstPrompt,
    hits: allHits,
    codePaths: allCodePaths,
    conclusion,
    tokenEstimate: estimateTokens(text),
    text,
    charCount: text.length,
    maxChars: opts.maxChars,
    maxTokens: opts.maxTokens,
    truncated,
    sources: selections.map((selection): ExcerptSource => ({
      sessionId: selection.sessionId,
      title: selection.title,
      date: formatDate(selection.createdAt),
      workspace: selection.workspace,
    })),
    selectedHitCount: sections.reduce((sum, s) => sum + s.hitCount, 0),
  }
}

/**
 * Build a bounded excerpt from a single session (legacy convenience wrapper).
 * @param sessionId session id
 * @param title session title
 * @param createdAt session createdAt (ms)
 * @param docs all indexed docs from the session
 * @param hitIds selected seq set
 */
export function buildExcerpt(
  sessionId: string,
  title: string,
  createdAt: number,
  docs: readonly IndexedDoc[],
  hitIds: readonly number[],
  options: ExcerptBuildOptions = {},
): Excerpt {
  return buildMultiExcerpt([{ sessionId, title, createdAt, docs, hitIds }], options)
}