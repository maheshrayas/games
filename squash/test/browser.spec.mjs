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

// Defaults to the file on disk — no server, and it reproduces the
// no-Content-Type condition that once caused the mojibake. Point GAME_URL at a
// deployment to run the same suite as a smoke test against it:
//   GAME_URL=https://maheshrayas.github.io/games/squash/ npm run test:browser
const GAME = process.env.GAME_URL || pathToFileURL(
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
test('the computer serves itself, so the game never stalls', async ({ page }) => {
  test.slow();
  await open(page);
  await choose(page, 'cpu-easy');

  // Serve whenever it is our serve. The Club computer puts roughly a third of
  // its shots into the tin or out, so we win rallies too — and a test that
  // served once and then idled would sit waiting for a serve it never made,
  // which looks exactly like the hang it is meant to detect. Playing properly
  // is the only way to reach the state under test.
  const serveIfOurs = async (s) => {
    if (s.phase === 'serve' && s.server === 0) await page.click('#serveBtn').catch(() => {});
  };

  // Play until the computer holds serve, which is the situation that used to
  // freeze the game: nothing but the computer itself can put the ball in play.
  let sawCpuServing = false;
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline && !sawCpuServing) {
    const s = await state(page);
    if (s.phase === 'serve' && s.server === 1) { sawCpuServing = true; break; }
    await serveIfOurs(s);
    await page.waitForTimeout(120);
  }
  expect(sawCpuServing, 'the computer never came to serve, so nothing was tested').toBe(true);

  // The assertion. Left alone, the computer must put the ball in play.
  await expect
    .poll(async () => (await state(page)).phase, { timeout: 8000, intervals: [100] })
    .not.toBe('serve');
});

// ── sound ─────────────────────────────────────────────────────────────────
test.describe('sound', () => {
  test('mutes, and remembers it across a reload', async ({ page }) => {
    await open(page);
    await choose(page, 'cpu-easy');
    await expect(page.locator('#muteBtn')).toHaveAttribute('aria-pressed', 'true');

    await page.click('#muteBtn');
    await expect(page.locator('#muteBtn')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#muteBtn')).toHaveText('Sound off');

    await page.reload();
    await page.waitForFunction(() => !!window.__squash?.state);
    await expect(page.locator('#muteBtn'), 'the mute should survive a reload')
      .toHaveAttribute('aria-pressed', 'false');
  });

  test('playing produces audio without throwing', async ({ page }) => {
    // Chrome refuses to start audio before a gesture, and every sound here is
    // fired from deep inside the game loop — so a mistake would surface as a
    // console error mid-rally rather than anywhere a unit test would look.
    const errors = await open(page);
    await choose(page, 'cpu-easy');
    await page.click('#serveBtn');
    await page.waitForTimeout(2500);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => window.__squash.audioState),
      'the audio context should be running after a gesture').not.toBe('suspended');
  });
});

