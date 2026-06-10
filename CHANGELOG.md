# Changelog

All notable ForgeDesk changes are tracked here.

ForgeDesk is not published to npm yet. Version entries describe the local source
state and GitHub release preparation only.

## v0.1.3 - 2026-06-11

Release prep for the v0.1.x local hardening follow-up after v0.1.2.

### Improved

- Added the existing local smoke workflow to GitHub Actions after build and
  before package packing.
- Documented that `forgedesk evidence` marks the target session as
  `needs-review`.
- Updated the roadmap after closing completed v0.1.x testing and CI items.

### Tests

- Added integration coverage for `needs-review` evidence transitions,
  `sessions --all`, `show --session`, and child-directory workspace discovery.

### Boundaries

- Still source-only and not published to npm.
- No AI provider calls, Web UI, cloud sync, background automation, plugin
  system, automatic commit, push, PR, tag, release, or npm publish behavior.

## v0.1.2 - 2026-06-10

Release prep for local hardening after the v0.1.1 source release.

### Improved

- Centralized session resolution for `ready`, `handoff`, `export`, `inspect`,
  and session lifecycle commands.
- Preserved explicit session behavior so handoff-related commands do not fall
  back to the active session after a session id is resolved.

### Tests

- Added integration coverage for active session, explicit session, and unknown
  session behavior across handoff-related commands.

### Boundaries

- Still source-only and not published to npm.
- No AI provider calls, Web UI, cloud sync, background automation, plugin
  system, automatic commit, push, PR, tag, release, or npm publish behavior.

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
