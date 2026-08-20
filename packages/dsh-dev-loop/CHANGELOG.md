# Changelog

## [0.9.0] - Unreleased

### 新增
- Build / Test / Package / Run-Restart / Stop / Open logs 动作
- 流式输出、退出码、耗时、取消
- ANSI 剥离、输出长度上限
- 本地完整日志保存
- secrets redaction
- Send last error to Agent
- Trust boundary 与 trust.json
- 预设模板：Node / Python / Rust / .NET / Godot
- Watch Mode（默认关闭）
- After Agent Turn（默认关闭）
- Generate preset
- 跨插件集成：Open Debrief 入口

### 修复
- smoke reactShim 补 Component/PureComponent
- 修复 useWorkspaces 调用方式并加面板 ErrorBoundary