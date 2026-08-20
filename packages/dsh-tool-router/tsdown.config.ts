/** dsh-tool-router：core（纯逻辑）与 host 双 ESM 构建。 */
export default [
  {
    name: 'dsh-tool-router/core',
    entry: { core: 'src/core/index.ts' },
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    outDir: 'lib',
    clean: true,
    dts: false,
    external: [/^@deepseek-ai\//],
    outputOptions: {
      entryFileNames: 'core.js',
    },
  },
  {
    name: 'dsh-tool-router',
    entry: { index: 'src/host/index.ts' },
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
]