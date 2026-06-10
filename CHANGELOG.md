# Changelog

All notable ForgeDesk changes are tracked here.

ForgeDesk is not published to npm yet. Version entries describe the local source
state and GitHub release preparation only.

## v0.1.1 - 2026-06-10

Release prep for the local CLI MVP.

### Added

- Session lifecycle commands: `sessions`, `show`, `done`, `archive`, and `reopen`.
- Evidence readiness, handoff, export, inspect, and doctor commands.
- Local smoke workflow with `pnpm smoke`.
- Command reference, troubleshooting guide, reviewer guide, and local workflow docs.

### Improved

- Evidence discovery with `evidence --latest` and `evidence --list`.
- Evidence and export self-checks with expected file and size reporting.
- Local metadata validation for project, config, and session JSON.
- Package contents now include docs linked from the README.

### Boundaries

- No AI provider calls.
- No Web UI or dashboard.
- No cloud sync or upload.
- No automatic commit, push, PR, tag, release, or npm publish behavior.

## v0.1.0

Initial local CLI MVP for recording change intent, decisions, risks, tests, git
status, and Markdown evidence packs.
