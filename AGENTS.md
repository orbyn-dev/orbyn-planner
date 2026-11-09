# Orbyn Planner

Read [docs/architecture.md](docs/architecture.md) before changing behaviour. Its rules are the contract; change it in the same commit as any change to them.

## Layout

- `web/`: the React app (Vite, TypeScript).
- `web/src/`: app composition (`app/`), screens (`features/`), state and services (`state/`), pure rules (`core/`), adapters (`data/`), UI (`ui/`), generic helpers (`lib/`), tests (`testing/`, `e2e/`), generated types (`generated/`) and styles (`styles/`). Imports are one-way, and features meet only through `features/<name>/index.ts`; see [web/src/README.md](web/src/README.md). `npm run check` enforces both.
- `web/src/generated/`: wire types generated from orbyn-engine's contracts. Do not edit by hand.
- `docs/architecture.md`: the contract for the UI. Its rules change in the same commit as the code.

## Checks

```bash
cd web && npm run check && npm test && npm run build
```

## Designs

The UI follows the private repository `orbyn-dev/orbyn-designs`, the one source of truth: `artifacts/` holds the published designs, `artifacts.json` indexes them, and `briefs/` holds the design-match brief. Read it from a current clone (`git pull` first), never from a copy in a temp folder, and never edit `artifacts/` here.

- Match the designs exactly, in Light, Dark and Dim, including copy and motion. Take every value from the design source.
- A UI change cites the artifact version and frame ids it builds, or links the design pull request there.
- Anything not designed or not in the plan goes to the Orbyn Product UI/UX Designer before it is built. Never invent it.
- The repository is private, so a contributor without access gets the frames they need in their issue.
- Public files never link the private plan or the design artifact pages.

## Delivery

- Branch from `main` with a short purpose name: `feat/`, `fix/`, `docs/`, `chore/` or `refactor/`.
- Open a pull request for every change. Merge only when every required check is green on the current head. Never weaken a check or merge red. Use a merge commit.
- Pull request and issue titles use `type(scope): summary`, at most 72 characters, with a kind from CONTRIBUTING.md.
- Every pull request fills in the template's AI usage section from what actually ran. The PR check fails while it is empty.
- Commits and branch names carry no agent or tool attribution: no `Co-Authored-By` trailer for an assistant, no generated-by line, no model or tool name. The AI usage section is the one place for it.
- Windows, macOS and Linux are all supported. Never add a Unix-only path, shell or signal without its Windows branch.
- Never commit secrets, real user data or files from your own machine. The repository is public.

Shared engineering methods live in the outer Orbyn Engineering library workspace. Do not copy them into this repository.
