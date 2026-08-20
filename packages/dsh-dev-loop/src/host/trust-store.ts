// dsh-dev-loop：trust store —— 首次执行 workspace 命令前需要确认。
// 每个项目根目录记一条信任记录，持久化在 ~/.dsh/dev-loop/trust.json。

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const DEFAULT_STORE_PATH = () => join(homedir(), '.dsh', 'dev-loop', 'trust.json')

export interface TrustRecord {
  root: string
  name: string
  confirmedAt: string
}

export class TrustStore {
  private readonly records = new Map<string, TrustRecord>()

  constructor(private readonly filePath: string = DEFAULT_STORE_PATH()) {
    this.load()
  }

  private key(root: string): string {
    return root.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  }

  private load(): void {
    try {
      if (!existsSync(this.filePath)) return
      const data = JSON.parse(readFileSync(this.filePath, 'utf8')) as unknown
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item && typeof item === 'object' && 'root' in item && typeof item.root === 'string') {
            const rec = item as TrustRecord
            this.records.set(this.key(rec.root), rec)
          }
        }
      }
    } catch {
      // trust 文件损坏时当作空，不阻塞插件
    }
  }

  private persist(): void {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true })
      writeFileSync(this.filePath, JSON.stringify([...this.records.values()], null, 2), 'utf8')
    } catch {
      // 持久化失败不致命；下次启动会重新要求确认
    }
  }

  isTrusted(root: string): boolean {
    return this.records.has(this.key(root))
  }

  confirm(root: string, name: string): void {
    const rec: TrustRecord = { root, name, confirmedAt: new Date().toISOString() }
    this.records.set(this.key(root), rec)
    this.persist()
  }

  revoke(root: string): void {
    this.records.delete(this.key(root))
    this.persist()
  }
}

function dirname(p: string): string {
  const idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return idx > 0 ? p.slice(0, idx) : '.'
}