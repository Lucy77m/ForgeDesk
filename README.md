# ForgeDesk

ForgeDesk is a local auto-capture layer for AI-assisted code changes.

AI coding tools can write code fast, but the resulting changes are often hard to review:
What was the intent? What files changed? What tests ran? What risks remain?

ForgeDesk captures local git changes and prepares review-ready material:
summary, PR body, test evidence, risk hints, review context, failed-test fix
context, and an evidence pack.

Generated review material includes reviewer checklists, known limits, suggested
review order, and local follow-up commands where useful.

It does not review code for you. It prepares the material before humans or AI
reviewers inspect the change.

## Install

ForgeDesk is an early local MVP published to npm.

Install the CLI:

```bash
npm install -g forgedesk
forgedesk --help
```

Or try it from a local checkout:

```bash
git clone https://github.com/Lucy77m/ForgeDesk.git
cd ForgeDesk
pnpm install
pnpm build
node dist/cli/index.js --help
```

## Quick Start

After installing from npm, run `forgedesk` directly. From a local checkout, use
`node dist/cli/index.js` after `pnpm build`.

```bash
echo "Local change" >> README.md
forgedesk setup
forgedesk next --dry-run
forgedesk next
```

`forgedesk setup` is the first-run local setup button. It initializes
ForgeDesk when needed, sets the safe advisory `assist` profile, refreshes
`NOW.md`, and repairs editor shortcuts.

`forgedesk next` is the daily local run button. It auto-captures local changes,
generates or refreshes evidence, checks readiness, and exports ready evidence
one safe step at a time.

Decision tree:

- Just starting: `forgedesk setup`
- Have local changes: `forgedesk next`
- Not sure what state you are in: `forgedesk doctor` or `forgedesk episodes status`
- Tests failed: `forgedesk fix-context`
- Ready to hand off: `forgedesk open export`

Set the local automation profile before using hooks or watch mode:

```bash
forgedesk auto-config
forgedesk auto-config set assist
forgedesk hooks install
forgedesk hooks status
forgedesk watch
forgedesk watch --quiet
forgedesk ignition install
forgedesk now
forgedesk episodes status
forgedesk repair
forgedesk tests discover
forgedesk shortcuts install
forgedesk shortcuts install --test-tasks
forgedesk ci print
```

Auto profiles are explicit local controls. They do not enable AI calls, product
code edits, commits, pushes, PRs, releases, publishes, uploads, or hidden
background services.

## Output

```text
.forgedesk/evidence/<session-id>/
|-- PR_EVIDENCE.md
|-- SUMMARY.md
|-- PR_BODY.md
|-- REVIEW_CONTEXT.md
|-- TEST_EVIDENCE.md
|-- CHANGE_SUMMARY.md
|-- TEST_RESULTS.md
|-- REVIEW_PROMPT.md
|-- evidence.json
```

## Dogfood Example

ForgeDesk is used on its own repository. A typical dogfood session captures a
local change with `forgedesk next`, records `pnpm typecheck`, `pnpm test`, and
`pnpm build`, then uses `forgedesk next` again to generate, check, and export
review-ready material.

The goal is not to prove the code is perfect. The goal is to make the change
intent, changed files, test evidence, and remaining risks easy to inspect.

## Commands

```bash
forgedesk init --repo .
forgedesk setup
forgedesk next --dry-run
forgedesk next
forgedesk auto --no-run
forgedesk auto-config
forgedesk auto-config set assist
forgedesk hooks install
forgedesk hooks status
forgedesk hooks uninstall
forgedesk watch
forgedesk watch --once
forgedesk watch --quiet
forgedesk ignition install
forgedesk ignition status
forgedesk ignition uninstall
forgedesk now
forgedesk episodes status
forgedesk repair
forgedesk tests discover
forgedesk shortcuts install
forgedesk shortcuts install --test-tasks
forgedesk shortcuts status
forgedesk shortcuts uninstall
forgedesk ci check
forgedesk ci print
forgedesk ci init
forgedesk review-context
forgedesk pr
forgedesk fix-context
forgedesk open
forgedesk open now
forgedesk open evidence
forgedesk open export
forgedesk open review-context
forgedesk open pr
forgedesk start --title "Describe the change"
forgedesk intent "Record the user-facing goal."
forgedesk decision "Record an implementation decision."
forgedesk risk "Record a risk or review focus."
forgedesk check "Record a manual verification check."
forgedesk test -- npm test
forgedesk evidence
forgedesk ready
forgedesk handoff
forgedesk export
forgedesk inspect --export
```

See [docs/commands.md](docs/commands.md) for the full command reference.

## What ForgeDesk Does

- Reads local git status and changed files.
- Sets up the local run-button workflow with one explicit command.
- Auto-captures local change context.
- Records change intent, decisions, risks, and tests.
- Generates summaries, PR body, review context, risk hints, fix context, and evidence files.
- Summarizes the current local work episode and next safe action.
- Repairs safe local ForgeDesk entry points when editor shortcuts or NOW drift.

## What ForgeDesk Does Not Do

- It does not write code.
- It does not review code for you.
- It does not act as an AI code reviewer or security scanner.
- It does not call an AI provider by default.
- It does not commit, push, open PRs, or publish releases.
- It does not upload your project.

See [docs/boundaries.md](docs/boundaries.md) for the product boundary contract.
See [docs/commands.md](docs/commands.md) for all CLI commands and side effects.
See [docs/run-button.md](docs/run-button.md) for the v0.3 local run-button
workflow.
See [docs/reviewer-guide.md](docs/reviewer-guide.md) for how to inspect an
evidence pack.
See [docs/local-workflow.md](docs/local-workflow.md) for a local demo workflow.
See [docs/troubleshooting.md](docs/troubleshooting.md) for common local errors
and fixes.
See [docs/roadmap.md](docs/roadmap.md) for the long-term planning reference.
See [CHANGELOG.md](CHANGELOG.md) for local source version notes.

## Project Status

ForgeDesk v0.5.1 is prepared as a GitHub source release for the setup-first
local autopilot workflow. The npm package remains at v0.2.3 until the next
explicit npm publish.

## Development

The published CLI supports Node.js 20 and newer. Local development uses
`pnpm@11.1.3`, which requires Node.js 22.13 or newer.

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm smoke
pnpm package-smoke
```

Run the CLI from source during development:

```bash
pnpm dev -- --help
pnpm dev -- init --repo .
```

Run the compiled CLI after building:

```bash
node dist/cli/index.js --help
```

Check the package contents without publishing:

```bash
pnpm pack --pack-destination <temp-dir>
npm publish --dry-run
```

See [docs/publishing.md](docs/publishing.md) for the release checklist and npm
publishing boundary.
