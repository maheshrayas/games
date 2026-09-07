# Glass Court Squash

Squash on a real-proportioned court (6.4m × 9.75m) seen from above, with a
head-on view of the front wall along the top so you can see where every shot
landed relative to the tin and the out line.

Modes: solo practice (rally alone, tracks your best streak), two players on one
keyboard, and three computer difficulties.

## Tournament

A five-round ladder — Club, County, Regional, National, Championship — against
named opponents who get quicker *and* play a faster ball as you climb, since the
ball is half the difficulty. Progress is kept in `localStorage`, so the ladder
survives a reload; **Start over** clears it.

Ladder matches are best of **three** rather than five. A full five-game match at
PAR 11 is a long sitting for a browser game, and a ladder people abandon halfway
is worth nothing. Exhibition matches against the computer are still best of five.

## Sound

Synthesised with the Web Audio API rather than shipped as files, so the game
stays one self-contained page. A squash court is mostly short percussive noise
anyway: every impact is a filtered noise burst with a pitched thump under it.
The tin gets deliberately the ugliest sound in the set, because it is the one
you learn to dread.

The audio context is created lazily on the first gesture — browsers refuse to
start audio before the user has interacted, and choosing a mode is that
interaction. Mute is remembered in `localStorage`.

## Ball speed

Real squash balls are graded by a coloured dot, and the grading is exactly how
fast and how lively they are — so the difficulty dial uses the real
designations rather than inventing "easy / normal / hard".

| Ball | Level | Drive | Floor bounce | |
|---|---|---|---|---|
| Blue | Beginner | ~10 m/s | 0.54 | Bounces high and travels slowly; long rallies |
| Red | Intermediate | ~12.5 m/s | 0.45 | Middling pace and bounce |
| Double yellow | Expert | ~16.7 m/s | 0.34 | Fast and nearly dead — the competition ball |

This is **separate from computer difficulty**, so it also applies in solo
practice and two-player, where there is no CPU to grade. Pace is stored as the
flight time to the front wall, so in `BALLS` a *larger* number is a *slower*
ball.

## Rules implemented

| Rule | |
|---|---|
| The tin | 0.48m board across the bottom of the front wall; hitting it loses the rally |
| Front wall out line | 4.57m |
| Side wall out line | slopes 4.57m → 2.13m front to back, checked at the point of contact |
| Back wall out line | 2.13m |
| One bounce | ball may bounce once before you return it; volleys allowed |
| Must reach the front wall | bouncing on the floor first loses the rally |
| Serve — foot in the box | server is placed in the correct service box |
| Serve — above the service line | 1.78m on the front wall |
| Serve — opposite back quarter | landing checked against the short line and half-court line |
| Serve alternation | winner serves; switch boxes when the server holds serve |
| Scoring | point-a-rally to 11, win by two, best of five games |

## The rule that is deliberately missing

**Let, stroke and no-let.** Both players share one court, so most real disputes
are about interference — whether your opponent blocked your swing or failed to
clear to the T. Adjudicating it needs body position, swing arc and a referee's
judgement, and professional referees openly disagree about it. Rather than
implement a fake version, players here pass through each other. This is the
same compromise every squash video game makes, and the in-game rules panel says
so plainly rather than implying the simulation is complete.

## The players

Drawn as small upright figures standing on the court: legs that cycle with the
distance actually covered, a body that turns to face where you're going (or
watches the ball when you're still), and a racket that winds up behind and
sweeps through a real arc on contact, trailing the swing path.

The court stays top-down because that is what makes the service quarters, the
short line and court position readable. But a figure drawn flat from directly
overhead is just a head and shoulders and doesn't read as a person at all — so
the floor is seen from above while the body is drawn standing up from its own
feet. Old top-down sports games made the same compromise for the same reason.

The racket orbits the body in the *court* plane, squashed vertically to match
the viewing angle, so a forehand across the court sweeps across the court rather
than across the screen.

## Tests

```bash
node squash/test/simulate.mjs
```

Runs the simulation headlessly for 4000 frames in every mode against a stub DOM
and canvas, asserting no throw and that rallies actually resolve.

It exists because a syntax check is not an execution check. A
`Cannot access 'lob' before initialization` shipped in the computer's swing: the
file parsed perfectly and rendered perfectly, and the throw only happened on the
first frame the CPU tried to hit the ball — which is why it reached a browser.
The test reproduces that failure on the old code and passes on the fix.

## Layout

The page is a flex column pinned to the viewport, and the court is the only
element that flexes — everything else keeps its natural height, so the court
absorbs whatever is left rather than the page growing a scrollbar. `layout()`
then picks a pixels-per-metre scale from whichever of width or height runs out
first, so the court's real 6.4 × 9.75 proportions survive at any size.

