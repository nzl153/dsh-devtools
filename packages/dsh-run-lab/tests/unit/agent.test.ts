import { describe, it, expect } from 'vitest'
import {
  parseAgentConfig,
  specFromCommand,
  substituteWorkspace,
  resolveAgentDriver,
  CommandAgentDriver,
} from '../../src/agent/driver.ts'

describe('agent wrapper', () => {
  it('parseAgentConfig normalizes agent spec', () => {
    const spec = parseAgentConfig({ driver: 'command', command: 'dsh --profile headless "$WORKSPACE"' })
    expect(spec?.driver).toBe('command')
    expect(spec?.command).toContain('$WORKSPACE')
    expect(spec?.usesWorkspace).toBe(true)
  })

  it('parseAgentConfig ignores missing command / non-object', () => {
    expect(parseAgentConfig(null)).toBeUndefined()
    expect(parseAgentConfig('x')).toBeUndefined()
    expect(parseAgentConfig({ command: '' })).toBeUndefined()
  })

  it('specFromCommand derives spec from legacy agentCommand', () => {
    const spec = specFromCommand('node agent.mjs %WORKSPACE%')
    expect(spec?.driver).toBe('command')
    expect(spec?.usesWorkspace).toBe(true)
    expect(specFromCommand(undefined)).toBeUndefined()
  })

  it('substituteWorkspace replaces both placeholder styles', () => {
    expect(substituteWorkspace('cd $WORKSPACE && echo %WORKSPACE%', 'C:/ws')).toBe('cd C:/ws && echo C:/ws')
  })

  it('resolveAgentDriver defaults unknown drivers to command', async () => {
    const driver = resolveAgentDriver('dsh-inproc')
    expect(driver).toBeInstanceOf(CommandAgentDriver)
    // dsh-inproc 未接线时回退 command，确保不会 crash。
    expect(driver.kind).toBe('command')
    const out = await driver.run({ cwd: process.cwd(), command: 'node --version' })
    expect(out.success).toBe(true)
  })
})