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
  js + '; return {setupServe,serve,stepPlayers,stepBall,swing,cpuSwing,draw,start,get S(){return S;}};',
)(doc, () => ({ getPropertyValue: () => '#000' }), noop, noop, { now: () => 0 });

const FRAMES = 4000;
let failed = 0;

for (const mode of ['practice', 'cpu-easy', 'cpu-med', 'cpu-hard', 'human']) {
  try {
    api.start(mode);
    api.serve();
    let rallies = 0;
    for (let f = 0; f < FRAMES; f++) {
      api.stepPlayers(1 / 60);
      api.stepBall(1 / 60);
      api.draw();
      if (api.S.phase === 'dead') { rallies++; api.setupServe(); api.serve(); }
      if (api.S.phase === 'over') break;
    }
    if (rallies === 0) { console.log(`FAIL ${mode}: no rally ever resolved`); failed++; }
    else console.log(`ok   ${mode.padEnd(10)} ${FRAMES} frames, ${rallies} rallies`);
  } catch (e) {
    console.log(`FAIL ${mode.padEnd(10)} ${e.constructor.name}: ${e.message}`);
    failed++;
  }
}

process.exit(failed ? 1 : 0);
