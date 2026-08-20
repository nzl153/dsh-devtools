/**
 * Parse DSH JSONL session events into searchable IndexedDoc records.
 *
 * Handles the live DSH event surface: user/assistant messages, packed/raw
 * chunks, tool calls/results, session titles, and turn outcomes. Pure module,
 * no DSH import — it only needs the decoded JSONL lines (see core/zstd.ts).
 */
import type { IndexedDoc, SourceKind } from './types.ts'
import { extractCommands, extractErrors, extractFileMentions, outcomeText } from './fields.ts'

interface RawEvent {
  type: string
  seq?: number
  time?: number
  data?: unknown
  surfaceOp?: string
}

/** Session meta accumulated during a single parse pass. */
export interface ParsedSession {
  readonly sessionId: string
  readonly createdAt: number
  readonly title: string
  readonly docs: readonly IndexedDoc[]
  readonly files: readonly string[]
  readonly commands: readonly string[]
  readonly errors: readonly string[]
  readonly outcome: string | null
  readonly turns: number
  readonly sizeBytes: number
}

interface ContentPart {
  type?: string
  text?: string
}

function textOfContent(content: unknown): string {
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  const walk = (items: unknown[]): void => {
    for (const item of items) {
      if (item && typeof item === 'object') {
        const p = item as ContentPart
        if (typeof p.text === 'string' && p.text) parts.push(p.text)
        // tool-result / tool-call blocks nest their payload under 'content'
        const nested = (item as { content?: unknown }).content
        if (Array.isArray(nested)) walk(nested)
      }
    }
  }
  walk(content)
  return parts.join('\n')
}

function isRealUser(data: unknown): boolean {
  if (data && typeof data === 'object') {
    const src = (data as { source?: { kind?: string } }).source
    return src?.kind === 'user'
  }
  return false
}

/** Normalize whitespace for FTS-friendly content. */
function normalize(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim()
}

export interface ParseOptions {
  /** Index reasoning blocks too (default true). */
  indexReasoning?: boolean
  /** Index tool call arguments (name + args) (default true). */
  indexToolCalls?: boolean
  /** Index system/skill/context injected messages (default false: noisy). */
  indexSystem?: boolean
}

const DEFAULTS: Required<ParseOptions> = {
  indexReasoning: true,
  indexToolCalls: true,
  indexSystem: false,
}

/**
 * Parse one decoded JSONL session into docs + metadata.
 * @param lines decoded non-empty JSONL lines
 * @param sessionId session id (used to stamp docs)
 * @param createdAt fallback createdAt (ignored if header present)
 */
