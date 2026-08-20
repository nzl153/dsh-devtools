/** dsh-time-machine 双 half 构建：Node ESM + 官方 client bundle（cjs，__ModuleLoader__ 契约）。 */
export default [
  {
    entry: ['src/host/index.ts'],
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    outDir: 'lib',
    clean: true,
    dts: false,
    external: [/^@deepseek-ai\//],
    outputOptions: {
      entryFileNames: 'index.js',
    },
  },
  {
    name: 'dsh-time-machine/client',
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    clean: false,
    external: [/^@deepseek-ai\//, 'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'scheduler'],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "dsh-time-machine", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
]
