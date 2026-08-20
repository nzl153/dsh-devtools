/**
 * dsh-debrief core wire types.
 *
 * These types deliberately do not import DSH packages. The host adapter maps
 * DSH session events into `DebriefEvent`, and the pure core computes
 * debriefs from that normalized shape so tests and the E2E script can feed
 * synthetic JSON without touching DSH.
 */

export type TriggerMode = 'off' | 'session-only' | 'every-n-turns' | 'on-completion'

export interface DebriefConfig {
  /** When a debrief card is produced on the client. */
  triggerMode: TriggerMode
  /** Render a card after every N turns when triggerMode is every-n-turns. */
  turnInterval: number
  /** Tool names treated as command executors. */
  commandToolNames: string[]
  /** Regex strings matched against a command line to classify it as a test run. */
  testCommandPatterns: string[]
  /** Maximum number of changed files / failed commands / unresolved items shown. */
  maxFailedCommands: number
  maxChangedFiles: number
  maxUnresolved: number
  /** Enable TODO/FIXME marker detection in tool/assistant/user text. */
  detectTodoMarkers: boolean
}

export const DEFAULT_CONFIG: DebriefConfig = {
  triggerMode: 'session-only',
  turnInterval: 1,
  commandToolNames: ['bash', 'bash_persistent', 'pwsh', 'shell', 'cmd', 'sh', 'zsh'],
  testCommandPatterns: [
    // 明确的已知 runner 直接子命令/参数调用，命令名不打头但参数是明确的 test 动词。
    '(^|\\s)(pnpm|npm|yarn|bun|deno|npx)\\s+(run\\s+)?(test|spec|e2e)(\\s|$)',
    '(^|\\s)(pnpm|npm|yarn|bun|deno|npx)\\s+(test|spec|e2e)\\b',
    '(^|\\s)dotnet\\s+test\\b',
    '(^|\\s)cargo\\s+test\\b',
    '(^|\\s)go\\s+test\\b',
    '(^|\\s)go\\s+vet\\b',
    '(^|\\s)python\\s+-m\\s+(unittest|pytest)\\b',
    '(^|\\s)pytest\\b',
    '(^|\\s)vitest\\b',
    '(^|\\s)jest\\b',
    '(^|\\s)ts-jest\\b',
    '(^|\\s)ava\\b',
    '(^|\\s)tape\\b',
    '(^|\\s)mocha\\b',
    '(^|\\s)rspec\\b',
    '(^|\\s)rake\\s+test\\b',
    '(^|\\s)make\\s+test\\b',
    '(^|\\s)gradle\\s+test\\b',
    '(^|\\s)maven\\s+test\\b',
    '(^|\\s)mvn\\s+test\\b',
    '(^|\\s)flutter\\s+test\\b',
    '(^|\\s)poetry\\s+run\\s+pytest\\b',
    '(^|\\s)phpunit\\b',
    '(^|\\s)behave\\b',
    '(^|\\s)cypress(\\s|run)\\b',
    '(^|\\s)playwright\\b',
    '(^|\\s)testcafe\\b',
    '(^|\\s)karma\\s+start\\b',
  ],
  maxFailedCommands: 10,
  maxChangedFiles: 20,
  maxUnresolved: 20,
  detectTodoMarkers: true,
}

export type Precision = 'exact' | 'estimated' | 'unavailable'

export interface DebriefEvent {
  /** Monotonic sequence number within the session. */
  seq: number
  /** Unix epoch milliseconds. */
  time: number
  /** DSH session event type. */
  type: string
  /** Event payload. Stays loose so the core can consume synthetic JSON too. */
  data: Record<string, unknown>
}

