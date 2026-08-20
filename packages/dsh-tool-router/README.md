# dsh-tool-router

DSH Tool Router — 每个 Agent step 动态缩小模型可见的工具 schema，同时保留安全 fallback。

它不是权限系统，不删除工具，也不让任何工具“永久不可用”。它只做一件事：

> 这一轮只向模型展示大概率相关的工具集合；如果猜错，模型可以用 `request_tools` 把需要的类别加回来。

## 现状

- 默认 `observe`：不改任何工具，只记录“如果路由会保留什么”。
- 本地统计写入 `~/.dsh/dsh-tool-router/stats.json`。
- 无外部依赖、无 LLM 二次调用、无网络。

## 官方 seam

DSH 本身提供了 per-step tool assembly 的官方扩展点：

- `system-prompt/assemble` waterfall：每个 step 的 `assembly.tools` 可以在这里被过滤。
- `agent/inbox/claimed`：在组装前捕获当前用户 prompt。
- `agent/pre-step` / `agent/request`：后续 dsh-model-router 会用到的官方模型路由 seam。

实现没有 monkey patch，也不改 DSH 源码。

一个已知缺口：`ToolSchema` 没有 tool 的注册来源（source）字段，因此分类使用 `name / description / parameters` + 内置已知工具名映射来推断。

## 安装

```bash
dsh plugin add link:"E:\\dsh-plugins\\dsh-tool-router"
```

或从私有仓库安装（需已推送）：

```bash
dsh plugin add link:"$(cygpath -m "$PWD")"
```

## 配置

插件配置使用 schemastery schema，字段：

```yaml
mode: observe            # off | observe | suggest | adaptive
alwaysVisible: []        # 用户额外配置的始终可见工具名
minimumSafeTools:        # 最小安全集，缺省如下
  - bash
  - read
  - search
fallbackToolName: request_tools
fallbackTtlSteps: 3
storePromptPreview: true
suggestPromptSection: true
```

### Modes

| mode | 行为 |
| --- | --- |
| off | 完全不路由 |
| observe | 不改变任何工具，只记录统计 |
| suggest | 不过滤，但向 system prompt 加一行轻量建议 |
| adaptive | 真正过滤工具可见集，并启用 `request_tools` fallback |

### Fallback

`adaptive` 模式下模型看到 `request_tools` 工具，可以请求：

```json
{ "enable": ["web", "database"] }
```

下一步会在 `system-prompt/assemble` 里把对应类别加回。TTL 默认 3 步，防呆。

## 分类

内置 13 类：

`filesystem / search / shell / git / lsp / web / browser / database / mcp / image / workflow / subagent / misc`

## 安全边界

- 只缩小 `assembly.tools`。
- 不碰 permissions / sandbox / guards / approval。
- `run_code`（Code Mode 保留 transport）永远不会被隐藏。
- 无路由信号时 fail-open，保留全部工具，避免猜错直接无解。

## 统计

`~/.dsh/dsh-tool-router/stats.json` 记录：

- prompt category
- selected / requested / enabled categories
- actual tools used
- unused visible tools
- before / after / saved schema bytes（token 为估算）

## 开发

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm test
pnpm benchmark
```

Core benchmark 使用 33 条 synthetic + real prompts，结果见 `pnpm benchmark` 输出。