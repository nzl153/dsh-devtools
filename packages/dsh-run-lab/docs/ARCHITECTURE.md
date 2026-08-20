# dsh-run-lab 架构

## 分层

- `src/core/`：纯类型 / 状态机 / 指标计算 / repeat 聚合 / evaluator 解析 / manifest serde
- `src/agent/`：AgentDriver wrapper（command 驱动 + 占位符替换 + spec 解析）
- `src/workspace/`：隔离（git worktree / 复制）
- `src/runner/`：进程运行 + diff 统计
- `src/dsh/`：DSH agent 命令适配
- `src/host/`：cordis 插件入口 + HTTP API + 引擎编排
- `src/cli/`：独立 CLI 入口
- `src/client/`：Web UI 面板（`sidebar.footer.action` 挂点）

## 运行流

1. 创建 Experiment，保存 manifest
2. 为每个分支创建隔离 workspace
3. 运行 AgentDriver 命令
4. 运行 Evaluator
5. 采集指标并聚合 repeat 结果
6. 返回 UI / CLI

## 存储

- 位置：`~/.dsh/run-lab/manifests/<id>.json`
- 内容：baseline / prompt / config / agent / evaluator / metrics / version
- secret 字段落盘前剔除

## 安全边界

- 只在隔离目录执行命令
- 不触碰主工作树
- 不运行破坏性命令
- HTTP API 仅 loopback + 同源