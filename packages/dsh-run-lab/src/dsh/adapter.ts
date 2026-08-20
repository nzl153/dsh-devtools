/**
 * DSH Agent 适配器：
 *  - buildAgentCommand：把 profile + prompt 拼成 `dsh --profile <p> "<prompt>"` 命令模板，
 *    供 BranchConfig.agentCommand 使用（会替换 $WORKSPACE）。
 *  - parseDshOutputMetrics：尽力从 headless stdout 提取 token/turn/call 等指标；
 *    拿不到一律返回 null（不伪造）。
 *
 * 第一版不直接调 DSH 内部 API（API 面在 rc.6 不稳定）；agentCommand 是用户可配置的
 * 任意命令。dsh adapter 只负责生成默认模板 + 尽力解析。
 */
import type { Metrics } from '../core/types.ts'
import { emptyMetrics, extractNumber } from '../core/metrics.ts'

export interface DshRunSpec {
  profile: string
  prompt: string
}

/** 生成默认 agentCommand 模板（Windows 兼容：用 dsh 可执行文件 + cmd 包装）。 */
export function buildAgentCommand(spec: DshRunSpec): string {
  const prompt = JSON.stringify(spec.prompt)
  // 优先使用 profile 内 node_modules/.bin 的 dsh；否则 PATH 里的 dsh。
  return `dsh --profile ${quoteShell(spec.profile)} ${prompt}`
}

function quoteShell(s: string): string {
  return /[\s"']/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s
}

/**
 * 从 headless 输出里尽力提取结构化指标。
 * token 行示例：
 *   input tokens: 1234, output tokens: 567
 *   turns: 3, tool calls: 5
 * 匹配不到 -> null（标 unavailable）。
 */
export function parseDshOutputMetrics(output: string): Partial<Metrics> {
  const out: Partial<Metrics> = {}
  const input = extractNumber(output, /input\s+tokens?:?\s*([0-9,_]+)/i)
  const outputT = extractNumber(output, /output\s+tokens?:?\s*([0-9,_]+)/i)
  if (input !== null) out.inputTokens = input
  if (outputT !== null) out.outputTokens = outputT
  const turns = extractNumber(output, /(?:turns?|turn count)\s*[:=]\s*([0-9,_]+)/i)
  if (turns !== null) out.turns = turns
  const llmCalls = extractNumber(output, /llm\s+calls?:?\s*([0-9,_]+)/i)
  if (llmCalls !== null) out.llmCalls = llmCalls
  const toolCalls = extractNumber(output, /tool\s+calls?:?\s*([0-9,_]+)/i)
  if (toolCalls !== null) out.toolCalls = toolCalls
  const compaction = extractNumber(output, /compaction(?:s)?\s*[:=]\s*([0-9,_]+)/i)
  if (compaction !== null) out.compactionCount = compaction
  return out
}

export function emptyDshMetrics(): Metrics {
  return emptyMetrics()
}

/** 记录无法从 DSH API 拿到 token 数据的说明。 */
export function unavailableNote(): string {
  return 'unavailable: no DSH API token feed in this build'
}
