/**
 * dsh-tool-router core types.
 *
 * These types intentionally depend only on JSON-safe shape descriptions. The
 * host layer adapts DSH runtime types onto `ToolLike` so the core can be unit
 * tested without a live Cordis context.
 */

export const TOOL_CATEGORIES = [
  'filesystem',
  'search',
  'shell',
  'git',
  'lsp',
  'web',
  'browser',
  'database',
  'mcp',
  'image',
  'workflow',
  'subagent',
  'misc',
] as const

export type ToolCategory = (typeof TOOL_CATEGORIES)[number]

export const ROUTER_MODES = ['off', 'observe', 'suggest', 'adaptive'] as const

export type RouterMode = (typeof ROUTER_MODES)[number]

/** The model-visible fields we can classify on. */
export interface ToolLike {
  name: string
  description?: string
  parameters?: Record<string, unknown>
}

export interface RouterConfig {
  /** off / observe / suggest / adaptive. Default: observe. */
  mode?: RouterMode
  /** Tool names that always stay visible (user config). */
  alwaysVisible?: string[]
  /** Fallback tool name used for category requests. Default: request_tools. */
  fallbackToolName?: string
  /** How many steps a fallback category enablement stays active. Default: 3. */
  fallbackTtlSteps?: number
  /** Minimum safe set, always retained even when not configured. */
  minimumSafeTools?: string[]
  /** Store a truncated prompt preview in local stats. Default: true. */
  storePromptPreview?: boolean
}

export interface CategoryReason {
  category: ToolCategory
  matchedKeywords: string[]
}

export interface RouteInput {
  /** The latest claimed user prompt. */
  prompt: string
  /** Recent derived message text/tool names, lower-case. */
  recent: string
}

export interface RouteOptions {
  mode: RouterMode
  alwaysVisible: string[]
  minimumSafeTools: string[]
  fallbackToolName: string
  enabledCategories: ToolCategory[]
}

export interface RoutePlan {
  mode: RouterMode
  /** Categories selected by deterministic heuristics. */
  selectedCategories: ToolCategory[]
  /** Categories explicitly requested through request_tools and still active. */
  requestedCategories: ToolCategory[]
  /** Every category that should be visible after this plan. */
  effectiveCategories: ToolCategory[]
  visibleNames: string[]
  hiddenNames: string[]
  beforeBytes: number
  afterBytes: number
  savedBytes: number
  beforeTokens: number
  afterTokens: number
  savedTokens: number
  reasons: CategoryReason[]
}

export interface StatsRecord {
  sessionId: string
  turn?: number
  step?: number
  timestamp: number
  mode: RouterMode
  promptCategory?: string
  promptPreview?: string
  selectedCategories: ToolCategory[]
  requestedCategories: ToolCategory[]
  enabledCategories: ToolCategory[]
  actualToolsUsed: string[]
  unusedVisible: string[]
  beforeBytes: number
  afterBytes: number
  savedBytes: number
  beforeTokens: number
  afterTokens: number
  savedTokens: number
}

export interface StatsFile {
  version: 1
  events: StatsRecord[]
}