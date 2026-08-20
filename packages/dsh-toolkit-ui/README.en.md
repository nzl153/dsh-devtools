# dsh-toolkit-ui

UI shell and shared presentation layer for the DSH Developer Toolkit.

It unifies the seven developer-tool plugins into one Toolkit navigation: up to three high-frequency quick actions plus a categorized popover, and a shared panel shell.

## Why

Plugins that each add their own button to the DSH header/sidebar do not scale and do not feel native.

dsh-toolkit-ui solves this:

- Unified navigation: OBSERVE / WORKSPACE / EXPERIMENT
- Each plugin registers a lightweight entry; uninstalling a plugin removes its entry automatically
- Shared panel shell makes every tool look like one set of Developer Tools

## Features

- Declarative Toolkit entry registration (global lightweight registry; no direct plugin source imports)
- Up to 3 quick actions: Context X-Ray / Time Machine / Debrief
- Toolkit popover: grouped entries with subtitle / metric / StateDot
- Shared ToolkitPanel: Header / Summary / Content / Footer
- Shared Metric / StatusRow / FileRow / SectionLabel / ToolkitEntryRow / ToolkitQuickAction
- Uses only `--dsw-*` tokens; supports light and dark
- Respects prefers-reduced-motion

## Install

Prerequisite: DSH CLI (`@deepseek-ai/dsh`) installed and a target profile (example: `web`).

```sh
git clone https://github.com/nzl153/dsh-devtools.git
cd dsh-toolkit-ui
pnpm install
pnpm build
dsh plugin --profile web add link:"$(cygpath -m "$PWD")"
```

Restart `dsh web` once after install. Client-only changes then hot reload:

```sh
pnpm dev
```

## Usage

1. Install dsh-toolkit-ui and any plugin
2. Open a session: Context / Debrief / Time Machine quick actions and the Toolkit button appear
3. Click Toolkit to open the categorized menu
4. Click any entry to open that plugin's panel

When a plugin is installed without the shell, it falls back to its own entry point.

## Development

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
pnpm verify:hmr --profile=web
```

HMR contract:

- Client-only changes: DSH runtime hot reloads automatically
- Host changes: require DSH restart

## Compatibility

- Tested DSH: `@deepseek-ai/dsh` `0.1.0-rc.6`
- Tested profile: `web`
- Tested platform: Windows (Git Bash / MSYS)

## Privacy

- Does not read session content
- Does not persist business data
- Entry metadata lives in browser memory only

## Security

- No direct imports of other plugin source
- Entries register through a global registry and are removed on unload
- Executes no commands
- Does not modify DSH official source

## Limitations

- Metric/state values must be fetched by the plugin's render functions; the shell does not poll
- The shell popover is a custom lightweight layer, not the official Menu row structure (needed for rich rows)
- Verified on rc.6 only

## Roadmap

- Deeper integration with official Menu / HoverCard
- Cross-plugin status aggregation (conflict + build failed combined count)
- Keyboard navigation

None are implemented yet.

## License

[MIT](LICENSE)