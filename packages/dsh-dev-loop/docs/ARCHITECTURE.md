# dsh-dev-loop 架构

## 分层

- `src/core/`：纯逻辑（config 校验、命令状态机、ANSI/截断/脱敏、模板生成、watch 调度器）
- `src/host/`：配置加载、CommandRunner(spawn)、日志存储、信任存储、Watch 服务、HTTP API、agent 错误发送
- `src/client/`：面板 UI（会话头部 actions 槽）、api 封装、locales、样式

## 数据流

1. client 读取当前 workspace 的 `.dsh/devloop.yml`
2. host 加载配置并检查 trust
3. CommandRunner spawn 命令，流式输出回 client
4. 输出同时写入 `~/.dsh/dev-loop/logs/`
5. 失败时可构造 bounded context 发给当前 agent

## 存储

- 日志：`~/.dsh/dev-loop/logs/<project>/`
- 信任：`~/.dsh/dev-loop/trust.json`

## 构建

tsdown 双 half：host → Node ESM（`lib/index.js`），client → `__ModuleLoader__` 契约 CJS（`lib/client.js`），external 所有 `@deepseek-ai/*` 与 `react`。