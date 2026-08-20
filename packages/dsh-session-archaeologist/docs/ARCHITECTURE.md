# dsh-session-archaeologist 架构

## 分层

- `src/core/`：纯搜索/解析/timeline/excerpt，可单测
- `src/host/`：SQLite 索引、扫描、HTTP API、context 注入
- `src/client/`：搜索面板（`sidebar.footer.action`）

## 数据流

1. host 扫描 `~/.dsh` 下的 session 持久化文件
2. core 解析消息、工具调用、文件名、命令、错误，写入 SQLite FTS5 索引
3. client 通过 HTTP API 查询
4. 多选片段生成 bounded excerpt
5. 通过官方 agent 接口注入当前 session 或回退 follow-up

## 存储

- 位置：`~/.dsh/session-archaeologist/index.db`
- 内容：FTS5 索引与结果缓存
- 不写 DSH durable event

## API

搜索、excerpt、context、index、exclude、timeline 接口见根目录 README。