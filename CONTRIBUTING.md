# Contributing

## Titles

Pull request and issue titles use the Conventional Commits form `type(scope): summary`.

- Kinds: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`, `style` or `revert`. An issue may also use `question`.
- The scope is optional and lowercase. `!` before the colon marks a breaking change.
- The summary is a short imperative phrase with a lowercase first letter and no full stop. The whole title is at most 72 characters.
- A title never credits a tool or an assistant.

The [Title](.github/workflows/pr-title.yml) check enforces this.

## Branches and commits

- Branch from `main`: `feat/`, `fix/`, `docs/`, `chore/` or `refactor/` plus a purpose name.
- Write Conventional Commits subjects.
- No agent or tool attribution in commits or branch names. Record AI use in the pull request's AI usage section.

## Checks

```bash
cd web && npm run check && npm test && npm run build
```

`npm run check` runs TypeScript, ESLint and the import-boundary checker (`npm run check:imports`).

## Local runners

Three Linux jobs (`changes`, `Cheap checks` and `Web`) can run on the organisation's self-hosted runners (group `orbyn-local`, labels `self-hosted, orbyn-local`). They do so only when the repository variable `CI_RUNNER` is `local`; unset, everything runs on GitHub-hosted runners as before. The expression sends the ordinary pull requests from forks to hosted runners, but it is **not a security boundary**: a fork's pull request runs its own copy of `ci.yml` and can name any runner.

The real boundary is a private repository plus the runner group. Set `CI_RUNNER=local` (Settings, Secrets and variables, Actions, Variables) **only after the repository is private**, and never by admitting a public repository to the runner group: a fork's pull request would choose its own runner and run its code on those machines. The group excludes public repositories today, so with the variable set on a public repository a job would simply wait forever. Once the repository is private, anyone who can push a branch can run anything on the runner, which is acceptable only then. Unset the variable to go back.

Stay hosted: `Wasm package` (builds `wasm-bindgen-cli` from source and needs a C linker the runner image lacks), `End to end` (Docker), `Desktop` (macOS and Windows), and the title, AI usage, commit trailer and CLA workflows. The runner image has git, bash, Python 3.12 and curl, no C compiler, `make`, Rust or `sudo`; `setup-node` installs Node 22 without root.

## Pull requests

- Fill in the template. Say what you verified and what you did not.
- Keep it short: bullets, under about 150 words outside AI usage.
- Merge with a merge commit once every required check is green.

## AI usage

Every pull request says how it was made. Tick "Written by hand", or give the harness and its version, every model by exact ID and what it did, the effort level, what a person decided, and every outside source. The [AI usage](.github/workflows/pr-ai-usage.yml) check fails while the section is empty. Dependabot is exempt.

## Dependencies

Dependabot opens weekly grouped minor and patch updates. Major versions are planned work in their own pull request. Pin GitHub Actions to a full commit SHA with the version in a comment.
