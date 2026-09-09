# Changelog

## [0.2.0] - Unreleased

### 变更
- 跟随 dsh-devtools 的 DeepSeek Harness 0.1.2-rc.1 适配批次升版本号。
- 本包是零依赖的宿主平面插件，不 import 任何 `@deepseek-ai/*` 运行时包，因此 0.1.2 的
  破坏性变更（client-runtime 下线、Session.events 删除、session/event 回调签名变化等）对本包无影响，
  本次没有代码改动。

### 构建
- `build` 脚本由 `bash scripts/build.sh` 改为 `node --check lib/index.js && node --check lib/core.js`：
  不再依赖 shell（本机 `bash` 会命中 WSL 的 `C:\Windows\System32\bash.exe`，导致构建失败）。

### 打包
- `files` 增加 `CHANGELOG.md`。
- npm 包名由 `@dsh-external/dsh-mode-boost` 改回 `dsh-mode-boost`：`@dsh-external` 不是本仓库
  作者控制的 scope，往里面发布会 403。
