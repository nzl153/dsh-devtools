/**
 * dsh-run-lab host half：cordis 插件入口。
 * 挂 webServer API + 实验服务（manifest 存储 + 引擎编排）。
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { createRunLabService, type RunLabService } from './service.ts'
import { registerRunLabApi } from './api.ts'
import { ensureRunLabDirs, runLabRoot } from '../core/manifest.ts'

export const name = 'dsh-run-lab'

export const inject = ['webServer'] as const

export interface Config {
  /** DSH_HOME 覆盖（缺省 ~/.dsh）。 */
  home?: string
  /** 命令超时 ms。 */
  timeoutMs: number
  /** 跑完是否保留隔离工作区（调试）。 */
  keepWorkspaces: boolean
}

export const Config = z.object({
  home: z.string().default(''),
  timeoutMs: z.number().min(1000).default(10 * 60 * 1000),
  keepWorkspaces: z.boolean().default(false),
})

export function apply(ctx: Context, config?: Config): void {
  const resolved = Config(config ?? {})
  const home = (resolved.home && resolved.home.length > 0) ? resolved.home : homeDefault()
  void ensureRunLabDirs(home).catch((error) => {
    ctx.logger.warn(`[dsh-run-lab] cannot init run-lab dirs: ${error instanceof Error ? error.message : String(error)}`)
  })

  const service: RunLabService = createRunLabService({
    home,
    timeoutMs: resolved.timeoutMs,
    keepWorkspaces: resolved.keepWorkspaces,
  })
  registerRunLabApi(ctx, service)

  ctx.effect(() => {
    ctx.logger.info(`[dsh-run-lab] ready. run-lab root: ${runLabRoot(home)}`)
    return () => {}
  }, 'dsh-run-lab: ready log')
}

function homeDefault(): string {
  return process.env.DSH_HOME
    ?? (process.platform === 'win32' ? (process.env.USERPROFILE ?? process.env.HOME ?? '.') : (process.env.HOME ?? '.'))
}