export function parseSession(
  lines: readonly string[],
  sessionId: string,
  createdAt = 0,
  opts: ParseOptions = {},
): ParsedSession {
  const o: Required<ParseOptions> = { ...DEFAULTS, ...opts }
  const docs: IndexedDoc[] = []
  const files = new Set<string>()
  const commands = new Set<string>()
  const errors = new Set<string>()
  let title = ''
  let realCreatedAt = createdAt
  let turns = 0
  let outcome: string | null = null
  const fileLimit = 200
  const commandLimit = 120
  const errorLimit = 60

  for (const line of lines) {
    let ev: RawEvent
    try {
      ev = JSON.parse(line) as RawEvent
    } catch {
      continue
    }
    const type = ev.type
    const seq = typeof ev.seq === 'number' ? ev.seq : 0
    const time = typeof ev.time === 'number' ? ev.time : 0
    const data = ev.data as Record<string, unknown> | undefined

    if (type === 'session' && data) {
      const id = typeof data['id'] === 'string' ? data['id'] : sessionId
      if (typeof data['createdAt'] === 'number') realCreatedAt = data['createdAt']
      void id
      continue
    }

    if (type === 'session/title' && data) {
      const t = (data as { title?: unknown }).title
      if (typeof t === 'string' && t && !title) title = t.slice(0, 200)
      continue
    }

    if (type === 'turn/start' && data) {
      turns += 1
      continue
    }

    if (type === 'turn/end' && data) {
      const reason = (data as { reason?: unknown }).reason
      const out = outcomeText(reason)
      if (out) {
        outcome = out
        docs.push({ sessionId, seq, time, title, role: 'meta', source: 'outcome', content: `outcome: ${out}`, meta: '' })
      }
      continue
    }

    if (type === 'user/message' && data) {
      const text = normalize(textOfContent((data as { content?: unknown }).content))
      if (!text) continue
      const realUser = isRealUser(data)
      if (!realUser && !o.indexSystem) {
        // system/skill/context injection — skip by default
        continue
      }
      const source: SourceKind = realUser ? 'user' : 'system'
      docs.push({ sessionId, seq, time, title, role: realUser ? 'user' : 'system', source, content: text, meta: realUser ? '' : 'injected' })
      if (realUser) {
        for (const f of extractFileMentions(text, fileLimit)) files.add(f)
      }
      continue
    }

    if (type === 'assistant/message' && data) {
      const message = (data as { message?: { content?: unknown; role?: string } }).message
      const content = message?.content ?? data['content']
      const text = normalize(textOfContent(content))
      if (!text) continue
      docs.push({ sessionId, seq, time, title, role: 'assistant', source: 'assistant', content: text, meta: '' })
      // capture code/file references inside assistant text
      for (const f of extractFileMentions(text, fileLimit)) files.add(f)
      continue
    }

    if (type === 'tool/call' && data && o.indexToolCalls) {
      const name = typeof data['name'] === 'string' ? data['name'] : 'tool'
      const argsRaw = data['arguments']
      const argsText = typeof argsRaw === 'string' ? argsRaw : ''
      const content = `tool: ${name}\n${argsText}`.trim()
      docs.push({ sessionId, seq, time, title, role: 'tool', source: 'tool', content, meta: name })
      for (const c of extractCommands(name, argsText, commandLimit)) commands.add(c)
      // file paths from arguments (all tools, not just shell)
      for (const f of extractFileMentions(argsText, fileLimit)) files.add(f)
      continue
    }

    if (type === 'tool/result' && data) {
      const text = normalize(textOfContent((data as { message?: { content?: unknown } }).message?.content ?? data['content']))
      if (text) {
        docs.push({ sessionId, seq, time, title, role: 'tool', source: 'tool-result', content: text.slice(0, 4000), meta: 'result' })
        for (const e of extractErrors(text, errorLimit)) errors.add(e)
        for (const f of extractFileMentions(text, fileLimit)) files.add(f)
      }
      continue
    }

    // packed chunks: text-chunks / reasoning-chunks (assistant streaming)
    if (type === 'text-chunks' && data && o.indexReasoning === false) {
      // raw streaming text — we already capture full assistant/message, skip to reduce dup
      continue
    }
    if (type === 'reasoning-chunks' && data && o.indexReasoning) {
      const texts = (data as { texts?: unknown }).texts
      if (Array.isArray(texts)) {
        const joined = normalize(texts.filter((t): t is string => typeof t === 'string').join(''))
        if (joined) {
          docs.push({ sessionId, seq, time, title, role: 'assistant', source: 'reasoning', content: joined.slice(0, 3000), meta: 'thinking' })
        }
      }
      continue
    }
    if (type === 'assistant/chunk' && data && o.indexReasoning) {
      // uncompressed chunk stream — only reasoning when explicitly tagged
      continue
    }
  }

  // Add one aggregate searchable doc per extracted category so the "Commands /
  // Errors / Files" search scopes can match on a dedicated source field without
  // multiplying the index by hundreds of tiny rows.
  const lastTime = docs.reduce((max, d) => Math.max(max, d.time), realCreatedAt)
  const baseSeq = docs.reduce((max, d) => Math.max(max, d.seq), 0)
  const categoryEntries: Array<[SourceKind, string[]]> = [
    ['command', [...commands].slice(0, commandLimit)],
    ['error', [...errors].slice(0, errorLimit)],
    ['file', [...files].slice(0, fileLimit)],
  ]
  let syntheticIndex = 0
  for (const [source, items] of categoryEntries) {
    if (items.length === 0) continue
    syntheticIndex += 1
    docs.push({
      sessionId,
      seq: baseSeq + syntheticIndex * 0.01,
      time: lastTime,
      title,
      role: 'meta',
      source,
      content: items.join('\n').slice(0, 8000),
      meta: '',
    })
  }

  const parsed: ParsedSession = {
    sessionId,
    createdAt: realCreatedAt,
    title: title || '(untitled)',
    docs,
    files: [...files].slice(0, fileLimit),
    commands: [...commands].slice(0, commandLimit),
    errors: [...errors].slice(0, errorLimit),
    outcome,
    turns,
    sizeBytes: 0,
  }
  return parsed
}
