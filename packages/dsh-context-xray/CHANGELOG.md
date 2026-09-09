# Changelog

## [1.0.0-rc.2] - Unreleased

### 破坏性变更：适配 DeepSeek Harness 0.1.2-rc.1
- `@deepseek-ai/dsh-client-runtime` 在 0.1.2 停止发布（末版 0.1.1-rc.2）。client 上下文类型改为
  `import type { Context as ClientContext } from '@deepseek-ai/cordis'`——旧包的 `ClientContext`
  定义本来就是 `export type ClientContext = Context`，属纯类型来源替换。
- `package.json` 的 `dsh.client.inject` 移除 `@deepseek-ai/dsh-client-runtime`。该字段是客户端插件的
  模块依赖清单：0.1.2 里这个包不存在，插件会一直等它、永远不激活（表现为面板打不开）。
- 开发依赖 `@deepseek-ai/dsh-*` 由 `0.1.0-rc.6` 升到 `0.1.2-rc.1`，`@deepseek-ai/cordis` 升到 `^4.0.2`。
- 客户端类型增强（`declare module` 合并）在 0.1.2 里不再由 client-runtime 提供，改为显式 import 提供方：
  `@deepseek-ai/dsh-client-ui-renderer/client` 提供 `Context.slots`。
- Host 侧 `Session.events` 数组被删除，改为方法 `Session.snapshotEvents()`（analyzer 里 3 处读取点）。
- `ctx.on('session/event')` 回调签名由 `(session)` 变为 `(session, event)`；turn 边界改为直接看回调带上来的
  那一条事件，不再每次回读整段日志（去重逻辑保留）。

### 未改动（澄清）
- `@deepseek-ai/dsh-client-ui-primitives` 与 `@deepseek-ai/dsh-client-ui-slots` 在 0.1.2 **没有**被删除：
  两者仍有 `0.1.2-rc.1` 发布，Web 端由前端 shell 以静态模块提供，本包对它们的 import 一律保持原样。

### 打包
- `files` 增加 `CHANGELOG.md`：此前它不在清单里，不会进 tarball。

## [1.0.0-rc.1] - Unreleased

### 新增
- Context Breakdown 面板
- Provider 压力与上下文窗口徽标（normal/elevated/high/critical）
- Prompt Sections 列表与折叠预览
- Tool Schema 明细（token、来源、调用次数、搜索、排序、复制操作）
- Turn 历史列表与增量说明
- 诊断 JSON 导出 / 复制
- 清空本地统计
- Turn history、Diff Inspector、Tool Schema Inspector、Pressure Warning、Export Diagnostic（1.0 候选功能）

### 修复
- ToolTable 未使用过滤按钮文案
- dshVersionOf 改用安全 `ctx.get`，修复启动 fail-soft
