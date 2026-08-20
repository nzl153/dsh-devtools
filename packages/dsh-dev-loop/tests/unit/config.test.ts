import { describe, it, expect } from 'vitest'
import { parseDevLoopConfig, isSecretEnvKey, renderTemplate } from '../../src/core/config.ts'

describe('config parse', () => {
  it('解析合法配置', () => {
    const res = parseDevLoopConfig(
      {
        name: 'Kakarot Mod',
        actions: {
          build: { command: 'dotnet build' },
          test: { command: 'dotnet test', dependsOn: ['build'] },
          logs: { file: 'logs/app.log' },
        },
      },
      'E:/proj',
    )
    expect(res.config.name).toBe('Kakarot Mod')
    expect(res.config.root).toBe('E:/proj')
    expect(res.config.actions.build.command).toBe('dotnet build')
    expect(res.config.actions.logs.file).toBe('logs/app.log')
    expect(res.config.actions.test.dependsOn).toEqual(['build'])
  })

  it('action 缺 command 且缺 file 时抛错', () => {
    expect(() =>
      parseDevLoopConfig({ name: 'x', actions: { a: { cwd: '.' } } }, 'R:/x'),
    ).toThrow(/必须提供 command 或 file/)
  })

  it('actions 缺失时抛错', () => {
    expect(() => parseDevLoopConfig({ name: 'x' }, 'R:/x')).toThrow(/actions/)
  })

  it('env 只接受标量，其余给 warning', () => {
    const res = parseDevLoopConfig(
      {
        name: 'x',
        actions: { a: { command: 'echo hi', env: { OK: '1', BAD: ['a'] } } },
      },
      'R:/x',
    )
    expect(res.config.actions.a.env).toEqual({ OK: '1' })
    expect(res.warnings.length).toBeGreaterThan(0)
  })

  it('timeout 支持字符串数字', () => {
    const res = parseDevLoopConfig(
      { name: 'x', actions: { a: { command: 'x', timeout: '5000' } } },
      'R:/x',
    )
    expect(res.config.actions.a.timeout).toBe(5000)
  })
})

describe('secret env detection', () => {
  it('识别 KEY/TOKEN/SECRET/PASSWORD', () => {
    for (const k of ['API_KEY', 'GITHUB_TOKEN', 'AWS_SECRET', 'PASSWORD', 'DB_PASS']) {
      expect(isSecretEnvKey(k)).toBe(true)
    }
    for (const k of ['HOME', 'PATH', 'NODE_ENV']) {
      expect(isSecretEnvKey(k)).toBe(false)
    }
  })
})

describe('yaml template generation', () => {
  it.each(['node', 'python', 'rust', 'dotnet', 'godot'] as const)('生成 %s 模板', (fw) => {
    const yml = renderTemplate(fw, 'My Project', 'R:/x')
    expect(yml).toContain('name: "My Project"')
    expect(yml).toContain('actions:')
    // 模板可被 parseDevLoopConfig 再解析
    const obj = yamlParseCompat(yml)
    const res = parseDevLoopConfig(obj, 'R:/x', 'My Project')
    expect(Object.keys(res.config.actions).length).toBeGreaterThan(0)
  })

  it.each(['node', 'dotnet', 'python', 'rust', 'godot'] as const)('%s 模板包含对应动作', (fw) => {
    const yml = renderTemplate(fw, 'X', 'R:/x')
    const obj = yamlParseCompat(yml)
    const actions = parseDevLoopConfig(obj, 'R:/x').config.actions
    expect(actions.build ?? actions.install ?? actions.run).toBeTruthy()
  })
})

describe('watch config parse', () => {
  it('解析 watch 块并带默认值', () => {
    const res = parseDevLoopConfig(
      {
        name: 'x',
        actions: { build: { command: 'npm run build' } },
        watch: { paths: ['src'], debounce: 250, action: 'build' },
      },
      'R:/x',
    )
    expect(res.config.watch).toMatchObject({
      enabled: true,
      paths: ['src'],
      debounce: 250,
      action: 'build',
    })
  })

  it('paths 缺省时默认 src', () => {
    const res = parseDevLoopConfig(
      { name: 'x', actions: { build: { command: 'x' } }, watch: { action: 'build' } },
      'R:/x',
    )
    expect(res.config.watch?.paths).toEqual(['src'])
    expect(res.warnings.some((w) => w.includes('watch.paths'))).toBe(true)
  })

  it('watch 缺 action 抛错', () => {
    expect(() =>
      parseDevLoopConfig(
        { name: 'x', actions: { build: { command: 'x' } }, watch: { paths: ['src'] } },
        'R:/x',
      ),
    ).toThrow(/watch.action/)
  })

  it('watch.enabled false 表示关闭', () => {
    const res = parseDevLoopConfig(
      { name: 'x', actions: { build: { command: 'x' } }, watch: { action: 'build', enabled: false } },
      'R:/x',
    )
    expect(res.config.watch?.enabled).toBe(false)
  })
})

describe('afterAgent config parse', () => {
  it('解析 afterAgent', () => {
    const res = parseDevLoopConfig(
      {
        name: 'x',
        actions: { test: { command: 'npm test' } },
        afterAgent: { action: 'test' },
      },
      'R:/x',
    )
    expect(res.config.afterAgent).toEqual({ enabled: true, action: 'test' })
  })

  it('afterAgent.enabled false 表示关闭', () => {
    const res = parseDevLoopConfig(
      {
        name: 'x',
        actions: { test: { command: 'npm test' } },
        afterAgent: { action: 'test', enabled: false },
      },
      'R:/x',
    )
    expect(res.config.afterAgent?.enabled).toBe(false)
  })

  it('afterAgent 缺 action 抛错', () => {
    expect(() =>
      parseDevLoopConfig(
        { name: 'x', actions: { test: { command: 'npm test' } }, afterAgent: {} },
        'R:/x',
      ),
    ).toThrow(/afterAgent.action/)
  })

  it('afterAgent 引用不存在的 action 给 warning', () => {
    const res = parseDevLoopConfig(
      { name: 'x', actions: { test: { command: 'npm test' } }, afterAgent: { action: 'missing' } },
      'R:/x',
    )
    expect(res.config.afterAgent?.action).toBe('missing')
    expect(res.warnings.some((w) => w.includes('afterAgent.action'))).toBe(true)
  })
})

function yamlParseCompat(yml: string): Record<string, unknown> {
  // 轻量兼容：模板是我们生成的，直接按行构造对象（避免引入 yaml 解析依赖到测试）
  const actions: Record<string, Record<string, string>> = {}
  let current: string | null = null
  const lines = yml.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = line.match(/^  (\w+):/)
    if (m && current === null) {
      current = m[1]
      actions[current] = {}
      // 下一行可能是 field
      continue
    }
    if (current) {
      const fm = line.match(/^    (\w+): (.*)$/)
      if (fm) {
        const key = fm[1]
        const val = fm[2].replace(/^"(.*)"$/, '$1')
        actions[current][key] = val
      }
      // 忽略 dependsOn 数组（- 行）
    }
  }
  return { name: 'My Project', actions }
}
