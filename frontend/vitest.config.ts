/**
 * Vitest configuration for frontend tests.
 *
 * Memory Optimization (Story 9-4):
 * Limits test workers to 3 threads to reduce memory usage from ~26GB to ~12GB.
 * This prevents OOM issues on machines with limited RAM during parallel test execution.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 3,
        minThreads: 1,
      },
    },
  },
});
