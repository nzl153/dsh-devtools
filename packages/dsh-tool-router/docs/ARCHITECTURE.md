# Architecture

## Overview

```
user prompt ──agent/inbox/claimed──▶ lastPrompt
                                        │
agent.session.deriveMessages() ────────┤
                                        ▼
                     system-prompt/assemble (per step)
                                        │
                    planRoute() ──▶ filtered assembly.tools
                                        │
                   request_tools ──▶ enabledCategories (TTL)
                                        │
                   tools/result ──▶ actual tool usage
                                        │
                   session/event step/end ──▶ stats.json
```

## Modules

- `src/core` — pure logic, no DSH runtime dependency.
  - `categories.ts` — deterministic tool → category classification.
  - `heuristics.ts` — prompt/recent context → candidate categories.
  - `router.ts` — plan + filter.
- `src/host` — DSH host adapter.
  - `index.ts` — official event wiring.
  - `messages.ts` — message text extraction.
  - `fallback.ts` — `request_tools` tool.
  - `store.ts` — local stats persistence.
  - `state.ts` — per-agent mutable state.

## Why `system-prompt/assemble`?

`dsh-agent-loop.preStep()` calls `systemPrompt.assemble()` on every step and the returned `assembly.tools` is what `buildRequest()` puts into the model request header. That makes the `system-prompt/assemble` waterfall the smallest official seam that can change model-visible tools per step.

`tools.restrict()` exists too, but it is a per-scope persistent filter, not per-step. The waterfall keeps the plugin per-step and non-mutating to the registry.

## Prompt visibility caveat

The assembly context does **not** include the current user prompt. The plugin bridges that with the official `agent/inbox/claimed` event, which fires synchronously before the first assembly of a step.

## Fallback design

`request_tools` is only registered in `adaptive` mode. The model can ask for categories; the per-agent state holds `enabledCategories` plus a TTL. Every assembly decrements the TTL, so an old request cannot keep categories enabled forever.

## Stats

Records are finalized at `step/end`, after tool results come in, so `actualToolsUsed` and `unusedVisible` reflect what actually happened during that step.

## Safety

- The only mutation is `assembly.tools` (and a suggest-mode prompt section).
- `run_code` is always retained for Code Mode.
- No category signal → fail-open (keep all tools).