# dsh-context-xray 架构

## 分层

- `src/host/`：DSH adapter、HTTP API、sidecar store、pressure 阈值配置
- `src/client/`：React 面板，挂载于 `conversation.session.header.actions`
- `src/core/`：纯 analyzer / token-metrics / turn-diff / pressure / diagnostic，可脱离 DSH 单测

## 数据流

1. client 通过 HTTP API 请求 `snapshot`
2. host 从 DSH runtime 读取 system prompt、session events、tool schemas、provider pressure
3. core 纯函数计算 breakdown、turn diff、pressure level、diagnostic
4. host 把结果返回 client，并把历史指标写入 sidecar

## 存储

- 位置：`~/.dsh/context-xray/<sessionId>.json`
- 内容：token 计数、占比、工具名
- 不保存：完整 prompt 正文、对话内容

## 配置

压力阈值配置示例：

```yaml
dsh-context-xray:
  pressureThresholds:
    elevated: 50
    high: 75
    critical: 90
```