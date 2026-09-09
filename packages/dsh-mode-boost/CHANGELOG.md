# Changelog

## [0.2.0] - Unreleased

### 变更
- 跟随 dsh-devtools 的 DeepSeek Harness 0.1.2-rc.1 适配批次升版本号。
- 本包是零依赖的宿主平面插件，不 import 任何 `@deepseek-ai/*` 运行时包，因此 0.1.2 的
  破坏性变更（client-runtime 下线、Session.events 删除、session/event 回调签名变化等）对本包无影响，
  本次没有代码改动。
