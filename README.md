# dsh-devtools

DSH 开发者工具插件集。11 个包共用一套构建与检查流程。

| 包 | 版本 | 说明 |
|---|---|---|
| `dsh-context-xray` | 1.0.0-rc.1 | DSH Context X-Ray / Context Inspector |
| `dsh-debrief` | 0.9.0 | DSH Mission Debrief |
| `dsh-dev-loop` | 0.9.0 | DSH Dev Loop |
| `dsh-developer-toolkit` | 0.1.0 | DSH Developer Toolkit |
| `dsh-mode-boost` | 0.1.0 | 模式提升插件 |
| `dsh-output-gallery` | 0.9.0 | DSH Session 产物中心 / Deliverables Gallery |
| `dsh-run-lab` | 0.8.0 | DSH Agent experiment & A/B comparison |
| `dsh-session-archaeologist` | 1.0.0-rc.1 | Session Archaeologist |
| `dsh-time-machine` | 1.0.0-rc.1 | DSH Agent 文件修改时间机器 |
| `dsh-tool-router` | 0.1.0 | DSH Tool Router |
| `dsh-toolkit-ui` | 0.1.0 | DSH Developer Toolkit UI shell and shared pr… |

## 开发

```bash
pnpm install
pnpm run check     # typecheck + build + test 全跑
```

`dsh-toolkit-ui` 是共用外壳，其余插件的面板都挂在它上面。**它一坏，所有面板一起坏** —— 排查「好几个插件都有毛病」时先查它。

改完源码务必先 `pnpm run typecheck` 再 build：tsdown 不做类型检查，类型错误会静默进产物，运行时才炸。