The canvas backing store is sized by device pixel ratio with the context
transformed to match, so all drawing code is written in CSS pixels and still
comes out sharp on a retina screen.

Height is `100dvh`, not `100vh`: on mobile Safari `vh` refers to the *largest*
viewport, so a `100vh` column sits underneath the address bar and scrolls
anyway.

## Portal thumbnails

```bash
npm run thumbs     # -> squash/dist/thumbnails/*.jpg
```

One SVG scene rendered into each required aspect using SVG's own "cover"
(`preserveAspectRatio="… slice"`), so the 5:3 strip and the 1:1 square are crops
of the same artwork rather than four drawings to keep in sync. Rendered at 2×
and downscaled through ImageMagick, because these are judged at 200×120 in a
catalogue grid where 1× type goes to mush.

Two things the small tile taught, both of which only appear once you look at it:

- The court and the front wall must share one geometry. Drawn as two separate
  rectangles they read as a diagram; with the wall rising from the court's far
  edge it reads as a room.
- A 200×120 tile has a wide *aspect* but is not a wide *canvas*. Given the
  side-by-side treatment its title was capped at 92px while the word measured
  124px, and clipped. Small tiles get the centred layout and a size derived from
  the width they actually have.

## Publishing to GameDistribution

```bash
npm run build:gd -- --game-id=<your GD game id>
# -> squash/dist/gamedistribution/index.html   (git-ignored; rebuild, don't edit)
```

Zip that directory and upload it in the GameDistribution developer portal. The
game id comes from the portal after you create the game entry; the build refuses
to run without one, because an SDK with no id loads happily and reports nothing,
which looks like it is working while earning nothing.

The distributed build is **generated from `index.html`**, never maintained
alongside it, so it cannot drift from the version the tests cover. The repo's
own copy stays a single self-contained file with no third-party scripts — that
is what makes it hostable anywhere and honest to read. Only the uploaded copy
carries their SDK.

Integration follows [their SDK guide](https://github.com/GameDistribution/GD-HTML5/wiki):
`GD_OPTIONS` with an `onEvent` handler, **pause *and* mute** on `SDK_GAME_PAUSE`
(both are mandatory), resume on `SDK_GAME_START`, and `showAd()` only ever from
a user click. The two ad placements are the pauses a squash match already has —
before a tournament match, and between games within one. Nothing interrupts a
live rally.

> Their SDK throws `document.browsingTopics() is deprecated` on current Chrome.
> That is theirs, not ours, and it does not stop the game.

### Rewarded ads

A required GameDistribution checklist item, not just a revenue option. Their
guide asks for "at least a couple" of placements and supplies six sample
patterns; two of them fit squash honestly:

- **Skip this round** — offered only after *losing* a tournament match, so it
  never cheapens a win. Their "Skip Chapter" pattern.
- **New court** — unlock the Glass or Night court. Their "New Theme" pattern.

The other four samples assume coins, lives or daily rewards. This game has no
economy, and inventing one purely to have something to sell would be the tail
wagging the dog.

The game never calls an ad SDK itself. A host registers a provider:

```js
window.squashGame.setRewardedAdProvider(() => Promise<boolean>);
```

Resolve **true only if the ad was watched to completion**. Until a host
registers one, no reward is ever offered — which is why the plain build shows
no "Watch ad" button it could not honour, and why a locked court simply does
nothing there.

Three tests guard the rule that matters: an unwatched ad, a dismissed ad, and a
"No thanks" must each unlock nothing. Rewarding a player for an ad they did not
watch is how a game gets pulled from a catalogue, so that one is verified by
making the code grant unconditionally and confirming the test fails.

### The embedding API

Any host page — theirs or yours — can drive the game:

```js
window.squashGame.pause();      // stops the simulation AND mutes
window.squashGame.resume();
window.squashGame.setMuted(true);
window.squashGame.paused;       // boolean
```

`pause()` muting as well as stopping is deliberate: ad networks require it, and
a rally continuing audibly under an ad is the fastest way to be dropped from a
catalogue. The suite has a test that fails if pause ever stops muting.

## Controls

- **Player 1** — `WASD` to move, `Space` to hit (hold it to lob)
- **Player 2** — arrow keys, `Enter` to hit
- **Touch** — drag to move, tap to hit

Your movement direction at the moment of contact steers the ball, so pushing
across the court as you hit sends it cross-court.

## Notes on the physics

Gravity is exaggerated (13.5 m/s² rather than 9.81), and even the double yellow
is livelier here than the real thing, which is famously dead until it warms up.
Both are deliberate: a faithfully dead ball makes for short, frustrating rallies
at this scale.

The serve derives its wall-to-floor flight time analytically rather than
assuming a fixed total, so it stays legal at any ball pace. Getting this wrong
is what made every serve a fault in the first draft.
