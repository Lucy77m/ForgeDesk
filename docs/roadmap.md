# Roadmap

This roadmap is a planning reference, not a commitment list.

ForgeDesk v0.1.3 is a local CLI MVP for evidence-first AI-assisted code
changes. Future work should keep that boundary clear unless the project
explicitly changes scope.

## Now: v0.1.x Local Hardening

Focus on reliability, maintainability, and clearer local workflows.

- Extract shared helpers for timestamps and id generation where this reduces
  real repetition.
- Keep GitHub releases source-only until npm publishing is intentionally
  prepared.

## Next: v0.2 Maintainability

Improve the codebase without changing the product shape.

- Add direct unit tests for `metadata.ts`, `format.ts`, workspace lookup, and
  currently lightly covered templates.
- Consider lightweight coverage reporting after the unit-test shape is clearer.
- Consider a CI matrix for Windows, macOS, and supported Node.js versions after
  smoke is stable in CI.
- Add `CONTRIBUTING.md` and a concise architecture overview if external
  contribution becomes likely.

## Later: v0.3 Evidence Value

Add features that make evidence more useful to reviewers while staying local.

- Capture `git diff --stat` and optionally a bounded diff excerpt in evidence.
- Add an AI-friendly context export that users can paste into their chosen
  reviewer without ForgeDesk calling any AI provider.
- Add local project statistics such as session counts, evidence coverage, and
  test pass rate.
- Explore session search over local evidence and session metadata.
- Explore a session timeline based on existing timestamps.

## Future: v0.4+ Ecosystem

Only move here after the local CLI workflow is boringly reliable.

- Prepare npm publishing with package metadata, security docs, and release
  checks.
- Define an Evidence Pack JSON schema so other local tools can read ForgeDesk
  output.
- Generate PR description templates from evidence packs.
- Explore optional git hook integration.

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
- API key storage.
- Cloud sync or upload.
- Automatic commit, push, PR, tag, release, or npm publish behavior.
- Background automation.
