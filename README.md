# ForgeDesk

ForgeDesk is a local evidence desk for AI-assisted code changes.

AI coding tools can write code fast, but the resulting changes are often hard to review:
What was the intent? What files changed? What tests ran? What risks remain?

ForgeDesk helps you turn a local git diff into a reviewable evidence pack.

## Quick Start

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
├── PR_EVIDENCE.md
├── CHANGE_SUMMARY.md
├── TEST_RESULTS.md
├── REVIEW_PROMPT.md
└── evidence.json
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
forgedesk test --command "npm test"
forgedesk test -- npm test
forgedesk status
forgedesk evidence
```

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

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
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
