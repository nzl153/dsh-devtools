# dsh-session-archaeologist

会话考古：跨 Session 全文搜索本机 DSH 历史会话，并把真正相关的片段带回当前上下文。

不是普通「session 列表搜索」：它索引 user/assistant 消息、工具调用摘要、文件名、命令、错误与最终结果，用 SQLite FTS5 / BM25 做本地全文检索。

## Why

DSH 的旧 session 是一次性资产。遇到类似问题想翻历史时，只能凭记忆或逐个打开会话找，效率很低。

dsh-session-archaeologist 解决：

- 用关键词搜遍所有历史 session，按相关度排序
- 按 workspace、日期、user/assistant/errors/commands/files 缩小范围
- 找到后把受限摘要直接带回当前上下文，而不是手动复制粘贴

## Features

- 跨 Session 全文搜索：`query` 返回按相关度排序的结果，带命中字段、时间、workspace、前后上下文、涉及文件、commands
- Search scopes：Current workspace / All workspaces / Current project path / Date range / User messages / Assistant messages / Errors / Commands / Files
- Structured result：每个结果展示命中字段（hitFields）、workspace、时间、session title、命中前后上下文
- Timeline：单个 session 生成 Problem → investigation → files → edits → test → result 结构化摘要（本地缓存，不调用付费模型）
- Bring to Current Context（多选）：勾选若干片段 → 生成 bounded excerpt（预计字符、估算 token、来源 session、日期、workspace）。全局默认预算 `maxChars=8000` / `maxTokens=2000`（API 可配），超预算截断，绝不整段塞入旧 session
  - Add to current context：通过 DSH 官方 `agent.inject` 注入当前 live session
  - 若当前没有可送达的 agent，自动回退为 DSH 官方输入 API 的 Send as follow-up（queue 用户消息），不碰 DOM
  - Copy excerpt 可一键复制
- 索引管理：Reindex / Delete index / Exclude session / Exclude workspace
- Benchmark fixture：500 个合成 session，普通查询延迟 <300ms

## Screenshots

![Main UI](screenshots/main.png)

![Useful state](screenshots/state.png)

## Install

前置条件：已安装 DSH CLI（`@deepseek-ai/dsh`），且本机已有目标 profile（示例为 `web`）。

```sh
git clone https://github.com/nzl153/dsh-devtools.git
cd dsh-session-archaeologist
pnpm install
pnpm build
dsh plugin --profile web add link:"$(cygpath -m "$PWD")"
```

装完重启 `dsh web`。之后 client-only 改动走 HMR：

```sh
pnpm dev
```

验证：

```sh
pnpm verify:hmr
```

## Usage

1. 安装并重启 DSH
2. 第一次使用先 Reindex（构建本地 SQLite FTS5 索引）
3. 在搜索面板输入关键词，按需要设置 scope
4. 勾选相关片段，生成 bounded excerpt
5. 选择 Add to current context，或 Copy excerpt

## Development

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

工程命令：

```sh
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest 单测 + jsdom smoke
pnpm build       # tsdown → lib/index.js + lib/client.js
node scripts/bench.mjs  # 生成 fixture 并跑搜索延迟基准
```

HMR 约定：

- client-only 改动：DSH 运行时 HMR 自动生效
- host 改动（`src/host/**`、`package.json` 结构、`cordis.patch.yml`）：需要重启 DSH

## API

- `POST /plugins/dsh-session-archaeologist/api/search` `{ query, limit?, filters? }`
  - `filters`: `sessions[]`、`workspaces[]`、`projectPath`、`after`、`before`、`source[]`、`excludeSessions[]`、`excludeWorkspaces[]`
- `POST .../excerpt` `{ selections: [{ sessionId, hitIds }], maxChars?, maxTokens?, contextRadius? }` —— 多 session 多选，返回 bounded excerpt（含 charCount/tokenEstimate/sources/truncated）
- `POST .../context` `{ sessionId, text, mode?: 'inject'|'steer' }` —— 通过官方 agent 接口送到当前 session
- `POST .../index`、`.../reindex`、`.../delete-index`
- `POST .../exclude`、`.../timeline`

## Compatibility

- 测试过的 DSH：`@deepseek-ai/dsh` `0.1.0-rc.6`
- 测试过的 profile：`web`
- 测试过的平台：Windows（Git Bash / MSYS）

未在其他 DSH 版本上验证，不承诺跨版本兼容。

## Privacy

- 全部本地，不开外网
- 索引与缓存只存在 `~/.dsh/session-archaeologist/index.db`
- 索引内容来自 `~/.dsh` 下的 session 持久化文件（JSONL/zstd）
- 不向 DSH Session durable log 写自定义事件

## Security

风险等级：Medium。

- 读取：本地 session 文件全文，并建立本地索引
- 写入：`~/.dsh/session-archaeologist/index.db`；可通过官方 agent 接口向当前 session 注入文本或发送 follow-up
- 执行：不执行外部命令
- 注入有预算上限（默认 8000 字符 / 2000 token），不会整段塞入旧 session
- 冷归档 session 无法注入，回退为队列消息
- 不修改 DSH 官方源码

## Limitations

- 索引为增量；首次索引大目录可能耗时
- FTS5 是关键词/BM25 相关度，不是语义搜索
- semantic layer（嵌入式向量检索 / rerank）未实现
- 部分 session 文件格式若无法解析会跳过并记录
- Add to current context 需要目标 session 在当前进程中 live（agent inject 是进程内行为）；冷归档 session 无法注入，会回退到队列消息
- Benchmark 数据为合成 fixture，不代表真实 corpus 性能

## Roadmap

- 可选 semantic 层：本地 embedding（如 `node-llama-cpp` 或 SQLite 向量扩展）与 rerank，默认保留 FTS5/BM25
- 需要引入更大 runtime 依赖，且要权衡索引体积与首次构建成本
- 已预留 `buildMultiExcerpt` 与 `SearchFilters` 扩展点

以上均未实现。

## License

[MIT](LICENSE)