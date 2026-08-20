// dsh-dev-loop host half.
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { DevLoopService } from './devloop-service.ts'
import { registerApi } from './api.ts'
import { DEFAULT_LOG_DIR } from './command-runner.ts'

export const name = 'dsh-dev-loop'

export const inject = ['webServer'] as const

export function apply(ctx: Context): void {
  const logDir = DEFAULT_LOG_DIR()
  const service = new DevLoopService(ctx, logDir)
  const dispose = registerApi(ctx, service)

  ctx.effect(() => {
    return () => {
      dispose()
      service.dispose()
    }
  }, 'dsh-dev-loop: web routes + services')
}

// 程序化 API（测试 / 脚本复用）：不挂 cordis 也能直接驱动命令执行。
export { CommandRunner, DEFAULT_LOG_DIR } from './command-runner.ts'
export { DevLoopService } from './devloop-service.ts'
export { TrustStore } from './trust-store.ts'
export { WatchService } from './watch-service.ts'
export { loadConfig, findConfigFile, generateTemplate } from './config-loader.ts'
export { sendErrorToAgent } from './agent-error.ts'
export type { RunOptions } from './command-runner.ts'
export type { SendErrorResult } from './agent-error.ts'
export type { WatchServiceDeps, WatchRunResult } from './watch-service.ts'
