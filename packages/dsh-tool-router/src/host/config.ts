/**
 * Host plugin configuration.
 */
import z from '@deepseek-ai/schemastery'
import { ROUTER_MODES, type RouterConfig, type RouterMode } from '../core/types.ts'

export const Config = z.object({
  mode: z.string().default('observe'),
  alwaysVisible: z.array(z.string()).default([]),
  minimumSafeTools: z.array(z.string()).default(['bash', 'read', 'search']),
  fallbackToolName: z.string().default('request_tools'),
  fallbackTtlSteps: z.number().min(1).max(20).default(3),
  storePromptPreview: z.boolean().default(true),
  suggestPromptSection: z.boolean().default(true),
})

export interface Config {
  mode?: string
  alwaysVisible?: string[]
  minimumSafeTools?: string[]
  fallbackToolName?: string
  fallbackTtlSteps?: number
  storePromptPreview?: boolean
  suggestPromptSection?: boolean
}

export function normalizeConfig(config: Config = {}): Required<Pick<RouterConfig, 'mode' | 'alwaysVisible' | 'minimumSafeTools' | 'fallbackToolName' | 'fallbackTtlSteps' | 'storePromptPreview'>> & { suggestPromptSection: boolean } {
  const rawMode = config.mode ?? 'observe'
  const mode: RouterMode = (ROUTER_MODES as readonly string[]).includes(rawMode)
    ? rawMode as RouterMode
    : 'observe'

  return {
    mode,
    alwaysVisible: config.alwaysVisible ?? [],
    minimumSafeTools: config.minimumSafeTools ?? ['bash', 'read', 'search'],
    fallbackToolName: config.fallbackToolName ?? 'request_tools',
    fallbackTtlSteps: Math.max(1, Math.min(20, config.fallbackTtlSteps ?? 3)),
    storePromptPreview: config.storePromptPreview ?? true,
    suggestPromptSection: config.suggestPromptSection ?? true,
  }
}