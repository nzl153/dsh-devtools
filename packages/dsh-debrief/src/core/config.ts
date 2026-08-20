/**
 * Configuration parsing and validation for dsh-debrief.
 *
 * The host reads user settings (via the DSH settings service) into a plain
 * object, then normalizes it here. Unknown fields are dropped, bad regexes in
 * `testCommandPatterns` are filtered out with a note, and trigger mode falls
 * back to the safe default rather than throwing.
 */

import {
  DEFAULT_CONFIG,
  type DebriefConfig,
  type TriggerMode,
} from './types.ts'

const TRIGGER_MODES: readonly TriggerMode[] = [
  'off',
  'session-only',
  'every-n-turns',
  'on-completion',
]

export function isTriggerMode(value: unknown): value is TriggerMode {
  return typeof value === 'string' && (TRIGGER_MODES as readonly string[]).includes(value)
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.floor(value)))
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

function validRegexes(patterns: readonly string[]): string[] {
  return patterns.filter((pattern) => {
    try {
      new RegExp(pattern, 'i')
      return true
    } catch {
      return false
    }
  })
}

export interface NormalizedConfig {
  config: DebriefConfig
  /** Warnings produced during normalization (e.g. dropped bad regex). */
  warnings: string[]
}

export function normalizeConfig(input: unknown): NormalizedConfig {
  const raw = typeof input === 'object' && input !== null ? input as Record<string, unknown> : {}
  const warnings: string[] = []

  const triggerMode = isTriggerMode(raw.triggerMode) ? raw.triggerMode : DEFAULT_CONFIG.triggerMode
  if (!isTriggerMode(raw.triggerMode) && raw.triggerMode !== undefined) {
    warnings.push(`triggerMode 未知，回退到 "${DEFAULT_CONFIG.triggerMode}"`)
  }

  const userPatterns = stringArray(raw.testCommandPatterns)
  const validUser = validRegexes(userPatterns)
  if (validUser.length !== userPatterns.length) {
    warnings.push('testCommandPatterns 中有非法正则，已忽略')
  }
  const testCommandPatterns = [...DEFAULT_CONFIG.testCommandPatterns, ...validUser]

  const commandToolNames = stringArray(raw.commandToolNames)
  if (raw.commandToolNames !== undefined && commandToolNames.length === 0) {
    warnings.push('commandToolNames 为空，使用默认命令工具名')
  }

  const config: DebriefConfig = {
    triggerMode,
    turnInterval: clampInt(raw.turnInterval, DEFAULT_CONFIG.turnInterval, 1, 100),
    commandToolNames: commandToolNames.length > 0 ? commandToolNames : DEFAULT_CONFIG.commandToolNames,
    testCommandPatterns,
    maxFailedCommands: clampInt(raw.maxFailedCommands, DEFAULT_CONFIG.maxFailedCommands, 1, 200),
    maxChangedFiles: clampInt(raw.maxChangedFiles, DEFAULT_CONFIG.maxChangedFiles, 1, 200),
    maxUnresolved: clampInt(raw.maxUnresolved, DEFAULT_CONFIG.maxUnresolved, 1, 200),
    detectTodoMarkers: typeof raw.detectTodoMarkers === 'boolean'
      ? raw.detectTodoMarkers
      : DEFAULT_CONFIG.detectTodoMarkers,
  }
  return { config, warnings }
}

export function sameConfig(a: DebriefConfig, b: DebriefConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}