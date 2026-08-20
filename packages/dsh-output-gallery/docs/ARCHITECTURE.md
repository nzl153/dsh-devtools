# dsh-output-gallery 架构

## 分层

- `src/core/`：纯逻辑，零 DSH 依赖
  - `classify.ts`：扩展名 → 分类 / 预览类型 / mime / 风险
  - `filter.ts`：include/exclude、默认忽略、配置解析
  - `version.ts`：版本历史 metadata 增量合并
  - `safety.ts`：预览安全判定
  - `relations.ts`：related command 识别
  - `indexer.ts`：scan 结果 → gallery 状态
- `src/host/`：DSH host half
  - `scanner.ts`：工作区增量扫描
  - `runtime.ts`：store + scanner + indexer 编排
  - `store.ts`：sidecar `~/.dsh/output-gallery/<sessionId>.json`
  - `preview.ts`：安全读预览
  - `zip.ts`：ZIP 中央目录解析（只列条目）
  - `api.ts`：HTTP API
  - `index.ts`：插件入口，turn 边界扫描
- `src/client/`：GalleryPanel、api、locales、styles

## 数据流

1. turn 结束触发扫描
2. scanner 读取 workspace，filter 过滤
3. indexer 生成新增/修改/删除状态
4. store 写 metadata sidecar
5. client 通过 API 查询，preview 实时读磁盘

## 存储

- 位置：`~/.dsh/output-gallery/<sessionId>.json`
- 内容：metadata（path / type / size / mtime / turn / pin / related command）
- 不保存文件内容

## 安全边界

- 只读文件，不执行
- 危险扩展不预览
- 路径防穿越
- HTML/SVG sandbox