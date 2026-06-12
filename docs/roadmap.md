# Roadmap

This roadmap is a planning reference, not a commitment list.

ForgeDesk v0.1.4 is a local CLI MVP for evidence-first AI-assisted code
changes. The next direction is local auto-capture: reducing manual evidence
work while keeping ForgeDesk out of AI review, cloud sync, and irreversible
automation.

## Now: v0.2 Auto Capture

Turn the manual evidence workflow into a one-command local capture experience.

- Make `forgedesk auto` the primary entry point for local changes.
- Automatically create or reuse a session for the current git diff.
- Generate draft title/intent, changed-file summary, risk hints, `SUMMARY.md`,
  `PR_BODY.md`, `REVIEW_CONTEXT.md`, `TEST_EVIDENCE.md`, and the existing
  evidence pack.
- Keep manual commands available as advanced controls.
- Keep GitHub releases source-only until npm publishing is intentionally prepared.

## Next: v0.3 Review Context Relief

Reduce the friction of handing ForgeDesk material to humans or AI reviewers.

- Generate bounded fix context when tests fail.
- Improve PR body and review context templates.
- Consider saving externally produced review notes back into a local session.

## Later: v0.4 Workflow Integration

Embed ForgeDesk into existing local and PR workflows without becoming a platform.

- Consider optional git hooks.
- Add CI checks for evidence completeness.
- Consider Windows, macOS, Linux, and Node.js CI matrices.
- Define an Evidence Pack JSON schema for local tool interoperability.

## Future: v0.5+ Optional Ecosystem

Only move here after the local auto-capture workflow is boringly reliable.

- Prepare npm publishing with package metadata, security docs, and release
  checks.
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

For v0.1.x and v0.2, avoid:

- Web dashboards or task boards.
- AI provider calls.
- AI code reviewer, automatic bug finder, or security scanner positioning.
- API key storage.
- Cloud sync or upload.
- Automatic commit, push, PR, tag, release, or npm publish behavior.
- Background automation.
