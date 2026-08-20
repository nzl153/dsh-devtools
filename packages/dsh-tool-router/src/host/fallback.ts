/**
 * The `request_tools` fallback tool.
 *
 * This is the safety valve: if the router hides something the model actually
 * needs, the model can ask for a category and the next step re-adds those
 * tools. It never grants permissions — it only changes model-visible tool set.
 */
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import { CATEGORIES, isToolCategory } from '../core/categories.ts'
import type { ToolCategory } from '../core/types.ts'

export interface RequestToolsOptions {
  fallbackToolName: string
  getState: (agentId: string) => { enabledCategories: Set<ToolCategory> }
  onRequest: (agentId: string, categories: ToolCategory[]) => void
}

export function requestToolsDefinition(options: RequestToolsOptions): ToolDefinition {
  const renderJson = (_args: unknown, value: unknown) => [
    {
      type: 'text' as const,
      text: typeof value === 'string' ? value : JSON.stringify(value),
    },
  ]

  return {
    name: options.fallbackToolName,
    description:
      'Request additional tool categories for the next steps. The router keeps a minimum safe tool set always visible; use this only when a needed tool is hidden. '
      + `Available categories: ${CATEGORIES.join(', ')}.`,
    parameters: {
      type: 'object',
      properties: {
        enable: {
          type: 'array',
          items: { type: 'string', enum: [...CATEGORIES] },
          description: 'Tool categories to make visible.',
        },
      },
      required: ['enable'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          enabled: { type: 'array', items: { type: 'string' } },
          availableCategories: { type: 'array', items: { type: 'string' } },
          hidden: { type: 'array', items: { type: 'string' } },
        },
        required: ['enabled', 'availableCategories', 'hidden'],
      },
      render: renderJson,
    },
    async execute(args, exec: ToolRunContext): Promise<unknown> {
      const agent = exec.agent
      if (agent === undefined) {
        return { enabled: [], availableCategories: CATEGORIES, hidden: [...CATEGORIES] }
      }

      const raw = (args as { enable?: unknown } | undefined)?.enable
      const requested = Array.isArray(raw)
        ? raw.filter(isToolCategory)
        : typeof raw === 'string' && isToolCategory(raw)
          ? [raw]
          : []

      options.onRequest(agent.id, requested)
      const enabled = new Set(options.getState(agent.id).enabledCategories)
      for (const category of requested) enabled.add(category)

      return {
        enabled: [...enabled],
        availableCategories: [...CATEGORIES],
        hidden: CATEGORIES.filter((category) => !enabled.has(category)),
      }
    },
  }
}