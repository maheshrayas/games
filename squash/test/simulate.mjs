/**
 * Runs the game's simulation headlessly for a few thousand frames in every
 * mode, with a stub DOM and canvas.
 *
 * This exists because a syntax check is not an execution check. A
 * `Cannot access 'lob' before initialization` shipped in the CPU's swing —
 * the file parsed perfectly, and the throw only happened on the first frame
 * the computer tried to hit the ball, which no parse or render test reached.
 *
 *   node squash/test/simulate.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');

let js = html.split('<script>')[1].split('</' + 'script>')[0];
// Drop the DOM wiring at the tail; the simulation is what we exercise.
js = js.slice(0, js.indexOf('// ── input ─')).replace(/document\.querySelectorAll[\s\S]*?;\n/g, '');

const noop = () => {};
// A canvas context that accepts every call and every property, so draw() runs
// for real — it is where a bad coordinate or a missing method would surface.
const gradientStub = { addColorStop: noop };
const ctxStub = new Proxy({}, {
  get: (_t, k) => {
    // createLinearGradient/createPattern return objects the code then calls into.
    if (typeof k === 'string' && k.startsWith('create')) return () => gradientStub;
    if (k === 'measureText') return () => ({ width: 10 });
    return noop;
  },
  set: () => true,
});
const elStub = new Proxy({}, {
  get: (_t, k) => {
    if (k === 'style') return {};
    if (k === 'getContext') return () => ctxStub;
    if (k === 'getBoundingClientRect') return () => ({ left: 0, top: 0, width: 440, height: 700 });
    if (k === 'width') return 440;
    if (k === 'height') return 700;
    return noop;
  },
  set: () => true,
});
const doc = { getElementById: () => elStub, querySelectorAll: () => [], addEventListener: noop };

const api = new Function(
  'document', 'getComputedStyle', 'requestAnimationFrame', 'addEventListener', 'performance',
  js + '; return {setupServe,serve,stepPlayers,stepBall,swing,cpuSwing,draw,start,keys,get S(){return S;}};',
)(doc, () => ({ getPropertyValue: () => '#000' }), noop, noop, { now: () => 0 });

const FRAMES = 4000;
let failed = 0;

for (const mode of ['practice', 'cpu-easy', 'cpu-med', 'cpu-hard', 'human']) {
  try {
    api.start(mode);
    let rallies = 0, stall = 0, worstStall = 0, wasDead = false;
    const dt = 1 / 60;
    for (let f = 0; f < FRAMES; f++) {
      const S = api.S;
      // Mirror frame()'s state machine rather than forcing a serve every
      // rally — forcing it is what hid the CPU never serving at all.
      if (S.phase === 'dead') { S.deadT -= dt; if (S.deadT <= 0) api.setupServe(); }
      if (S.phase === 'serve' && S.autoServe > 0) {
        S.autoServe -= dt;
        if (S.autoServe <= 0) api.serve();
      } else if (S.phase === 'serve') {
        // A human would press Space here — but only when it is their serve.
        const mine = mode === 'practice' || mode === 'human' || S.server === 0;
        if (mine) api.serve();
      }
      if (S.phase === 'serve') { stall++; worstStall = Math.max(worstStall, stall); }
      else stall = 0;

      api.stepPlayers(dt);
      api.stepBall(dt);
      api.draw();
      if (S.phase === 'dead' && !wasDead) rallies++;   // count transitions, not frames
      wasDead = S.phase === 'dead';
      if (S.phase === 'over') break;
    }
    // Two seconds of frames sitting in 'serve' means nobody can put the ball
    // in play: the game is hung, which is exactly how the missing CPU serve
    // presented.
    if (worstStall > 120) {
      console.log(`FAIL ${mode}: stuck in 'serve' for ${worstStall} frames — nobody serves`);
      failed++;
    } else if (rallies === 0) {
      console.log(`FAIL ${mode}: no rally ever resolved`);
      failed++;
    } else {
      console.log(`ok   ${mode.padEnd(10)} ${FRAMES} frames, ${rallies} rallies, worst serve wait ${worstStall}f`);
    }
  } catch (e) {
    console.log(`FAIL ${mode.padEnd(10)} ${e.constructor.name}: ${e.message}`);
    failed++;
  }
}

// ── control mapping ────────────────────────────────────────────────────────
// The on-screen hint promises "WASD or arrows" outside two-player, and for a
// while it was a lie: arrows were wired to player 2 only, so in solo and
// vs-computer they did nothing at all.
function movesOn(mode, key, who = 0) {
  api.start(mode);
  for (const k in api.keys) api.keys[k] = false;
  const p = api.S.P[who];
  const [x0, y0] = [p.x, p.y];
  api.keys[key] = true;
  for (let f = 0; f < 12; f++) api.stepPlayers(1 / 60);
  api.keys[key] = false;
  return Math.hypot(api.S.P[who].x - x0, api.S.P[who].y - y0) > 0.2;
}

const controls = [
  ['cpu-easy', 'a',         0, true,  'WASD moves you vs the computer'],
  ['cpu-easy', 'arrowleft', 0, true,  'arrows move you vs the computer'],
  ['practice', 'arrowleft', 0, true,  'arrows move you in practice'],
  ['human',    'a',         0, true,  'WASD moves player 1 in two-player'],
  ['human',    'arrowleft', 0, false, 'arrows must NOT move player 1 in two-player'],
  ['human',    'arrowleft', 1, true,  'arrows move player 2 in two-player'],
];
for (const [mode, key, who, want, label] of controls) {
  const got = movesOn(mode, key, who);
  if (got === want) console.log(`ok   ${label}`);
  else { console.log(`FAIL ${label} (expected ${want}, got ${got})`); failed++; }
}

process.exit(failed ? 1 : 0);
