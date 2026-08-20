import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    // Allow explicit `.ts` extension imports used across src/core.
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
})
