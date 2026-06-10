# AGENTS.md

## Project Identity

ForgeDesk is a local evidence desk for AI-assisted code changes.

v0.1 focuses on Evidence Pack / PatchProof: turning a local git change
into reviewable Markdown evidence.

Do not expand v0.1 into a full local project dashboard.

## Source Of Truth

Before planning or editing, read:

- `ForgeDesk_v0.1_Evidence_First_Plan.md`

Use that file as the product boundary for v0.1.

## v0.1 Scope

Implement the CLI-first evidence workflow:

- initialize project metadata
- start a change session
- record intent
- record decisions
- record risks
- record or run tests
- read local git status, branch, HEAD, and changed files
- generate evidence pack files

Expected output shape:

- `PR_EVIDENCE.md`
- `CHANGE_SUMMARY.md`
- `TEST_RESULTS.md`
- `REVIEW_PROMPT.md`
- `evidence.json`

## Explicit Non-Goals

Do not add these to v0.1 unless the user explicitly changes scope:

- web dashboard
- task board
- timeline
- BaseBrief GUI
- AI provider calls
- API key storage
- automatic code writing
- automatic review verdicts
- automatic commit, push, PR, or release
- cloud sync or upload
- team permissions

## Implementation Preferences

Prefer a small TypeScript Node.js CLI.

Keep storage local and inspectable, using JSON and Markdown.

Keep abstractions thin until the first end-to-end evidence pack works.

Do not introduce React, database services, auth, or background automation for
v0.1.

## Verification

After changes, run the smallest relevant local verification available.

If package scripts do not exist yet, say that clearly instead of inventing them.

For CLI behavior, prefer testing with a temporary or demo git repo before
claiming the workflow works.
