import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Fork pool gives each test file its own process — required for NestJS
    // decorators and metadata reflection. Also prevents EventEmitter leaks
    // from process-level listeners that accumulate across test files.
    pool: "forks",

    // Default timeout for individual tests. Process-spawning tests use
    // their own explicit timeout in the test definition.
    testTimeout: 10_000,

    // Hook timeout (beforeAll/afterAll). Integration tests that boot
    // NestJS apps or run DB migrations may need more time.
    hookTimeout: 30_000,

    // Glob patterns for test discovery
    include: ["src/**/*.spec.ts"],

    // Suppress console noise from NestJS logger during tests.
    // Set to "verbose" for debugging.
    onConsoleLog() {
      return false;
    },
  },
});
