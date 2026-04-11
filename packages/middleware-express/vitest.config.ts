import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Point workspace deps at their TypeScript source so tests don't require a build step.
      '@scraperkast/core': path.resolve(__dirname, '../core/src/index.ts'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
