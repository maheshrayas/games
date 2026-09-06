import { defineConfig, devices } from '@playwright/test';

/**
 * Games here are single self-contained files, so the tests load them straight
 * off disk over file:// — no server, no build step, nothing to keep in sync.
 *
 * That is also the harsher test: a file:// load sends no Content-Type header,
 * which is precisely the condition under which the missing <meta charset>
 * turned every em dash into mojibake.
 */
export default defineConfig({
  testDir: './squash/test',
  testMatch: '**/*.spec.mjs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    // Locally: drive the Chrome already on the machine, so a checkout needs no
    // browser download. On CI: use Playwright's own pinned Chromium, so the run
    // is reproducible and does not depend on whatever browser the runner image
    // happens to ship that week.
    channel: process.env.CI ? undefined : 'chrome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
