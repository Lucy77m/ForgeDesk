# AGENTS.md

## Project Identity

ForgeDesk is a setup-first local autopilot CLI for AI-assisted code changes.

The main workflow is:

- first-run button: `forgedesk setup`
- daily run button: `forgedesk next`
- status/readiness: `forgedesk now`, `forgedesk doctor`, `forgedesk episodes status`
- repair: `forgedesk repair`
- local automation surfaces: `hooks`, `watch`, `ignition`, `shortcuts`
- handoff exits: `review-context`, `pr`, `fix-context`, `handoff`, `export`, `inspect`, `open`, `context`

Do not expand ForgeDesk into a dashboard, hosted service, IDE extension, AI
reviewer, or project-management platform unless the user explicitly changes
scope.

## Source Of Truth

Before planning or editing, read:

- `docs/boundaries.md`
- `README.md`

For command behavior and side effects, also read:

- `docs/commands.md`
- `docs/run-button.md`

Use `docs/boundaries.md` as the product boundary for the current local-first
CLI direction. Earlier planning drafts are not repository source of truth.

## Current Scope

Implement small, explicit, local CLI features that reduce first-time and daily
workflow friction while preserving inspectable local JSON and Markdown output.

Core local workflow:

- initialize or repair local ForgeDesk metadata and editor shortcuts
- auto-capture local git changes when the user runs the command
- record intent, decisions, risks, checks, and tests
- read local git status, branch, HEAD, changed files, and recent commits
- generate and inspect evidence files
- package review, PR, failed-test, handoff, export, and open-file exits

## Explicit Non-Goals

Do not add these unless the user explicitly changes scope:

- AI provider calls
- API key storage
- automatic code writing or fixing
- automatic review verdicts
- automatic commit, push, PR, tag, release, or npm publish
- Web UI, dashboard, task board, or timeline
- cloud sync, upload, hosted service, accounts, or permissions
- background daemon, cron, or system service
- plugin system
- full IDE extension

## Implementation Preferences

Prefer a small TypeScript Node.js CLI.

Keep storage local and inspectable, using JSON and Markdown.

Keep abstractions thin and command behavior explicit.

Maintain existing local editor task surfaces such as shortcuts, ignition, VS
Code/Cursor tasks, and local open-file/open-folder helpers. Do not turn those
helpers into a full IDE extension.

Do not read, print, or modify `.env`, tokens, secrets, credentials, or API keys.

## Verification

After changes, run the smallest relevant local verification available.

For CLI behavior, prefer focused tests with a temporary git repo. When a
command would open an external app, use an injectable runner or dry path check
in tests so CI does not launch real applications.

If package scripts do not exist or a verification step cannot run, say that
clearly instead of inventing a result.
