// dsh-dev-loop：host 配置加载 —— 读取 workspace 的 .dsh/devloop.yml。

import { readFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { parse } from 'yaml'
import { parseDevLoopConfig, renderTemplate } from '../core/config.ts'
import type { DevLoopConfig } from '../core/types.ts'

export const CONFIG_FILE = '.dsh/devloop.yml'
export const CONFIG_FILE_YAML = '.dsh/devloop.yaml'

/** 在项目根下查找配置文件（优先 .yml，其次 .yaml）。 */
export async function findConfigFile(root: string): Promise<string | null> {
  for (const rel of [CONFIG_FILE, CONFIG_FILE_YAML]) {
    const full = join(root, rel)
    try {
      const st = await import('node:fs/promises').then((m) => m.stat(full))
      if (st.isFile()) return full
    } catch {
      // 不存在则继续
    }
  }
  return null
}

/** 加载并解析配置。找不到文件返回 null，解析失败抛异常。 */
export async function loadConfig(root: string): Promise<DevLoopConfig | null> {
  const file = await findConfigFile(root)
  if (!file) return null
  const text = await readFile(file, 'utf8')
  const raw: unknown = parse(text)
  const fallback = basename(root) || 'project'
  return parseDevLoopConfig(raw, root, fallback).config
}

/** 生成预设模板文本（不写盘，由 API/CLI 调用方决定写入）。 */
export function generateTemplate(framework: 'node' | 'python' | 'rust' | 'dotnet' | 'godot', name: string, root: string): string {
  return renderTemplate(framework, name, root)
}
