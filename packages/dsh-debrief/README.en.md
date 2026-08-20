# dsh-debrief

Deterministic, non-LLM mission debriefs for DSH. After each completed turn or session, the plugin produces a local work summary computed entirely from the session event stream — no extra model calls, no UI-text parsing.

## Why

After an agent turn, it is hard to say exactly what happened: which commands ran, which files changed, which tests failed, how many tokens were spent.

dsh-debrief solves this:

- Computes facts from the local event stream, not LLM summaries
- Shows a debrief card after every turn / session
- Surfaces failed commands and unresolved items

## Features

- Turn Debrief: duration, steps, tool calls, commands, tests, failed commands, changed files, tokens in/out, slowest tool call, per-tool statistics, unresolved items
- Session Debrief: aggregates the same statistics across the whole session, plus total turns and duration
- Unresolved detection: commands with `exit code != 0`, tool results with error, TODO/FIXME markers
- Test detection: only commands matching user-configured `testCommandPatterns` (or built-in patterns) are marked as tests; unknown exit codes are marked `unknown`, never guessed
- Token/context stats: provider usage from `assistant/message` and the official token-meter projection
- Actions: View files, View failed commands, Copy summary, Continue unresolved (generates a bounded prompt draft into the composer; does not auto-run)
- Trigger settings: `off` / `session-only` / `every-n-turns` / `on-completion`; default is low-noise `session-only`

## Screenshots

![Main UI](screenshots/main.png)

![Useful state](screenshots/state.png)

## Install

Prerequisite: DSH CLI (`@deepseek-ai/dsh`) installed and a target profile (example: `web`).

```sh
git clone https://github.com/nzl153/dsh-debrief.git
cd dsh-debrief
pnpm install
pnpm build
dsh plugin --profile web add link:"$(cygpath -m "$PWD")"
```

Restart `dsh web` once after install. Client-only changes then hot reload:

```sh
pnpm dev
```

Verify:

```sh
pnpm verify:hmr
```

## Usage

1. Install and restart DSH
2. Default `session-only` mode shows a collapsed debrief card at each turn tail; expand to view
3. Open the Session Debrief panel from the session header for the full summary
4. Click View failed commands or Continue unresolved on failures
5. For more frequent debriefs, change the setting to `every-n-turns` or `on-completion`

Settings persist through the DSH settings service (namespace `debrief`):

```jsonc
{
  "triggerMode": "session-only",        // off | session-only | every-n-turns | on-completion
  "turnInterval": 2,                    // interval for every-n-turns
  "testCommandPatterns": ["my-test-runner"], // appended to built-in patterns
  "detectTodoMarkers": true
}
```

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
pnpm test        # vitest unit + jsdom smoke (client bundle load)
pnpm test:e2e    # simulated session event array, pure core assertions (no DSH)
pnpm build       # tsdown → lib/index.js + lib/client.js
pnpm verify:hmr  # verify HMR wiring against a running DSH
```

HMR contract:

- Client-only changes: DSH runtime hot reloads automatically
- Host changes (`src/host/**`, `package.json` structure, `cordis.patch.yml`): requires DSH restart

## API

Host HTTP API (same-origin validation, `{ ok, value }` / `{ ok, error }` envelopes):

| Endpoint | Method | Body | Returns |
|---|---|---|---|
| `/plugins/dsh-debrief/api/turn` | POST | `{ sessionId, turn }` | `TurnDebrief` |
| `/plugins/dsh-debrief/api/session` | POST | `{ sessionId }` | `SessionDebrief` |
| `/plugins/dsh-debrief/api/turns` | POST | `{ sessionId }` | `{ turns: number[] }` |
| `/plugins/dsh-debrief/api/settings` | POST | `{}` | settings |

## Compatibility

- Tested DSH: `@deepseek-ai/dsh` `0.1.0-rc.6`
- Tested profile: `web`
- Tested platform: Windows (Git Bash / MSYS)

Not verified on other DSH versions. No cross-version guarantee.

## Privacy

- All analysis is local; no network requests; no model calls
- Event logs are kept in memory per session and released on `session/disposed`; no on-disk sidecar
- Nothing custom is appended to the DSH session durable log
- Does not modify DSH official source

## Security

Risk level: Low.

- Reads: session event stream and provider usage
- Writes: no disk sidecar; can insert a prompt draft into the composer via official `inputActions.setDraft()` (does not auto-execute)
- Executes: no commands
- Continue unresolved requires the user to send the draft manually
- If a test cannot be identified, it is treated as a command; if exit code is unknown, it is marked `unknown`

## Limitations

- Changed/read file detection depends on tools exposing structured paths (fs diff meta) or a known-tool-name heuristic; third-party tools may not be covered
- Test status only gets passed/failed when an exit code or structured test result exists; ambiguous command semantics are treated as commands
- `session-only` / `on-completion` cannot prove the session is truly finished in a turn-tail context, so every closed turn shows a collapsed card (can be dismissed); the authoritative full summary lives in the Session panel
- Event logs are in-memory only; history is lost after DSH restarts (no persistence)

## Roadmap

- Event log sidecar persistence
- Better path detection for third-party tools
- Structured test report parsing (JUnit etc.)

None are implemented yet.

## License

[MIT](LICENSE)