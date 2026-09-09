/**
 * User settings for dsh-debrief, registered through the DSH settings service.
 *
 * The DSH settings service persists the document for us (no hand-rolled
 * sidecar needed). Fields map 1:1 onto the core `DebriefConfig`.
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { SettingsScope } from '@deepseek-ai/dsh-settings'
import type { DebriefSettings } from '../core/types.ts'
import { DEFAULT_CONFIG } from '../core/types.ts'

/**
 * 0.1.2 起 `settingsNamespace()` 助手被移除，命名空间改用普通字符串常量
 * （官方插件同样写法，例如 dsh-agent-presets 的 `const SETTINGS_NAMESPACE = "agent-presets"`）。
 */
export const DEBRIEF_NAMESPACE = 'debrief'

export const DebriefSettingsSchema: z<DebriefSettings> = z.object({
  triggerMode: z.union(['off', 'session-only', 'every-n-turns', 'on-completion'] as const).default(DEFAULT_CONFIG.triggerMode),
  turnInterval: z.natural().min(1).max(100).default(DEFAULT_CONFIG.turnInterval),
  testCommandPatterns: z.array(z.string()).default([]),
  detectTodoMarkers: z.boolean().default(DEFAULT_CONFIG.detectTodoMarkers),
})

export type DebriefSettingsScope = SettingsScope<DebriefSettings>

export function registerDebriefSettings(ctx: Context): DebriefSettingsScope {
  return ctx.settings.register(DEBRIEF_NAMESPACE, DebriefSettingsSchema, { applies: 'live' })
}