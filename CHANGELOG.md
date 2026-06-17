# Changelog

All notable ForgeDesk changes are tracked here.

Version entries describe source, GitHub release, and npm publishing state.

## v0.5.1 - 2026-06-13

Open and first-time friction polish.

### Added

- Added `forgedesk open` as a local file/folder opener for existing ForgeDesk
  outputs.
- Added targets for `now`, `evidence`, `export`, `review-context`, and `pr`.
- Added injectable opener coverage so tests do not launch real desktop apps.

### Improved

- README now includes a first-decision tree for setup, local changes, status,
  failed tests, and handoff.
- Project `AGENTS.md` now reflects the setup-first v0.5 local autopilot
  direction instead of the old v0.1 evidence-pack framing.
- Added a first-time walkthrough integration test through setup, next, test,
  export, open-path validation, and inspect.

### Publishing

- GitHub source release preparation only.
- No npm publish in this version. The npm package remains at v0.2.3 until the
  next explicit npm publish.

### Boundaries

- `open` only opens existing local files or directories with the system opener.
  It does not generate evidence, call AI, edit product code, commit, push, open
  PRs, tag, release, publish, upload, or run in the background.

## v0.5.0 - 2026-06-13

Local autopilot setup milestone.

### Added

- Added `forgedesk setup` as a setup-first entry point for the local run-button
  workflow.
- Added `forgedesk setup --mode <mode>` to initialize the local auto profile,
  defaulting to safe advisory `assist`.
- Added `forgedesk setup --test-tasks` and `forgedesk setup --package-scripts`
  to opt into additional local shortcuts during setup.
- Added explicit `forgedesk setup --ignition` and `forgedesk setup --hooks`
  flags for stronger local automation entry points.
- Added `forgedesk setup --json` with the `forgedesk-setup-v1` report.

### Improved

- Setup initializes ForgeDesk in a git repo when needed, sets the auto profile,
  refreshes NOW, repairs safe shortcuts, and reports the next local actions in
  one pass.
- The v0.5 docs now present `setup -> next -> test button -> next` as the main
  low-friction workflow.

### Tests

- Added setup coverage for first-run initialization, safe default repair,
  optional test tasks, explicit ignition, and explicit hooks.

### Publishing

- GitHub source release only.
- No npm publish in this version. The npm package remains at v0.2.3 until the
  next explicit npm publish.

### Boundaries

- Setup is an explicit local command. It does not call AI, edit product code,
  run tests, commit, push, open PRs, tag, release, publish, upload, or install
  hooks/ignition unless those flags are explicitly used.

## v0.4.6 - 2026-06-13

Quiet watch output for editor-run autopilot.

### Added

- Added `forgedesk watch --quiet` for compact human-readable watch output.

### Improved

- `forgedesk ignition install` now starts `forgedesk watch --quiet`.
- Generated `ForgeDesk: Watch` editor shortcuts now run `forgedesk watch
  --quiet`.
- Quiet mode preserves the same watch state machine and JSON output; it only
  reduces terminal noise for human-readable foreground watch output.

### Tests

- Added quiet watch coverage and updated ignition/shortcut task assertions.
- Increased the Vitest timeout for slower Windows CI integration runs.

### Publishing

- GitHub source release only.
- No npm publish in this version.

### Boundaries

- Quiet watch remains a foreground local process. It does not install a daemon,
  call AI, edit product code, run tests, commit, push, open PRs, tag, release,
  publish, upload, or run as a hidden background service.

## v0.4.5 - 2026-06-13

Safe local repair for ForgeDesk entry points.

### Added

- Added `forgedesk repair` to refresh `.forgedesk/NOW.md`, repair safe editor
  shortcuts, and report stronger opt-in entry points.
- Added `forgedesk repair --test-tasks` to also repair discovered package test
  tasks.
- Added `forgedesk repair --package-scripts` to also repair ForgeDesk package
  scripts.
