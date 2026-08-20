# dsh-context-xray

DSH Context X-Ray: shows what the model actually receives in this turn and why the context is so large.

It is not a plain token counter. It splits context into System Prompt / Conversation / Tool Schemas / Skills / Workspace Instructions / Memory / Attachments / Other, with estimated tokens, share, turn-to-turn deltas, and per-tool detail.

## Why

Context in DSH is a black box. When the context gets too large or approaches the limit, it is hard to know whether system prompt, tool schemas, conversation history, or memory is the main cost.

dsh-context-xray opens that black box:

- How many tokens each part costs per turn
- Which part grows the most between turns
- How many tokens each tool schema costs and whether it is actually used

Use it for context bloat, redundant tools, and pressure warnings.

## Features

- Context Breakdown panel for the current session
- Provider-reported pressure and context window (from the official `contextPressure` projection), with normal/elevated/high/critical badge using configurable thresholds
- Prompt Sections list (id / source / order / token estimate / stable / preview; bodies collapsed by default)
- Tool Schema detail (tokens, source, call count, last call time, called this turn / ever, search, sort)
  - Click to expand schema JSON preview
  - Actions: copy name / copy schema / copy tool diagnostic
- Turn history list (`Turn 41 198k`, `Turn 42 201k +3k`); click a turn to see its breakdown and per-category delta explanations
- Export/copy diagnostic JSON (no prompt bodies; for issue reports)
- Clear local metrics

## Screenshots

![Main UI](screenshots/main.png)

![Useful state](screenshots/state.png)

## Install

Prerequisite: DSH CLI (`@deepseek-ai/dsh`) installed and a target profile (example: `web`).

```sh
git clone https://github.com/nzl153/dsh-devtools.git
cd dsh-context-xray
pnpm install
pnpm build
dsh plugin --profile web add link:"$(cygpath -m "$PWD")"
```

Restart `dsh web` once after install. Client-only changes then hot reload:

```sh
pnpm dev
```

Verify wiring:

```sh
pnpm verify:hmr
```

## Usage

1. Install and restart DSH
2. Open the Context Breakdown panel in a session (session header actions)
3. Check total pressure, category shares, Prompt Sections, Tool Schema detail
4. For changes, open Turn history and click a turn to see deltas
5. For issue reports, export diagnostic JSON

## Development

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

Commands:

```sh
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest unit + jsdom smoke
pnpm build       # tsdown → lib/index.js + lib/client.js
pnpm verify:hmr  # verify HMR wiring against a running DSH
```

HMR contract:

- Client-only changes: DSH runtime hot reloads automatically
- Host changes (`src/host/**`, `package.json` structure, `cordis.patch.yml`): requires DSH restart

## Compatibility

- Tested DSH: `@deepseek-ai/dsh` `0.1.0-rc.6`
- Tested profile: `web`
- Tested platform: Windows (Git Bash / MSYS)

Not verified on other DSH versions. No cross-version guarantee.

## Privacy

- All analysis is local; no network requests
- Full prompt bodies are never persisted; `snapshot?includeBody=true` returns them only on demand and never writes them to sidecar
- Sidecar history keeps only tokens/shares/tool names: `~/.dsh/context-xray/<sessionId>.json`
- The diagnostic export JSON contains no prompt bodies (DSH version, plugin version, context/tool/section metrics and history)
- `Clear local metrics` deletes that file

## Security

- Read-only diagnostics; risk level: Low
- Reads: current session context composition, tool schemas, token metrics
- Writes: only sidecar metadata under `~/.dsh/context-xray/`; no durable Session log writes
- Executes: no commands
- Does not modify DSH official source or monkey-patch official bundles
- Does not append custom durable events to the Session log
- Does not auto-disable tools; the panel only shows a badge

## Limitations

- Tool source classification (builtin/plugin/MCP) is heuristic and may be wrong
- All token details use the official heuristic (4 chars ≈ 1 token + structural overhead), not billing data
- Provider total pressure is exact; per-section tokens are estimates
- History is retained only while the current DSH instance runs; clearing deletes it

## Roadmap

- User configurable tool source mapping (currently heuristic)
- More precise provider usage fields
- History trend chart for context pressure warnings

None of these are implemented yet.

## License

[MIT](LICENSE)