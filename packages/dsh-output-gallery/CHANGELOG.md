# Changelog

## [0.10.0] - Unreleased

### 破坏性变更：适配 DeepSeek Harness 0.1.2-rc.1
- `@deepseek-ai/dsh-client-runtime` 在 0.1.2 停止发布（末版 0.1.1-rc.2）。client 上下文类型改为
  `import type { Context as ClientContext } from '@deepseek-ai/cordis'`。
- `dsh.client.inject` 移除 `@deepseek-ai/dsh-client-runtime`，避免客户端加载器等待一个不存在的插件。
- 开发依赖 `@deepseek-ai/dsh-*` 由 `0.1.0-rc.6` 升到 `0.1.2-rc.1`，`@deepseek-ai/cordis` 升到 `^4.0.2`。
- 客户端类型增强改为显式 import 提供方：`dsh-client-ui-renderer/client` 提供 `Context.slots`。
- Host 侧 `Session.events` 数组被删除，改为 `Session.snapshotEvents()`（runtime 里读取事件日志处）。
- `ctx.on('session/event')` 回调签名由 `(session)` 变为 `(session, event)`；turn 边界改为直接消费回调里的
  那一条事件，`turn/end` 自带 turn 号，不再回读整段日志。

### 未改动（澄清）
- `@deepseek-ai/dsh-client-ui-primitives` / `dsh-client-ui-slots` 在 0.1.2 仍在发布并由前端 shell
  提供，本包对它们的 import 保持不变。

### 打包
- `files` 去掉 `src/core`：消费者通过 `exports` 的 `./core` 拿到的是构建产物 `lib/core.js`，TypeScript 源码不需要随包发布（少 8 个文件约 43 kB）。
- `files` 增加 `CHANGELOG.md`。

## [0.9.0] - Unreleased

### 新增
- 自动收集 session 产物
- 四类展示：Images / Documents / Builds / Data
- 交付物模式：Mark as deliverable / 只看交付物
- Related command 识别
- 安全预览：图片 / SVG / 文本 / JSON / Markdown / HTML / PDF / ZIP 列表
- 版本历史（metadata）
- include / exclude 配置
- 跨插件集成：Open in Time Machine

### 修复
- SVG 预览改为 sandbox iframe，移除脆弱正则 sanitize
