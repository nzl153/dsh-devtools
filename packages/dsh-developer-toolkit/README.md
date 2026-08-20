# DSH Developer Toolkit

DSH（DeepSeek Harness）开发者工具集：围绕一次 Agent 工作的前、中、后，提供可独立安装的诊断、审计、实验与复盘插件。

配套独立项目：Pet Whale 桌宠不加入本工具集，它是独立的 companion 项目。

## 工具链定位

```
Before  Agent 工作前
  → dsh-preflight          环境健康检查，装前预演冲突，出问题后读日志定位根因

During Agent 工作中
  → dsh-context-xray       模型实际看到什么、上下文为什么这么大
  → dsh-time-machine       Agent 改了哪些文件，能否安全恢复
  → dsh-dev-loop           项目 Build/Test/Run/Restart 是否通过

After  Agent 工作后
  → dsh-session-archaeologist  之前做过什么：跨会话检索与时间线
  → dsh-debrief            本次运行发生了什么：确定性工作总结
  → dsh-output-gallery     本次运行产出了什么：产物分类与安全预览
  → dsh-run-lab            哪个 Agent / 配置表现更好：隔离 A/B 实验
```

## Screenshots

每个插件都从真实 DSH Web 截取，至少包含 Main UI 与一个有用状态。本仓库汇总一份副本。

| Plugin | Main UI | Useful state |
|---|---|---|
| dsh-context-xray | ![main](screenshots/dsh-context-xray.main.png) | ![state](screenshots/dsh-context-xray.state.png) |
| dsh-time-machine | ![main](screenshots/dsh-time-machine.main.png) | ![state](screenshots/dsh-time-machine.state.png) |
| dsh-session-archaeologist | ![main](screenshots/dsh-session-archaeologist.main.png) | ![state](screenshots/dsh-session-archaeologist.state.png) |
| dsh-run-lab | ![main](screenshots/dsh-run-lab.main.png) | ![state](screenshots/dsh-run-lab.state.png) |
| dsh-dev-loop | ![main](screenshots/dsh-dev-loop.main.png) | ![state](screenshots/dsh-dev-loop.state.png) |
| dsh-debrief | ![main](screenshots/dsh-debrief.main.png) | ![state](screenshots/dsh-debrief.state.png) |
| dsh-output-gallery | ![main](screenshots/dsh-output-gallery.main.png) | ![state](screenshots/dsh-output-gallery.state.png) |

## 插件矩阵

| Plugin | Purpose | Host | Client | Storage | Risk Level | DSH Version | Status |
|---|---|---|---|---|---|---|---|
| dsh-toolkit-ui | 统一 Toolkit 导航与共享 Panel 壳 | ✅ | ✅ | 无持久化 | Low | `0.1.0-rc.6` | Private preview |
| dsh-preflight | 安装前预演、日志诊断、可执行修复 | ✅ | ✅ | `~/.dsh/preflight/` | Low | `0.1.0-rc.6` | Public |
| dsh-context-xray | 上下文组成与 token 诊断 | ✅ | ✅ | `~/.dsh/context-xray/` | Low | `0.1.0-rc.6` | Private preview |
| dsh-time-machine | 文件修改记录、安全恢复、冲突检测 | ✅ | ✅ | `~/.dsh/time-machine/` | High | `0.1.0-rc.6` | Private preview |
| dsh-session-archaeologist | 本地 session 全文检索、时间线、bring-to-context | ✅ | ✅ | `~/.dsh/session-archaeologist/` | Medium | `0.1.0-rc.6` | Private preview |
| dsh-run-lab | 隔离工作区 Agent 实验与 A/B 对比 | ✅ | ✅ | `~/.dsh/run-lab/` | High | `0.1.0-rc.6` | Private preview |
| dsh-dev-loop | 项目级 Build/Test/Run/Restart 开发面板 | ✅ | ✅ | `~/.dsh/dev-loop/` | Medium | `0.1.0-rc.6` | Private preview |
| dsh-debrief | 确定性每 turn / 每 session 工作总结 | ✅ | ✅ | `~/.dsh/debrief/` | Low | `0.1.0-rc.6` | Private preview |
| dsh-output-gallery | session 产物跟踪、安全预览、交付物关系 | ✅ | ✅ | `~/.dsh/output-gallery/` | Medium | `0.1.0-rc.6` | Private preview |

Risk Level 说明：

- Low：只读诊断，或只写 limited metadata，不执行命令
- Medium：会创建本地索引、运行本机命令（如 pnpm test）、读取 session 内容
- High：会写/恢复文件、创建隔离工作区、运行 Agent 命令，需用户确认

## 安装入口

每个插件独立安装，互不依赖。推荐方式：

```sh
git clone https://github.com/nzl153/<repo>.git
cd <repo>
pnpm install
pnpm build
dsh plugin --profile web add link:"$(cygpath -m "$PWD")"
```

当前 7 个插件仓库为 private preview，clone 需要你有 GitHub 访问权限。`dsh-preflight` 已公开，可直接安装。

## 兼容版本

- 测试过的 DSH：`@deepseek-ai/dsh` `0.1.0-rc.6`
- 测试过的 profile：`web`
- 测试过的平台：Windows（Git Bash / MSYS）
- 未在其他 DSH 版本上验证，不承诺跨版本兼容

## 设计原则

- 独立安装、独立卸载，不相互 import
- 跨插件集成只走 HTTP API probe，做不了就静默降级
- 不修改 DSH 官方源码，不写自定义 durable session 事件
- 默认只保存元数据，不保存完整 prompt / 搜索结果正文
- 破坏性操作（恢复文件、跑 Agent、执行命令）默认需要用户确认

## Roadmap

- SDK / 聚合安装脚本：一条命令安装全部工具
- 统一诊断导出格式
- 插件间共享上下文摘要（仍走 HTTP probe 协议）
- 公共 curated registry 提交（等各插件 readiness 稳定后）

## License

[MIT](LICENSE)