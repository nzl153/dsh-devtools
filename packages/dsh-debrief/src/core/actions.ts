/**
 * Pure action helpers for dsh-debrief.
 *
 * These functions produce user-facing action payloads (copy text, composer
 * draft) from a debrief object. They are DSH-free so unit tests can assert
 * the generated prompt is bounded and deterministic.
 */

import type { Debrief, FileChange, UnresolvedItem } from './types.ts'
import { formatDuration, formatTokens } from './format.ts'

export interface ContinuePromptOptions {
  /** Max unresolved items included. */
  maxUnresolved?: number
  /** Max failed commands included. */
  maxFailedCommands?: number
  /** Max changed files included. */
  maxChangedFiles?: number
  /** Overall prompt character budget; longer results are truncated with a marker. */
  maxChars?: number
}

const DEFAULT_OPTIONS: Required<ContinuePromptOptions> = {
  maxUnresolved: 8,
  maxFailedCommands: 6,
  maxChangedFiles: 6,
  maxChars: 1600,
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, Math.max(0, maxChars - 3))}...`
}

function fileLine(file: FileChange): string {
  return `- ${file.path}${file.kind !== 'unknown' ? ` (${file.kind})` : ''}`
}

function unresolvedLine(item: UnresolvedItem): string {
  if (item.detail && item.detail !== item.label) return `- ${item.label}（${item.detail}）`
  return `- ${item.label}`
}

/**
 * Build a bounded "continue unresolved" prompt draft ready to insert into the
 * composer. It only lists evidence already computed by the debrief; it never
 * instructs the model to perform a destructive or automatic action on its own.
 */
export function buildContinuePrompt(debrief: Debrief, options: ContinuePromptOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const lines: string[] = []

  if (debrief.kind === 'session') {
    lines.push(`会话战报（${debrief.turnCount} 轮）`)
  } else {
    lines.push(`第 ${debrief.turn} 轮战报`)
  }
  lines.push(`耗时 ${formatDuration(debrief.durationMs)}，命令 ${debrief.commandCount} 条`)

  const failed = debrief.failedCommands.slice(0, opts.maxFailedCommands)
  if (failed.length > 0) {
    lines.push('')
    lines.push('失败命令：')
    for (const cmd of failed) {
      const code = cmd.exitCode === null ? '无 exit code' : `exit ${cmd.exitCode}`
      lines.push(`- ${cmd.command} (${code})`)
    }
  }

  const unresolved = debrief.unresolved.slice(0, opts.maxUnresolved)
  if (unresolved.length > 0) {
    lines.push('')
    lines.push('未解决项：')
    for (const item of unresolved) lines.push(unresolvedLine(item))
  }

  const files = debrief.changedFiles.slice(0, opts.maxChangedFiles)
  if (files.length > 0) {
    lines.push('')
    lines.push('相关文件：')
    for (const file of files) lines.push(fileLine(file))
  }

  lines.push('')
  lines.push('请先检查以上各项的当前状态，再继续处理；不要重复执行已经成功的步骤，也不要擅自执行有风险的操作。')

  return truncate(lines.join('\n'), opts.maxChars)
}

/** Build a plain-text summary (used by the Copy action). */
export function summarizeDebrief(d: Debrief): string {
  const lines: string[] = []
  lines.push(d.kind === 'turn' ? `Turn ${d.turn} Debrief` : 'Session Debrief')
  lines.push(`Duration: ${formatDuration(d.durationMs)}`)
  if (d.kind === 'session') lines.push(`Turns: ${d.turnCount}`)
  lines.push(`Steps: ${d.stepCount}  Tool calls: ${d.toolCallCount}  Commands: ${d.commandCount}`)
  if (d.tokens.usageReports > 0) {
    lines.push(`Tokens in: ${formatTokens(d.tokens.inputTokens)}  out: ${formatTokens(d.tokens.outputTokens)}`)
  }
  if (d.changedFiles.length > 0) {
    lines.push(`Changed files: ${d.changedFiles.map((f) => f.path).join(', ')}`)
  }
  if (d.tests.length > 0) {
    const passed = d.tests.filter((t) => t.status === 'passed').length
    const failed = d.tests.filter((t) => t.status === 'failed').length
    const unknown = d.tests.filter((t) => t.status === 'unknown').length
    const bits = [`${passed} passed`, `${failed} failed`]
    if (unknown > 0) bits.push(`${unknown} unknown`)
    lines.push(`Tests: ${bits.join(', ')}`)
  }
  if (d.failedCommands.length > 0) {
    lines.push(`Failed commands: ${d.failedCommands.map((c) => c.command).join('; ')}`)
  }
  if (d.unresolved.length > 0) {
    lines.push(`Unresolved: ${d.unresolved.map((u) => u.detail).join('; ')}`)
  }
  return lines.join('\n')
}