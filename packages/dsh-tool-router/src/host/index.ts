/**
 * dsh-tool-router host half.
 *
 * It listens to official DSH extension points only:
 * - `agent/inbox/claimed` captures the current user prompt before assembly;
 * - `system-prompt/assemble` filters model-visible tool schemas per step;
 * - `tools/result` observes actual tool usage for local stats;
 * - `session/event` finalizes per-step stats.
 *
 * No monkey patching. The router only shrinks `assembly.tools`.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-session'
import { planRoute } from '../core/router.ts'
import type { StatsRecord, ToolCategory } from '../core/types.ts'
import { Config as ConfigSchema, normalizeConfig, type Config as ConfigInput } from './config.ts'
import { requestToolsDefinition } from './fallback.ts'
import { buildRouteInput, messageToRouteText } from './messages.ts'
import { RouterStateStore } from './state.ts'
import { createStatsStore } from './store.ts'

export const name = 'dsh-tool-router'

export { ConfigSchema as Config }
export { normalizeConfig }
export type { Config as ConfigInput } from './config.ts'

export function apply(ctx: Context, config: ConfigInput = {}): void {
  const cfg = normalizeConfig(config)
  const states = new RouterStateStore()
  const statsPromise = createStatsStore()

  ctx.effect(() => {
    const disposers: Array<() => void> = []

    // Capture the latest claimed user prompt before `system-prompt/assemble`.
    disposers.push(ctx.on('agent/inbox/claimed', ({ agent, message }) => {
      const state = states.get(agent.id)
      state.lastPrompt = messageToRouteText(message)
    }))

    // Core per-step routing.
    disposers.push(ctx.on('system-prompt/assemble', (assembly, context, next) => {
      if (context.agent === undefined) return next()

      const agent = context.agent
      const state = states.get(agent.id)
      const input = buildRouteInput(agent, state.lastPrompt)
      const enabledCategories = [...state.enabledCategories]

      const plan = planRoute(assembly.tools, input, {
        mode: cfg.mode,
        alwaysVisible: cfg.alwaysVisible,
        minimumSafeTools: cfg.minimumSafeTools,
        fallbackToolName: cfg.fallbackToolName,
        enabledCategories,
      })

      state.lastPlan = plan
      state.usedInStep = new Set()

      if (cfg.mode === 'adaptive') {
        const visible = new Set(plan.visibleNames)
        assembly.tools = assembly.tools.filter((tool) => visible.has(tool.name))
      } else if (cfg.mode === 'suggest' && cfg.suggestPromptSection && plan.selectedCategories.length > 0) {
        // Suggest mode does not filter; it only adds a lightweight prompt hint.
        assembly.sections.push({
          name: 'tool-router:suggestion',
          text: `Tool Router suggestion (not enforced): likely useful categories: ${plan.selectedCategories.join(', ')}.`,
        })
      }

      // Consume fallback TTL after this assembly's decision.
      if (state.fallbackStepsLeft > 0) {
        state.fallbackStepsLeft -= 1
        if (state.fallbackStepsLeft <= 0) state.enabledCategories.clear()
      }

      const record: StatsRecord = {
        sessionId: agent.id,
        timestamp: Date.now(),
        mode: cfg.mode,
        promptCategory: plan.selectedCategories[0],
        promptPreview: cfg.storePromptPreview ? state.lastPrompt.slice(0, 120) : undefined,
        selectedCategories: plan.selectedCategories,
        requestedCategories: enabledCategories,
        enabledCategories: plan.effectiveCategories,
        actualToolsUsed: [],
        unusedVisible: [],
        beforeBytes: plan.beforeBytes,
        afterBytes: plan.afterBytes,
        savedBytes: plan.savedBytes,
        beforeTokens: plan.beforeTokens,
        afterTokens: plan.afterTokens,
        savedTokens: plan.savedTokens,
      }
      state.pendingRecord = record

      return next()
    }))

    // Observe actual tool usage.
    disposers.push(ctx.on('tools/result', (exec, _result) => {
      if (exec.agent === undefined) return
      const state = states.get(exec.agent.id)
      state.usedInStep.add(exec.name)
    }))

    // Finalize a stats record once its step ends.
    disposers.push(ctx.on('session/event', (session, event) => {
      if (event.type !== 'step/end') return
      const state = states.get(session.id)
      const record = state.pendingRecord
      if (record === undefined) return

      const used = [...state.usedInStep]
      const visible = state.lastPlan?.visibleNames ?? []
      record.actualToolsUsed = used
      record.unusedVisible = visible.filter((name) => !used.includes(name))
      void statsPromise.then((stats) => stats.record(record))
      state.pendingRecord = undefined
    }))

    // Remove dead agent state.
    disposers.push(ctx.on('agent/disposed', ({ agent }) => {
      states.delete(agent.id)
    }))

    // Fallback tool: only present when filtering is actually active.
    if (cfg.mode === 'adaptive') {
      const disposeTool = ctx.tools.register(requestToolsDefinition({
        fallbackToolName: cfg.fallbackToolName,
        getState: (agentId) => states.get(agentId),
        onRequest: (agentId, categories) => {
          const state = states.get(agentId)
          for (const category of categories) state.enabledCategories.add(category)
          state.fallbackStepsLeft = cfg.fallbackTtlSteps
          if (state.pendingRecord !== undefined) {
            const all = new Set<ToolCategory>([...state.pendingRecord.requestedCategories, ...categories])
            state.pendingRecord.requestedCategories = [...all]
            state.pendingRecord.enabledCategories = [...new Set<ToolCategory>([...state.pendingRecord.enabledCategories, ...categories])]
          }
        },
      }))
      disposers.push(disposeTool)
    }

    return () => {
      for (const dispose of disposers) dispose()
      states.clear()
      void statsPromise.then((stats) => stats.flush()).catch((error) => {
        ctx.logger.warn(`[dsh-tool-router] stats flush failed: ${error instanceof Error ? error.message : String(error)}`)
      })
    }
  }, 'dsh-tool-router')
}