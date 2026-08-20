/**
 * Host plugin configuration schema.
 *
 * Thresholds are percentages (0-100) of the provider-reported pressure vs the
 * context window. Defaults match the Phase 2 spec: elevated 50%, high 75%,
 * critical 90%.
 */
import z from '@deepseek-ai/schemastery'

export const Config = z.object({
  pressureThresholds: z.object({
    elevated: z.number().min(0).max(100).default(50),
    high: z.number().min(0).max(100).default(75),
    critical: z.number().min(0).max(100).default(90),
  }),
})

export interface Config {
  pressureThresholds?: {
    elevated?: number
    high?: number
    critical?: number
  }
}