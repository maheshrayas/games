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
    // Use the Chrome already on the machine rather than downloading a
    // Playwright build. Keeps the repo's "no heavy toolchain" premise, and a
    // real Chrome is what players use anyway.
    channel: 'chrome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
