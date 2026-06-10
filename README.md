# ForgeDesk

ForgeDesk is a local evidence desk for AI-assisted code changes.

AI coding tools can write code fast, but the resulting changes are often hard to review:
What was the intent? What files changed? What tests ran? What risks remain?

ForgeDesk helps you turn a local git diff into a reviewable evidence pack.

## Install

ForgeDesk is an early local MVP. It is not published to npm yet.

Try it from a local checkout:

```bash
git clone https://github.com/Lucy77m/ForgeDesk.git
cd ForgeDesk
pnpm install
pnpm build
node dist/cli/index.js --help
```

## Quick Start

After building from a local checkout, replace `forgedesk` with
`node dist/cli/index.js` until the package is published.

```bash
forgedesk init --repo .
forgedesk start --title "Fix OAuth redirect"
forgedesk intent "Return users to the original page after login."
forgedesk decision "Keep the redirect target in signed state."
forgedesk risk "Malformed redirect state needs review."
forgedesk test -- npm test
forgedesk evidence
```

## Output

```text
.forgedesk/evidence/<session-id>/
|-- PR_EVIDENCE.md
|-- CHANGE_SUMMARY.md
|-- TEST_RESULTS.md
|-- REVIEW_PROMPT.md
`-- evidence.json
```

## Dogfood Example

ForgeDesk is used on its own repository. A typical dogfood session records a
small local change, captures `pnpm typecheck`, `pnpm test`, and `pnpm build`,
then generates a reviewable evidence pack under `.forgedesk/evidence/`.

The goal is not to prove the code is perfect. The goal is to make the change
intent, changed files, test evidence, and remaining risks easy to inspect.

## Commands

```bash
forgedesk init --repo .
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
- Records change intent, decisions, risks, and tests.
- Generates a Markdown evidence pack for PRs, reviews, releases, or AI handoff.

## What ForgeDesk Does Not Do

- It does not write code.
- It does not review code for you.
- It does not call an AI provider by default.
- It does not commit, push, open PRs, or publish releases.
- It does not upload your project.

See [docs/boundaries.md](docs/boundaries.md) for the v0.1 boundary contract.
See [docs/commands.md](docs/commands.md) for all CLI commands and side effects.
See [docs/reviewer-guide.md](docs/reviewer-guide.md) for how to inspect an
evidence pack.
See [docs/local-workflow.md](docs/local-workflow.md) for a local demo workflow.
See [docs/troubleshooting.md](docs/troubleshooting.md) for common local errors
and fixes.
See [docs/roadmap.md](docs/roadmap.md) for the long-term planning reference.
See [CHANGELOG.md](CHANGELOG.md) for local source version notes.

## Project Status

ForgeDesk v0.1.4 is prepared as a source-available local CLI MVP. It is not
published to npm.

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm smoke
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
```
