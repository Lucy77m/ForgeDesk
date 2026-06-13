# Roadmap

This roadmap is a planning reference, not a commitment list.

ForgeDesk v0.4.6 is a local autopilot CLI with explicit auto profiles, optional
repository git hooks, foreground watch mode, ignition folder-open tasks, editor
shortcuts, opt-in test button discovery, local episode status, safe local repair, quiet watch output, `.forgedesk/NOW.md`, and an optional CI evidence gate for evidence-first AI-assisted code changes. The current
direction is to make local workflow steps easier to preview, execute, diagnose,
gate, and hand off while keeping ForgeDesk out of AI review, cloud sync, hidden
background automation, and irreversible automation.

## Now: v0.3 Run Button Milestone

Make the automatic local workflow boringly reliable and easier for humans.

- Make `forgedesk next` the primary run button for safe local workflow steps.
- Support `forgedesk next --dry-run` as a safe button preview.
- Detect stale evidence with local diff fingerprints before export.
- Explain `forgedesk next` decisions with stable reasons and one recommended
  next step.
- Keep `forgedesk auto` as the explicit entry point for local change capture.
- Automatically create or reuse a session for the current git diff.
- Generate bounded fix context when tests fail.
- Generate draft title/intent, changed-file summary, risk hints, `SUMMARY.md`,
  `PR_BODY.md`, `REVIEW_CONTEXT.md`, `TEST_EVIDENCE.md`, and the existing
  evidence pack.
- Continue improving bounded log handling, fix-context quality, and dogfood
  coverage.
- Keep npm publishing intentional, verified, and separate from ForgeDesk product
  behavior.
- Validate packaged CLI installs with local package smoke before release.
- Make `forgedesk doctor` a clearer troubleshooting button for local session,
  evidence freshness, and verification state.
- Improve review and handoff output so generated Markdown can go to reviewers
  with less manual rearranging.
- Use `forgedesk auto-config` as the shared safety profile for local hooks,
  watch mode, and CI evidence gates.
- Support optional repository git hooks for advisory, local-auto, or guarded
  evidence checks.
- Support foreground watch mode for users who want ForgeDesk to keep the next
  local step visible without becoming a daemon.
- Keep watch usable as an editor task with compact quiet output.
- Support local ignition tasks so opening the project can start watch after the
  editor's automatic-task approval.
- Keep `.forgedesk/NOW.md` as the fixed local status entry for humans and AI
  continuation windows.
- Generate editor shortcuts so common ForgeDesk buttons can be clicked from VS
  Code without memorizing commands.
- Discover common package test scripts and generate opt-in editor test buttons
  that record explicit test runs through ForgeDesk.
- Summarize the current local work episode so users can see whether the change
  needs evidence, verification, export, or a new session.
- Repair safe local ForgeDesk entry points with one command when editor
  shortcuts or NOW drift.
- Generate optional CI evidence gates for repositories that want evidence
  completeness and readiness checked before merge.

## Next: v0.3.x Review Context Relief

Reduce the friction of handing ForgeDesk material to humans or AI reviewers.

- Keep improving PR body, review context, and handoff templates from dogfood.
- Consider lightweight local review-note capture after external review.
- Consider saving externally produced review notes back into a local session.

## Later: v0.4.x Workflow Integration Polish

Embed ForgeDesk into existing local and PR workflows without becoming a platform.

- Improve CI gate setup docs for npm-published and source-checkout installs.
- Explore PR-diff-aware freshness checks without uploading code or calling AI.
- Define an Evidence Pack JSON schema for local tool interoperability.

## Future: v0.5+ Optional Ecosystem

Only move here after the local auto-capture workflow is boringly reliable.

- Explore static HTML summaries, local timelines, optional rules config, IDE
  integrations, or optional provider review.

## Ideas Parking Lot

These ideas may be useful, but they should not drive near-term scope.

- Evidence scoring based on transparent local completeness rules.
- Workflow templates for bug fixes, features, and dependency upgrades.
- Static HTML evidence timeline export.
- Local evidence rules such as `.forgedesk/rules.json`.
- Plugin-style extension points.

## Guardrails

For v0.1.x, v0.2, and v0.3, avoid:

- Web dashboards or task boards.
- AI provider calls.
- AI code reviewer, automatic bug finder, or security scanner positioning.
- API key storage.
- Cloud sync or upload.
- Automatic commit, push, PR, tag, release, or npm publish behavior.
- Background automation.
