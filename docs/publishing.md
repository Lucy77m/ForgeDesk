# Publishing

This checklist is for maintainers publishing ForgeDesk itself. It is not a
ForgeDesk product workflow.

ForgeDesk must not publish packages, create tags, push commits, or create
GitHub releases for users. Those actions remain explicit maintainer actions
performed outside the CLI.

## Preflight

Run from the repository root:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm smoke
pnpm package-smoke
node dist/cli/index.js --version
pnpm pack --pack-destination <temp-dir>
npm publish --dry-run
```

Local development and CI use `pnpm@11.1.3`, which requires Node.js 22.13 or
newer. The published CLI runtime supports Node.js 20 and newer.

`pnpm package-smoke` creates a package tarball, installs it into a temporary npm
project, verifies the installed `forgedesk` binary version, and runs
`forgedesk next --dry-run --json` in a temporary git repository. It removes its
temporary files and does not publish anything.

Before a real npm publish, confirm:

- `package.json` and the CLI version match the release version.
- The git worktree is clean except for intentional release-prep changes.
- The tag does not already exist locally or on GitHub.
- The GitHub release does not already exist.
- `npm whoami` succeeds for the publishing account.
- `npm view forgedesk version` does not already show the target version.
- `npm publish --dry-run` reports `https://registry.npmjs.org/`.

## npm Boundary

`npm publish` is allowed only for intentional ForgeDesk release work. It should
not be hidden inside ForgeDesk commands, tests, smoke scripts, hooks, or
background automation.

If npm authentication is missing, stop at the dry-run and fix the account setup
outside the repository. Do not add tokens, `.npmrc` credentials, or environment
secrets to the repo.
