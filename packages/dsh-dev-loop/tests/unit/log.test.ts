import { describe, it, expect } from 'vitest'
import {
  stripAnsi,
  truncateOutput,
  redactSecrets,
  isSecretKey,
  redactText,
  extractLastFailSection,
} from '../../src/core/log.ts'

describe('stripAnsi', () => {
  it('去除 ANSI 转义', () => {
    expect(stripAnsi('\u001b[32mgreen\u001b[0m')).toBe('green')
    expect(stripAnsi('\x1b[31mred\x1b[0m plain')).toBe('red plain')
  })
})

describe('truncateOutput', () => {
  it('短文本不截断', () => {
    const r = truncateOutput('hello', { maxLength: 100 })
    expect(r.truncated).toBe(false)
    expect(r.text).toBe('hello')
  })
  it('长文本按头尾截断', () => {
    const long = 'a'.repeat(100) + 'END'
    const r = truncateOutput(long, { maxLength: 50 })
    expect(r.truncated).toBe(true)
    expect(r.text).toContain('… [output truncated] …')
    expect(r.text.length).toBeLessThanOrEqual(50)
    expect(r.text).toContain('END')
  })
})

describe('secrets redaction', () => {
  it('redactSecrets 屏蔽环境变量', () => {
    const out = redactSecrets({ API_KEY: 'abc123', HOME: '/x' })
    expect(out.API_KEY).toBe('***')
    expect(out.HOME).toBe('/x')
  })
  it('isSecretKey 判断', () => {
    expect(isSecretKey('TOKEN')).toBe(true)
    expect(isSecretKey('PATH')).toBe(false)
  })
  it('redactText 替换文本中的 secret 值', () => {
    expect(redactText('use abc123 now', ['abc123'])).toBe('use *** now')
  })
})

describe('extractLastFailSection', () => {
  it('提取含 error 的上下文', () => {
    const text = ['ok', 'ok', 'ERROR: boom', 'after'].join('\n')
    const section = extractLastFailSection(text)
    expect(section).toBeTruthy()
    expect(section).toContain('ERROR: boom')
    expect(section).toContain('after')
  })
  it('无错误返回 null', () => {
    expect(extractLastFailSection('all fine')).toBeNull()
  })
})
