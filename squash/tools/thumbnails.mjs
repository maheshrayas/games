/**
 * Generates the portal thumbnails.
 *
 *   node squash/tools/thumbnails.mjs
 *   -> squash/dist/thumbnails/*.jpg
 *
 * One scene, rendered into each required aspect with SVG's own "cover"
 * (preserveAspectRatio slice), so a 5:3 strip and a 1:1 square are crops of the
 * same artwork rather than five drawings to keep in sync.
 *
 * Rendered at 2x and downscaled, because these are judged at 200x120 in a
 * catalogue grid where 1x text goes to mush.
 *
 * The design is the game's own palette — floodlit maple, squash-court red, a
 * black ball — because a thumbnail that looks like the game is the only honest
 * kind.
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../node_modules/@playwright/test/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'dist', 'thumbnails');
const tmp = join(out, '.tmp');

const SIZES = [
  { name: 'thumb-512x384',   w: 512,  h: 384,  required: true },
  { name: 'thumb-512x512',   w: 512,  h: 512,  required: true },
  { name: 'thumb-200x120',   w: 200,  h: 120,  required: true },
  { name: 'promo-1280x720',  w: 1280, h: 720,  required: false },
];

/**
 * The scene, in a 16:10 viewBox. Cropped, never squashed.
 *
 * Drawn in perspective with the front wall RISING FROM the court's far edge,
 * because a court and a wall drawn as two separate rectangles read as a
 * diagram — the first version had a white bar floating above a tilted floor and
 * you could not tell they were the same room. The tin along the wall's base is
 * the one piece of squash iconography a stranger might recognise, so it gets
 * the strongest colour in the frame.
 */
const scene = `
<svg viewBox="0 0 1000 625" preserveAspectRatio="xMidYMid slice"
     xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;width:100%;height:100%">
  <defs>
    <radialGradient id="floodlight" cx="50%" cy="22%" r="82%">
      <stop offset="0%"  stop-color="#333944"/>
      <stop offset="100%" stop-color="#0C0E12"/>
    </radialGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#C9A473"/>
      <stop offset="45%"  stop-color="#E4C795"/>
      <stop offset="100%" stop-color="#F2DDB4"/>
    </linearGradient>
    <linearGradient id="wallg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#FBF8F2"/>
      <stop offset="100%" stop-color="#DAD5CA"/>
    </linearGradient>
    <linearGradient id="trail" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity=".6"/>
    </linearGradient>
  </defs>

  <rect width="1000" height="625" fill="url(#floodlight)"/>

  <!-- Front wall, rising from the court's far edge. Same width as that edge,
       so the two share one vanishing geometry. -->
  <g>
    <rect x="352" y="86" width="296" height="182" fill="url(#wallg)"/>
    <rect x="352" y="234" width="296" height="34" fill="#B23A2E"/>          <!-- the tin -->
    <rect x="352" y="176" width="296" height="3"  fill="#B23A2E" opacity=".9"/>
    <rect x="352" y="86"  width="296" height="5"  fill="#B23A2E"/>
    <rect x="352" y="86"  width="296" height="182" fill="none" stroke="#6E6A62" stroke-width="1.5"/>
  </g>

  <!-- Floor, in perspective: narrow at the wall, wide at the viewer. -->
  <polygon points="352,268 648,268 902,610 98,610" fill="url(#floor)"/>
  <line x1="352" y1="268" x2="648" y2="268" stroke="#8C6A38" stroke-width="2" opacity=".6"/>

  <!-- Court markings, converging with the floor. -->
  <line x1="243" y1="415" x2="757" y2="415" stroke="#B23A2E" stroke-width="5"/>
  <line x1="500" y1="415" x2="500" y2="610" stroke="#B23A2E" stroke-width="5"/>
  <polygon points="243,415 355,415 330,530 196,530" fill="none" stroke="#B23A2E" stroke-width="4"/>
  <polygon points="645,415 757,415 804,530 670,530" fill="none" stroke="#B23A2E" stroke-width="4"/>
  <line x1="466" y1="415" x2="534" y2="415" stroke="#B23A2E" stroke-width="8"/>

  <!-- Ball off the wall, coming at the viewer. -->
  <path d="M556 214 C 618 300, 668 360, 706 404" stroke="url(#trail)" stroke-width="8"
        fill="none" stroke-linecap="round"/>
  <circle cx="556" cy="214" r="9" fill="#16181C" opacity=".55"/>
  <circle cx="710" cy="408" r="17" fill="#16181C"/>
  <circle cx="703" cy="401" r="5" fill="#FFFFFF" opacity=".38"/>

  <!-- Player, near court, mid-swing and reaching for it. -->
  <g transform="translate(392 452) scale(1.22)">
    <ellipse cx="0" cy="88" rx="36" ry="12" fill="#000" opacity=".42"/>
    <path d="M0 42 L-26 88 M0 42 L28 86" stroke="#1B4763" stroke-width="16"
          stroke-linecap="round" fill="none"/>
    <ellipse cx="0" cy="16" rx="23" ry="31" fill="#2C6E9B"/>
    <path d="M7 4 L80 -40" stroke="#E3B189" stroke-width="12" stroke-linecap="round"/>
    <path d="M7 4 L58 -27" stroke="#20242B" stroke-width="5.5" stroke-linecap="round"/>
    <g transform="translate(104 -54) rotate(-33)">
      <ellipse rx="27" ry="19" fill="#FFFFFF" opacity=".08"/>
      <path d="M-19 0 H19 M0 -14 V14 M-10 -11 V11 M10 -11 V11" stroke="#FFFFFF"
            stroke-width="1.7" opacity=".5"/>
      <ellipse rx="27" ry="19" fill="none" stroke="#20242B" stroke-width="6.5"/>
    </g>
    <circle cx="0" cy="-26" r="19" fill="#E3B189"/>
    <path d="M-19 -32 A19 19 0 0 1 19 -32 Z" fill="#3A2B22"/>
  </g>
</svg>`;

