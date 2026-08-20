# Changelog

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