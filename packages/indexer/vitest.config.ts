import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    maxWorkers: 1,
    setupFiles: ['./test/setup.ts'],
    testTimeout: 20000,
  },
});
