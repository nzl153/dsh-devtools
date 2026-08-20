/**
 * dsh-run-lab 三 entry 构建：
 *  - index.js  —— host half（cordis 插件 + webServer HTTP API），Node ESM。
 *  - cli.js    —— 独立 CLI 入口（可直接 `node lib/cli.js` 跑核心实验），Node ESM。
 *  - client.js —— Web UI half（cjs + __ModuleLoader__ 契约）。
 * host/cli external 掉 @deepseek-ai/*；client 额外 external react 全家桶。
 */
export default [
  {
    entry: ['src/host/index.ts'],
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    outDir: 'lib',
    clean: true,
    dts: false,
    external: [/^@deepseek-ai\//, 'react', 'react-dom'],
    outputOptions: {
      entryFileNames: 'index.js',
    },
  },
  {
    entry: { cli: 'src/cli/index.ts' },
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    outDir: 'lib',
    dts: false,
    clean: false,
    external: [/^@deepseek-ai\//, 'react', 'react-dom'],
    outputOptions: {
      entryFileNames: 'cli.js',
    },
  },
  {
    name: 'dsh-run-lab/client',
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    clean: false,
    external: [/^@deepseek-ai\//, 'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'scheduler'],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "dsh-run-lab", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
]
