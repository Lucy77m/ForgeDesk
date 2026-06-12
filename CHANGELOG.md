# Changelog

All notable ForgeDesk changes are tracked here.

Version entries describe source, GitHub release, and npm publishing state.

## v0.2.3 - 2026-06-12

First npm-published release for the local run-button CLI.

### Improved

- Updated package and CLI versions for the npm-published release.
- Updated README install instructions for `npm install -g forgedesk` while
  preserving local-checkout development instructions.
- Corrected the cross-platform CI matrix to Node.js 22 and 24 because
  `pnpm@11.1.3` requires Node.js 22.13 or newer for the development pipeline.
- Updated the roadmap toward post-publish onboarding and review-context relief.

### Tests

- Kept the full typecheck, unit/integration test, build, smoke, pack, npm
  dry-run, and install sanity gates for the published package.

### Publishing

- Published the package to npm as `forgedesk`.
- Published the matching GitHub source release and tag.

### Boundaries

- npm publishing is a maintainer release action, not ForgeDesk product behavior.
- No AI provider calls, Web UI, cloud sync, background automation, plugin
  system, automatic code fixing, automatic commit, push, PR, tag, release, or
  npm publish behavior inside ForgeDesk.

## v0.2.2 - 2026-06-12

Release preparation for npm packaging and cross-platform checks.

### Improved

- Added npm package metadata including license, repository, bugs, homepage,
  keywords, package files, and public publish config.
- Fixed package publishing to the official npm registry through
  `publishConfig.registry`.
- Added a `prepack` build step so package dry-runs and publishes rebuild the
  compiled CLI before packing.
- Expanded CI across Windows, macOS, Linux, Node.js 20, and Node.js 24.
- Added publishing and security docs that keep package publishing as an explicit
  maintainer action outside the ForgeDesk CLI.

### Tests

- Kept the full typecheck, unit/integration test, build, smoke, pack, and npm
  dry-run release gates for package validation.

### Boundaries

- Still not published to npm in this version.
- No AI provider calls, Web UI, cloud sync, background automation, plugin
  system, automatic code fixing, automatic commit, push, PR, tag, release, or
  npm publish behavior inside ForgeDesk.

## v0.2.1 - 2026-06-12

Run-button UX polish for the local auto-capture workflow.

### Improved

- Added concise summaries and copyable command suggestions to `forgedesk next`
  output and `forgedesk next --json` reports.
- Improved blocked `next` guidance so failed-test readiness blockers point to
  `forgedesk fix-context` before rerunning the local button.
- Documented the human-readable `next` output shape in the command reference.

### Tests

- Extended CLI integration coverage for `next` summaries, command suggestions,
  dry-run previews, and failed-test blocker guidance.

### Boundaries

- Still source-only and not published to npm.
- No AI provider calls, Web UI, cloud sync, background automation, plugin
  system, automatic code fixing, automatic commit, push, PR, tag, release, or
  npm publish behavior inside ForgeDesk.

## v0.2.0 - 2026-06-12

Release prep for the local auto-capture and run-button workflow.

### Added

- Added `forgedesk next` as a safe local run button that auto-captures,
  generates evidence, checks readiness, or exports one step at a time.
- Added `forgedesk next --dry-run` to preview the next local step without
  writing `.forgedesk/` files.
- Added `forgedesk auto --no-run` for local auto-capture of dirty git changes.
- Added `forgedesk review-context` and `forgedesk pr` print/copy exits for
  review context and PR body handoff.
- Added `forgedesk fix-context` for bounded failed-test repair context.

### Improved

- Generated `SUMMARY.md`, `PR_BODY.md`, `REVIEW_CONTEXT.md`, and
  `TEST_EVIDENCE.md` alongside the existing evidence pack.
- Added rule-derived local risk hints with explicit source labels.
- Updated README, command docs, boundaries, and roadmap around the automatic
  local workflow.

### Tests

- Added integration coverage for `next`, `next --dry-run`, auto-capture,
  review/PR exits, and fix-context behavior.
- Added focused unit coverage for risk rules, clipboard, review output, and
  fix-context rendering.

### Boundaries

- Still source-only and not published to npm.
- No AI provider calls, Web UI, cloud sync, background automation, plugin
  system, automatic code fixing, automatic commit, push, PR, tag, release, or
  npm publish behavior inside ForgeDesk.

## v0.1.4 - 2026-06-11

Release prep for v0.2 maintainability hardening after v0.1.3.

### Improved

- Shared timestamp and id generation helpers across session and test-runner
  flows.
- Simplified metadata validation, format rendering helpers, and workspace
  discovery/session-resolution internals without changing CLI behavior.
- Updated the roadmap after closing the completed v0.2 direct unit-test item.

### Tests

- Added direct unit coverage for metadata validation, format helpers, workspace
  lookup/session resolution, and lightly covered evidence templates.

### Boundaries

- Still source-only and not published to npm.
- No AI provider calls, Web UI, cloud sync, background automation, plugin
  system, automatic commit, push, PR, tag, release, or npm publish behavior.

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
