// dsh-dev-loop locale 命名空间。
export const NS = 'dsh-dev-loop'

export type DevLoopKey =
  | 'open'
  | 'title'
  | 'noConfig'
  | 'noWorkspace'
  | 'trustWarning'
  | 'confirmTrust'
  | 'trusted'
  | 'notTrusted'
  | 'build'
  | 'test'
  | 'package'
  | 'run'
  | 'restart'
  | 'stop'
  | 'openLogs'
  | 'sendError'
  | 'lastFail'
  | 'noLastFail'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'idle'
  | 'duration'
  | 'exit'
  | 'output'
  | 'emptyOutput'
  | 'copied'
  | 'loading'
  | 'error'
  | 'cancel'
  | 'status'
  | 'action'
  | 'reset'
  | 'watch'
  | 'watchStart'
  | 'watchStop'
  | 'watchPending'
  | 'afterAgent'
  | 'afterAgentOn'
  | 'afterAgentOff'
  | 'generatePreset'
  | 'presetName'
  | 'openDebrief'

export const zh: Record<DevLoopKey, string> = {
  open: 'DevLoop',
  title: '开发循环',
  noConfig: '当前 workspace 没有 .dsh/devloop.yml',
  noWorkspace: '无法识别当前 workspace，请在面板中填写项目根路径',
  trustWarning: '命令完全来自当前 workspace 的 .dsh/devloop.yml。首次执行前请确认信任该项目的命令。',
  confirmTrust: '信任并执行',
  trusted: '已信任',
  notTrusted: '未信任',
  build: 'Build',
  test: 'Test',
  package: 'Package',
  run: 'Run',
  restart: 'Run/Restart',
  stop: 'Stop',
  openLogs: 'Open logs',
  sendError: 'Send last error to Agent',
  lastFail: '最近失败',
  noLastFail: '暂无失败记录',
  running: '运行中',
  succeeded: '通过',
  failed: '失败',
  cancelled: '已取消',
  idle: '未运行',
  duration: '耗时',
  exit: '退出码',
  output: '输出',
  emptyOutput: '（无输出）',
  copied: '已复制到剪贴板',
  loading: '加载中…',
  error: '错误',
  cancel: '取消',
  status: '状态',
  action: '动作',
  reset: '撤销信任',
  watch: 'Watch',
  watchStart: 'Start watch',
  watchStop: 'Stop watch',
  watchPending: 'pending',
  afterAgent: 'After Agent',
  afterAgentOn: 'on',
  afterAgentOff: 'off',
  generatePreset: 'Generate preset',
  presetName: '项目名（可选）',
  openDebrief: '打开战报',
}

export const en: Record<DevLoopKey, string> = {
  open: 'DevLoop',
  title: 'Dev Loop',
  noConfig: 'No .dsh/devloop.yml in the current workspace',
  noWorkspace: 'Could not detect the current workspace; enter a project root below',
  trustWarning: 'Commands come entirely from this workspace\u2019s .dsh/devloop.yml. Confirm you trust this project before the first run.',
  confirmTrust: 'Trust & run',
  trusted: 'Trusted',
  notTrusted: 'Not trusted',
  build: 'Build',
  test: 'Test',
  package: 'Package',
  run: 'Run',
  restart: 'Run/Restart',
  stop: 'Stop',
  openLogs: 'Open logs',
  sendError: 'Send last error to Agent',
  lastFail: 'Last fail',
  noLastFail: 'No failures yet',
  running: 'running',
  succeeded: 'PASS',
  failed: 'FAIL',
  cancelled: 'cancelled',
  idle: 'idle',
  duration: 'dur',
  exit: 'exit',
  output: 'Output',
  emptyOutput: '(no output)',
  copied: 'copied to clipboard',
  loading: 'Loading…',
  error: 'Error',
  cancel: 'Cancel',
  status: 'Status',
  action: 'Action',
  reset: 'Revoke trust',
  watch: 'Watch',
  watchStart: 'Start watch',
  watchStop: 'Stop watch',
  watchPending: 'pending',
  afterAgent: 'After Agent',
  afterAgentOn: 'on',
  afterAgentOff: 'off',
  generatePreset: 'Generate preset',
  presetName: 'Project name (optional)',
  openDebrief: 'Open Debrief',
}
