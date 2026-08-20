# Changelog

## [1.0.0-rc.1] - Unreleased

### 新增
- Session Baseline：首次文件修改时自动建立基线
- Turn 修改记录：hooks 前后增量扫描，记录新增/修改/删除/重命名与 diff
- Watcher 辅助层：fs.watch 快速发现 + debounce + periodic reconciliation scan
- Rename detection
- 安全恢复：preview + 确认 + 冲突检测
- Conflict UI：三方内容、Copy old version、Restore to new file、Force overwrite
- Timeline filters：按 file / turn / Agent / conflict / baseline
- 跨插件集成：来自其他插件的时间线入口