// Benchmark: 30+ synthetic/real prompts → deterministic router token reduction.
// This is a core-level benchmark (no LLM, no tool calls). Real agent wall-time
// / success-rate benchmark belongs in a Run Lab script after the plugin is live.
import { planRoute } from '../lib/core.js'

const tools = [
  { name: 'read', description: 'Read a file from the workspace.' },
  { name: 'write', description: 'Write a file.' },
  { name: 'edit', description: 'Edit a file in place.' },
  { name: 'str_replace_editor', description: 'Apply string replacements to a file.' },
  { name: 'glob', description: 'Find files by glob pattern.' },
  { name: 'grep', description: 'Search file contents with regex.' },
  { name: 'workspace_search', description: 'Search indexed workspace files.' },
  { name: 'bash', description: 'Run a shell command.' },
  { name: 'pwsh', description: 'Run a PowerShell command.' },
  { name: 'job_list', description: 'List background jobs.' },
  { name: 'job_output', description: 'Read background job output.' },
  { name: 'job_kill', description: 'Kill a background job.' },
  { name: 'git_commit', description: 'Create a git commit.' },
  { name: 'git_diff', description: 'Show git diff.' },
  { name: 'git_branch', description: 'Manage git branches.' },
  { name: 'lsp_definition', description: 'Find symbol definition via LSP.' },
  { name: 'lsp_reference', description: 'Find symbol references via LSP.' },
  { name: 'web_search', description: 'Search the web.' },
  { name: 'web_fetch', description: 'Fetch a URL.' },
  { name: 'browser_navigate', description: 'Open a page in a browser.' },
  { name: 'browser_click', description: 'Click an element in a browser.' },
  { name: 'sql_query', description: 'Run a SQL query.' },
  { name: 'sqlite_exec', description: 'Execute SQLite statement.' },
  { name: 'mcp_call', description: 'Call an MCP server tool.' },
  { name: 'image_analyze', description: 'Analyze an image.' },
  { name: 'workflow_run', description: 'Run a workflow pipeline.' },
  { name: 'subagent_spawn', description: 'Spawn a subagent.' },
  { name: 'subagent_send', description: 'Send a message to a subagent.' },
  { name: 'skill', description: 'Load an agent skill.' },
  { name: 'todo_write', description: 'Write a todo list.' },
  { name: 'ask_user_question', description: 'Ask the user a question.' },
]

const prompts = [
  // edit file
  '修改 README 的安装说明',
  '给 src/index.ts 加一个单元测试',
  '把硬编码的颜色替换成 token',
  '重命名变量并更新引用',
  '创建 docs/ARCHITECTURE.md',
  '帮我修一下这个编译错误',
  '删除 temp 目录里没用的文件',
  // debug test
  '运行测试并告诉我哪里失败了',
  '测试挂了一个，帮我 debug',
  '查看 CI 日志定位失败原因',
  '跑一下所有单测',
  '这个命令报错了，看看为什么',
  // web research
  '查一下 DeepSeek Harness 的最新文档',
  '搜索 React 19 的 breaking changes',
  '帮我抓取这个网页的内容',
  '这个 API 的接口文档在哪',
  // git
  '把当前分支合并到 main',
  '看看最近的 git 历史',
  '帮我写 commit message',
  '推送前检查一下 diff',
  // large code navigation
  '找到负责权限校验的实现',
  '哪里定义了 User 类型',
  '哪个文件提到了这个配置项',
  '找到所有调用这个函数的地方',
  '这个 symbol 在项目里怎么用的',
  // docs
  '总结一下这篇文档',
  '给 README 加中文说明',
  '查找文档里关于插件的部分',
  // mixed tasks
  '先找到相关代码，再运行测试确认',
  '查一下数据库结构，然后更新文档',
  '用浏览器打开页面，截图保存到项目里',
  '写个脚本批量处理文件并运行',
  '搜索 web 资料然后写进 README',
]

const options = {
  mode: 'adaptive',
  alwaysVisible: [],
  minimumSafeTools: ['bash', 'read', 'search'],
  fallbackToolName: 'request_tools',
  enabledCategories: [],
}

let totalBeforeTokens = 0
let totalAfterTokens = 0
let totalSavedTokens = 0
let zeroSaved = 0
const rows = []

for (const prompt of prompts) {
  const plan = planRoute(tools, { prompt, recent: '' }, options)
  totalBeforeTokens += plan.beforeTokens
  totalAfterTokens += plan.afterTokens
  totalSavedTokens += plan.savedTokens
  if (plan.savedTokens === 0) zeroSaved += 1
  rows.push({
    prompt,
    categories: plan.selectedCategories.join('|') || '(fail-open)',
    visible: plan.visibleNames.length,
    hidden: plan.hiddenNames.length,
    beforeTokens: plan.beforeTokens,
    afterTokens: plan.afterTokens,
    savedTokens: plan.savedTokens,
  })
}

console.log('Tool Router core benchmark')
console.log(`prompts: ${rows.length}`)
console.log(`total before tokens: ${totalBeforeTokens}`)
console.log(`total after tokens: ${totalAfterTokens}`)
console.log(`total saved tokens: ${totalSavedTokens} (${(totalSavedTokens / totalBeforeTokens * 100).toFixed(1)}%)`)
console.log(`prompts with zero saving (fail-open / no reduction): ${zeroSaved}`)
console.log('')
console.table(rows)

if (rows.length < 30) {
  console.error('benchmark requires at least 30 prompts')
  process.exit(1)
}