function page(w, h) {
  const tiny = w <= 260;
  // A 200x120 tile has a wide aspect but is not a wide *canvas*: the
  // side-by-side layout caps the title at 46% of 200px = 92px, and the word
  // measures 124px, so it clipped. Small tiles get the centred treatment and a
  // size derived from the width they actually have.
  const wide = !tiny && w / h >= 1.45;
  const titlePx = tiny ? Math.round(w * 0.25)
                : wide ? Math.round(h * 0.30)
                       : Math.round(h * 0.20);
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=IBM+Plex+Sans:wght@600&display=swap">
<style>
  *{margin:0;box-sizing:border-box}
  html,body{width:${w}px;height:${h}px;overflow:hidden;background:#0E1014}
  .frame{position:relative;width:${w}px;height:${h}px;overflow:hidden}
  .veil{position:absolute;inset:0;background:linear-gradient(
      ${wide ? '90deg, rgba(8,9,12,.93) 0%, rgba(8,9,12,.72) 34%, rgba(8,9,12,0) 62%'
             : '180deg, rgba(8,9,12,0) 42%, rgba(8,9,12,.80) 74%, rgba(8,9,12,.95) 100%'})}
  .type{position:absolute;${wide ? 'left:5.5%;top:50%;transform:translateY(-50%);max-width:46%'
                                 : `left:0;right:0;bottom:${tiny ? 5 : 6}%;text-align:center;padding:0 4%`}}
  .eyebrow{font-family:"IBM Plex Sans",sans-serif;font-weight:600;color:#E4634D;
    letter-spacing:.22em;text-transform:uppercase;font-size:${tiny ? 6.5 : Math.round(h * 0.035)}px;
    margin-bottom:${tiny ? 2 : 6}px}
  h1{font-family:"Barlow Condensed",Impact,sans-serif;font-weight:700;color:#F5F1E8;
    text-transform:uppercase;line-height:.84;letter-spacing:-.01em;
    font-size:${titlePx}px;white-space:nowrap;
    text-shadow:0 ${Math.round(h*0.012)}px ${Math.round(h*0.05)}px rgba(0,0,0,.65)}
  .rule{width:${tiny ? 26 : Math.round(h*0.13)}px;height:${tiny ? 2 : 3}px;background:#B23A2E;
    margin:${tiny ? '4px 0 4px' : '10px 0 9px'};${wide ? '' : 'margin-left:auto;margin-right:auto;'}}
  .strap{font-family:"IBM Plex Sans",sans-serif;font-weight:600;color:#C6BDAE;
    font-size:${tiny ? 6 : Math.round(h * 0.032)}px;letter-spacing:.05em}
</style></head><body>
<div class="frame">
  ${scene}
  <div class="veil"></div>
  <div class="type">
    ${tiny ? '' : '<div class="eyebrow">Glass Court</div>'}
    <h1>Squash</h1>
    <div class="rule"></div>
    ${tiny ? '<div class="strap">Tournament · 2 player</div>'
           : '<div class="strap">Five-round tournament · 2 players · real rules</div>'}
  </div>
</div></body></html>`;
}

rmSync(out, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
for (const { name, w, h } of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.setContent(page(w, h), { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);   // or the title renders in a fallback face
  const big = join(tmp, `${name}.png`);
  await p.screenshot({ path: big });
  await ctx.close();

  // Downscale 2x -> 1x with a proper filter, then JPEG. Chrome cannot do this
  // itself, and a 1x render has visibly rougher type at these sizes.
  const jpg = join(out, `${name}.jpg`);
  execFileSync('convert', [big, '-resize', `${w}x${h}`, '-quality', '92',
                           '-strip', '-interlace', 'Plane', jpg]);
  console.log(`${name}.jpg  ${w}x${h}`);
}
await browser.close();
rmSync(tmp, { recursive: true, force: true });
console.log(`\nWritten to squash/dist/thumbnails/`);
