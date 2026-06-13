# Changelog

All notable ForgeDesk changes are tracked here.

Version entries describe source, GitHub release, and npm publishing state.

## v0.3.2 - 2026-06-13

Optional local git hooks for the auto-profile workflow.

### Added

- Added `forgedesk hooks status` to inspect local ForgeDesk-managed hook state.
- Added `forgedesk hooks install` and `forgedesk hooks uninstall` for
  repository-local `pre-commit` and `pre-push` hooks.
- Added `forgedesk hooks run <hook>` as the local runner used by installed
  hooks.

### Improved

- Hooks follow the configured auto profile:
  - `manual` keeps installed hooks idle.
  - `assist` warns without blocking.
  - `local-auto` may run one safe local `forgedesk next` step.
  - `guarded` may block commit or push when evidence is missing, stale, or not ready.
- Hook installation refuses to overwrite hooks not managed by ForgeDesk.

### Tests

- Added hook integration tests for install/status/uninstall, unmanaged-hook
  refusal, `assist`, `local-auto`, `guarded`, and unknown hook names.

### Publishing

- GitHub source release only.
- No npm publish in this version.

### Boundaries

- Hooks are explicit, local, inspectable, and removable. They do not call AI,
  edit product code, run tests, commit, push, open PRs, tag, release, publish,
  upload, or run as hidden background services.

## v0.3.1 - 2026-06-13

Auto-profile foundation for explicit local automation.

### Added

- Added `forgedesk auto-config` to show the repository automation profile.
- Added `forgedesk auto-config set <mode>` with `manual`, `assist`,
  `local-auto`, and `guarded` modes.
- Added `.forgedesk/auto.json` as the local, inspectable auto-profile file used
  by future hooks, watch mode, and CI evidence gates.

### Improved

- `forgedesk doctor` now reports the active auto profile.
- Updated boundaries and run-button docs to distinguish hidden background
  automation from explicit opt-in local automation surfaces.

### Tests

- Added direct auto-config validation tests and CLI coverage for showing,
  setting, and diagnosing the local auto profile.

### Publishing

- GitHub source release only.
- No npm publish in this version.

### Boundaries

- Auto profiles do not call AI, edit product code, run tests, commit, push,
  open PRs, tag, release, publish, upload, or start hidden background services.

## v0.3.0 - 2026-06-13

Local run-button milestone release.

### Improved

- Marked the v0.3 line as the local run-button workflow: `forgedesk next` is
  the primary safe step runner, with `doctor`, `fix-context`, review outputs,
  handoff, export, and inspect as supporting local buttons.
- Added `docs/run-button.md` as the focused guide for the v0.3 workflow and
  boundary.
- Updated README and roadmap status around the run-button milestone and the
  next v0.3.x review-context direction.

### Tests

- Kept the full typecheck, unit/integration test, build, smoke, package-smoke,
  version, pack, and ForgeDesk dogfood gates.

### Publishing

- GitHub source release only.
- No npm publish in this version.

### Boundaries

- The run button remains local, deterministic, and user-invoked. It does not
  call AI, edit product code, run tests unless explicitly requested, commit,
  push, open PRs, tag, release, publish, upload, or run in the background.
- No AI provider calls, Web UI, cloud sync, background automation, plugin
  system, automatic code fixing, automatic commit, push, PR, tag, release, or
  npm publish behavior inside ForgeDesk.

## v0.2.9 - 2026-06-13

Review and handoff output polish.

### Improved

- Added reviewer checklist and known-limits sections to generated `PR_BODY.md`.
- Added at-a-glance metadata, reviewer checklist, and known-limits sections to
  generated `REVIEW_CONTEXT.md`.
- Added suggested review order and local follow-up commands to handoff reports
  and exported `HANDOFF.md`.

### Tests

- Extended template tests for the new review-context and PR-body sections.
- Extended handoff integration coverage for suggested review order and command
  output.

### Publishing

- GitHub source release only.
- No npm publish in this version.

### Boundaries

- Output polish remains local Markdown generation. ForgeDesk still does not call
  AI, decide correctness, modify product code, commit, push, open PRs, tag,
  release, or publish.
