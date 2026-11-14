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

To turn it on, set `CI_RUNNER=local` (Settings, Secrets and variables, Actions, Variables). On a public repository, set it only while the organisation Actions setting "Require approval for all external contributors" stays on (it is on for all six public repositories, checked through the API): a fork's pull request runs its own copy of `ci.yml` and can name any runner, so a fork's run on these machines needs a maintainer's approval first. The public repositories are admitted to the `orbyn-local` group knowingly, on that basis. The expression is not a security boundary, maintainers must never approve a fork run that changes `.github/workflows`, and making the repository private removes the exposure. If the approval policy is ever relaxed, unset `CI_RUNNER` first. Anyone who can push a branch to the repository can run anything on the runner. Unset the variable to go back.

Stay hosted: `Wasm package` (builds `wasm-bindgen-cli` from source and needs a C linker the runner image lacks), `End to end` (Docker), `Desktop (macos-15)`, and the title, AI usage, commit trailer and CLA workflows. The runner image has git, bash, Python 3.12 and curl, no C compiler, `make`, Rust or `sudo`; `setup-node` installs Node 22 without root.

The Windows entry of `Desktop (windows-2022)` can likewise run on the self-hosted Windows runners (group `orbyn-local-windows`, labels `self-hosted, windows, orbyn-win`) when the second repository variable `CI_RUNNER_WINDOWS` is `local`; the macOS entry and the job names never change, and with the variable unset it runs hosted. Never admit a public repository to `orbyn-local-windows`. These runners are not containers: every job runs directly on the host as the same limited user `orbyn-ci`, which can modify every runner folder (`C:\orbyn-ci\runners\*`) and shares one profile (`~\.cargo`, `~\.rustup`, the npm cache, the startup folder and the Run key). So one job can change the runner program or its configuration in every slot, and so run code in every later job of every repository in the group, private ones included, and take their tokens; plant tools in the shared profile; read the memory and environment of a concurrent job (its `GITHUB_TOKEN`); read a one-time registration token if one is on disk; and reach the laptop's network. The admin token and the account password are protected. The fork check is not a security boundary. A private repository is acceptable only where everyone who can push, and every dependency the job builds (`npm ci` install scripts, `build.rs`, proc macros, Dependabot PRs), is trusted with every other repository in the group. No public repository is admitted to `orbyn-local-windows` and none will be (the group admits only the private `ci-runner` repository). The Windows runners share one limited user, so they are for private repositories only until they move to per-job VMs.

## Pull requests

- Fill in the template. Say what you verified and what you did not.
- Keep it short: bullets, under about 150 words outside AI usage.
- Merge with a merge commit once every required check is green.

## AI usage

Every pull request says how it was made. Tick "Written by hand", or give the harness and its version, every model by exact ID and what it did, the effort level, what a person decided, and every outside source. The [AI usage](.github/workflows/pr-ai-usage.yml) check fails while the section is empty. Dependabot is exempt.

## Dependencies

Dependabot opens weekly grouped minor and patch updates. Major versions are planned work in their own pull request. Pin GitHub Actions to a full commit SHA with the version in a comment.
