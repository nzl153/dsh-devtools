# dsh-run-lab

DSH Agent 实验与 A/B 对比插件：把同一个真实编码任务放进两个隔离工作区分别运行，然后用同一套客观指标对比。

当前版本做 sequential repeat：A x N、B x N 串行跑，不并发；不依赖云服务，全部本地运行。

## Why

「换一个模型 / 配置 / prompt，效果到底好不好」不能靠感觉判断。

dsh-run-lab 解决：

- 同一个任务在隔离工作区标准化运行
- 用同一套指标对比：success、wall time、turns、tokens、diff、evaluator 结果
- repeat 多轮，看成功率和中位数，而不是单次运气

## Features

- 从历史任务 / Prompt 输入出发，创建 Experiment A/B
- 隔离：git 仓库用 `git worktree add --detach <commit>`；非 git 用复制目录（忽略 `node_modules`/`.git`/`dist` 等大目录）
- Agent Runner 走统一 `AgentDriver` wrapper：每个分支可配 `agent`（含 `driver: 'command'` 与命令模板，`$WORKSPACE` / `%WORKSPACE%` 会被替换），也可用旧字段 `agentCommand`
- Evaluator：`command` + `expectExitCode` + `junitFile` + `regexAssertions` + `expectFileExists`
- Repeat：实验支持 `repeat: N`，每分支串行跑 N 遍，结果聚合 success rate、median wall time、median tool calls、median input/output tokens
- 指标：success/fail、wall time、turns、LLM calls、tool calls、input/output tokens、files changed、diff size、tests passed/failed/skipped、errors、retries、compaction count
- UI：Experiment 列表、New Experiment（可设 repeat）、Run A/B、结果左右对照、成功率/中位数展示
- Manifest 存到 `~/.dsh/run-lab/manifests/<id>.json`，只保存非 secret 字段

## Screenshots

![Main UI](screenshots/main.png)

![Useful state](screenshots/state.png)

## Install

前置条件：已安装 DSH CLI（`@deepseek-ai/dsh`），且本机已有目标 profile（示例为 `web`）。

```sh
git clone https://github.com/nzl153/dsh-devtools.git
cd dsh-run-lab
pnpm install
pnpm build
dsh plugin --profile web add link:"$(cygpath -m "$PWD")"
```

装完重启 `dsh web`。之后 client-only 改动走 HMR：

```sh
pnpm dev
```

## Usage

最小流程：

1. 安装并重启 DSH
2. 在侧边栏底部打开「实验比对」面板
3. 填写 prompt、baseline 目录、两个分支的 agent / evaluator 配置，可选 repeat
4. 创建 Experiment，点击 Run A/B
5. 查看成功率和中位数指标对比

命令行同样可用，完整示例见 `examples/`。

## Development

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

工程命令：

```sh
pnpm typecheck       # tsc --noEmit
pnpm test            # vitest 单测 + client bundle smoke
pnpm build           # tsdown 三入口：lib/index.js + lib/cli.js + lib/client.js
pnpm e2e             # 真实 E2E：临时 sample repo + fake agent wrapper + repeat A/B
pnpm verify:hmr      # 校验与运行中 DSH 的 HMR 链路
```

HMR 约定：

- client-only 改动：DSH 运行时 HMR 自动生效
- host 改动（`src/host/**`、`package.json` 结构、`cordis.patch.yml`）：需要重启 DSH

## Compatibility

- 测试过的 DSH：`@deepseek-ai/dsh` `0.1.0-rc.6`
- 测试过的 profile：`web`
- 测试过的平台：Windows（Git Bash / MSYS）

未在其他 DSH 版本上验证，不承诺跨版本兼容。

## Privacy

- 全部本地运行，不上传实验数据
- Manifest 保存在 `~/.dsh/run-lab/manifests/<id>.json`
- 落盘前深度脱敏，键名命中 token/secret/password/api-key 等字段剔除
- 不向 DSH Session durable log 写自定义事件

## Security

风险等级：High（会在隔离工作区执行 Agent 与 evaluator 命令）。

- 实验只在隔离工作区运行（git worktree 或临时复制目录），从不触碰主工作树
- 默认禁止 destructive replay：agent/evaluator 命令都只在隔离目录里执行
- 跑完自动清理隔离工作区（`keepWorkspaces` 开启则保留，调试用）
- host HTTP API 全部走 `trustedRequest`（仅 loopback + 同源），`{ ok, value }` envelope
- Manifest 落盘前深度脱敏，不保存 secret

## Limitations

- 只串行 repeat（A 全部跑完再跑 B），不并发 A/B
- 不直接调用 DSH 内部 Agent API；默认走 command 驱动的外部命令 wrapper。`dsh-inproc` 驱动已预留但未接线
- DSH token 指标没有官方 API feed 时标 unavailable（不伪造）
- JUnit 用轻量字符串解析，支持标准 `<testsuite tests/failures/errors/skipped>`；不覆盖 xUnit/其他 XML 方言
- 默认驱动把 Agent 当作外部命令执行，指标解析能力取决于命令输出格式

## Roadmap

- 并发 A/B 运行
- `dsh-inproc` 驱动接入 DSH 官方 Agent API
- 更完整的 JUnit / 测试报告解析
- 云端看板与共享实验库

以上均未实现。

## License

[MIT](LICENSE)