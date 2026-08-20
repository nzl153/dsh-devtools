/**
 * dsh-session-archaeologist core wire types. Pure JSON / type only, no DSH import.
 */

/** FTS indexed document source kind. */
export type SourceKind =
  | 'user'       // 真实用户消息 (source.kind === 'user')
  | 'assistant'  // 模型回复文本（含 reasoning 可选）
  | 'reasoning'  // 模型思考段
  | 'tool'       // 工具调用（名称 + 参数摘要）
  | 'tool-result' // 工具返回（含错误文本）
  | 'system'     // 系统/skill/context 注入的 user/message（默认不索引）
  | 'file'       // 涉及文件（从工具参数/结果提取）
  | 'command'    // 命令（从工具参数提取，如 bash/pwsh/git）
  | 'error'      // 错误文本
  | 'outcome'    // turn/end 结果
  | 'title'      // session 标题

/** 单个被索引的 FTS 文档（一条可搜索的记录）。 */
export interface IndexedDoc {
  readonly sessionId: string
  readonly seq: number
  readonly time: number
  /** 标题（同 session 内冗余，便于 per-session 过滤）。 */
  readonly title: string
  readonly role: 'user' | 'assistant' | 'tool' | 'system' | 'meta'
  readonly source: SourceKind
  readonly content: string
  /** 每条文档的命中可回填。 */
  readonly meta?: string
}

/** 一次返回的搜索结果 hit。 */
export interface SearchHit {
  readonly sessionId: string
  readonly seq: number
  readonly time: number
  readonly title: string
  /** 该条命中在哪个 source 字段。 */
  readonly source: SourceKind
  readonly role: string
  /** FTS snippet，已做 [..] 高亮。 */
  readonly snippet: string
  /** 相关度百分比（0-100，纯展示用）。 */
  readonly relevance: number
  /** 该 session 命中的条数（聚合到 session 级）。 */
  sessionHitCount: number
  /** 命中所属 workspace（通常为真实路径或 normalized token）。 */
  readonly workspace: string
  /** 命中前的相邻消息（格式化短文本），用于结构化上下文。 */
  readonly contextBefore: readonly string[]
  /** 命中后的相邻消息（格式化短文本），用于结构化上下文。 */
  readonly contextAfter: readonly string[]
}

/** session 级聚合结果。 */
export interface SessionResult {
  readonly sessionId: string
  readonly date: string
  readonly title: string
  readonly workspace: string
  readonly relevance: number
  readonly hitCount: number
  /** 最佳命中片段。 */
  readonly snippet: string
  /** 命中字段（在该 session 的命中里出现的所有 source）。 */
  readonly hitFields: readonly SourceKind[]
  readonly files: readonly string[]
  readonly commands: readonly string[]
  readonly hasError: boolean
  readonly outcome: string | null
}

/** 单个 session 的 timeline 阶段。 */
export interface TimelineStage {
  readonly label: string
  readonly detail: string
  readonly confidence: 'known' | 'estimated' | 'unknown'
}

/** session 结构化摘要。 */
export interface SessionTimeline {
  readonly sessionId: string
  readonly title: string
  readonly createdAt: number
  readonly stages: readonly TimelineStage[]
  readonly generatedAt: string
  readonly local: true
}

/** 一次 excerpt 选中的 source session + 需要带出的 hit seq。 */
export interface ExcerptSelection {
  readonly sessionId: string
  readonly title: string
  readonly createdAt: number
  readonly workspace?: string
  readonly docs: readonly IndexedDoc[]
  readonly hitIds: readonly number[]
}

/** 单个 excerpt 来源的展示信息。 */
export interface ExcerptSource {
  readonly sessionId: string
  readonly title: string
  readonly date: string
  readonly workspace?: string
}

/** bounded excerpt（Bring to current context）。 */
export interface Excerpt {
  readonly sessionId: string
  readonly date: string
  readonly title: string
  readonly originalPrompt: string
  readonly hits: readonly ExcerptHit[]
  readonly codePaths: readonly string[]
  readonly conclusion: string | null
  readonly tokenEstimate: number
  /** 拼接后的完整 excerpt 文本（可直接发到当前 session）。 */
  readonly text: string
  /** 最终文本字符数。 */
  readonly charCount: number
  /** 全局字符预算。 */
  readonly maxChars: number
  /** 全局 token 预算。 */
  readonly maxTokens: number
  /** 是否因预算被截断。 */
  readonly truncated: boolean
  /** 参与 excerpt 的源 session 列表（多选时会超过 1）。 */
  readonly sources: readonly ExcerptSource[]
  /** 实际选中的 hit 数量。 */
  readonly selectedHitCount: number
}

export interface ExcerptHit {
  readonly sessionId: string
  readonly source: SourceKind
  readonly role: string
  readonly seq: number
  readonly time: number
  readonly snippet: string
}

export interface IndexStatus {
  readonly indexedSessions: number
  readonly indexedDocs: number
  readonly excludedSessions: readonly string[]
  readonly excludedWorkspaces: readonly string[]
  readonly dbPath: string
}

export interface SearchFilters {
  readonly sessions?: readonly string[]
  /** 精确 workspace 过滤（可多个）。 */
  readonly workspaces?: readonly string[]
  /** 按当前项目路径前缀过滤（匹配 sessions.workspace 前缀）。 */
  readonly projectPath?: string
  /** 命中事件时间起（含）。 */
  readonly after?: number
  /** 命中事件时间止（不含）。 */
  readonly before?: number
  /** 命中 source 过滤。 */
  readonly source?: readonly SourceKind[]
  readonly excludeSessions?: readonly string[]
  readonly excludeWorkspaces?: readonly string[]
  readonly limit?: number
}

/** 查询结果（session 级聚合 + 原始 hit）。 */
export interface SearchResponse {
  readonly query: string
  readonly total: number
  readonly results: readonly SessionResult[]
  readonly hits: readonly SearchHit[]
  readonly tookMs: number
}