# ForgeDesk Boundaries

ForgeDesk v0.1 is a local evidence desk for AI-assisted code changes.

It helps a developer explain and verify a local git change by recording intent,
decisions, risks, tests, and git status, then rendering a Markdown evidence
pack.

## What v0.1 Does

- Reads local git status, branch, HEAD, changed files, and recent commits.
- Stores ForgeDesk project/session metadata locally under `.forgedesk/`.
- Records change intent, decisions, risks, and test evidence.
- Runs test commands only when the user explicitly invokes `forgedesk test --`.
- Generates local Markdown and JSON evidence files.

## What v0.1 Does Not Do

- It does not write or modify product code for the user.
- It does not judge whether code is correct.
- It does not call AI providers.
- It does not store API keys or credentials.
- It does not upload repository contents.
- It does not commit, push, open PRs, tag releases, or publish packages.
- It does not run background automation.
- It does not provide a dashboard, task board, timeline, or team permission system.

## Evidence Is Not Review

ForgeDesk evidence is review input, not a review verdict.

The evidence pack should help a maintainer or future AI window answer:

- What was the intended change?
- What files changed?
- What decisions and risks were recorded?
- What tests were recorded or executed?
- What remains unverified?

The final judgment still belongs to the developer or reviewer.
