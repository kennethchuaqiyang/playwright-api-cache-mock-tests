import { defineConfig } from '@playwright/test';

// These are pure API tests (using Playwright's `request` fixture only —
// no browser is ever launched), and redis-cache-mock-api,
// inmemory-cache-mock-api, and elk-cache-mock-api all read/write the
// SAME underlying Postgres row for the test user. That shared state is
// why this config deliberately gives up Playwright's usual parallelism:
//
// - A single project: the default scaffold generates chromium/firefox/
//   webkit projects and runs every test against all three. That triples
//   execution time for no benefit here (there's no browser behavior to
//   compare) and, worse, ran those three projects concurrently against
//   the same live cache and DB row — causing real races between
//   projects (one project's PUT invalidating a cache entry mid-assertion
//   in another).
// - fullyParallel: false — stops even tests within one spec file from
//   being scheduled in parallel; test.describe.serial() only orders
//   tests within its own block, it doesn't prevent Playwright from
//   running a different describe block (or a different spec file)
//   concurrently in another worker.
// - workers: 1 — the actual enforcement: only one test executes at any
//   moment, across the whole run, full stop. This is what makes the
//   redis vs. inmemory blocks, and the separate elk-cache.spec.ts file,
//   safe to run without racing each other's reads/writes on that shared
//   Postgres row.
//
// The trade-off is speed — everything runs strictly one at a time
// instead of in parallel — which is the right call for integration
// tests against shared live infrastructure, not unit tests.

export default defineConfig({
  testDir: './tests',

  fullyParallel: false,
  workers: 1,

  // Retries mainly help absorb Render free-tier cold-start latency
  // (spin-up can take 20-50s) rather than flaky logic.
  retries: process.env.CI ? 1 : 0,

  // 'html' for local viewing (npx playwright show-report), 'junit' so
  // Jenkins can parse and display results the same way as the Go suite.
  reporter: [['html'], ['junit', { outputFile: 'results.xml' }]],

  use: {
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'api',
      // No browser-specific settings needed — these tests never launch
      // a browser context, they only use the `request` fixture.
    },
  ],
});