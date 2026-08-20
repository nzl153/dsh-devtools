# dsh-time-machine 架构

## 分层

- `src/core/`：纯快照引擎（HostFs 抽象、diff、基线、恢复规划、sidecar store、watcher 纯逻辑；无 DSH 依赖）
- `src/host/`：DSH host half，hook 接线 + fs.watch 后端 + HTTP API
- `src/client/`：DSH web client half，Timeline + diff + conflict/恢复面板 + filters

## 数据流

1. DSH 工具调用前/后，host 触发扫描
2. core 对比当前 workspace 与上次记录，生成 diff 事件
3. 事件写入 sidecar store
4. client 通过 HTTP API 查询 timeline / diff / conflict
5. 恢复时先 preview 计算三方内容，确认后写回

## 存储

- 位置：`~/.dsh/time-machine/<sessionId>/`
- 文件内容：content-addressed object store
- 只保存恢复所需的小文本文件内容；二进制与大文件仅存 hash

## 安全边界

- 只读 Git 命令
- 写回必须显式确认
- 冲突不自动覆盖
- 不运行破坏性命令