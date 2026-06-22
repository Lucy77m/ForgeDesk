# ForgeDesk API Contract

From v1.0.0 onward, ForgeDesk follows these stability commitments for all
structured output.

## Semver for JSON Output

All `--json` output schemas follow semantic versioning:

- **Patch** (v1.x.y): Bug fixes, no schema changes.
- **Minor** (v1.x.0): New optional fields may be added. Existing fields are
  never removed or renamed. Consumers that ignore unknown fields will not break.
- **Major** (v2.0.0): Fields may be removed, renamed, or have their types
  changed.

## Frozen Schema Versions

The following `schemaVersion` values are frozen as of v1.0.0. They will not
change within the v1.x line:

| Schema Version | Used By |
|---|---|
| `forgedesk-evidence-v1` | evidence.json |
| `forgedesk-session-v1` | Session JSON files |
| `forgedesk-project-v1` | project.json |
| `forgedesk-config-v1` | config.json |
| `forgedesk-auto-config-v1` | auto.json |
| `forgedesk-handoff-v1` | `forgedesk handoff --json` |
| `forgedesk-export-v1` | `forgedesk export --json` |
| `forgedesk-ready-v1` | `forgedesk ready --json` |
| `forgedesk-next-v1` | `forgedesk next --json` |
| `forgedesk-doctor-v1` | `forgedesk doctor --json` |
| `forgedesk-now-v1` | `forgedesk now --json` |
| `forgedesk-context-v1` | `forgedesk context --json` |
| `forgedesk-ci-check-v1` | `forgedesk ci check --json` |
| `forgedesk-ci-validate-v1` | `forgedesk ci validate --json` |
| `forgedesk-templates-v1` | `forgedesk templates --json` |
| `forgedesk-rules-v1` | rules.json |
| `forgedesk-inspect-v1` | `forgedesk inspect --json` |
| `forgedesk-watch-v1` | `forgedesk watch --json` |
| `forgedesk-repair-v1` | `forgedesk repair --json` |
| `forgedesk-setup-v1` | `forgedesk setup --json` |
| `forgedesk-auto-v1` | `forgedesk auto --json` |
| `forgedesk-test-discovery-v1` | `forgedesk tests discover --json` |
| `forgedesk-episode-status-v1` | `forgedesk episodes status --json` |
| `forgedesk-evidence-score` | Evidence Score in doctor/now/next reports |

## What This Means For Consumers

- You can safely parse any `--json` output and rely on known fields.
- New fields may appear in minor versions — use lenient parsing.
- `schemaVersion` values are stable identifiers for the lifetime of v1.x.
- Breaking changes will be clearly announced with a major version bump.

## What Is Not Covered

- Human-readable console output format may change in minor versions.
- CLI command names and options are stable but may gain new options in minor
  versions.
- The `.forgedesk/` directory structure may gain new files in minor versions.
