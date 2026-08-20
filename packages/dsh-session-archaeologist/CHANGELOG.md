# Changelog

## [1.0.0-rc.1] - Unreleased

### 新增
- 跨 Session 全文搜索（SQLite FTS5 / BM25）
- Search scopes：workspace / project path / date / source 过滤
- Structured results：命中字段、上下文、workspace、session title
- Timeline：单 session 结构化摘要
- Bring to Current Context：bounded excerpt + 官方 agent.inject / follow-up 回退
- 索引管理：Reindex / Delete index / Exclude session / Exclude workspace
- 合成 benchmark fixture
- 跨插件集成：Open Time Machine 入口

### 变更
- 提升为 1.0 候选版本