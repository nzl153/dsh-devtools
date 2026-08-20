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
pnpm run check     # typecheck + build + test + integrity 全跑
```

| 命令 | 作用 |
|---|---|
| `pnpm run typecheck` | 各包 `tsc --noEmit` |
| `pnpm run build` | 各包 tsdown 构建 |
| `pnpm run test` | 各包单测 / smoke / e2e |
| `pnpm run integrity` | **扫全部产物，找「引用了但从未定义」的标识符** |

### 关于 integrity

`scripts/bundle-integrity.mjs` 解析每个包 `lib/*.js` 的 AST，
把「被引用的名字」减去「声明过的名字」和已知全局，剩下的就是运行时会炸的。

存在的理由是 2026-08-19 那次事故：`Shell.tsx` 用了 `setToolkitOpenId` 却没 import，
tsdown 判定没人用把它摇掉，**编译期零报错**，点关闭按钮才 `ReferenceError`。
已验证：把那行 import 删掉重新构建，这个检查会红。

它不做作用域分析——名字只要在文件任何地方声明过就算数。所以会漏报跨作用域引用，
但不会误报。

`dsh-toolkit-ui` 是共用外壳，其余插件的面板都挂在它上面。**它一坏，所有面板一起坏** —— 排查「好几个插件都有毛病」时先查它。

改完源码务必先 `pnpm run typecheck` 再 build：tsdown 不做类型检查，类型错误会静默进产物，运行时才炸。
