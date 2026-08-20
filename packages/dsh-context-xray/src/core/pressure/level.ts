/**
 * Pure pressure-level classification based on DSH's provider-reported
 * contextPressure projection (pressureTokens / projectedTokens) and the
 * provider context window. Intentional: no self-estimated totals here.
 */
import type { PressureLevel, PressureThresholds } from '../types.ts'

export interface PressureMetrics {
  readonly pressureTokens: number | null
  readonly projectedTokens: number | null
  readonly contextWindow: number | null
}

export const DEFAULT_PRESSURE_THRESHOLDS: PressureThresholds = {
  elevated: 50,
  high: 75,
  critical: 90,
}

export function pressureLevel(
  metrics: PressureMetrics,
  thresholds: PressureThresholds = DEFAULT_PRESSURE_THRESHOLDS,
): PressureLevel | null {
  if (metrics.contextWindow === null || metrics.contextWindow <= 0) return null
  const numerator = metrics.projectedTokens ?? metrics.pressureTokens ?? null
  if (numerator === null || numerator <= 0) return null
  const ratio = (numerator / metrics.contextWindow) * 100
  if (ratio >= thresholds.critical) return 'critical'
  if (ratio >= thresholds.high) return 'high'
  if (ratio >= thresholds.elevated) return 'elevated'
  return 'normal'
}