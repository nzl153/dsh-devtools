// dsh-dev-loop：日志工具 —— ANSI 安全渲染、有界截断、secrets 脱敏。纯函数，可单测。

/** ANSI 转义序列：OSC / CSI / 普通转义。 */
const ANSI_RE =
  // eslint-disable-next-line no-control-regex
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g

/** 去除 ANSI 转义序列，保留可读文本。 */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '')
}

export interface TruncateOptions {
  /** 输出上限字符数。 */
  maxLength: number
  /** 命中上限时保留头部/尾部比例（默认各半）。 */
  headRatio?: number
}

/**
 * 有界截断：超过 maxLength 时保留 head + tail，中间用省略标记替换。
 * 返回截断后的文本以及是否被截断。
 */
export function truncateOutput(text: string, opts: TruncateOptions): { text: string; truncated: boolean } {
  const max = Math.max(1, Math.floor(opts.maxLength))
  if (text.length <= max) return { text, truncated: false }
  const marker = '\n… [output truncated] …\n'
  if (marker.length >= max) {
    return { text: marker.slice(0, max), truncated: true }
  }
  const headRatio = opts.headRatio ?? 0.5
  const avail = max - marker.length
  const head = Math.floor(avail * Math.min(Math.max(headRatio, 0), 1))
  const tail = avail - head
  return { text: text.slice(0, head) + marker + text.slice(text.length - tail), truncated: true }
}

/**
 * 从环境变量里识别敏感键并替换值为 ***。返回脱敏后的副本。
 * 用于日志输出：把可能打印到输出的 secret 值屏蔽掉。
 */
export function redactSecrets(env: Record<string, string> | undefined, redactValue = '***'): Record<string, string> {
  if (!env) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(env)) {
    out[k] = isSecretKey(k) ? redactValue : v
  }
  return out
}

/** 判断键名是否敏感（KEY/TOKEN/SECRET/PASSWORD 等）。 */
export function isSecretKey(key: string): boolean {
  return /(KEY|TOKEN|SECRET|PASSWORD|PASS|AUTH|CREDENTIAL|API_?KEY)/i.test(key)
}

/**
 * 文本级脱敏：把给定环境里每个 secret 值在文本中的出现替换为 ***。
 * 用于命令输出里的 secrets redaction（基础能力）。
 */
export function redactText(text: string, secrets: string[]): string {
  let out = text
  for (const secret of secrets) {
    if (!secret) continue
    const needle = secret
    if (needle.length >= 3) {
      out = out.split(needle).join('***')
    }
  }
  return out
}

/**
 * 从日志里提取“最后失败”的 bounded context：
 * 取最后若干行含 error/fail/exception/fatal 的行，以及其前后各 context 行。
 */
export function extractLastFailSection(text: string, maxLines = 40): string | null {
  const lines = text.split(/\r?\n/)
  const hits: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (/\b(error|fail|exception|fatal|panic|traceback|failed|✗|×)\b/i.test(lines[i])) {
      hits.push(i)
    }
  }
  if (hits.length === 0) return null
  const last = hits[hits.length - 1]
  const before = 8
  const after = 6
  const start = Math.max(0, last - before)
  const end = Math.min(lines.length, last + after + 1)
  let section = lines.slice(start, end).join('\n')
  if (section.length > 4000) section = truncateOutput(section, { maxLength: 4000 }).text
  return section
}
