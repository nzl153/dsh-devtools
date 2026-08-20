# Changelog

## [1.0.0-rc.1] - Unreleased

### 新增
- Context Breakdown 面板
- Provider 压力与上下文窗口徽标（normal/elevated/high/critical）
- Prompt Sections 列表与折叠预览
- Tool Schema 明细（token、来源、调用次数、搜索、排序、复制操作）
- Turn 历史列表与增量说明
- 诊断 JSON 导出 / 复制
- 清空本地统计
- Turn history、Diff Inspector、Tool Schema Inspector、Pressure Warning、Export Diagnostic（1.0 候选功能）

### 修复
- ToolTable 未使用过滤按钮文案
- dshVersionOf 改用安全 `ctx.get`，修复启动 fail-soft