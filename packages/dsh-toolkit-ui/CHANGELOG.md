# Changelog

## [0.2.0] - Unreleased

### 破坏性变更：适配 DeepSeek Harness 0.1.2-rc.1
- `@deepseek-ai/dsh-client-runtime` 在 0.1.2 中已停止发布（最后一个版本是 0.1.1-rc.2，之后整包下线）。
  本包只用到它的 `ClientContext` 类型，而该类型在旧包里的定义就是 `export type ClientContext = Context`，
  因此改为直接 `import type { Context as ClientContext } from '@deepseek-ai/cordis'`。
  这是类型来源的替换，运行时行为不变。
- `package.json` 的 `dsh.client.inject` 里移除 `@deepseek-ai/dsh-client-runtime`。该字段是客户端模块的
  加载依赖清单，不是服务注入清单（后者是 `src/client/index.tsx` 里的 `inject = ['slots', 'locale']`，
  未改动）。移除后为空数组，与服务注入顺序无关。

### 变更
- 开发依赖中的 `@deepseek-ai/dsh-*` 全部由 `0.1.0-rc.6` 升到 `0.1.2-rc.1`；
  `@deepseek-ai/cordis` 由 `^4.0.1` 升到 `^4.0.2`（0.1.2 的 peer 要求）。

### 未改动（澄清）
- `@deepseek-ai/dsh-client-ui-primitives` 与 `@deepseek-ai/dsh-client-ui-slots` 在 0.1.2 中**没有**被删除：
  两者仍有 `0.1.2-rc.1` 版本发布，且 Web 端由前端 shell 以静态模块（staticModules）提供，
  0.1.2 自身的插件也照旧 `require('@deepseek-ai/dsh-client-ui-primitives')`。
  因此本包对这两个包的 import 一律保持原样，没有改写。

### 打包
- `files` 增加 `CHANGELOG.md`：此前它不在清单里，不会进 tarball。

## [0.1.0] - Unreleased

### 新增
- Toolkit Shell：header quick actions + 分类 Popover
- Toolkit entry 全局 registry（可选集成，卸载自动清理）
- 共享 ToolkitPanel / Metric / StatusRow / FileRow / SectionLabel / EntryRow / QuickAction
- `--dsw-*` token 主题适配与 prefers-reduced-motion 支持