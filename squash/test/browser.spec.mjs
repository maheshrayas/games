/**
 * Browser tests for Glass Court Squash.
 *
 * simulate.mjs already exercises the physics and rules headlessly. This file
 * covers everything that lives *outside* the simulation, which is where every
 * bug a player actually hit turned out to be:
 *
 *   - a ReferenceError on the CPU's first swing (the page parsed and rendered
 *     fine; it threw only once the computer tried to hit)
 *   - em dashes as mojibake, because nothing declared the charset
 *   - arrow keys wired to a player that does not exist outside two-player
 *   - the page taller than the viewport
 *   - the computer never serving, hanging the game after it won a point
 *
 * Loaded over file:// on purpose: it needs no server, and it reproduces the
 * no-Content-Type condition that caused the mojibake.
 */
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'),
).href;

/** Load the game and fail the test on any console error or uncaught throw. */
async function open(page, { viewport } = {}) {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(`${e.name}: ${e.message}`));
  if (viewport) await page.setViewportSize(viewport);
  await page.goto(GAME);
  await page.waitForFunction(() => !!window.__squash?.state);
  return errors;
}

const state = (page) => page.evaluate(() => {
  const S = window.__squash.state;
  return { phase: S.phase, mode: S.mode, server: S.server, pts: S.pts,
           p0: { x: S.P[0].x, y: S.P[0].y }, p1: { x: S.P[1].x, y: S.P[1].y } };
});

/** Dismiss the mode menu by choosing one. */
async function choose(page, mode) {
  await page.click(`[data-mode="${mode}"]`);
  await expect(page.locator('#menuDlg')).not.toBeVisible();
}

// ── the crash that shipped ────────────────────────────────────────────────
test.describe('runtime', () => {
  for (const mode of ['practice', 'cpu-easy', 'cpu-med', 'cpu-hard', 'human']) {
    test(`${mode} plays for two seconds with no console error`, async ({ page }) => {
      const errors = await open(page);
      await choose(page, mode);
      await page.waitForTimeout(2000);
      expect(errors, `console errors in ${mode}`).toEqual([]);
    });
  }
});

// ── the layout ────────────────────────────────────────────────────────────
test.describe('fits the screen', () => {
  const sizes = [
    { name: 'phone portrait',  width: 390, height: 844 },
    { name: 'small phone',     width: 360, height: 640 },
    { name: 'phone landscape', width: 844, height: 390 },
    { name: 'tablet',          width: 768, height: 1024 },
    { name: 'desktop',         width: 1280, height: 800 },
  ];
  for (const { name, width, height } of sizes) {
    test(`no vertical scrollbar on ${name} (${width}x${height})`, async ({ page }) => {
      await open(page, { viewport: { width, height } });
      await choose(page, 'cpu-easy');
      // Two different failures, and the obvious check only catches one.
      // scrollHeight-clientHeight is 0 whenever the content is clipped rather
      // than scrolled, and html/body are overflow:hidden here — so a layout
      // that pushes the controls off the bottom reports no overflow at all.
      // Asserting that the *last* element is fully on screen is what actually
      // catches it.
      const overflow = await page.evaluate(() => ({
        doc: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        body: document.body.scrollHeight - document.body.clientHeight,
      }));
      expect(overflow.doc, 'document scrolls vertically').toBeLessThanOrEqual(1);
      expect(overflow.body, 'body scrolls vertically').toBeLessThanOrEqual(1);

      const offscreen = await page.evaluate((h) =>
        [...document.querySelectorAll('.stage > *')]
          .map((el) => ({ cls: el.className || el.tagName, bottom: el.getBoundingClientRect().bottom }))
          .filter((e) => e.bottom > h + 1), height);
      expect(offscreen, 'these are pushed below the fold').toEqual([]);
    });

    test(`court stays inside the viewport on ${name}`, async ({ page }) => {
      await open(page, { viewport: { width, height } });
      await choose(page, 'cpu-easy');
      const box = await page.locator('#cv').boundingBox();
      expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      expect(box.height, 'court collapsed to nothing').toBeGreaterThan(80);
    });
  }
});

// ── the mojibake ──────────────────────────────────────────────────────────
test('the page declares UTF-8 and renders it', async ({ page }) => {
  await open(page);

  // The declaration itself is the assertion that has teeth. Chrome sniffs
  // UTF-8 on a file:// load whether or not anything declares it, so the
  // rendered-text check below passes even with the meta tag deleted — it
  // cannot guard the regression on its own. Browsers that do not sniff, and
  // hosts that serve a different charset, are exactly the cases the
  // declaration exists for.
  const declared = await page.evaluate(() =>
    !!document.querySelector('meta[charset]') ||
    !!document.querySelector('meta[http-equiv="Content-Type"]'));
  expect(declared, 'no <meta charset> — text encoding is left to a guess').toBe(true);
  expect(await page.evaluate(() => document.characterSet)).toBe('UTF-8');

  const text = await page.locator('#menuDlg').innerText();
  expect(text).toContain('—');          // a real em dash
  expect(text).not.toContain('â');      // the mojibake signature
});

