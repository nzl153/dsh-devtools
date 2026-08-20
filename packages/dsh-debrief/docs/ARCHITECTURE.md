# dsh-debrief 架构

## 分层

- `src/core/`：纯 debrief 计算（事件归一化、配置解析、token 统计、摘要），不依赖 DSH
- `src/host/`：DSH adapter（`session/event` 监听、每 session 事件日志）、HTTP API、设置注册
- `src/client/`：React 卡片/面板、locale、样式、slot 注册

## UI 挂点

- `conversation.chat.turnTail`：turn 尾部战报卡片
- `conversation.session.header.actions`：会话头部 Session 面板入口
- Continue unresolved 使用官方 `inputActions.setDraft()` 插入 composer

## 数据流

1. host 监听 session event
2. core 将事件归一化为 TurnDebrief / SessionDebrief
3. client 通过 HTTP API 拉取
4. 不写磁盘 sidecar，事件日志随 session 释放

## 存储

- 无磁盘 sidecar
- 设置通过 DSH 设置服务持久化（namespace `debrief`）