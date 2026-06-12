# ForgeDesk Boundaries

ForgeDesk is a local auto-capture layer for AI-assisted code changes.

It helps a developer turn local git changes into review-ready material:
summary, PR body, test evidence, risk hints, review context, failed-test fix
context, and an inspectable evidence pack.

## What ForgeDesk Does

- Reads local git status, branch, HEAD, changed files, and recent commits.
- Stores ForgeDesk project/session metadata locally under `.forgedesk/`.
- Auto-captures local change context with `forgedesk auto`.
- Generates draft intent, summaries, PR body, review context, and risk hints.
- Records change intent, decisions, risks, manual checks, and test evidence.
- Runs test commands only when the user explicitly invokes `forgedesk test --`.
- Packages bounded fix context for failed tests.
- Generates local Markdown and JSON evidence files.

## What ForgeDesk Does Not Do

- It does not write or modify product code for the user.
- It does not judge whether code is correct.
- It does not act as an AI code reviewer, PR review bot, bug finder, or security scanner.
- It does not call AI providers.
- It does not store API keys or credentials.
- It does not upload repository contents.
- It does not commit, push, open PRs, tag releases, or publish packages.
- It does not run background automation.
- It does not provide a dashboard, task board, timeline, or team permission system.

## Evidence Is Not Review

ForgeDesk evidence and risk hints are review input, not review verdicts.

The evidence pack should help a maintainer or future AI window answer:

- What was the intended change?
- What files changed?
- What decisions and risks were recorded?
- What tests were recorded or executed?
- What remains unverified?

The final judgment still belongs to the developer or reviewer.

## Automation Boundary

ForgeDesk may automatically capture, summarize, and package local context. It
must mark generated or rule-derived material honestly and avoid correctness
claims.

ForgeDesk must not automatically perform irreversible project actions such as
commit, push, pull request creation, merge, tag, release, or package publish.