// ── controls ──────────────────────────────────────────────────────────────
test.describe('controls', () => {
  /** Hold a key and report how far player `who` travelled. */
  async function moved(page, key, who = 0) {
    const before = (await state(page))[`p${who}`];
    await page.keyboard.down(key);
    await page.waitForTimeout(350);
    await page.keyboard.up(key);
    const after = (await state(page))[`p${who}`];
    return Math.hypot(after.x - before.x, after.y - before.y);
  }

  test('WASD moves you against the computer', async ({ page }) => {
    await open(page); await choose(page, 'cpu-easy');
    expect(await moved(page, 'a')).toBeGreaterThan(0.2);
  });

  test('arrow keys move you against the computer', async ({ page }) => {
    await open(page); await choose(page, 'cpu-easy');
    expect(await moved(page, 'ArrowLeft')).toBeGreaterThan(0.2);
  });

  test('arrow keys move you in solo practice', async ({ page }) => {
    await open(page); await choose(page, 'practice');
    expect(await moved(page, 'ArrowRight')).toBeGreaterThan(0.2);
  });

  test('in two-player the arrows drive player 2, not player 1', async ({ page }) => {
    await open(page); await choose(page, 'human');
    expect(await moved(page, 'ArrowLeft', 1), 'player 2 should move').toBeGreaterThan(0.2);
    expect(await moved(page, 'ArrowLeft', 0), 'player 1 must not').toBeLessThan(0.2);
    expect(await moved(page, 'a', 0), 'player 1 uses WASD').toBeGreaterThan(0.2);
  });

  test('the page does not scroll when arrows or space are pressed', async ({ page }) => {
    await open(page, { viewport: { width: 390, height: 844 } });
    await choose(page, 'cpu-easy');
    for (const k of ['ArrowDown', 'ArrowUp', 'Space']) await page.keyboard.press(k);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});

// ── touch, which nothing covered before ───────────────────────────────────
test.describe('touch', () => {
  test('dragging the court moves you', async ({ page }) => {
    await open(page, { viewport: { width: 390, height: 844 } });
    await choose(page, 'cpu-easy');
    const box = await page.locator('#cv').boundingBox();
    const before = (await state(page)).p0;

    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.6, { steps: 8 });
    await page.mouse.up();

    const after = (await state(page)).p0;
    expect(Math.hypot(after.x - before.x, after.y - before.y),
      'a drag on the court should move the player').toBeGreaterThan(0.3);
  });

  test('a drag lands the player near where the finger went', async ({ page }) => {
    await open(page, { viewport: { width: 390, height: 844 } });
    await choose(page, 'cpu-easy');
    const box = await page.locator('#cv').boundingBox();
    const { ppm, ox, oy } = await page.evaluate(() => ({
      ppm: window.__squash.ppm, ...window.__squash.origin,
    }));
    // Aim at a known court coordinate and check we land close to it.
    const targetX = 2.0, targetY = 7.0;
    await page.mouse.move(box.x + ox + targetX * ppm, box.y + oy + targetY * ppm);
    await page.mouse.down();
    await page.mouse.move(box.x + ox + targetX * ppm, box.y + oy + targetY * ppm, { steps: 3 });
    await page.mouse.up();

    const { p0 } = await state(page);
    expect(Math.abs(p0.x - targetX), `x off by too much (got ${p0.x})`).toBeLessThan(0.6);
    expect(Math.abs(p0.y - targetY), `y off by too much (got ${p0.y})`).toBeLessThan(0.6);
  });
});

// ── the hang ──────────────────────────────────────────────────────────────
// Real time, not simulated: this one has to watch the game actually play, so
// it is slower than the rest and gets a longer budget. Under full parallel
// load a page competes for CPU and the game clock effectively slows, which is
// why the wait is generous rather than tight.
test('the computer serves itself, so the game never stalls', async ({ page }) => {
  test.slow();
  await open(page);
  await choose(page, 'cpu-easy');
  // You always serve first, so the opening serve is ours to make; after that
  // sit still. The computer wins the rally, becomes the server, and from then
  // on has to serve itself — which is the thing that used to hang.
  await page.click('#serveBtn');
  await page.waitForFunction(() => window.__squash.state.pts[1] > 0,
    null, { timeout: 60000, polling: 250 });

  let stuck = 0;
  for (let i = 0; i < 20; i++) {
    const s = await state(page);
    stuck = s.phase === 'serve' ? stuck + 1 : 0;
    expect(stuck, "stuck in 'serve' — nobody is putting the ball in play").toBeLessThan(8);
    await page.waitForTimeout(250);
  }
});

// ── UI ────────────────────────────────────────────────────────────────────
test.describe('interface', () => {
  test('choosing a mode starts that mode', async ({ page }) => {
    await open(page);
    await choose(page, 'cpu-hard');
    expect((await state(page)).mode).toBe('cpu-hard');
    await expect(page.locator('#modeLabel')).toContainText('Pro');
  });

  test('the ball selector changes the ball and marks itself pressed', async ({ page }) => {
    await open(page); await choose(page, 'cpu-easy');
    await page.click('[data-ball="yellow"]');
    expect(await page.evaluate(() => window.__squash.ball)).toBe('yellow');
    await expect(page.locator('[data-ball="yellow"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-ball="red"]')).toHaveAttribute('aria-pressed', 'false');
  });

  test('the rules are honest about the omitted rule', async ({ page }) => {
    await open(page); await choose(page, 'cpu-easy');
    await page.click('#rulesBtn');
    const rules = page.locator('#rulesDlg');
    await expect(rules).toBeVisible();
    await expect(rules).toContainText('let and stroke');
    await expect(rules).toContainText('tin');
  });

  test('Change mode reopens the menu', async ({ page }) => {
    await open(page); await choose(page, 'cpu-easy');
    await page.click('#menuBtn');
    await expect(page.locator('#menuDlg')).toBeVisible();
  });
});
