# dsh-tool-router

## [0.1.0] - 2026-08-18

- 首个 MVP：
  - 13 类工具分类（filesystem/search/shell/git/lsp/web/browser/database/mcp/image/workflow/subagent/misc）
  - 确定性启发式路由（不调用 LLM）
  - off / observe / suggest / adaptive 四模式，默认 observe
  - alwaysVisible + minimumSafeTools
  - `request_tools` fallback（adaptive 模式）
  - 本地 JSON 统计（实际使用、未使用、schema 字节节省）
  - core benchmark（33 条 prompt，约 74% schema token 缩减）
  - 官方 `system-prompt/assemble` seam，无 monkey patch