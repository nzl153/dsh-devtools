/**
 * dsh-run-lab 核心类型定义（纯 TS，可被 host / cli / client 共享）。
 * 不依赖 DSH API，可在单元测试中直接构造。
 */

/** 实验生命周期状态。 */
export type ExperimentStatus =
  | 'draft'
  | 'prepared'
  | 'running'
  | 'completed'
  | 'failed'

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed'

/** Agent 驱动标识（见 src/agent/driver.ts）。 */
export type AgentDriverKind = 'command' | 'dsh-inproc'

/** 分支里声明的 agent 驱动配置（存 manifest，不含 secret）。 */
export interface AgentSpec {
  /** 驱动类型，默认 'command'。 */
  driver: AgentDriverKind
  /** 解析后的命令模板（command 驱动用）。 */
  command?: string
  /** 命令模板是否引用了工作区占位。 */
  usesWorkspace?: boolean
}

/** 每个分支（A/B）的隔离配置。 */
export interface BranchConfig {
  /** 分支标识，固定 'a' | 'b'（沿用实验 A/B 命名）。 */
  id: 'a' | 'b'
  /** 显示名称，例如 "DSH rc.6 + default preset"。 */
  label: string
  /**
   * 运行 Agent 的命令模板（已由 AgentSpec 归一化后的旧字段，保留兼容）。
   * $WORKSPACE 会被替换为当前分支隔离工作区路径。
   * 留空表示不实际跑 agent（纯 evaluator 对比场景）。
   */
  agentCommand?: string
  /** Agent 驱动配置（Phase 2 推荐字段；与 agentCommand 二选一或同时兼容）。 */
  agent?: AgentSpec
  /**
   * 工作区施加在 baseline 之上的覆盖层（可选）。
   * 用于“同一 baseline、同一 prompt”下的配置差异，键为仓库内相对路径，
   * 值为覆盖文件内容；隔离时先落 baseline，再覆盖这些文件。
   */
  workspaceOverrides?: Record<string, string>
  /** Evaluator 配置（每个分支可以有不同的 evaluator）。 */
  evaluator?: EvaluatorConfig
}

/** Evaluator 配置，全部可选 -> 未配置时只做进程退出码度量。 */
export interface EvaluatorConfig {
  /** 要执行的命令，例如 "npm test" / "pnpm test" / "dotnet test" / "pytest -q"。 */
  command: string
  /** 期望退出码；缺省 null 表示不校验（成功与否以实际退出码为准）。 */
  expectExitCode?: number | null
  /** 期望存在的文件（绝对路径或用 ${workspace} 占位）。成功后额外校验。 */
  expectFileExists?: string[]
  /** JUnit XML 文件路径（相对工作区），存在则解析 tests/failures/errors/skipped。 */
  junitFile?: string
  /** 简单正则断言（对 evaluator stdout/stderr 全文匹配，全部命中才通过）。 */
  regexAssertions?: string[]
  /** 可选的 JUnit 文件路径中 XML 用的根元素名字，缺省自动识别。 */
  junitRoot?: string
}

/** 单个实验。 */
export interface Experiment {
  id: string
  /** Manifest schema version，Phase 2 起为 '0.8'。 */
  version: string
  title: string
  /** 用户输入的 Prompt（任务描述）；对 secret 字段做脱敏存储。 */
  prompt: string
  /** baseline 仓库路径（源工作区）。 */
  baseline: string
  /** baseline 是否为 git 仓库（决定隔离方式）。 */
  baselineIsGit: boolean
  /** baseline commit（git 仓库时）；非 git 为 null。 */
  baselineCommit: string | null
  /** 隔离方式：'git-worktree' | 'copy'。 */
  isolation: 'git-worktree' | 'copy'
  /** 每个分支跑多少遍（默认 1）；A x N / B x N。 */
  repeat: number
  /** 分支 A / B。 */
  branches: [BranchConfig, BranchConfig]
  status: ExperimentStatus
  createdAt: string
  updatedAt: string
  result?: ExperimentResult | null
}

/** 单次 repeat 的运行结果（BranchResult.runs 的成员）。 */
export interface BranchRun {
  /** 第几遍（从 0 开始，便于展示 "run 0/1/2"）。 */
  index: number
  status: RunStatus
  /** 进程级 + evaluator 级指标。 */
  metrics: Metrics
  /** evaluator 解析结果（可能为 null：未配 evaluator）。 */
  evaluator: EvaluatorResult | null
  /** Agent 实际执行信息（驱动 + 命令模板，不含 secret）。 */
  agent?: AgentSpec | null
  /** 运行日志片段（stdout + stderr，截断保存，不含 secret）。 */
  outputTail: string
  error?: string | null
}