// ── tournament ────────────────────────────────────────────────────────────
test.describe('tournament', () => {
  test('shows a five-round ladder with the first round next', async ({ page }) => {
    await open(page);
    await page.click('[data-mode="tournament"]');
    await expect(page.locator('#tourDlg')).toBeVisible();
    await expect(page.locator('#tourList .rung')).toHaveCount(5);
    await expect(page.locator('.rung.next')).toContainText('Ravi Menon');
    await expect(page.locator('#tourPlay')).toContainText('Ravi Menon');
  });

  test('starting a round sets that opponent, their ball, and best of three', async ({ page }) => {
    await open(page);
    await page.click('[data-mode="tournament"]');
    await page.click('#tourPlay');
    await expect(page.locator('#tourDlg')).not.toBeVisible();

    expect(await page.evaluate(() => window.__squash.state.tourRound)).toBe(0);
    expect(await page.evaluate(() => window.__squash.state.gamesToWin),
      'tournament matches are best of three').toBe(2);
    expect(await page.evaluate(() => window.__squash.ball)).toBe('blue');
    await expect(page.locator('#n1'), 'the scoreboard should name the opponent')
      .toContainText('Ravi Menon');
    await expect(page.locator('#modeLabel')).toContainText('Club ladder');
  });

  test('an exhibition match is still best of five', async ({ page }) => {
    await open(page);
    await choose(page, 'cpu-easy');
    expect(await page.evaluate(() => window.__squash.state.gamesToWin)).toBe(3);
    expect(await page.evaluate(() => window.__squash.state.tourRound)).toBe(null);
  });

  test('progress is remembered, and Start over clears it', async ({ page }) => {
    await open(page);
    // Winning a match legitimately would take minutes, so the progress itself
    // is set the way the game stores it — this asserts the ladder *reads* its
    // saved progress, which is the part that makes a tournament worth playing.
    await page.evaluate(() => localStorage.setItem('gc-tour', JSON.stringify({ round: 2 })));
    await page.reload();
    await page.waitForFunction(() => !!window.__squash?.state);

    await page.click('[data-mode="tournament"]');
    await expect(page.locator('.rung.beaten')).toHaveCount(2);
    await expect(page.locator('.rung.next')).toContainText('Aisha Rahman');

    await page.click('#tourReset');
    await expect(page.locator('.rung.beaten')).toHaveCount(0);
    await expect(page.locator('.rung.next')).toContainText('Ravi Menon');
  });

  test('the last round is the hardest opponent on the fastest ball', async ({ page }) => {
    await open(page);
    await page.evaluate(() => localStorage.setItem('gc-tour', JSON.stringify({ round: 4 })));
    await page.reload();
    await page.waitForFunction(() => !!window.__squash?.state);
    await page.click('[data-mode="tournament"]');
    await page.click('#tourPlay');
    expect(await page.evaluate(() => window.__squash.state.mode)).toBe('cpu-hard');
    expect(await page.evaluate(() => window.__squash.ball)).toBe('yellow');
  });
});

// ── the contract a distribution build depends on ──────────────────────────
// build-gd.mjs injects an SDK that pauses the game, mutes it, and hangs ad
// breaks off specific elements. Rename any of these in the game and that build
// breaks silently — it would still load, still play, and simply never pause for
// an ad or never earn anything.
test.describe('embedding contract', () => {
  test('exposes pause, resume and setMuted to a host page', async ({ page }) => {
    await open(page);
    await choose(page, 'cpu-easy');
    const api = await page.evaluate(() => Object.keys(window.squashGame || {}));
    for (const k of ['pause', 'resume', 'setMuted', 'paused']) expect(api).toContain(k);
  });

  test('pause stops play and mutes, as ad networks require', async ({ page }) => {
    await open(page);
    await choose(page, 'cpu-easy');
    await page.click('#serveBtn');
    await page.waitForTimeout(400);

    await page.evaluate(() => window.squashGame.pause());
    const a = await page.evaluate(() => ({ ...window.__squash.state.B }));
    await page.waitForTimeout(600);
    const b = await page.evaluate(() => ({ ...window.__squash.state.B }));

    expect(b, 'the ball moved while paused').toEqual(a);
    expect(await page.evaluate(() => window.__squash.muted),
      'pausing must mute too — GameDistribution requires it').toBe(true);

    await page.evaluate(() => window.squashGame.resume());
    await page.waitForTimeout(500);
    const c = await page.evaluate(() => ({ ...window.__squash.state.B }));
    expect(c, 'the game did not restart after resume').not.toEqual(b);
  });

  test('the elements ad breaks hang off still exist', async ({ page }) => {
    await open(page);
    await page.click('[data-mode="tournament"]');
    await expect(page.locator('#tourPlay')).toBeVisible();
    await page.click('#tourPlay');
    await expect(page.locator('#serveBtn')).toBeVisible();
    // The between-games break is triggered by gameNo advancing.
    expect(await page.evaluate(() => typeof window.__squash.state.gameNo)).toBe('number');
  });
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
