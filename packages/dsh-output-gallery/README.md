# dsh-output-gallery

Session 产物中心：按 Session 自动整理 Agent 生成 / 修改的产物，并提供安全预览与版本历史。

全部本地，不存文件内容、不执行危险文件。

## Why

Agent 一轮跑完，产出了哪些文件、哪些是最终交付物、改过几版，DSH 只展示当前 turn 的 produced files，缺少跨 turn 汇总。

dsh-output-gallery 解决：

- 按 Session 自动收集产物
- 分类展示 Images / Documents / Builds / Data
- 标记交付物并过滤
- 安全预览，不让模型生成的 HTML/SVG 直接执行

## Features

- 自动收集：turn 结束时增量扫描会话工作区，只收集 session 开始后新建或明确修改、且位于 workspace 内的文件。过滤 `node_modules`、`.git`、缓存与临时构建碎片
- 四类展示：Images / Documents / Builds / Data；每项显示 path / type / size / created / modified / generated & modified turn / related command / preview available
- 交付物模式：每个文件可 Mark as deliverable 固定为最终交付物；顶部「只看交付物」过滤出用户 pin 的条目。pin 状态写入 sidecar
- Related command：从 session 事件中识别与文件相关的最新命令；无法可靠识别时显示 `unknown`
- 安全预览：
  - 图片缩略图、SVG（sandbox iframe 渲染，不执行脚本）、纯文本 / 代码、JSON tree
  - Markdown 以纯文本渲染（绝不使用 `dangerouslySetInnerHTML` 渲染原始 Markdown）
  - HTML 只放进 `<iframe sandbox="">`，不执行脚本
  - PDF 提供 inline 打开 / 下载（仅限已跟踪且非危险的产物）
  - ZIP 只列出内部条目，绝不自动解压或执行
  - 可执行文件（exe/msi/bat/ps1/sh/…）仅显示元数据，不预览不执行
- 版本历史（metadata）：同一文件跨 turn 连续被修改时，记录「Turn 5 / 9 / 14」等版本点。只存 size / mtime / turn，不重复保存文件内容
- 配置：工作区 `.dsh/output-gallery.yml` 可 include / exclude；`~/.dsh/output-gallery/<sessionId>.json` 为 sidecar 元数据存储（预览时实时读磁盘）

## 与官方 deliverables 的关系

DSH rc.6 自带的 `@deepseek-ai/dsh-client-ui-deliverables` 做的是单 turn 尾部的 produced-files 行与正文内联引用，纯 client 侧呈现，没有 host 侧独立的 deliverables service / HTTP API / 数据存储。

本插件是互补功能：

- 不重复造官方那套 turn-tail 行 / 内联引用
- 做官方没有的部分：跨 turn / 跨 session 汇总分类、版本历史、安全预览、sidecar 存储、include/exclude 规则
- 选择自研 sidecar 实现，而不是扩展官方模型

## Screenshots

![Main UI](screenshots/main.png)

![Useful state](screenshots/state.png)

## Install

前置条件：已安装 DSH CLI（`@deepseek-ai/dsh`），且本机已有目标 profile（示例为 `web`）。

```sh
git clone https://github.com/nzl153/dsh-devtools.git
cd dsh-output-gallery
pnpm install
pnpm build
dsh plugin --profile web add link:"$(cygpath -m "$PWD")"
```

装完重启 `dsh web`。之后 client-only 改动走 HMR：

```sh
pnpm dev
```

## Usage

1. 安装并重启 DSH
2. 在侧边栏打开 Output Gallery 面板
3. 选择 session，查看自动收集的产物
4. 对最终交付物点击 Mark as deliverable
5. 需要看内容时使用安全预览

## Development

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

工程命令：

```sh
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest 单测 + client bundle smoke
pnpm build          # tsdown 构建 + verify-build
pnpm e2e            # 临时 workspace 上的 scanner+indexer 端到端校验（不启动 DSH）
pnpm verify:hmr     # 校验 profile link / node_modules / DSH graph rev（需 DSH 在跑）
```

HMR 约定：

- client-only 改动：DSH 运行时 HMR 自动生效
- host 改动（`src/host/**`、`package.json` 结构、`cordis.patch.yml`）：需要重启 DSH

## API

统一 `{ ok: true, value }` / `{ ok: false, error }`，仅接受 loopback + 同源请求。

- `POST /plugins/dsh-output-gallery/api/list`      `{ sessionId }`
- `POST /plugins/dsh-output-gallery/api/refresh`    `{ sessionId, turn? }`
- `POST /plugins/dsh-output-gallery/api/preview`    `{ sessionId, path }`
- `POST /plugins/dsh-output-gallery/api/pin`        `{ sessionId, path, pinned }`
- `POST /plugins/dsh-output-gallery/api/sessions`
- `POST /plugins/dsh-output-gallery/api/config`     `{ sessionId? }`
- `POST /plugins/dsh-output-gallery/api/clear`      `{ sessionId? }`
- `GET  /plugins/dsh-output-gallery/file/<path>`    静态 raw 文件（需 `x-dsh-gallery-session` 头，仅 PDF 等 inline 用）

## Compatibility

- 测试过的 DSH：`@deepseek-ai/dsh` `0.1.0-rc.6`
- 测试过的 profile：`web`
- 测试过的平台：Windows（Git Bash / MSYS）

未在其他 DSH 版本上验证，不承诺跨版本兼容。

## Privacy

- 全部本地，不上传文件内容
- sidecar 只存 metadata：`~/.dsh/output-gallery/<sessionId>.json`
- 预览时实时读磁盘，不把文件内容写进索引
- 不向 DSH Session durable log 写自定义事件

## Security

风险等级：Medium（会读取 workspace 文件并预览）。

- 只有 loopback 同源请求能调用 API；响应带 `nosniff`、`no-store`
- Markdown / HTML 预览不会用 `dangerouslySetInnerHTML` 渲染模型生成的原始内容；Markdown 走纯文本，HTML 强制 `sandbox=""` iframe
- 危险扩展（.exe/.msi/.bat/.ps1/.sh/.dll/…）只返回元数据
- 预览读取有字节上限（文本 256KB）；ZIP 只读中央目录列条目
- 路径解析强制落在 workspace 内（防穿越）
- 不执行可执行文件，不自动解压 ZIP

## Limitations

- 只跟踪 DSH 当前 workspace 目录内的文件
- Related command 无法可靠识别时显示 `unknown`
- 版本历史只存 metadata（size / mtime / turn），不保存内容快照，无法对旧版本预览
- 不是每次文件变化都会立即出现，依赖 turn 边界扫描
- SVG/HTML 预览在 sandbox 内，部分交互脚本不可用

## Roadmap

- 旧版本内容快照与预览
- 跨 session 汇总视图
- 更细粒度的产物关系图谱

以上均未实现。

## License

[MIT](LICENSE)