# dsh-toolkit-ui 架构

## 职责

- 只做 UI shell 与共享展示层
- 不包含任何业务逻辑

## 模块

- `src/shared/`：类型、全局 registry、hooks、ToolkitPanel 与展示组件、CSS
- `src/client/`：DSH client 插件入口，注册 header action，渲染 Toolbar 与 Popover
- `src/host/`：no-op host half，满足 DSH bundle 结构

## 集成方式

- 插件通过 `registerToolkitEntry` 注册 entry，函数返回 disposer
- shell 通过 `useToolkitEntries` / `useToolkitOpenId` 响应式读取
- 全局对象 `__DSH_TOOLKIT__` 保存 entries / shellReady / openId
- 插件在 `ctx.effect` 中注册，插件卸载时自动清理

## 为什么不直接 import 插件

DSH client module loader 不允许跨插件运行时 import。用全局 registry + 事件是 optional integration 的轻量实现。