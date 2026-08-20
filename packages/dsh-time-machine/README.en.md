# dsh-time-machine

DSH agent file modification time machine: automatically records agent workspace changes, shows per-turn timeline/diff, and supports safe restore.

## Why

Agents change files fast, but DSH does not tell you what changed or how to get back to a previous state.

dsh-time-machine answers:

- Which files did the agent change this turn?
- What changed exactly?
- Can we safely restore when something breaks?
- Will restore overwrite your manual edits?

## Features

- Session Baseline: automatically created on the first agent file change; records file hash, whether the file existed, git state, and dirty files that already existed before the session
- Turn recording: uses official DSH `tools/pre-execute` / `tools/post-execute` hooks to incrementally scan the workspace around relevant tool calls, recording add/edit/delete/rename, +/- line counts, mtime, tool-call source, and diff
- Watcher assist: Node built-in `fs.watch` as a fast-discovery hint with debounce/merge; final consistency is guaranteed by scan
- Rename detection: identical size + hash or content similarity above a threshold is recorded as a rename instead of delete + add
- Safety-first restore: preview first; explicit confirmation required before any write-back; re-hash before writing; mismatch becomes CONFLICT and is never auto-overwritten
- Conflict UI: View conflict, Copy old version, Restore to new file, Force overwrite
- Timeline filters: by file, by turn, agent-only edits, conflicts-only, changed-since-baseline
- Git read-only: only read-only git commands are used; destructive commands are never run

## Screenshots

![Main UI](screenshots/main.png)

![Useful state](screenshots/state.png)

## Install

Prerequisite: DSH CLI (`@deepseek-ai/dsh`) installed and a target profile (example: `web`).

```sh
git clone https://github.com/nzl153/dsh-devtools.git
cd dsh-time-machine
pnpm install
pnpm build
dsh plugin --profile web add link:"$(cygpath -m "$PWD")"
```

Restart `dsh web` once after install. Client-only changes then hot reload:

```sh
pnpm dev
```

## Usage

1. Install and restart DSH
2. Open the Time Machine panel in the agent workspace
3. Inspect Session Baseline and Turn list
4. Click a turn or file to see the diff
5. To restore: choose Restore → Preview → confirm write-back
6. If a conflict appears, follow the UI to choose how to handle it

## Development

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

Requires Node.js >= 22 (verified with Node 24 and pnpm 11).

Commands:

```sh
pnpm typecheck       # tsc --noEmit
pnpm test:unit       # Vitest unit tests
pnpm test:smoke      # client bundle loader contract
pnpm test:e2e        # real temporary git repo, core engine only, no DSH
pnpm test            # unit + smoke + E2E
pnpm build           # tsdown dual-half + scripts/verify-build.mjs
pnpm verify:hmr --profile=web
```

HMR contract:

- Client-only changes: DSH runtime hot reloads automatically
- Host changes (`src/host/**`, `package.json` structure, `cordis.patch.yml`): requires DSH restart

## Compatibility

- Tested DSH: `@deepseek-ai/dsh` `0.1.0-rc.6`
- Tested profile: `web`
- Tested platform: Windows (Git Bash / MSYS)
- Node.js: >= 22

Not verified on other DSH versions. No cross-version guarantee.

## Privacy

- All data stays local; no network requests
- Snapshots and history live in `~/.dsh/time-machine/<sessionId>/`
- File contents use a content-addressed object store
- To support baseline restore, small text files (default < 1 MiB) are stored; this is a deliberate trade-off
- Binary and large files are recorded by hash only; their contents are not stored
- Nothing custom is appended to the DSH session log

## Security

Risk level: High (writes files back).

### Never automated

1. Never overwrite pre-existing uncommitted user work: files marked `dirty-before-session` at baseline are refused on restore
2. Never write back without explicit confirmation: restores start with `preview`; commit requires `confirmed: true`
3. Never overwrite conflicts: if the on-disk hash differs from the plugin's recorded latest state, the file is flagged CONFLICT and not written; force requires `force:true` after client-side double confirm and host verification
4. Never delete a file the agent did not create: if a file existed at baseline and restoring would delete it, the operation is refused
5. Never run destructive git commands: `reset --hard`, `clean -fd`, `checkout .` are never used

### Operations that require confirmation

- Restore this file → preview → confirm
- Restore this turn → preview → confirm
- Restore to session baseline → preview → confirm
- Force overwrite conflict → preview → double confirm → host `confirmed:true, force:true`

## Limitations

- Binary and large files are hash-only and cannot be content-restored (`content-not-stored`)
- Default ignored directories: `node_modules`, `.git`, `build`, `dist`, `.dsh`, `.venv`, `venv`; adjustable via `EngineConfig` in `src/core/engine.ts`
- The watcher is only a fast-discovery hint; final consistency comes from scan. Missed watcher events are picked up by the next scan
- The "conflicts only" filter is approximate (shows modified/deleted/renamed risk items); exact conflicts require a preview
- Restore to new file defaults to `<rel>.tm-conflict` so manual edits are never silently overwritten
- Only tracks files inside the current DSH workspace directory

## Roadmap

- Optional content restore for binary / large files
- Cross-session global timeline
- Finer watcher event merge configuration

None of these are implemented yet.

## License

[MIT](LICENSE)