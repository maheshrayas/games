# Glass Court Squash

Squash on a real-proportioned court (6.4m × 9.75m) seen from above, with a
head-on view of the front wall along the top so you can see where every shot
landed relative to the tin and the out line.

Modes: solo practice (rally alone, tracks your best streak), two players on one
keyboard, and three computer difficulties.

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
