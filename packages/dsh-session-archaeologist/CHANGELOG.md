# Changelog

## [1.0.0-rc.2] - Unreleased

### 破坏性变更：适配 DeepSeek Harness 0.1.2-rc.1
- `@deepseek-ai/dsh-client-runtime` 在 0.1.2 停止发布（末版 0.1.1-rc.2）。client 上下文类型改为
  `import type { Context as ClientContext } from '@deepseek-ai/cordis'`。
- `dsh.client.inject` 移除 `@deepseek-ai/dsh-client-runtime`，避免客户端加载器等待一个不存在的插件。
- 开发依赖 `@deepseek-ai/dsh-*` 由 `0.1.0-rc.6` 升到 `0.1.2-rc.1`，`@deepseek-ai/cordis` 升到 `^4.0.2`。
- 客户端类型增强改为显式 import 提供方：
  - `@deepseek-ai/dsh-client-ui-renderer/client` → `Context.slots`
  - `@deepseek-ai/dsh-api-session-controller/client` → `Context.sessions`（`ISessions`）。
    本包 client 侧用 `ctx.sessions.list.getSnapshot()` 与 `ctx.sessions.binding(id)`，
    0.1.2 里这两个成员仍在 `ISessions` 上，只是类型声明必须显式引入客户端包，
    否则会命中 host 侧 `dsh-session` 的 `Context.sessions`（`SessionStore`）声明。

### 未改动（澄清）
- `@deepseek-ai/dsh-client-ui-primitives` / `dsh-client-ui-slots` 在 0.1.2 仍在发布并由前端 shell
  提供，本包对它们的 import 保持不变。

### 打包
- `files` 增加 `CHANGELOG.md`：此前它不在清单里，不会进 tarball。

## [1.0.0-rc.1] - Unreleased

### 新增
- 跨 Session 全文搜索（SQLite FTS5 / BM25）
- Search scopes：workspace / project path / date / source 过滤
- Structured results：命中字段、上下文、workspace、session title
- Timeline：单 session 结构化摘要
- Bring to Current Context：bounded excerpt + 官方 agent.inject / follow-up 回退
- 索引管理：Reindex / Delete index / Exclude session / Exclude workspace
- 合成 benchmark fixture
- 跨插件集成：Open Time Machine 入口

### 变更
- 提升为 1.0 候选版本
