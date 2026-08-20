# dsh-tool-router

DSH Tool Router — dynamically shrink model-visible tool schemas per agent step while keeping a safe fallback.

It is **not** a permission system. It does **not** delete tools. It does **not** make any tool permanently unavailable.

> This step only shows the model the tool set most likely relevant. If the router guesses wrong, the model can call `request_tools` to re-enable a category for the next step.

## Status

- Default mode `observe`: does not change tools, only records what routing would keep.
- Local stats are written to `~/.dsh/dsh-tool-router/stats.json`.
- No network, no second LLM call, no external services.

## Official seam

DSH already exposes a per-step tool assembly extension point:

- `system-prompt/assemble` waterfall — `assembly.tools` can be filtered per step.
- `agent/inbox/claimed` — captures the current user prompt before assembly.
- `agent/pre-step` / `agent/request` — official model routing seams used by dsh-model-router later.

No monkey patching, no DSH source changes.

Known gap: `ToolSchema` does not expose the tool's registration source, so classification uses `name / description / parameters` plus a built-in known-tool map.

## Install

```bash
dsh plugin add link:"E:\\dsh-plugins\\dsh-tool-router"
```

## Config

Schemastery schema fields:

```yaml
mode: observe            # off | observe | suggest | adaptive
alwaysVisible: []
minimumSafeTools:
  - bash
  - read
  - search
fallbackToolName: request_tools
fallbackTtlSteps: 3
storePromptPreview: true
suggestPromptSection: true
```

### Modes

| mode | behavior |
| --- | --- |
| off | no routing |
| observe | no tool changes, record stats only |
| suggest | no filtering, add a lightweight prompt hint |
| adaptive | filter visible tools and enable `request_tools` fallback |

### Fallback

In `adaptive`, the model sees `request_tools` and can request:

```json
{ "enable": ["web", "database"] }
```

The next step re-adds the matching categories. TTL defaults to 3 steps.

## Categories

`filesystem / search / shell / git / lsp / web / browser / database / mcp / image / workflow / subagent / misc`

## Safety

- Only shrinks `assembly.tools`.
- Does not touch permissions / sandbox / guards / approval.
- `run_code` (Code Mode reserved transport) is never hidden.
- Fail-open when no routing signal is present.

## Development

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm test
pnpm benchmark
```