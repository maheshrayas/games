# games

[![tests](https://github.com/maheshrayas/games/actions/workflows/tests.yml/badge.svg)](https://github.com/maheshrayas/games/actions/workflows/tests.yml)

Small browser games. Each lives in its own directory and is a single
self-contained HTML file — no build step, no dependencies, no server.
Open the file, or serve the directory, and it runs.

| Game | |
|---|---|
| [`squash/`](squash/) | Squash, played from above. Solo practice, local two-player, and three computer difficulties. |

## Tests

```bash
npm install     # once, for the browser suite
npm test
```

Each game's own `test/` directory holds a dependency-free headless suite plus
Playwright browser tests. Locally the browser tests drive the Chrome already
installed rather than downloading one; on CI they use Playwright's own pinned
Chromium, so a run does not depend on what the runner image happens to ship.

Both suites run on every push to `main` and on every pull request
([workflow](.github/workflows/tests.yml)).

## Running one

```bash
python3 -m http.server 8000     # then open http://localhost:8000/squash/
```

Opening `index.html` directly from the filesystem works too; the local server
only matters if a game later needs `fetch` or modules.

## Why single-file

These are meant to be droppable onto any host that serves static files —
itch.io, GitHub Pages, a CDN — and to stay readable years from now. A single
file with the CSS and JS inline has no toolchain to rot.
