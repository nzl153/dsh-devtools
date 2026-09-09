# Changelog

## [0.10.0] - Unreleased

### 破坏性变更：适配 DeepSeek Harness 0.1.2-rc.1
- `@deepseek-ai/dsh-client-runtime` 在 0.1.2 停止发布（末版 0.1.1-rc.2）。client 上下文类型改为
  `import type { Context as ClientContext } from '@deepseek-ai/cordis'`（旧包的 `ClientContext`
  就是 `export type ClientContext = Context`）。
- `dsh.client.inject` 移除 `@deepseek-ai/dsh-client-runtime`，避免客户端加载器等待一个不存在的插件
  （否则插件不激活、面板打不开）。
- 开发依赖 `@deepseek-ai/dsh-*` 由 `0.1.0-rc.6` 升到 `0.1.2-rc.1`，`@deepseek-ai/cordis` 升到 `^4.0.2`。
- 客户端类型增强改为显式 import 提供方：`@deepseek-ai/dsh-client-ui-renderer/client` 提供 `Context.slots`。

### 未改动（澄清）
- `@deepseek-ai/dsh-client-ui-primitives` / `dsh-client-ui-slots` 在 0.1.2 仍在发布并由前端 shell
  提供，本包对它们的 import 保持不变。

### 修复
- `adoptStyles()` 创建了 `<style id="dsh-dev-loop-styles">` 并写入了 CSS，却从未插入文档，面板样式一直没生效。补上 `document.head.append(style)`。
  （真机验证时发现的既有问题，与 0.1.2 迁移无关。）

### 打包
- `files` 增加 `CHANGELOG.md`。

## [0.9.0] - Unreleased

### 新增
- Build / Test / Package / Run-Restart / Stop / Open logs 动作
- 流式输出、退出码、耗时、取消
- ANSI 剥离、输出长度上限
- 本地完整日志保存
- secrets redaction
- Send last error to Agent
- Trust boundary 与 trust.json
- 预设模板：Node / Python / Rust / .NET / Godot
- Watch Mode（默认关闭）
- After Agent Turn（默认关闭）
- Generate preset
- 跨插件集成：Open Debrief 入口

### 修复
- smoke reactShim 补 Component/PureComponent
- 修复 useWorkspaces 调用方式并加面板 ErrorBoundary
