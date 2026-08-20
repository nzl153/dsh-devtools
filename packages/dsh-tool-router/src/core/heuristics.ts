/**
 * Deterministic prompt/category heuristic router.
 *
 * First version intentionally avoids an LLM call. It reads the latest claimed
 * user prompt plus a small amount of recent derived message text and selects
 * likely tool categories.
 */
import type { CategoryReason, RouteInput, ToolCategory } from './types.ts'

interface Rule {
  category: ToolCategory
  keywords: string[]
}

/** Keyword order matters little; all categories with a match are returned. */
const RULES: Rule[] = [
  {
    category: 'filesystem',
    keywords: [
      'readme', 'file', '文件', '修改', '编写', '创建', '删除', '移动', '复制',
      '路径', 'edit', 'write', 'read', 'rewrite', 'patch', 'diff', '替换', '硬编码',
    ],
  },
  {
    category: 'search',
    keywords: [
      '找', '搜索', '查一下', 'search', 'find', 'grep', 'definition', 'reference',
      '引用', '哪个文件', '谁定义', 'where is', 'locate', 'symbol', 'readme', '文件', 'file',
      '接口', '文档', '总结',
    ],
  },
  {
    category: 'shell',
    keywords: [
      '运行', '执行', '测试', '单测', 'test', 'bash', 'shell', '命令', 'terminal',
      'build', 'install', '启动', 'run', 'execute', 'job', 'compile', '编译', '错误',
      '日志', 'ci', '失败',
    ],
  },
  {
    category: 'git',
    keywords: ['git', 'commit', 'branch', 'push', 'pull', 'merge', 'rebase', 'checkout', '仓库', '分支', '合并', 'main'],
  },
  {
    category: 'lsp',
    keywords: ['definition', 'reference', '实现', 'define', 'symbol', 'hover', '跳转', 'rename', '类型', 'type'],
  },
  {
    category: 'web',
    keywords: ['网页', '网站', 'web', 'website', 'http', 'url', '查网页', 'fetch', 'curl', 'docs', '文档', '文档页', 'api'],
  },
  {
    category: 'browser',
    keywords: ['browser', 'playwright', '页面', '网页', '点击', 'screenshot', '打开网页', 'navigate'],
  },
  {
    category: 'database',
    keywords: ['database', 'db', 'sql', 'query', 'sqlite', 'postgres', 'mysql', '数据库', '表', '查询'],
  },
  {
    category: 'mcp',
    keywords: ['mcp', 'model context protocol'],
  },
  {
    category: 'image',
    keywords: ['image', '图片', '截图', '照片', 'png', 'icon', 'visual'],
  },
  {
    category: 'workflow',
    keywords: ['workflow', 'pipeline', '计划', '规划', 'goal', 'todo', '任务', '调度', '流程', 'plan'],
  },
  {
    category: 'subagent',
    keywords: ['subagent', '子代理', 'delegate', '并行', '并发', 'agent', 'child'],
  },
]

function hasKeyword(text: string, keyword: string): boolean {
  if (keyword.length === 0) return false
  // ASCII keywords are matched case-insensitively; CJK is self-delimiting.
  if (/^[\x00-\x7F]+$/.test(keyword)) {
    return text.toLowerCase().includes(keyword.toLowerCase())
  }
  return text.includes(keyword)
}

export function routeCategories(input: RouteInput): { categories: ToolCategory[]; reasons: CategoryReason[] } {
  const text = `${input.prompt}\n${input.recent}`
  const categories: ToolCategory[] = []
  const reasons: CategoryReason[] = []

  for (const rule of RULES) {
    const matched = rule.keywords.filter((keyword) => hasKeyword(text, keyword))
    if (matched.length > 0) {
      categories.push(rule.category)
      reasons.push({ category: rule.category, matchedKeywords: matched.slice(0, 8) })
    }
  }

  return { categories, reasons }
}