import { defineConfig } from 'vitest/config';

// Global maintenance tests may only run through the separately reviewed owned
// target helper. They are excluded from the ordinary shared unit-test command.
export default defineConfig({ test: {
  environment: 'node', include: ['tests/maintenance.owned.test.ts'],
  fileParallelism: false, testTimeout: 30_000, hookTimeout: 30_000,
} });
