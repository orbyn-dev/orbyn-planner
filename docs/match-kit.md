# Match kit

Renders one planner screen and the design frame it should match, side by side, on a seeded planner at a pinned time. For development only.

## Run it

```bash
cd web
export ORBYN_DESIGNS_DIR=<your orbyn-designs clone>   # read with git show origin/main; run git fetch there first. Never checked out
export ORBYN_PLAYWRIGHT=<folder whose node_modules has playwright>   # optional: web/node_modules is tried first
export ORBYN_CHROME=<chrome binary>                    # optional: the newest ~/Library/Caches/ms-playwright chromium is found
node scripts/match.mjs <frame-id> [--theme light|dark|dim|all] [--out <folder>] [--pr <name>]
```

Nothing is downloaded. Output goes to `.match/<pr or branch>/` (ignored by Git, never commit images):
`<frame>-<theme>-side.png` (ours left, design right), the two halves, and `<frame>-<theme>-text.txt` (copy only one side has).
`ORBYN_DESIGN_FILE` points at a saved copy of the design page instead.

What is pinned: Sat 7 Nov 2026 08:30, time zone UTC, locale `en-GB`, reduced motion, one pixel per CSS pixel. Ours runs on an in-memory planner (no account), in the dev server only.
Ours is 1160x700 (desktop) or 390x730 (phone). The design is cropped to the same: the window title bar is hidden and the phone's status bar is left out.

## Add a frame

1. Add the data the frame is drawn with as a scenario in `web/tools/match/fixture.ts` (and its name to `SCENARIOS`).
2. Add the frame to `web/tools/match/frames.json`: `design` (section id), `app` (which phone, when a section has several), `kind` (`desktop` or `phone`), `route`, `scenario`, and `steps` to click first (`{ "role": "radio", "name": "Day" }`). Use `id@n` as the key for the n-th frame of a section.
3. Run it for all three themes and look at each image.

## Matched

A frame is matched when layout, copy, sizes and colours agree in light, dark and Dim and someone looked at all three images. Otherwise it is partial, and each remaining difference is listed with `file:line`.
Differences that come only from the frame's own sample data (a count that doesn't add up in the design) are noted as such, not as app differences.

## Development only

The fixture, the demo page and the runner never reach a production or staging build, and never touch an account or an engine.

- They live in `web/tools/` and `web/scripts/`, outside `src/`; the Docker build context skips `tools/`.
- The runner answers the planner's `/health` check itself and fails the run if any other request leaves the dev server.
- `web/tools/match/guard.test.ts` (part of `npm test`, so the Web job) builds the production and staging bundles and fails if the fixture's code, its marker, its sample strings or the demo page appear, or if anything in `src/` imports `tools/`, or if the kit imports engine, sync or sign-in code or calls a network API. `fixture.test.tsx` runs every scenario with the network stubbed and fails on any call.
