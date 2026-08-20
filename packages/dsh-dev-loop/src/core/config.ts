// dsh-dev-loop：纯配置校验 —— 从已解析的 YAML 对象构建 DevLoopConfig。
// 不含文件 IO / 运行时依赖，便于单测。

import type { AfterAgentConfig, DevLoopAction, DevLoopConfig, WatchConfig } from './types.ts'

export interface ParseResult {
  config: DevLoopConfig
  warnings: string[]
}

/** 识别应被脱敏的环境变量名（KEY/TOKEN/SECRET/PASSWORD/…) */
const SECRET_KEY_RE = /(KEY|TOKEN|SECRET|PASSWORD|PASS|AUTH|CREDENTIAL|API_?KEY)/i

/** 一个 action 的原始 YAML 形态。 */
interface RawAction {
  command?: unknown
  file?: unknown
  cwd?: unknown
  env?: unknown
  timeout?: unknown
  shell?: unknown
  dependsOn?: unknown
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function toStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function toPosInt(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.floor(v)
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number(v.trim())
  return undefined
}

/**
 * 从原始 YAML 对象解析出配置。会做基础结构校验，不符合的字段跳过并给 warning，
 * 结构性错误（actions 缺失、action 既无 command 也无 file）抛异常。
 */
export function parseDevLoopConfig(raw: unknown, root: string, fallbackName = 'project'): ParseResult {
  const warnings: string[] = []
  if (!isRecord(raw)) {
    throw new Error('devloop.yml 顶层必须是对象')
  }
  const name = toStr(raw['name'])?.trim() || fallbackName
  const actionsRaw = raw['actions']
  if (!isRecord(actionsRaw) || Object.keys(actionsRaw).length === 0) {
    throw new Error('devloop.yml 需要非空的 actions 对象')
  }

  const actions: Record<string, DevLoopAction> = {}
  for (const [actionName, value] of Object.entries(actionsRaw)) {
    if (!isRecord(value)) {
      warnings.push(`action "${actionName}" 不是对象，已跳过`)
      continue
    }
    const ra = value as RawAction
    const command = toStr(ra.command)
    const file = toStr(ra.file)
    if (!command && !file) {
      throw new Error(`action "${actionName}" 必须提供 command 或 file 之一`)
    }
    const env: Record<string, string> = {}
    if (ra.env !== undefined) {
      if (isRecord(ra.env)) {
        for (const [k, v] of Object.entries(ra.env)) {
          if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            env[k] = String(v)
          } else {
            warnings.push(`action "${actionName}" 的 env.${k} 不是标量，已忽略`)
          }
        }
      } else {
        warnings.push(`action "${actionName}" 的 env 必须是对象`)
      }
    }
    actions[actionName] = {
      name: actionName,
      command,
      file,
      cwd: toStr(ra.cwd),
      env,
      timeout: toPosInt(ra.timeout),
      shell: toStr(ra.shell),
      dependsOn: Array.isArray(ra.dependsOn)
        ? ra.dependsOn.filter((x): x is string => typeof x === 'string')
        : undefined,
    }
  }

  const config: DevLoopConfig = { name, actions, root }

  const watchRaw = raw['watch']
  if (watchRaw !== undefined) {
    if (!isRecord(watchRaw)) {
      warnings.push('watch 必须是对象，已忽略')
    } else {
      const action = toStr(watchRaw.action)
      if (!action) {
        throw new Error('watch.action 必须提供')
      }
      const rawPaths = Array.isArray(watchRaw.paths)
        ? watchRaw.paths.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : []
      const paths = rawPaths.map((p) => p.trim())
      if (paths.length === 0) {
        warnings.push('watch.paths 为空，默认监听 src')
        paths.push('src')
      }
      config.watch = {
        enabled: typeof watchRaw.enabled === 'boolean' ? watchRaw.enabled : true,
        paths,
        debounce: toPosInt(watchRaw.debounce) ?? 500,
        action,
        ...(Array.isArray(watchRaw.ignore)
          ? { ignore: watchRaw.ignore.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()) }
          : {}),
      }
      if (!config.actions[config.watch.action]) {
        warnings.push(`watch.action "${config.watch.action}" 在 actions 中不存在`)
      }
    }
  }

  const afterAgentRaw = raw['afterAgent']
  if (afterAgentRaw !== undefined) {
    if (!isRecord(afterAgentRaw)) {
      warnings.push('afterAgent 必须是对象，已忽略')
    } else {
      const action = toStr(afterAgentRaw.action)
      if (!action) {
        throw new Error('afterAgent.action 必须提供')
      }
      const afterAgent: AfterAgentConfig = {
        enabled: typeof afterAgentRaw.enabled === 'boolean' ? afterAgentRaw.enabled : true,
        action,
      }
      if (!config.actions[afterAgent.action]) {
        warnings.push(`afterAgent.action "${afterAgent.action}" 在 actions 中不存在`)
      }
      config.afterAgent = afterAgent
    }
  }

  return { config, warnings }
}

