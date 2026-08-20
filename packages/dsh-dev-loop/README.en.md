# dsh-dev-loop

Project-level Build / Test / Run / Restart development loop panel for DeepSeek Harness (DSH).

In the DSH web UI, actions defined in the current workspace's `.dsh/devloop.yml` (build/test/package/run/logs…) can be run with one click: streaming output, exit codes, duration, cancel, full local log, and sending the last failure to the current Agent.

## Why

After the agent changes code, you need to manually run build, test, and restart repeatedly to confirm project state. DSH has no unified development loop panel.

dsh-dev-loop solves this:

- Turns repetitive build/test/run actions into panel buttons
- Streaming output and one-click failure forwarding to the agent
- Watch Mode and After Agent Turn automate verification

## Features

- Auto-detects the current workspace and reads its `.dsh/devloop.yml`
- Action buttons: Build / Test / Package / Run-Restart / Stop / Open logs
- Each run uses `child_process.spawn` with streaming output, exit code, duration, cancel support
- ANSI-safe rendering (escape sequences stripped in memory), max output length (default 200k chars)
- Full logs saved locally: `~/.dsh/dev-loop/logs/<project>/<timestamp>-<project>-<action>.log`
- Secrets redaction: values of sensitive env keys (`KEY/TOKEN/SECRET/PASSWORD`) are replaced with `***` in output
- Send last error to Agent: sends the bounded failure output through the DSH agent interface, falling back to copy hint when no agent is available
- Trust boundary: commands come entirely from the workspace config; first execution requires confirmation; trust records persist in `~/.dsh/dev-loop/trust.json`
- Config supports `cwd / env / timeout / shell / dependsOn / watch / afterAgent`
- Preset templates: Node / Python / Rust / .NET / Godot
- Watch Mode (off by default): listens to path changes, debounces, and runs the configured action; protects against infinite loops, re-entry, and uses queued-latest
- After Agent Turn (off by default): runs the configured action after an agent turn completes; failures only show FAIL, no automatic agent fix loop
- Generate preset: from the panel or CLI `pnpm preset --framework <fw> --output PATH`

## Screenshots

![Main UI](screenshots/main.png)

![Useful state](screenshots/state.png)

## Install

Prerequisite: DSH CLI (`@deepseek-ai/dsh`) installed and a target profile (example: `web`).

```sh
git clone https://github.com/nzl153/dsh-dev-loop.git
cd dsh-dev-loop
pnpm install
pnpm build
dsh plugin --profile web add link:"$(cygpath -m "$PWD")"
```

Restart `dsh web` once after install. Client-only changes then hot reload:

```sh
pnpm dev
```

## Usage

1. Create `.dsh/devloop.yml` in the project root with actions
2. Install the plugin and restart DSH
3. Open the Dev Loop panel and confirm trust on first execution
4. Click Build / Test / Run buttons
5. Use Send last error to Agent on failure

Minimal config:

```yaml
name: my-app
actions:
  build:
    command: npm run build
  test:
    command: npm test
    dependsOn: [build]
  run:
    command: node .
  logs:
    file: logs/app.log
```

More examples in `examples/`.

## Development

```sh
pnpm install
pnpm dev
pnpm dev:client
pnpm test
pnpm build
```

Commands:

```sh
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest unit + client bundle smoke
pnpm build        # dual-half build + verify-build
pnpm verify:hmr   # verify profile link / realpath / graph rev vs local bundle hash
pnpm preset       # generate preset template (--framework node|python|rust|dotnet|godot)
pnpm e2e          # end-to-end execution verification without DSH (build first)
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

- Command output and logs are stored locally under `~/.dsh/dev-loop/logs/`
- Trust records are stored in `~/.dsh/dev-loop/trust.json`
- Secrets redaction happens locally before output; no network requests
- Nothing custom is appended to the DSH session durable log

## Security

Risk level: Medium (executes commands from the workspace config).

- Commands come entirely from the current workspace's `.dsh/devloop.yml`, not from the plugin author
- First execution shows the trust boundary and requires confirmation
- Trust records persist in `~/.dsh/dev-loop/trust.json` (keyed by project root)
- HTTP API only accepts loopback and same-origin requests (`127.0.0.1 / ::1`, `sec-fetch-site` not cross-site, origin matches host)
- To revoke trust, delete the entry from `trust.json` or clear the file
- Secrets redaction is basic text replacement; it does not guarantee coverage of all output paths

## Limitations

- Watch uses recursive `fs.watch`; deleting the watched root requires restarting Watch
- Watch auto-execution only works after the project is trusted
- After Agent Turn only reacts to completed turns; aborted/error turns do not trigger it
- On Windows cancel uses `taskkill /T /F`; other platforms use SIGTERM
- stdout/stderr are merged into one stream; no separate coloring
- `logs` actions only return the log file path; no live tail
- Send last error to Agent requires a live agent in the target session; falls back to copy hint otherwise

## Roadmap

- Live log tail
- Separate stdout/stderr views
- Better secrets redaction for structured output
- Multi-project management

None are implemented yet.

## License

[MIT](LICENSE)