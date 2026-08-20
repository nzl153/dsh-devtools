export const NS = 'dsh-toolkit-ui'

export const zh = {
  toolkit: 'Toolkit',
  close: '关闭',
  observe: '观察',
  workspace: '工作区',
  experiment: '实验',
} as const

export const en = {
  toolkit: 'Toolkit',
  close: 'Close',
  observe: 'Observe',
  workspace: 'Workspace',
  experiment: 'Experiment',
} as const

export type ToolkitUiKey = keyof typeof zh