- Added `forgedesk repair --json` with the `forgedesk-repair-v1` report.

### Improved

- Repair checks auto profile, NOW, shortcuts, ignition, and hooks in one local
  pass.
- Default repair does not install hooks or ignition; it suggests the explicit
  commands for those stronger opt-ins instead.

### Tests

- Added repair coverage for default NOW/shortcut repair, optional test-task
  repair, and unmanaged editor-task refusal.

### Publishing

- GitHub source release only.
- No npm publish in this version.

### Boundaries

- Repair only touches local ForgeDesk setup files such as NOW and explicit
  shortcuts by default. It does not call AI, edit product code, run tests,
  commit, push, open PRs, tag, release, publish, upload, or install
  hooks/ignition unless those explicit commands are run separately.

## v0.4.4 - 2026-06-13

Local episode status for the current work segment.

### Added

- Added `forgedesk episodes status` to summarize the active local work episode.
- Added `forgedesk episodes status --json` with the
  `forgedesk-episode-status-v1` report.
- Added episode phase and summary lines to `.forgedesk/NOW.md`.

### Improved

- Episode status classifies the active session as `no-active-session`,
  `needs-evidence`, `stale-evidence`, `needs-verification`, `failed-tests`,
  `draft`, `ready`, `exported`, or `done`.
- The report points to the next local action without changing session or
  evidence schema.

### Tests

- Added episode coverage for no active session, needs-evidence, ready,
  exported, and stale-evidence phases.

### Publishing

- GitHub source release only.
- No npm publish in this version.

### Boundaries

- Episodes are local status summaries over existing sessions. They do not add a
  task board, timeline, AI review, code edits, commits, pushes, PRs, releases,
  publishes, uploads, or background services.

## v0.4.3 - 2026-06-13

Test button discovery for editor shortcuts.

### Added

- Added `forgedesk tests discover` to find common package scripts without
  running them.
- Added `forgedesk tests discover --json` for structured local discovery.
- Added `forgedesk shortcuts install --test-tasks` to generate VS Code tasks
  such as `ForgeDesk Test: test` and `ForgeDesk Test: typecheck`.
- Added matching `shortcuts status --test-tasks` and
  `shortcuts uninstall --test-tasks` support.

### Improved

- Discovered test tasks route through `forgedesk test -- <runner> run <script>`
  so explicit user-triggered test runs are captured as ForgeDesk evidence.

### Tests

- Added test discovery coverage for package-manager detection, missing
  `package.json`, CLI JSON output, and generated editor task arguments.

### Publishing

- GitHub source release only.
- No npm publish in this version.

### Boundaries

- Test discovery does not run tests automatically. Generated tasks are explicit
  local buttons and do not call AI, edit product code, commit, push, open PRs,
  tag, release, publish, upload, or run as hidden background services.

## v0.4.2 - 2026-06-13

`NOW.md` as the fixed local autopilot status entry.

### Added

- Added `forgedesk now` to refresh and print `.forgedesk/NOW.md`.
- Added `forgedesk now --json` for structured status output.
- Added automatic NOW refresh after `next`, `doctor`, `watch --once`, and `ci
  check` when possible.

### Improved

- `NOW.md` summarizes active session, auto mode, readiness, inspect status,
  evidence/review/export paths, blockers, warnings, and next suggested action.

### Tests

- Added NOW integration coverage for manual refresh, `next` refresh, and
  `watch --once` refresh.

### Publishing

- GitHub source release only.
- No npm publish in this version.

### Boundaries

- `NOW.md` is local status, not a review verdict. It does not call AI, edit
  product code, commit, push, open PRs, tag, release, publish, upload, or run as
  a hidden background service.

## v0.4.1 - 2026-06-13

Ignition setup for folder-open local watch mode.

### Added

- Added `forgedesk ignition status`.
- Added `forgedesk ignition install` to create a VS Code/Cursor-compatible
  folder-open task that starts `forgedesk watch`.
