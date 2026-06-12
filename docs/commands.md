# Command Reference

ForgeDesk commands are local-first. They read and write only local files under
the target repository unless a command explicitly runs a test process.

## Recommended Workflow

```bash
forgedesk next
```

`next` is the primary run button for local auto-capture and handoff prep. It
advances one safe local step at a time. Manual commands remain available for
advanced control:

```bash
forgedesk init --repo .
forgedesk next
forgedesk start --title "Describe the change"
forgedesk intent "Record the user-facing goal."
forgedesk decision "Record an implementation decision."
forgedesk risk "Record a risk or review focus."
forgedesk check "Record a manual verification check."
forgedesk test -- npm test
forgedesk evidence
forgedesk review-context
forgedesk pr
forgedesk ready
forgedesk handoff
forgedesk export
forgedesk inspect --export
```

## Run Button

| Command | Purpose | Writes local data |
|---|---|---|
| `forgedesk next` | Run the next safe local ForgeDesk step. | yes |
| `forgedesk next --json` | Print the next-step report as JSON. | yes |

`next` may auto-capture local changes, generate evidence, check readiness, or
export a ready evidence pack. It does not run tests, call an AI provider, modify
product code, commit, push, open PRs, tag, release, publish, or run in the
background.

## Auto Capture

| Command | Purpose | Writes local data |
|---|---|---|
| `forgedesk auto --no-run` | Capture the current local git change and generate pre-review material without running checks. | yes |
| `forgedesk auto --title "..." --no-run` | Override the generated session title. | yes |
| `forgedesk auto --json --no-run` | Print the auto-capture report as JSON. | yes |

Auto capture may initialize `.forgedesk/` in a git repository, create or reuse a
session, generate draft intent, derive local risk hints, and write review-ready
files. It does not review code, call an AI provider, commit, push, open PRs, tag,
release, or publish.

## Session Setup

| Command | Purpose | Writes local data |
|---|---|---|
| `forgedesk init --repo .` | Create `.forgedesk/` metadata in a git repo. | yes |
| `forgedesk start --title "..."` | Start a new active change session. | yes |
| `forgedesk sessions` | List local sessions, excluding archived sessions by default. | no |
| `forgedesk sessions --all` | List every local session. | no |
| `forgedesk sessions --status <status>` | Filter sessions by `active`, `needs-review`, `done`, or `archived`. | no |
| `forgedesk show` | Show the active session. | no |
| `forgedesk show --session <id>` | Show one session by id. | no |

## Recording Evidence

| Command | Purpose | Writes local data |
|---|---|---|
| `forgedesk intent "..."` | Record or replace the active session intent. | yes |
| `forgedesk decision "..."` | Append an implementation decision. | yes |
| `forgedesk risk "..."` | Append a risk or review focus. | yes |
| `forgedesk risk "..." --severity low` | Append a risk with `low`, `medium`, or `high` severity. | yes |
| `forgedesk check "..."` | Append a manual verification check. | yes |
| `forgedesk test --command "npm test"` | Record a test command without running it. | yes |
| `forgedesk test -- npm test` | Run a command, capture result, and write a log under `.forgedesk/logs/`. | yes |

## Evidence Pack

| Command | Purpose | Writes local data |
|---|---|---|
| `forgedesk evidence` | Generate evidence files for the active session. | yes |
| `forgedesk evidence --session <id>` | Generate evidence for a specific session. | yes |
| `forgedesk evidence --output-dir <dir>` | Generate evidence into a chosen local directory. | yes |
| `forgedesk evidence --latest` | Show the latest generated evidence pack. | no |
| `forgedesk evidence --list` | List sessions that have evidence paths. | no |

Generating evidence marks the target session as `needs-review`.

Generated evidence includes:

```text
SUMMARY.md
PR_BODY.md
REVIEW_CONTEXT.md
TEST_EVIDENCE.md
PR_EVIDENCE.md
CHANGE_SUMMARY.md
TEST_RESULTS.md
REVIEW_PROMPT.md
evidence.json
```

## Review And Handoff

| Command | Purpose | Writes local data |
|---|---|---|
| `forgedesk status` | Show current project, git, and active session readiness. | no |
| `forgedesk doctor` | Check ForgeDesk metadata, sessions, and evidence file integrity. | no |
| `forgedesk doctor --json` | Print the doctor report as JSON. | no |
| `forgedesk ready` | Check whether the active session has enough evidence for handoff. | no |
| `forgedesk ready --session <id>` | Check readiness for a specific session. | no |
| `forgedesk ready --json` | Print the readiness report as JSON. | no |
| `forgedesk handoff` | Print a compact handoff summary for the active session. | no |
| `forgedesk handoff --session <id>` | Print a handoff summary for one session. | no |
| `forgedesk handoff --json` | Print the handoff report as JSON. | no |
| `forgedesk review-context` | Print `REVIEW_CONTEXT.md` for the active session. | no |
| `forgedesk review-context --session <id>` | Print `REVIEW_CONTEXT.md` for a specific session. | no |
| `forgedesk review-context --copy` | Copy `REVIEW_CONTEXT.md` to the system clipboard. | no |
| `forgedesk pr` | Print `PR_BODY.md` for the active session. | no |
| `forgedesk pr --session <id>` | Print `PR_BODY.md` for a specific session. | no |
| `forgedesk pr --copy` | Copy `PR_BODY.md` to the system clipboard. | no |
| `forgedesk inspect` | Check expected evidence files and file sizes. | no |
| `forgedesk inspect --session <id>` | Inspect a specific session's evidence files. | no |
| `forgedesk inspect --export` | Inspect the default export directory for the session. | no |
| `forgedesk inspect --json` | Print the inspect report as JSON. | no |

`review-context` and `pr` read existing evidence; they do not generate it. With
`--copy`, they attempt to use the local system clipboard and fail clearly if no
clipboard command is available.

`ready`, `handoff`, `review-context`, `pr`, and `inspect` do not decide whether
the code is correct. They only organize local evidence for human review.

## Export

| Command | Purpose | Writes local data |
|---|---|---|
| `forgedesk export` | Copy an existing evidence pack plus `HANDOFF.md` to `.forgedesk/exports/<session-id>`. | yes |
| `forgedesk export --session <id>` | Export evidence for a specific session. | yes |
| `forgedesk export --output-dir <dir>` | Export to a chosen local directory. | yes |
| `forgedesk export --json` | Print the export report as JSON. | yes |

Export copies local files only. It does not upload, publish, compress, or
regenerate evidence.

## Session Lifecycle

| Command | Purpose | Writes local data |
|---|---|---|
| `forgedesk done` | Mark the active session as done. | yes |
| `forgedesk archive --session <id>` | Archive a session. | yes |
| `forgedesk reopen --session <id>` | Reopen a done or archived session and make it active. | yes |

`done` means the local evidence workflow is complete. It is not a correctness,
merge, release, or publication verdict.
