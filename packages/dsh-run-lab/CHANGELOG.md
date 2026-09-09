# Changelog

## [0.9.0] - Unreleased

### 破坏性变更：适配 DeepSeek Harness 0.1.2-rc.1
- `@deepseek-ai/dsh-client-runtime` 在 0.1.2 停止发布（末版 0.1.1-rc.2）。client 上下文类型改为
  `import type { Context as ClientContext } from '@deepseek-ai/cordis'`。
- `dsh.client.inject` 移除 `@deepseek-ai/dsh-client-runtime`，避免客户端加载器等待一个不存在的插件。
- 开发依赖 `@deepseek-ai/dsh-*` 由 `0.1.0-rc.6` 升到 `0.1.2-rc.1`，`@deepseek-ai/cordis` 升到 `^4.0.2`。
- 客户端类型增强改为显式 import 提供方：`@deepseek-ai/dsh-client-ui-renderer/client` 提供 `Context.slots`。

### 未改动（澄清）
- `@deepseek-ai/dsh-client-ui-primitives` / `dsh-client-ui-slots` 在 0.1.2 仍在发布并由前端 shell
  提供，本包对它们的 import 保持不变。

## [0.8.0] - Unreleased

### 新增
- Experiment A/B 创建与运行
- 隔离工作区：git worktree / 目录复制
- AgentDriver wrapper：command 驱动 + 占位符替换
- Evaluator：command / exit code / JUnit / regex / file exists
- Repeat：串行 N 遍，聚合 success rate 与 median 指标
- Manifest 落盘与 secret 字段剔除
- Web UI：Experiment 列表、New Experiment、Run A/B、结果对照
- 独立 CLI 入口

### 变更
- 明确当前版本为 0.8.0（MVP）