- Added `forgedesk ignition uninstall` to remove the ForgeDesk-managed ignition
  task.

### Improved

- Ignition refuses to overwrite unmanaged tasks with the same label.
- Documentation now explains that editors may ask the user to allow automatic
  tasks for the folder.

### Tests

- Added ignition integration coverage for install/status/uninstall,
  `runOptions.runOn = folderOpen`, and unmanaged-task refusal.

### Publishing

- GitHub source release only.
- No npm publish in this version.

### Boundaries

- Ignition is an explicit local editor task. It does not install a daemon, call
  AI, edit product code, commit, push, open PRs, tag, release, publish, upload,
  or run as a hidden background service.

## v0.4.0 - 2026-06-13

Local autopilot milestone with optional CI evidence gates.

### Added

- Added `forgedesk ci check` for CI-friendly evidence readiness checks.
- Added `forgedesk ci print` to print a GitHub Actions evidence gate workflow.
- Added `forgedesk ci init` to write `.github/workflows/forgedesk-evidence.yml`
  when a repository explicitly opts in.

### Improved

- `ci check` verifies evidence presence, expected files, readiness, and dirty
  worktree freshness.
- Clean checkouts report freshness as `skipped-clean-worktree` instead of
  pretending to reconstruct a PR diff fingerprint.
- The roadmap now treats v0.4 as the local autopilot + optional evidence gate
  milestone.

### Tests

- Added CI gate integration coverage for passing ready evidence, missing
  evidence, stale dirty evidence, workflow printing, workflow init, and
  overwrite protection.

### Publishing

- GitHub source release only.
- No npm publish in this version.

### Boundaries

- The CI gate checks local ForgeDesk evidence. It does not call AI, upload
  repository contents, comment on PRs, review code, edit code, commit, push,
  open PRs, tag, release, publish, or cloud sync.

## v0.3.4 - 2026-06-13

Zero-terminal editor shortcuts for the local run-button workflow.

### Added

- Added `forgedesk shortcuts status`.
- Added `forgedesk shortcuts install` and `forgedesk shortcuts uninstall` for
  ForgeDesk-managed VS Code tasks.
- Added optional `--package-scripts` support for installing/removing
  ForgeDesk-managed npm scripts.

### Improved

- Generated VS Code tasks for `Next`, `Next Preview`, `Doctor`, `Watch`, and
  `Inspect Export`.
- Shortcut installation refuses to overwrite unmanaged tasks or package scripts.

### Tests

- Added shortcut integration coverage for install/status/uninstall,
  unmanaged-task refusal, optional package scripts, missing package.json, and
  unmanaged package script refusal.

### Publishing

- GitHub source release only.
- No npm publish in this version.

### Boundaries

- Shortcuts are explicit local entry points for existing ForgeDesk commands.
  They do not call AI, edit product code, commit, push, open PRs, tag, release,
  publish, upload, or run as hidden background services.

## v0.3.3 - 2026-06-13

Foreground watch mode for local run-button automation.

### Added

- Added `forgedesk watch` as a foreground local watch mode.
- Added `forgedesk watch --once` for one-shot checks, tests, and scripts.
- Added `forgedesk watch --interval <ms>` with a minimum 500 ms polling
  interval.

### Improved

- Watch mode follows the auto profile:
  - `manual` stays idle.
  - `assist` previews the next local step without writing files.
  - `local-auto` may run one safe `forgedesk next` step.
  - `guarded` reports blockers without writing files.

### Tests

- Added watch integration coverage for `manual`, `assist`, `local-auto`,
  `guarded`, and invalid interval handling.

### Publishing

- GitHub source release only.
- No npm publish in this version.

### Boundaries

- Watch is a foreground process started by the user and stopped with `Ctrl+C`.
  It is not a daemon, cron job, system service, AI reviewer, code fixer,
  committer, pusher, PR opener, publisher, uploader, or cloud sync process.

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
