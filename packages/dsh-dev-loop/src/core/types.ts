// dsh-dev-loop：纯 core 领域类型（不依赖运行时，可单测）。

/** DevLoop 项目名（来自 .dsh/devloop.yml 的 name 字段，缺省为目录名）。 */
export interface DevLoopConfig {
  name: string
  /** action 名 → 动作定义；顺序即显示顺序。 */
  actions: Record<string, DevLoopAction>
  /** 命令来源根目录（绝对路径），决定 trust boundary。 */
  root: string
  /** Watch Mode 配置；缺省 = 关闭。 */
  watch?: WatchConfig
  /** Agent 完成一轮后自动执行配置；缺省 = 关闭。 */
  afterAgent?: AfterAgentConfig
}

/** Watch Mode：监听文件变化，去抖后自动执行指定 action。 */
export interface WatchConfig {
  /** 显式 false 可关闭；配置 watch 块但未写 enabled 时视为开启。 */
  enabled: boolean
  /** 要监听的相对路径（相对项目根）；缺省为 ["src"]。 */
  paths: string[]
  /** 去抖毫秒；缺省 500。 */
  debounce: number
  /** 变化后要执行的 action 名。 */
  action: string
  /** 额外要忽略的目录名/路径片段（追加到内置输出目录忽略列表）。 */
  ignore?: string[]
}

/** After Agent Turn：Agent 完成一轮后自动执行指定 action。 */
export interface AfterAgentConfig {
  /** 显式 false 可关闭；配置 afterAgent 块但未写 enabled 时视为开启。 */
  enabled: boolean
  /** 要执行的 action 名。 */
  action: string
}

/** Watch Mode 的运行时状态（供 UI / API 展示）。 */
export interface WatchStatus {
  /** 配置层面是否启用；未配置时此对象不应存在。 */
  configured: boolean
  /** 当前是否已在监听。 */
  started: boolean
  /** 配置的 action。 */
  action: string
  /** 监听路径（显示用）。 */
  paths: string[]
  /** 去抖毫秒。 */
  debounce: number
  /** 当前是否有 action 正在执行（由调度器维护，不重复 spawn）。 */
  running: boolean
  /** 等待中的最新一次变更（跑完后再执行一次，不堆积）。 */
  pending: boolean
  /** 是否因未信任而无法启动（自动执行不能绕过 trust）。 */
  needsTrust: boolean
  /** 最近一次由 watch 触发的 run id。 */
  lastRunId: string | null
  /** 最近一次由 watch 触发的 run 终态。 */
  lastStatus: CommandStatus | null
  /** 最近一次 watch 触发时间。 */
  lastTriggeredAt: number | null
  /** watch 运行中的错误信息。 */
  lastError: string | null
}

/** After Agent Turn 的运行时状态（供 UI / API 展示）。 */
export interface AfterAgentStatus {
  /** 配置是否启用。 */
  enabled: boolean
  /** 配置的 action。 */
  action: string
  /** 最近一次自动执行的 run id。 */
  lastRunId: string | null
  /** 最近一次自动执行的状态。 */
  lastStatus: CommandStatus | null
}

/** 单个 action 的定义。 */
export interface DevLoopAction {
  /** action 名。 */
  name: string
  /** 要执行的命令。若配置了 file，则忽略 command。 */
  command?: string
  /**
   * 日志文件路径（相对于项目根）——用于 actions 里的 "logs" 这类动作：
   * 不执行命令，改为读取/跟踪该文件。
   */
  file?: string
  /** 工作目录（相对项目根；缺省 = 项目根）。 */
  cwd?: string
  /** 环境变量覆盖（合并进进程环境）。其中的 KEY/TOKEN/SECRET 等会被脱敏。 */
  env?: Record<string, string>
  /** 超时毫秒；缺省 0 = 不限。 */
  timeout?: number
  /** 使用的 shell；缺省按平台（win32 -> cmd，其余 -> /bin/sh）。 */
  shell?: string
  /** 依赖的 action 名（先执行依赖，任一失败则不执行本动作）。 */
  dependsOn?: string[]
}

/** 一次命令执行的运行时视图。 */
export interface CommandRun {
  id: string
  project: string
  action: string
  command: string
  status: CommandStatus
  /** 退出码；null = 未结束/被取消没有退出码。 */
  exitCode: number | null
  /** 被取消时为 true。 */
  cancelled: boolean
  /** 累计耗时毫秒。 */
  durationMs: number
  /** 开始时的时间戳（epoch ms）。 */
  startedAt: number | null
  /** 结束时间戳（epoch ms）。可 null。 */
  endedAt: number | null
  /** 有界输出（已脱敏、已去 ANSI、已截断）。 */
  output: string
  /** 完整日志保存路径（本地磁盘）。 */
  logFile: string | null
  /** 最近一次的失败摘要（bounded context，用于 Send last error to Agent）。 */
  lastError: string | null
}

export type CommandStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'cancelled'

/** 与 UI / API 通信的状态汇总。 */
export interface DevLoopSummary {
  project: DevLoopConfig | null
  actions: Array<{ name: string; kind: 'command' | 'file' }>
  runs: Record<string, CommandRun>
  lastFail: { action: string; at: number; snippet: string } | null
  needsTrust: boolean
  trusted: boolean
  logDir: string
  /** Watch Mode 当前状态；未配置为 null。 */
  watch: WatchStatus | null
  /** After Agent Turn 当前状态；未配置为 null。 */
  afterAgent: AfterAgentStatus | null
}

/** 命令状态机转移结果。 */
export interface Transition {
  ok: boolean
  error?: string
}
