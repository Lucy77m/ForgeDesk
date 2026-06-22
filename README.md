# ForgeDesk

AI coding tools write code fast. But when it's time to review: what was the intent? what files changed? did tests pass? what risks remain?

ForgeDesk captures your local git changes and prepares review-ready material — summary, PR body, test evidence, risk hints, review context. You get a folder of structured files that can go straight into a PR or handoff.

It does not review code for you. It prepares the material so humans (or AI reviewers) can inspect the change faster.

## Install

```bash
npm install -g forgedesk
```

## Quick Start

```bash
forgedesk setup       # first time: initialize and configure
forgedesk next        # daily: auto-capture changes and generate evidence
```

That's it. `forgedesk next` runs one safe step at a time — capture, generate evidence, check readiness, export. Run it again after making changes or recording tests.

## Typical Workflow

```bash
forgedesk setup                        # one-time setup
# ... make code changes, run your tests ...
forgedesk test -- npm test             # record test results
forgedesk next                         # auto-capture → evidence → export
```

After `forgedesk next` finishes, your PR body, review context, and evidence pack are ready in `.forgedesk/exports/`.

## What You Get

```
.forgedesk/evidence/<session>/
├── SUMMARY.md           # change summary
├── PR_BODY.md           # ready to paste into a PR
├── REVIEW_CONTEXT.md    # structured context for reviewers
├── TEST_EVIDENCE.md     # test results summary
├── PR_EVIDENCE.md       # decisions, risks, manual checks
├── evidence.json        # machine-readable evidence pack
└── ...
```

## Common Commands

| Command | What it does |
|---|---|
| `forgedesk setup` | First-time setup |
| `forgedesk next` | Run the next safe step |
| `forgedesk doctor` | Check project health |
| `forgedesk context` | Generate AI-friendly context file |
| `forgedesk rules --preset security` | Install security risk rules |
| `forgedesk templates --init` | Generate customizable templates |

See [docs/commands.md](docs/commands.md) for the full command reference.

## Features

- **Auto-capture**: Reads your git diff and captures changed files, branch, commits
- **Evidence generation**: Produces structured Markdown and JSON evidence packs
- **Risk detection**: Flags auth, payment, config, database changes; detects hardcoded secrets and eval usage in diffs
- **Evidence Score**: Deterministic 0-7 quality metric for readiness
- **Configurable rules**: Add custom risk rules via `.forgedesk/rules.json` or install presets
- **Custom templates**: Override PR body, summary, and review context templates with your own
- **Workspace support**: Discovers test scripts across pnpm workspace packages
- **CI gate**: `forgedesk ci check` and `forgedesk ci validate` for CI pipelines

## What ForgeDesk Does NOT Do

- No AI calls — ForgeDesk does not call any AI provider
- No code review — it prepares material, not verdicts
- No auto-commit/push/PR — all git actions are explicit
- No cloud sync — everything stays local
- No background services — runs on demand

## Documentation

- [Command Reference](docs/commands.md) — all CLI commands and options
- [API Contract](docs/api-contract.md) — JSON schema stability guarantees
- [Evidence Schema](docs/schema/evidence-v1.json) — evidence.json JSON Schema
- [Reviewer Guide](docs/reviewer-guide.md) — how to inspect an evidence pack
- [Troubleshooting](docs/troubleshooting.md) — common errors and fixes
- [Roadmap](docs/roadmap.md) — planning reference

## Project Status

ForgeDesk v1.0.0 is the stable release. All `--json` output schemas are frozen under semver.

## Development

Requires Node.js 20+. Local development uses pnpm:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm smoke
```

See [docs/publishing.md](docs/publishing.md) for the release checklist.
