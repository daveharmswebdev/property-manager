/**
 * Vitest configuration for frontend tests.
 *
 * Memory Optimization (Story 9-4):
 * Limits test workers to 3 threads to reduce memory usage from ~26GB to ~12GB.
 * This prevents OOM issues on machines with limited RAM during parallel test execution.
 *
 * Coverage Configuration:
 * Uses V8 provider for native coverage with AST-based remapping (since Vitest 3.2.0).
 * Run with: ng test -c coverage
 * Or CLI: ng test --coverage
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
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/main.ts',
        'src/**/*.d.ts',
        'src/environments/**',
        'src/**/index.ts',
      ],
      // Watermarks for HTML report color coding
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 50,
        lines: 70,
      },
    },
  },
});
