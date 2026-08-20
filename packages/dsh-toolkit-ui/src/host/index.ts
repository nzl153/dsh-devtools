import type { Context } from '@deepseek-ai/cordis'

export const inject: string[] = []

export function apply(ctx: Context): void {
  ctx.effect(() => () => undefined, 'dsh-toolkit-ui: host no-op')
}