/** 解析 watch 配置；供独立校验/演示使用。 */
export function parseWatchConfig(raw: unknown): WatchConfig {
  if (!isRecord(raw)) throw new Error('watch 必须是对象')
  const action = toStr(raw.action)
  if (!action) throw new Error('watch.action 必须提供')
  const rawPaths = Array.isArray(raw.paths)
    ? raw.paths.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : []
  const paths = rawPaths.map((p) => p.trim())
  if (paths.length === 0) paths.push('src')
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    paths,
    debounce: toPosInt(raw.debounce) ?? 500,
    action,
    ...(Array.isArray(raw.ignore)
      ? { ignore: raw.ignore.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()) }
      : {}),
  }
}

/** 解析 afterAgent 配置；供独立校验/演示使用。 */
export function parseAfterAgentConfig(raw: unknown): AfterAgentConfig {
  if (!isRecord(raw)) throw new Error('afterAgent 必须是对象')
  const action = toStr(raw.action)
  if (!action) throw new Error('afterAgent.action 必须提供')
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    action,
  }
}

/** 判断环境变量名是否应脱敏。 */
export function isSecretEnvKey(key: string): boolean {
  return SECRET_KEY_RE.test(key)
}

/** 预设模板：渲染一份 .dsh/devloop.yml 字符串。 */
export function renderTemplate(framework: 'node' | 'python' | 'rust' | 'dotnet' | 'godot', name: string, root: string): string {
  const lines: string[] = []
  const push = (s: string): void => { lines.push(s) }

  push(`# ${name} — dsh-dev-loop 配置`)
  push('# 命令完全来自当前 workspace 的这份文件；首次执行前会要求确认信任。')
  push('name: ' + JSON.stringify(name))
  push('actions:')
  const add = (action: string, body: Record<string, string | string[]>): void => {
    push(`  ${action}:`)
    for (const [k, v] of Object.entries(body)) {
      if (Array.isArray(v)) {
        if (v.length === 0) continue // 空依赖数组不输出，保持模板干净
        push(`    ${k}:`)
        for (const item of v) push(`      - ${JSON.stringify(item)}`)
      } else {
        push(`    ${k}: ${JSON.stringify(v)}`)
      }
    }
  }

  switch (framework) {
    case 'node': {
      add('install', { command: 'npm install', dependsOn: [] })
      add('build', { command: 'npm run build', dependsOn: ['install'] })
      add('test', { command: 'npm test', dependsOn: ['install'] })
      add('run', { command: 'node .' })
      break
    }
    case 'python': {
      add('install', { command: 'pip install -r requirements.txt', dependsOn: [] })
      add('test', { command: 'python -m pytest', dependsOn: ['install'] })
      add('run', { command: 'python main.py' })
      break
    }
    case 'rust': {
      add('build', { command: 'cargo build', dependsOn: [] })
      add('test', { command: 'cargo test', dependsOn: ['build'] })
      add('run', { command: 'cargo run' })
      break
    }
    case 'dotnet': {
      add('build', { command: 'dotnet build', dependsOn: [] })
      add('test', { command: 'dotnet test', dependsOn: ['build'] })
      add('run', { command: 'dotnet run' })
      break
    }
    case 'godot': {
      add('build', { command: 'godot --headless --export-release "default"', dependsOn: [] })
      add('test', { command: 'godot --headless --script res://tests/run_tests.gd', dependsOn: ['build'] })
      add('run', { command: 'godot --path .' })
      break
    }
  }
  void root
  return lines.join('\n') + '\n'
}
