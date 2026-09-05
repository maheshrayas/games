# Glass Court Squash

Squash on a real-proportioned court (6.4m × 9.75m) seen from above, with a
head-on view of the front wall along the top so you can see where every shot
landed relative to the tin and the out line.

Modes: solo practice (rally alone, tracks your best streak), two players on one
keyboard, and three computer difficulties.

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

## Controls

- **Player 1** — `WASD` to move, `Space` to hit (hold it to lob)
- **Player 2** — arrow keys, `Enter` to hit
- **Touch** — drag to move, tap to hit

Your movement direction at the moment of contact steers the ball, so pushing
across the court as you hit sends it cross-court.

## Notes on the physics

Gravity is exaggerated (13.5 m/s² rather than 9.81) and the ball is far bouncier
than a real squash ball, which is famously dead when cold. Both are deliberate:
a faithfully dead ball makes for long, dull rallies at this scale.