export interface ToolCallRecord {
  callId: string
  name: string
  /** Raw arguments string exactly as produced (unparsed). */
  arguments: string
  /** Parsed arguments object when the raw string is valid JSON. */
  args: Record<string, unknown> | null
  /** Parent turn, when the event carried one. */
  turn: number
  step: number
  /** Start time from the tool/call event. */
  startedAt: number
  /** End time from the matching tool/result event (when observed). */
  endedAt: number | null
  /** Duration in ms; null while incomplete. */
  durationMs: number | null
  /** True when the matching tool/result carried an error field. */
  errored: boolean
  /** Tool-private meta, when the result attached one (e.g. fs diffs). */
  resultMeta: unknown
  /** Text preview of the tool result (first ~500 chars), when available. */
  resultPreview: string | null
}

export interface CommandRecord extends ToolCallRecord {
  /** The command line extracted from arguments. */
  command: string
  /** Exit code extracted from bash-style result text; null when not observed. */
  exitCode: number | null
  /** `test` when the command matched a configured test pattern or structured result, else `command`. */
  kind: 'command' | 'test'
  /** How the test classification was made. Null for plain commands. */
  testSource: 'pattern' | 'structure' | null
  /** For test commands: passed/failed/unknown. Never guessed without exit code or structured status. */
  testStatus: 'passed' | 'failed' | 'unknown' | null
}

export interface FileChange {
  path: string
  kind: 'write' | 'edit' | 'unknown'
  /** True when the file path came from structured result meta (fs diffs). */
  structured: boolean
}

export interface FileRead {
  path: string
  toolName: string
}

export interface UnresolvedItem {
  kind: 'failed-command' | 'todo-marker' | 'error'
  label: string
  detail: string
  turn: number
}

export interface TokenTotals {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  /** Sum of the four buckets when any usage was observed. */
  totalTokens: number
  /** Provider-reported projected/context pressure, when passed in. */
  contextPressure: number | null
  contextWindow: number | null
  /** Number of assistant/message events that carried provider usage. */
  usageReports: number
  precision: Precision
}

export interface ToolStat {
  name: string
  callCount: number
  errorCount: number
  totalDurationMs: number
  avgDurationMs: number | null
  slowestCallMs: number | null
  slowestCallCommand: string | null
}

export interface TestRunResult {
  command: string
  exitCode: number | null
  status: 'passed' | 'failed' | 'unknown'
  turn: number
}

export interface TurnDebrief {
  kind: 'turn'
  sessionId: string
  turn: number
  startedAt: number
  endedAt: number
  durationMs: number
  stepCount: number
  assistantMessageCount: number
  toolCallCount: number
  commandCount: number
  toolStats: ToolStat[]
  slowestToolCall: ToolCallRecord | null
  commands: CommandRecord[]
  failedCommands: CommandRecord[]
  tests: TestRunResult[]
  changedFiles: FileChange[]
  filesRead: FileRead[]
  unresolved: UnresolvedItem[]
  tokens: TokenTotals
  /** Data provenance notes: what was exact, estimated, or unavailable. */
  notes: string[]
}

export interface SessionDebrief {
  kind: 'session'
  sessionId: string
  startedAt: number
  endedAt: number
  durationMs: number
  turnCount: number
  stepCount: number
  assistantMessageCount: number
  toolCallCount: number
  commandCount: number
  toolStats: ToolStat[]
  slowestToolCall: ToolCallRecord | null
  commands: CommandRecord[]
  failedCommands: CommandRecord[]
  tests: TestRunResult[]
  changedFiles: FileChange[]
  filesRead: FileRead[]
  unresolved: UnresolvedItem[]
  tokens: TokenTotals
  notes: string[]
}

export type Debrief = TurnDebrief | SessionDebrief

export interface DebriefSettings {
  triggerMode: TriggerMode
  turnInterval: number
  testCommandPatterns: string[]
  detectTodoMarkers: boolean
}

/** Plain settings payload served to the client over the HTTP API. */
export interface DebriefSettingsLike {
  triggerMode: string
  turnInterval: number
  testCommandPatterns: string[]
  detectTodoMarkers: boolean
}