/** Repeat 汇总（success rate + 中位数）。 */
export interface RepeatSummary {
  count: number
  successCount: number
  /** 0..1；0 表示全失败。 */
  successRate: number
  medianWallTimeMs: number | null
  medianToolCalls: number | null
  medianInputTokens: number | null
  medianOutputTokens: number | null
  /** 每次 input+output 之和的中位数。 */
  medianTokens: number | null
}

/** 分支 A/B 各自的 Repeat 聚合结果。 */
export interface BranchResult {
  branch: 'a' | 'b'
  status: RunStatus
  /** 声明/实际执行的 repeat 次数。 */
  repeat: number
  /** 每次运行的原始结果；repeat === 1 时长度为 1。 */
  runs: BranchRun[]
  /** 聚合指标：中位数（数值） + 是否全部成功（success）。 */
  metrics: Metrics
  /** repeat 汇总（中位数/成功率）。 */
  summary: RepeatSummary
  /** 最后一次 evaluator 解析结果（兼容展示；repeat>1 请优先看 runs）。 */
  evaluator: EvaluatorResult | null
  /** 聚合日志片段（各 run 拼接，截断保存，不含 secret）。 */
  outputTail: string
  error?: string | null
}

/** 实验汇总结果。 */
export interface ExperimentResult {
  startedAt: string | null
  finishedAt: string | null
  /** 每个分支一次即一个 BranchResult（内部含 runs）。 */
  runs: [BranchResult, BranchResult]
  /** 对比汇总（core/repeat 基于聚合 metrics 计算）。 */
  comparison: Comparison
}

export interface Comparison {
  winner: 'a' | 'b' | 'tie' | 'incomplete'
  /** 逐指标 A/B 数值对比。 */
  metrics: Record<string, { a: number | null; b: number | null; better: 'a' | 'b' | 'tie' | 'na' }>
}

/**
 * 客观指标集合。
 * 数值型字段统一 number，无法采集用 null（不写 undefined，便于 JSON serde 与对比）。
 */
export interface Metrics {
  success: boolean
  wallTimeMs: number | null
  turns: number | null
  llmCalls: number | null
  toolCalls: number | null
  inputTokens: number | null
  outputTokens: number | null
  filesChanged: number | null
  diffSize: number | null
  testsPassed: number | null
  testsFailed: number | null
  testsSkipped: number | null
  errors: number
  retries: number | null
  compactionCount: number | null
  /** DSH 内部 token 数据不可得时的说明（例如 "unavailable: no dsh API"）。 */
  notes?: string[]
}

/** Evaluator 单项结果。 */
export interface EvaluatorResult {
  passed: boolean
  exitCode: number | null
  expectExitCodeOk: boolean | null
  junit: JunitSummary | null
  regexAssertions: RegexAssertionResult[]
  fileExists: FileExistsResult[]
  error?: string | null
}

export interface JunitSummary {
  tests: number
  failures: number
  errors: number
  skipped: number
  /** 全部通过判定（tests>0 且 failures===0 且 errors===0）。 */
  passed: boolean
}

export interface RegexAssertionResult {
  pattern: string
  matched: boolean
}

export interface FileExistsResult {
  path: string
  exists: boolean
}

/** 创建实验的输入（API / CLI）。 */
export interface CreateExperimentInput {
  title?: string
  prompt: string
  baseline: string
  /** 可选：pin 到指定 commit；缺省用当前 HEAD。 */
  baselineCommit?: string | null
  /** 强制用复制隔离，即使源是 git 仓库。 */
  forceCopy?: boolean
  /** 每个分支重复跑的次数，1 表示单次（默认 1）。 */
  repeat?: number
  branches: [BranchConfig, BranchConfig]
}

/** Manifest schema 版本；Phase 2 目标 0.8。 */
export const MANIFEST_VERSION = '0.8'

/** Manifest 存储根目录常量（host + cli 共用）。 */
export const DEFAULT_RUN_LAB_DIR = 'run-lab'
export const DEFAULT_MANIFESTS_DIR = 'manifests'
export const DEFAULT_WORKSPACES_DIR = 'workspaces'
