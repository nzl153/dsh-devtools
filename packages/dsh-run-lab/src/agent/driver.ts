/**
 * AgentDriver：真 Agent Run 的抽象 wrapper 接口 + 命令驱动实现。
 *
 * Phase 1 里 agent 只通过 `agentCommand` 模板在隔离工作区里跑一个外部命令
 * （例如 `dsh --profile headless "<task>"`），并把输出当作文本尽力解析指标。
 * Phase 2 把它收敛成显式的 AgentDriver 接口：
 *
 *   - CommandAgentDriver：默认实现，把 agentCommand 当作一个外部命令在隔离
 *     工作区执行（DSH 官方 CLI 或任意可执行文件都行）。这是当前唯一可用的驱动，
 *     因为本插件的运行时 bundle 刻意不依赖 DSH 内部 API（@deepseek-ai/* 只在
 *     devDependencies），且 `ctx.agents.create()` 需要宿主进程里注册了
 *     dsh-agent-loop 工厂 + 已配置的 LLM provider 才能跑。
 *
 * 后续若要在插件内直接调 DSH 官方 programmatic run API（ctx.agents.create /
 * resume + agent.followup + whenIdle），只需新增一个 DshAgentDriver 实现并让
 * resolveAgentDriver 按 driver 名字分发即可，引擎调用方接口不变。这个文件保持纯
 * Node，不 import 任何 @deepseek-ai/* 运行时包，可在宿主外单独单测。
 */
import type { RunCommandOptions, RunCommandResult } from '../runner/runner.ts'
import { runCommand } from '../runner/runner.ts'

/** 驱动标识：当前只有 'command'；'dsh-inproc' 预留（未接线）。 */
export type AgentDriverKind = 'command' | 'dsh-inproc'

/** 一次真 Agent Run 的输入（与具体驱动无关）。 */
export interface AgentRunRequest {
  /** 隔离工作区路径（命令的 cwd）。 */
  cwd: string
  /** 要执行的 agent 命令（已做过 $WORKSPACE 替换或由驱动自行替换）。 */
  command: string
  /** 命令模板里是否引用了工作区占位（供解析/记录）。 */
  usesWorkspace?: boolean
  env?: Record<string, string>
  timeoutMs?: number
  maxOutputBytes?: number
}

/** 一次真 Agent Run 的结果（驱动无关）。 */
export interface AgentRunOutcome {
  success: boolean
  wallTimeMs: number
  timedOut: boolean
  exitCode: number | null
  outputTail: string
  /** 驱动无法采到的指标说明（例如 inproc 驱动缺 token feed）。 */
  notes?: string[]
  error?: string | null
}

/** 分支里声明的 agent 驱动配置（存 manifest，不含 secret）。 */
export interface AgentSpec {
  /** 驱动类型，默认 'command'。 */
  driver: AgentDriverKind
  /** 解析后的命令模板（command 驱动用）。 */
  command?: string
  /** 记录命令模板是否引用了 $WORKSPACE。 */
  usesWorkspace?: boolean
}

export interface AgentDriver {
  readonly kind: AgentDriverKind
  run(req: AgentRunRequest): Promise<AgentRunOutcome>
}

/** 默认驱动：把 agentCommand 当作外部命令在隔离工作区执行。 */
export class CommandAgentDriver implements AgentDriver {
  readonly kind: AgentDriverKind = 'command'

  async run(req: AgentRunRequest): Promise<AgentRunOutcome> {
    const opts: RunCommandOptions = {
      cwd: req.cwd,
      command: req.command,
      timeoutMs: req.timeoutMs,
      maxOutputBytes: req.maxOutputBytes,
      env: req.env,
    }
    const res: RunCommandResult = await runCommand(opts)
    return {
      success: res.exitCode === 0 && !res.timedOut,
      wallTimeMs: res.wallTimeMs,
      timedOut: res.timedOut,
      exitCode: res.exitCode,
      outputTail: res.outputTail,
      notes: res.timedOut ? ['agent command timed out'] : [],
      error: res.error ?? null,
    }
  }
}

const commandDriver = new CommandAgentDriver()

/** 按名字解析驱动；未知驱动回退到 command（不抛错，保持向后兼容）。 */
export function resolveAgentDriver(kind: AgentDriverKind | string | undefined): AgentDriver {
  if (kind === 'dsh-inproc') {
    // 预留：DSH 程序化 run API 未在本插件内接线，见文件头说明。
    return commandDriver
  }
  return commandDriver
}

/**
 * 解析 / 归一化分支的 agent 配置（从 API/CLI 的原始 JSON）。
 * 容错：未知字段忽略，类型不对回退默认。返回 AgentSpec 或 undefined（无 agent）。
 */
export function parseAgentConfig(input: unknown): AgentSpec | undefined {
  if (input === null || input === undefined || typeof input !== 'object') return undefined
  const o = input as Record<string, unknown>
  const driver = typeof o['driver'] === 'string' ? o['driver'] as AgentDriverKind : 'command'
  const command = typeof o['command'] === 'string' && o['command'] ? o['command'] : undefined
  if (!command) return undefined
  return {
    driver,
    command,
    usesWorkspace: command.includes('$WORKSPACE') || command.includes('%WORKSPACE%'),
  }
}

/** 从 command 模板推导 AgentSpec（老字段 agentCommand 兼容进 agent）。 */
export function specFromCommand(command: string | undefined): AgentSpec | undefined {
  if (!command) return undefined
  return {
    driver: 'command',
    command,
    usesWorkspace: command.includes('$WORKSPACE') || command.includes('%WORKSPACE%'),
  }
}

/**
 * 替换命令模板里的工作区占位（$WORKSPACE 与 %WORKSPACE%），返回替换后的命令。
 * 纯函数，可单测。
 */
export function substituteWorkspace(template: string, wsDir: string): string {
  return template.replaceAll('$WORKSPACE', wsDir).replaceAll('%WORKSPACE%', wsDir)
}
