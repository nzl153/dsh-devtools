/** dsh-toolkit-ui: host no-op + shared ESM + client shell bundle. */
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
    name: 'dsh-toolkit-ui/shared',
    entry: { shared: 'src/shared/index.ts' },
    outDir: 'lib',
    format: 'esm',
    platform: 'browser',
    dts: false,
    clean: false,
    external: [/^@deepseek-ai\//, 'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'scheduler'],
    outputOptions: {
      entryFileNames: 'shared.js',
    },
  },
  {
    name: 'dsh-toolkit-ui/client',
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    clean: false,
    external: [/^@deepseek-ai\//, 'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'scheduler'],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "dsh-toolkit-ui", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
]