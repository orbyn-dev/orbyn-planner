# Web source

The React app behind Orbyn Planner. [`docs/architecture.md`](../../docs/architecture.md) is the behaviour contract; this file is the code layout it assumes.

## Layout

| Path | Holds |
| --- | --- |
| `app/` | Entrypoint, boot, shell, composition and routing. |
| `features/<name>/` | A screen or flow. Its `index.ts` is the public surface. |
| `state/` | Providers, hooks, application services and sync orchestration. |
| `core/` | Pure planner and account rules, models and ports. No browser, storage or network. |
| `data/` | IndexedDB, HTTP and engine adapters. |
| `ui/` | Primitives and product components. |
| `lib/` | Generic helpers with no product rules. |
| `testing/` | Fakes, fixtures and test-only adapters. |
| `e2e/` | Tests against a real engine. |
| `generated/` | Wire and WebAssembly types generated from orbyn-engine. Do not edit by hand. |
| `styles/` | Tokens and CSS. |

## Imports

Imports point one way:

- `app` may use `features`, `state`, `data`, `core`, `ui`, `lib`, `styles` and `generated`.
- `features` may use other feature front doors, `state`, `data`, `core`, `ui`, `lib`, `styles` and `generated`.
- `state` may use `data`, `core`, `lib`, `styles` and `generated`.
- `data` may use `core`, `lib` and `generated`.
- `core` may use `lib` and `generated`.
- `ui` may use `core`, `lib`, `styles` and `generated`.
- `lib` may use `styles`.

Tests, `testing/` and `e2e/` may use anything.

A feature reaches another feature only through `features/<name>/index.ts`. Add every public module to that index; do not import another feature's files directly. `app` may deep-import a feature only for a lazy route.

`npm run check:imports` enforces these rules, the feature front doors, the one-way layers and acyclic production imports. `npm run check` runs it with TypeScript and ESLint. `scripts/check-imports.mjs` is the source of truth; update its table and this file together when the layout changes.
