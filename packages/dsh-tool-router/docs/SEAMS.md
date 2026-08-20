# DSH Seam Research (dsh-tool-router)

## Result

There **is** an official, stable per-step tool assembly seam:

- `system-prompt/assemble` waterfall (`@deepseek-ai/dsh-system-prompt`)
- receives `(assembly, context, next)`
- called by `dsh-agent-loop` in `preStep()` before every model request
- `assembly.tools` becomes the `tools` field in the request header

## Related seams

- `tools.restrict({ allow, deny })` — per-scope persistent filter.
- `tools.schemas(scope)` — model-visible schema projection.
- `agent/inbox/claimed` — current user prompt capture before assembly.
- `agent/request` — official per-step provider/model switch (used by dsh-model-router later).

## Gap

`ToolSchema` only has `name / description / parameters`. The tool registration source (which plugin registered it) is **not** exposed in the public assembly or registry API. The router therefore approximates source using name prefixes and known tool names. This is a metadata gap, not a security gap.