- No AI provider calls, Web UI, cloud sync, background automation, plugin
  system, automatic code fixing, automatic commit, push, PR, tag, release, or
  npm publish behavior inside ForgeDesk.

## v0.2.8 - 2026-06-13

Doctor and troubleshooting polish for the local run-button workflow.

### Improved

- Added a `recommendation` to `forgedesk doctor` reports so the command points
  to the next useful local action instead of only listing checks.
- Added active-session diagnostics for missing evidence, stale evidence,
  missing verification, and failed tests.
- Reused the same evidence freshness helper from `forgedesk next`, so doctor
  and next agree on whether the evidence pack matches the current local diff.

### Tests

- Extended doctor integration coverage for healthy evidence, stale evidence,
  and missing evidence files.

### Publishing

- GitHub source release only.
- No npm publish in this version.

### Boundaries

- Doctor remains a local read-only diagnostic command. It does not call AI,
  modify product code, run tests, commit, push, open PRs, tag, release, or
  publish.
- No AI provider calls, Web UI, cloud sync, background automation, plugin
  system, automatic code fixing, automatic commit, push, PR, tag, release, or
  npm publish behavior inside ForgeDesk.

## v0.2.7 - 2026-06-13

Install and runtime hardening for packaged ForgeDesk builds.

### Improved

- Added `pnpm package-smoke`, which packs ForgeDesk, installs the generated
  tarball into a temporary npm project, verifies the installed `forgedesk`
  version, and runs `forgedesk next --dry-run --json` in a temporary git repo.
- Added the package smoke check to CI after the existing pack step.
- Documented package smoke as part of maintainer preflight validation.

### Tests

- Kept the full typecheck, unit/integration test, build, smoke, pack, and
  package-install smoke gates.

### Publishing

- GitHub source release only.
- No npm publish in this version.

### Boundaries

- Package smoke validates the ForgeDesk package locally; it does not publish,
  upload, tag, release, or store credentials.
- No AI provider calls, Web UI, cloud sync, background automation, plugin
  system, automatic code fixing, automatic commit, push, PR, tag, release, or
  npm publish behavior inside ForgeDesk.

## v0.2.6 - 2026-06-13

Run-button UX polish for clearer next-step decisions.

### Improved

- Added a stable `reason` field to `forgedesk next --json` reports so local
  tools and humans can distinguish dirty capture, missing evidence, stale
  evidence, missing tests, failed tests, ready export, and completed export.
- Added a `recommendation` field to `forgedesk next --json` and surfaced the
  same recommendation near the top of human-readable `next` output.
- Updated blocked and export output to show `Reason` and `Recommended next`
  before the detailed sections, reducing the "what now?" scan cost.

### Tests

- Extended integration coverage for `next` reason and recommendation values
  across auto-capture, stale evidence, failed tests, export preview, and export.

### Publishing

- GitHub source release only.
- No npm publish in this version.

### Boundaries

- No AI provider calls, Web UI, cloud sync, background automation, plugin
  system, automatic code fixing, automatic commit, push, PR, tag, release, or
  npm publish behavior inside ForgeDesk.

## v0.2.5 - 2026-06-13

Evidence freshness hardening for the local run-button workflow.

### Improved

- Added a local diff fingerprint to new git snapshots so ForgeDesk can detect
  stale evidence when tracked file contents change without changing the file
  list.
- Updated `forgedesk next` and `forgedesk next --dry-run` to refresh stale
  evidence instead of exporting an evidence pack for an older local diff.
- Added `evidenceFresh` to `forgedesk next --json` reports when freshness is
  relevant.
- Included the local shared-helper maintenance hardening from the post-v0.2.3
  development branch: shared CLI list rendering, internal error codes, direct
  git parser tests, and local workflow doc cleanup.

### Tests

- Added coverage for same-file content changes triggering evidence refresh.
- Added direct tests for git status parsing, diff fingerprints, and internal
  error-code matching.

### Publishing

- GitHub source release only.
- No npm publish in this version.

### Boundaries

- No AI provider calls, Web UI, cloud sync, background automation, plugin
  system, automatic code fixing, automatic commit, push, PR, tag, release, or
  npm publish behavior inside ForgeDesk.

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
