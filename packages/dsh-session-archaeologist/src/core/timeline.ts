/**
 * Timeline construction: turn/session structural summary.
 *
 * Uses deterministic local heuristics only — never calls any paid model.
 * When a stage cannot be reliably identified it is marked "estimated" or
 * "unknown". The result is cached by the host as a sidecar JSON file.
 */
import type { IndexedDoc, SessionTimeline, TimelineStage } from './types.ts'

function stage(label: string, detail: string, confidence: TimelineStage['confidence']): TimelineStage {
  return { label, detail, confidence }
}

const TOOL_NAMES = new Set([
  'bash', 'pwsh', 'powershell', 'cmd', 'sh', 'shell', 'zsh',
  'glob', 'read', 'read_document', 'grep', 'rg', 'find',
  'write', 'write_file', 'edit', 'str_replace_editor', 'apply',
  'patch', 'create', 'delete', 'move', 'copy', 'rename',
  'npm', 'pnpm', 'node', 'python', 'git', 'cargo', 'dotnet', 'go',
  'gh', 'npx', 'yarn', 'bun',
])

/** Build a structured timeline from parsed docs (and optionally file/command metadata). */
export function buildTimeline(
  sessionId: string,
  title: string,
  createdAt: number,
  docs: readonly IndexedDoc[],
  files: readonly string[],
  commands: readonly string[],
): SessionTimeline {
  const userMsgs = docs.filter((d) => d.source === 'user')
  const toolDocs = docs.filter((d) => d.source === 'tool')
  const resultDocs = docs.filter((d) => d.source === 'tool-result')
  const outcomeDoc = [...docs].sort((a, b) => b.seq - a.seq).find((d) => d.source === 'outcome')
  const readTools = toolDocs.filter((d) => /tool: (?:read|glob|grep|find|ls|cat|head|tail|list)/.test(d.content))
  const editTools = toolDocs.filter((d) => /tool: (?:write|edit|patch|str_replace_editor|apply|create|delete|move|copy|rename|modify)/.test(d.content))
  const testCommands = commands.filter((c) => /\b(test|check|verify|build|lint|typecheck|run|dev)\b/i.test(c))

  const stages: TimelineStage[] = []

  const problem = userMsgs[0]?.content.trim() ?? userMsgs.find((d) => d.source === 'system')?.content.trim() ?? ''
  stages.push(stage(
    'Problem',
    problem ? problem.slice(0, 1500) : 'No user prompt captured.',
    problem ? 'known' : 'unknown',
  ))

  const investLines = userMsgs.slice(1).map((d) => d.content.trim().slice(0, 300))
  if (readTools.length > 0 || investLines.length > 0) {
    const detail = [
      readTools.length > 0 ? `${readTools.length} inspection tool call(s)` : '',
      ...investLines.map((l) => `user follow-up: ${l}`),
    ].filter(Boolean).join('\n')
    stages.push(stage('Investigation', detail, readTools.length > 0 ? 'known' : 'estimated'))
  } else {
    stages.push(stage('Investigation', 'No explicit inspection tool calls found.', 'estimated'))
  }

  const fileDetail = files.length > 0
    ? files.slice(0, 30).join('\n')
    : 'No file mentions detected.'
  stages.push(stage('Files inspected', fileDetail, files.length > 0 ? 'known' : 'estimated'))

  if (editTools.length > 0) {
    stages.push(stage('Edits', `${editTools.length} edit/write tool call(s)`, 'known'))
  } else {
    stages.push(stage('Edits', 'No edit/write tool calls detected.', 'unknown'))
  }

  if (testCommands.length > 0) {
    stages.push(stage('Test', testCommands.slice(0, 10).join('\n'), 'known'))
  } else {
    stages.push(stage('Test', 'No test/build command detected.', 'estimated'))
  }

  stages.push(stage(
    'Result',
    outcomeDoc?.content ?? 'No turn/end outcome captured.',
    outcomeDoc ? 'known' : 'estimated',
  ))

  return {
    sessionId,
    title: title || '(untitled)',
    createdAt,
    stages,
    generatedAt: new Date().toISOString(),
    local: true,
  }
}