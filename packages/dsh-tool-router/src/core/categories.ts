/**
 * Deterministic tool classification.
 *
 * DSH's model-visible `ToolSchema` only carries name/description/parameters,
 * so "source" attribution is approximated from name prefixes and a built-in
 * known-tool map. This module never calls an LLM.
 */
import type { ToolCategory, ToolLike } from './types.ts'

export const CATEGORIES: readonly ToolCategory[] = [
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
]

/** Exact model-visible tool names we know ship with DSH or the toolkit family. */
const NAME_OVERRIDES: Record<string, ToolCategory> = {
  read: 'filesystem',
  write: 'filesystem',
  edit: 'filesystem',
  str_replace_editor: 'filesystem',
  fs_read: 'filesystem',
  fs_write: 'filesystem',
  fs_edit: 'filesystem',
  glob: 'search',
  grep: 'search',
  rg: 'search',
  workspace_search: 'search',
  fs_search: 'search',
  definition: 'lsp',
  reference: 'lsp',
  bash: 'shell',
  pwsh: 'shell',
  sh: 'shell',
  job_list: 'shell',
  job_output: 'shell',
  job_kill: 'shell',
  web_search: 'web',
  web_fetch: 'web',
  http: 'web',
  fetch: 'web',
  skill: 'misc',
  todo_write: 'misc',
  ask_user_question: 'misc',
  get_goal: 'workflow',
  create_goal: 'workflow',
  update_goal: 'workflow',
  subagent: 'subagent',
  ralph: 'subagent',
  ralph_loop: 'subagent',
  send_message: 'subagent',
  interrupt_agent: 'subagent',
  report: 'subagent',
  workflow: 'workflow',
  pipeline: 'workflow',
}

const NAME_PATTERNS: Record<Exclude<ToolCategory, 'misc'>, RegExp[]> = {
  filesystem: [
    /^(fs|file|dir|folder|path|workspace)/i,
    /(read|write|edit|mkdir|rmdir|remove|delete|move|copy|rename|ls|stat|touch)/i,
  ],
  search: [
    /(grep|rg|ripgrep|search|find|locate|glob|definition|reference)/i,
  ],
  shell: [
    /(bash|pwsh|shell|terminal|command|exec|run|sh|job)/i,
  ],
  git: [
    /(git|commit|branch|checkout|merge|rebase|push|pull|diff|status|stash)/i,
  ],
  lsp: [
    /(lsp|definition|reference|symbol|hover|diagnostic|code_action|rename)/i,
  ],
  web: [
    /(web|http|url|crawl|scrape|fetch|search_web|web_search)/i,
  ],
  browser: [
    /(browser|playwright|puppeteer|navigate|click|type|screenshot|page)/i,
  ],
  database: [
    /(sql|database|db|query|sqlite|postgres|mysql|redis|mongo)/i,
  ],
  mcp: [
    /(^mcp|mcp_|model.context.protocol)/i,
  ],
  image: [
    /(image|picture|photo|png|jpe?g|svg|icon|visual)/i,
  ],
  workflow: [
    /(workflow|pipeline|schedule|cron|goal|plan|task|todo)/i,
  ],
  subagent: [
    /(subagent|agent|delegate|fork|child|ralph)/i,
  ],
}

const DESCRIPTION_PATTERNS: Record<Exclude<ToolCategory, 'misc'>, RegExp[]> = {
  filesystem: [
    /file|filesystem|directory|path|read|write|edit|workspace file/i,
  ],
  search: [
    /search|grep|find|regex|glob|locate|index/i,
  ],
  shell: [
    /shell|command|terminal|bash|pwsh|run command|execute|background job/i,
  ],
  git: [
    /git|commit|branch|repository|version control/i,
  ],
  lsp: [
    /lsp|language server|definition|reference|symbol|type definition/i,
  ],
  web: [
    /web|http|url|website|search engine|page content|fetch/i,
  ],
  browser: [
    /browser|playwright|navigate|click|screenshot|headless/i,
  ],
  database: [
    /database|sql|query|sqlite|postgres|mysql|redis|record/i,
  ],
  mcp: [
    /mcp|model context protocol/i,
  ],
  image: [
    /image|picture|photo|visual|screenshot|icon/i,
  ],
  workflow: [
    /workflow|pipeline|task|goal|schedule|orchestrat/i,
  ],
  subagent: [
    /subagent|child agent|delegate|parallel agent|agent loop/i,
  ],
}

export interface Classification {
  category: ToolCategory
  score: number
  reasons: string[]
}

function normalizeName(name: string): string {
  // Some DSH tools expose a `tool:` internal prefix alongside the model name.
  return name.replace(/^tool:/, '').trim()
}

export function isToolCategory(value: unknown): value is ToolCategory {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)
}

export function classifyTool(tool: ToolLike): Classification {
  const name = normalizeName(tool.name)
  const override = NAME_OVERRIDES[name]
  if (override !== undefined) {
    return { category: override, score: 10, reasons: [`known name "${tool.name}"`] }
  }

  const description = tool.description ?? ''
  const nameText = `${name} ${name.includes('.') ? name.split('.')[0] : ''}`
  const candidates: Array<{ category: Exclude<ToolCategory, 'misc'>; score: number; reasons: string[] }> = []

  for (const category of Object.keys(NAME_PATTERNS) as Exclude<ToolCategory, 'misc'>[]) {
    let score = 0
    const reasons: string[] = []
    for (const pattern of NAME_PATTERNS[category]) {
      if (pattern.test(nameText)) {
        score += 3
        reasons.push(`name:${pattern}`)
      }
    }
    for (const pattern of DESCRIPTION_PATTERNS[category]) {
      if (pattern.test(description)) {
        score += 1
        reasons.push(`desc:${pattern}`)
      }
    }
    if (score > 0) candidates.push({ category, score, reasons })
  }

  if (candidates.length === 0) {
    return { category: 'misc', score: 0, reasons: ['no category matched'] }
  }

  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]!
  return { category: best.category, score: best.score, reasons: best.reasons }
}

export function classifyTools(tools: readonly ToolLike[]): Map<ToolCategory, string[]> {
  const result = new Map<ToolCategory, string[]>()
  for (const tool of tools) {
    const { category } = classifyTool(tool)
    const list = result.get(category)
    if (list === undefined) result.set(category, [tool.name])
    else list.push(tool.name)
  }
  return result
}