import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 3, // Limit to 3 workers to reduce memory usage (~12GB vs ~26GB)
        minThreads: 1,
      },
    },
  },
});
