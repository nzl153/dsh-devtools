/** dsh-output-gallery 构建：core bundle（Node ESM）+ host bundle（Node ESM）+ client bundle（cjs，__ModuleLoader__ 契约）。
 *  每个 half 单独 build，避免 rolldown 多入口产生 hash 名共享 chunk。 */

export default [
  {
    entry: 'src/core/index.ts',
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    outDir: 'lib',
    clean: true,
    dts: false,
    external: [],
    outputOptions: {
      entryFileNames: 'core.js',
    },
  },
  {
    entry: 'src/host/index.ts',
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    outDir: 'lib',
    clean: false,
    dts: false,
    external: [/^@deepseek-ai\//],
    outputOptions: {
      entryFileNames: 'index.js',
    },
  },
  {
    name: 'dsh-output-gallery/client',
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    clean: false,
    external: [/^@deepseek-ai\//, 'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'scheduler'],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "dsh-output-gallery", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
]