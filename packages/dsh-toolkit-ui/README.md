# dsh-toolkit-ui

DSH Developer Toolkit 的 UI Shell 与共享展示层。

它把 7 个开发者工具插件统一收进一个 Toolkit 导航：最多 3 个高频 quick action + 分类 Popover，并提供一个统一的 Panel 视觉壳。

## Why

多个插件各自往 DSH 顶部/侧边塞按钮，不可扩展，也不像原生工具。

dsh-toolkit-ui 解决：

- 统一导航：OBSERVE / WORKSPACE / EXPERIMENT
- 每个插件只注册轻量 entry，卸载后入口自动消失
- 共享 Panel 壳，让所有工具看起来是同一套 Developer Tools

## Features

- 声明式 Toolkit entry 注册（全局轻量 registry，不直接 import 插件源码）
- 最多 3 个 quick action：Context X-Ray / Time Machine / Debrief
- Toolkit Popover：分组展示所有插件，含 subtitle / metric / StateDot
- 统一 ToolkitPanel：Header / Summary / Content / Footer
- 共享 Metric / StatusRow / FileRow / SectionLabel / ToolkitEntryRow / ToolkitQuickAction
- 只使用 `--dsw-*` token，支持 light / dark
- prefers-reduced-motion 支持

## Install

前置条件：已安装 DSH CLI（`@deepseek-ai/dsh`），且本机已有目标 profile（示例为 `web`）。

```sh
git clone https://github.com/nzl153/dsh-devtools.git
cd dsh-toolkit-ui
pnpm install
pnpm build
dsh plugin --profile web add link:"$(cygpath -m "$PWD")"
```

装完重启 `dsh web`。之后 client-only 改动走 HMR：

```sh
pnpm dev
```

## Usage

1. 安装 dsh-toolkit-ui 与任意插件
2. 打开一个 session，顶部出现 Context / Debrief / Time Machine 与 Toolkit 按钮
3. 点击 Toolkit 打开分组菜单
4. 点击任意 entry 打开对应插件面板

插件单独安装时（无 shell），插件会显示自己的 fallback 入口。

## Development

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
pnpm verify:hmr --profile=web
```

HMR 约定：

- client-only 改动：DSH 运行时 HMR 自动生效
- host 改动：需要重启 DSH

## Compatibility

- 测试过的 DSH：`@deepseek-ai/dsh` `0.1.0-rc.6`
- 测试过的 profile：`web`
- 测试过的平台：Windows（Git Bash / MSYS）

## Privacy

- 不读取任何 session 内容
- 不保存任何业务数据
- 所有 entry 元数据只存在于浏览器内存

## Security

- 不直接 import 其他插件源码
- entry 通过全局 registry 注册，卸载时自动清理
- 不执行任何命令
- 不修改 DSH 官方源码

## Limitations

- entry 的 metric / state 需要插件在 render 函数里自行获取，shell 不主动轮询
- 当前 shell 的 popover 是自定义轻量浮层，未使用官方 Menu 的 row 结构（因为需要富文本行）
- 只在 rc.6 验证

## Roadmap

- 官方 Menu / HoverCard 的更深接入
- 跨插件状态聚合（如 conflict + build failed 合并计数）
- 键盘导航（arrow keys）

以上均未实现。

## License

[MIT](LICENSE)