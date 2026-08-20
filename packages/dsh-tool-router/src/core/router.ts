/**
 * Route planning and filtering.
 *
 * The only mutation this module performs is shrinking a tool list. It never
 * touches permissions, sandbox, guards, or approval.
 */
import { classifyTool } from './categories.ts'
import { routeCategories } from './heuristics.ts'
import type { RouteInput, RouteOptions, RoutePlan, ToolCategory, ToolLike } from './types.ts'

/**
 * DSH Code Mode's reserved transport. Unlike normal tools it is outside the
 * filterable registry layers, so the router must never hide it.
 */
const RESERVED_TOOL_NAMES = ['run_code']

function utf8Length(text: string): number {
  return Buffer.byteLength(text, 'utf8')
}

function bytesOfTools(tools: readonly ToolLike[]): number {
  let total = 0
  for (const tool of tools) {
    total += utf8Length(JSON.stringify(tool))
  }
  return total
}

function tokensOfBytes(bytes: number): number {
  // Rough UTF-8 byte -> token estimate; real tokenizers vary by provider.
  return Math.round(bytes / 4)
}

export function planRoute(tools: readonly ToolLike[], input: RouteInput, options: RouteOptions): RoutePlan {
  const { categories, reasons } = routeCategories(input)

  const selectedCategories = categories
  const requestedCategories = [...options.enabledCategories]
  const effective = new Set<ToolCategory>([...selectedCategories, ...requestedCategories])

  const alwaysSet = new Set<string>([
    ...options.alwaysVisible,
    ...options.minimumSafeTools,
    options.fallbackToolName,
    ...RESERVED_TOOL_NAMES,
  ])
  for (const name of alwaysSet) {
    if (name.trim().length === 0) alwaysSet.delete(name)
  }

  const beforeBytes = bytesOfTools(tools)
  const beforeTokens = tokensOfBytes(beforeBytes)

  let visibleNames: string[]
  let hiddenNames: string[]

  if (options.mode === 'adaptive') {
    // Fail-open: if no signal at all, keep the full set so a bad guess never
    // makes a task unsolvable. Fallback requests can still narrow it later.
    if (effective.size === 0) {
      visibleNames = tools.map((tool) => tool.name)
      hiddenNames = []
    } else {
      visibleNames = []
      hiddenNames = []
      for (const tool of tools) {
        const category = classifyTool(tool).category
        if (alwaysSet.has(tool.name) || effective.has(category)) {
          visibleNames.push(tool.name)
        } else {
          hiddenNames.push(tool.name)
        }
      }
    }
  } else {
    visibleNames = tools.map((tool) => tool.name)
    hiddenNames = []
  }

  const visibleSet = new Set(visibleNames)
  const afterTools = tools.filter((tool) => visibleSet.has(tool.name))
  const afterBytes = bytesOfTools(afterTools)
  const afterTokens = tokensOfBytes(afterBytes)

  return {
    mode: options.mode,
    selectedCategories,
    requestedCategories,
    effectiveCategories: [...effective],
    visibleNames,
    hiddenNames,
    beforeBytes,
    afterBytes,
    savedBytes: Math.max(0, beforeBytes - afterBytes),
    beforeTokens,
    afterTokens,
    savedTokens: Math.max(0, beforeTokens - afterTokens),
    reasons,
  }
}