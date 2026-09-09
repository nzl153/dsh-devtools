# Changelog

## [1.0.0-rc.2] - Unreleased

### 重命名
- npm 包名改为 `@dsh-external/dsh-time-machine`：`dsh-time-machine` 在 npm 上已被他人占用
  （zjukop 于 2026-08-15 发布的同名包），原名发不出去。
- 插件 id、目录名、`cordis.patch.yml`、HTTP 路由 `/plugins/dsh-time-machine/api`、
  client bundle id、locale 命名空间全部保持 `dsh-time-machine`，运行时行为不变。
- 新增 `publishConfig.access = "public"`：scoped 包首次发布默认 restricted，不显式声明会发成私有包。

### 破坏性变更：适配 DeepSeek Harness 0.1.2-rc.1
- `@deepseek-ai/dsh-client-runtime` 在 0.1.2 停止发布（末版 0.1.1-rc.2）。client 上下文类型改为
  `import type { Context as ClientContext } from '@deepseek-ai/cordis'`。
- `dsh.client.inject` 移除 `@deepseek-ai/dsh-client-runtime`，避免客户端加载器等待一个不存在的插件。
- 开发依赖 `@deepseek-ai/dsh-*` 由 `0.1.0-rc.6` 升到 `0.1.2-rc.1`，`@deepseek-ai/cordis` 升到 `^4.0.2`。
- 客户端类型增强改为显式 import 提供方：`dsh-client-ui-renderer/client` 提供 `Context.slots`。
- `ctx.on('session/event')` 回调签名由 `(session)` 变为 `(session, event)`；`adapter.onSessionEvent`
  相应改为 `(session, event)`，只处理当前事件而不是每次回扫整段日志（语义等价，且不会重复回放历史）。

### 未改动（澄清）
- `@deepseek-ai/dsh-client-ui-primitives` / `dsh-client-ui-slots` 在 0.1.2 仍在发布并由前端 shell
  提供，本包对它们的 import 保持不变。

### 打包
- `files` 增加 `CHANGELOG.md`：此前它不在清单里，不会进 tarball。

## [1.0.0-rc.1] - Unreleased

### 新增
- Session Baseline：首次文件修改时自动建立基线
- Turn 修改记录：hooks 前后增量扫描，记录新增/修改/删除/重命名与 diff
- Watcher 辅助层：fs.watch 快速发现 + debounce + periodic reconciliation scan
- Rename detection
- 安全恢复：preview + 确认 + 冲突检测
- Conflict UI：三方内容、Copy old version、Restore to new file、Force overwrite
- Timeline filters：按 file / turn / Agent / conflict / baseline
- 跨插件集成：来自其他插件的时间线入口
