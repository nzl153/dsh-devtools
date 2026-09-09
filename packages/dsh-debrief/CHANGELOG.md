# Changelog

## [0.10.0] - Unreleased

### 破坏性变更：适配 DeepSeek Harness 0.1.2-rc.1
- `@deepseek-ai/dsh-client-runtime` 在 0.1.2 停止发布（末版 0.1.1-rc.2）。client 上下文类型改为
  `import type { Context as ClientContext } from '@deepseek-ai/cordis'`（旧包的 `ClientContext`
  就是 `export type ClientContext = Context`）。
- `dsh.client.inject` 移除 `@deepseek-ai/dsh-client-runtime`，避免客户端加载器等待一个不存在的插件。
- 开发依赖 `@deepseek-ai/dsh-*` 由 `0.1.0-rc.6` 升到 `0.1.2-rc.1`，`@deepseek-ai/cordis` 升到 `^4.0.2`。
- **`conversation.chat.turnTail` 槽位换了归属**：0.1.2 起由 `@deepseek-ai/dsh-client-ui-chat/client`
  声明（不再在 `dsh-client-ui-conversation/client`），`TurnTailOwnerProps` 也从 ui-chat 导出。
  槽位键名与语义（completed-Turn extension chain）不变，只是 import 来源换了。
- 客户端类型增强改为显式 import 提供方：`dsh-client-ui-renderer/client` 提供 `Context.slots`。
- Host 侧 `settingsNamespace()` 助手被移除，命名空间改用普通字符串常量
  （官方插件同样写法，如 dsh-agent-presets 的 `const SETTINGS_NAMESPACE = "agent-presets"`）。

### 未改动（澄清）
- `@deepseek-ai/dsh-client-ui-primitives` / `dsh-client-ui-slots` 在 0.1.2 仍在发布并由前端 shell
  提供，本包对它们的 import 保持不变。

## [0.9.0] - Unreleased

### 新增
- Turn Debrief：Duration / Steps / Tool calls / Commands / Tests / Failed / Files / Tokens / Slowest tool call
- Session Debrief：全 session 汇总
- Unresolved 识别：exit code / error / TODO/FIXME
- 测试识别：内置 pattern + 用户配置
- Token / context 统计
- 操作：View files / View failed commands / Copy summary / Continue unresolved
- 触发设置：off / session-only / every-n-turns / on-completion
- 跨插件集成：打开 Time Machine / X-Ray 入口
