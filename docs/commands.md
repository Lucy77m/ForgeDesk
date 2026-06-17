# Command Reference

ForgeDesk commands are local-first. They read and write only local files under
the target repository unless a command explicitly runs a test process.

## Recommended Workflow

```bash
forgedesk setup
forgedesk next --dry-run
forgedesk next
```

`next` is the primary run button for local auto-capture and handoff prep. It
advances one safe local step at a time. Manual commands remain available for
advanced control:

```bash
forgedesk init --repo .
forgedesk setup
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
forgedesk fix-context
forgedesk open export
forgedesk ready
forgedesk handoff
forgedesk export
forgedesk inspect --export
```

## Run Button

| Command | Purpose | Writes local data |
|---|---|---|
| `forgedesk next` | Run the next safe local ForgeDesk step. | yes |
| `forgedesk next --dry-run` | Preview the next safe local step without writing files. | no |
| `forgedesk next --json` | Print the next-step report as JSON. | yes |

`next` may auto-capture local changes, generate evidence, check readiness, or
export a ready evidence pack. It does not run tests, call an AI provider, modify
product code, commit, push, open PRs, tag, release, publish, or run in the
background.

When evidence exists, `next` compares the current local diff fingerprint with
the fingerprint recorded in the evidence pack. If the code changed since
evidence generation, `next` refreshes evidence before export instead of handing
off a stale pack. JSON reports include `evidenceFresh` when this freshness check
is relevant.

Use `next --dry-run` as a button preview before running the step. It reports the
same planned action without changing `.forgedesk/`.

The human-readable `next` output includes a short summary, blockers, warnings,
recommended next steps, and a `Commands` section with copyable local commands.
When failed tests block export, `next` points to `forgedesk fix-context` before
asking you to run the button again.

`next --json` includes `reason` and `recommendation` fields. The reason is a
stable local state label such as `dirty-no-session`, `missing-evidence`,
`stale-evidence`, `missing-tests`, `failed-tests`, `ready-to-export`, or
`exported`; the recommendation is the single next step ForgeDesk would put in
front of a human.

See [run-button.md](run-button.md) for the focused v0.3 workflow guide.

## Setup

| Command | Purpose | Writes local data |
|---|---|---|
| `forgedesk setup` | Initialize ForgeDesk if needed and repair safe local entry points. | yes |
| `forgedesk setup --mode <mode>` | Set the local auto profile during setup. | yes |
| `forgedesk setup --test-tasks` | Also install discovered package test tasks. | yes |
| `forgedesk setup --package-scripts` | Also install ForgeDesk package scripts. | yes |
| `forgedesk setup --ignition` | Also install the folder-open watch task. | yes |
| `forgedesk setup --hooks` | Also install ForgeDesk-managed git hooks. | yes |
| `forgedesk setup --json` | Print the setup report as JSON. | yes |

`setup` is the first-run local setup button. By default it initializes
ForgeDesk in a git repo when needed, sets `assist` mode, refreshes `NOW.md`,
and repairs safe editor shortcuts.

Hooks and ignition are stronger local automation entry points, so setup only
installs them when `--hooks` or `--ignition` is explicitly passed.

## Auto Profile

| Command | Purpose | Writes local data |
|---|---|---|
| `forgedesk auto-config` | Show the local automation profile. | no |
| `forgedesk auto-config show` | Show the local automation profile. | no |
| `forgedesk auto-config set <mode>` | Set the local automation profile. | yes |
| `forgedesk auto-config --json` | Print the auto-profile report as JSON. | no |

If `.forgedesk/auto.json` does not exist, ForgeDesk reports the default
`manual` profile without writing a file.

Modes:

- `manual`: ForgeDesk only moves when a command is run.
- `assist`: local automation may suggest the next step but should not write new evidence automatically.
- `local-auto`: explicit local automation may refresh ForgeDesk evidence and exports.
- `guarded`: local gates may block git actions when evidence is missing, stale, or not ready.

`auto-config set` writes `.forgedesk/auto.json`. It does not call AI, edit
product code, run tests, commit, push, open PRs, tag, release, publish, upload,
or start a hidden background service.

## Git Hooks

| Command | Purpose | Writes local data |
|---|---|---|
| `forgedesk hooks status` | Show whether ForgeDesk-managed git hooks are installed. | no |
| `forgedesk hooks install` | Install ForgeDesk-managed `pre-commit` and `pre-push` hooks. | yes |
| `forgedesk hooks uninstall` | Remove ForgeDesk-managed hooks. | yes |
| `forgedesk hooks run <hook>` | Run one hook check; used by installed hooks. | maybe |

Hooks are installed only in the current repository under `.git/hooks/`.
ForgeDesk refuses to overwrite hooks it does not manage. Remove or merge custom
hooks manually, then run `forgedesk hooks install` again.

Hook behavior follows `forgedesk auto-config`:

- `manual`: installed hooks stay idle and pass.
- `assist`: hooks warn and pass.
- `local-auto`: hooks may run one safe `forgedesk next` step, writing only local ForgeDesk evidence/export files.
- `guarded`: hooks may block git commit or push when evidence is missing, stale, or not ready.

Hooks do not call AI, edit product code, run tests, commit, push, open PRs, tag,
release, publish, upload, or run as a hidden background service.

## Watch

| Command | Purpose | Writes local data |
|---|---|---|
| `forgedesk watch` | Run foreground local watch mode until stopped. | depends on auto mode |
| `forgedesk watch --once` | Evaluate watch mode once and exit. | depends on auto mode |
| `forgedesk watch --interval <ms>` | Set the polling interval; minimum 500 ms. | depends on auto mode |
| `forgedesk watch --quiet` | Print compact human-readable watch output. | depends on auto mode |
| `forgedesk watch --json` | Print watch reports as JSON. | depends on auto mode |

Watch mode is a foreground process. It does not install a daemon, cron job, or
system service. Press `Ctrl+C` to stop it.

Watch behavior follows `forgedesk auto-config`:

- `manual`: watch stays idle.
- `assist`: watch previews the next local step without writing files.
- `local-auto`: watch may run one safe `forgedesk next` step per observed state change.
- `guarded`: watch reports blockers without writing files.

Use `watch --once` for scripts, tests, or a one-shot no-loop check.
Use `watch --quiet` when watch is running as an editor task and you only want a
compact status line when the local state changes. JSON output remains full
fidelity.

## Ignition

| Command | Purpose | Writes local data |
|---|---|---|
| `forgedesk ignition status` | Show whether the folder-open watch task is installed. | no |
| `forgedesk ignition install` | Install a ForgeDesk-managed folder-open watch task. | yes |
| `forgedesk ignition uninstall` | Remove the ForgeDesk-managed ignition task. | yes |

Ignition writes a VS Code/Cursor-compatible task named `ForgeDesk: Ignition
Watch` with `runOptions.runOn = folderOpen`. Editors may ask you to allow
automatic tasks for the folder before it runs.

Ignition refuses to overwrite a task with the same label unless ForgeDesk
created it. It starts `forgedesk watch --quiet` as an explicit editor task; it does not
install a daemon, cron job, system service, AI reviewer, code fixer, committer,
pusher, PR opener, publisher, uploader, or cloud sync process.

## NOW

| Command | Purpose | Writes local data |
|---|---|---|
| `forgedesk now` | Refresh and print `.forgedesk/NOW.md`. | yes |
| `forgedesk now --json` | Refresh `NOW.md` and print the structured report. | yes |

`NOW.md` is the fixed local status entry for the current repository. It includes
the current session, auto mode, readiness state, evidence/export paths,
blockers, warnings, and next suggested action.

`next`, `doctor`, `watch --once`, and `ci check` also refresh `NOW.md` when
possible. `NOW.md` is local status, not a review verdict.

## Open

| Command | Purpose | Writes local data |
|---|---|---|
| `forgedesk open` | Open `.forgedesk/NOW.md`. | no |
| `forgedesk open now` | Open `.forgedesk/NOW.md`. | no |
| `forgedesk open evidence` | Open the active session evidence directory. | no |
| `forgedesk open export` | Open the active session export directory. | no |
| `forgedesk open review-context` | Open `REVIEW_CONTEXT.md` for the active session. | no |
| `forgedesk open pr` | Open `PR_BODY.md` for the active session. | no |

`open` uses the local system opener: Windows `start`, macOS `open`, and Linux
`xdg-open`. It only opens existing local ForgeDesk files or directories. If
the target has not been generated or exported yet, it fails clearly instead of
pretending the open succeeded.

## Episodes

| Command | Purpose | Writes local data |
|---|---|---|
| `forgedesk episodes status` | Show the active local work episode phase. | no |
| `forgedesk episodes status --json` | Print the episode status report as JSON. | no |

An episode is ForgeDesk's local summary of the current work segment around the
active session. It may report phases such as `needs-evidence`,
`stale-evidence`, `needs-verification`, `failed-tests`, `ready`, `exported`, or
`done`, then point to the next local command.

Episodes do not add a task board, timeline, review verdict, or new evidence
schema. They summarize existing local session, git, evidence, readiness, and
export state.

## Repair

| Command | Purpose | Writes local data |
|---|---|---|
| `forgedesk repair` | Refresh NOW and repair safe ForgeDesk editor shortcuts. | yes |
| `forgedesk repair --test-tasks` | Also repair discovered package test tasks. | yes |
| `forgedesk repair --package-scripts` | Also repair ForgeDesk package scripts. | yes |
| `forgedesk repair --json` | Print the repair report as JSON. | yes |

Repair checks auto profile, NOW, shortcuts, ignition, and hooks in one pass.
By default it only refreshes `NOW.md` and repairs explicit editor shortcuts.
It does not install hooks or ignition; it reports the explicit commands for
those stronger opt-ins.

## Shortcuts

| Command | Purpose | Writes local data |
|---|---|---|
| `forgedesk shortcuts status` | Show local editor shortcut status. | no |
| `forgedesk shortcuts status --test-tasks` | Include discovered package test task status. | no |
| `forgedesk shortcuts install` | Install ForgeDesk VS Code tasks. | yes |
| `forgedesk shortcuts install --package-scripts` | Also add ForgeDesk npm scripts when `package.json` exists. | yes |
| `forgedesk shortcuts install --test-tasks` | Also add discovered package test tasks. | yes |
| `forgedesk shortcuts uninstall` | Remove ForgeDesk-managed VS Code tasks. | yes |
| `forgedesk shortcuts uninstall --package-scripts` | Also remove ForgeDesk-managed package scripts. | yes |
| `forgedesk shortcuts uninstall --test-tasks` | Also remove ForgeDesk-managed package test tasks. | yes |

Installed VS Code tasks:

- `ForgeDesk: Next`
- `ForgeDesk: Next Preview`
- `ForgeDesk: Doctor`
- `ForgeDesk: Watch`
- `ForgeDesk: Inspect Export`

Optional package scripts:

- `forgedesk:next`
- `forgedesk:preview`
- `forgedesk:doctor`
- `forgedesk:watch`
- `forgedesk:inspect-export`

Optional test tasks are generated from common package scripts discovered by
`forgedesk tests discover`, such as `test`, `typecheck`, `build`, `lint`, and
`check`. They run through `forgedesk test -- <runner> run <script>` so the
explicit test result is captured in the active session.

ForgeDesk refuses to overwrite tasks or scripts it does not manage. Shortcuts
are local entry points for existing ForgeDesk commands; they do not call AI,
edit product code, commit, push, open PRs, tag, release, publish, upload, or
run as a hidden background service.

## Test Discovery

| Command | Purpose | Writes local data |
|---|---|---|
| `forgedesk tests discover` | Discover common package test scripts without running them. | no |
| `forgedesk tests discover --json` | Print the discovery report as JSON. | no |

Discovery reads the local `package.json` and reports common scripts that can be
used as explicit ForgeDesk test buttons. It does not execute scripts.

## CI Evidence Gate

| Command | Purpose | Writes local data |
|---|---|---|
| `forgedesk ci check` | Check active-session evidence for CI gating. | no |
| `forgedesk ci check --session <id>` | Check a specific session. | no |
| `forgedesk ci check --json` | Print the CI check report as JSON. | no |
| `forgedesk ci print` | Print a GitHub Actions evidence gate workflow. | no |
| `forgedesk ci init` | Write `.github/workflows/forgedesk-evidence.yml`. | yes |
| `forgedesk ci init --force` | Overwrite the generated workflow. | yes |

`ci check` verifies that evidence exists, expected evidence files are present,
and readiness passes. If the local worktree is dirty, it also checks whether
the evidence fingerprint is fresh for the current diff. In a clean checkout,
local diff freshness is reported as `skipped-clean-worktree` rather than
pretending to validate a PR diff.

The generated workflow installs ForgeDesk from npm and runs `forgedesk ci
check`. Review the workflow before committing it, especially while a GitHub
source release is newer than the npm package.

The CI gate does not call AI, upload repository contents, comment on PRs, review
code, edit code, commit, push, open PRs, tag, release, or publish.

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
| `forgedesk fix-context` | Print bounded context for fixing failed tests. | no |
| `forgedesk fix-context --session <id>` | Print fix context for a specific session. | no |
| `forgedesk fix-context --copy` | Copy fix context to the system clipboard. | no |
| `forgedesk context` | Generate a local AI-friendly context file at `.forgedesk/CONTEXT.md`. | yes |
| `forgedesk context --session <id>` | Generate context for a specific session. | yes |
| `forgedesk context --json` | Print the context report as JSON. | yes |
| `forgedesk inspect` | Check expected evidence files and file sizes. | no |
| `forgedesk inspect --session <id>` | Inspect a specific session's evidence files. | no |
| `forgedesk inspect --export` | Inspect the default export directory for the session. | no |
| `forgedesk inspect --json` | Print the inspect report as JSON. | no |

`doctor` checks local ForgeDesk metadata, session files, evidence file
integrity, the active session's verification state, and whether active evidence
matches the current local diff. Human-readable output includes `Evidence Score`,
`Recommended next`; JSON output includes `evidenceScore` and the same
`recommendation` field. Older evidence
packs created by previous ForgeDesk versions are summarized as historical
warnings when they are not the active session.

`review-context`, `pr`, and `fix-context` read existing local session data; they
do not generate evidence or fix code. With `--copy`, they attempt to use the
local system clipboard and fail clearly if no clipboard command is available.

Generated `PR_BODY.md` and `REVIEW_CONTEXT.md` include reviewer checklist and
known-limits sections so the material can be pasted or handed off with less
manual rearranging. `handoff` and exported `HANDOFF.md` include a suggested
review order plus local commands for reopening the same session context.

`ready`, `handoff`, `review-context`, `pr`, `fix-context`, and `inspect` do not
decide whether the code is correct. They only organize local evidence for human
review.

## Export

| Command | Purpose | Writes local data |
|---|---|---|
| `forgedesk export` | Copy an existing evidence pack plus `HANDOFF.md` to `.forgedesk/exports/<session-id>`. | yes |
| `forgedesk export --session <id>` | Export evidence for a specific session. | yes |
| `forgedesk export --output-dir <dir>` | Export to a chosen local directory. | yes |
| `forgedesk export --json` | Print the export report as JSON. | yes |

Export copies local files only. It does not upload, publish, compress, or
regenerate evidence.

## Risk Rules

ForgeDesk includes built-in risk rules that detect common change patterns such
as auth, payment, config, database, CI, package metadata, deleted files, and
large changes.

You can add custom rules by creating `.forgedesk/rules.json`:

```json
{
  "schemaVersion": "forgedesk-rules-v1",
  "rules": [
    {
      "name": "internal-api",
      "pattern": "(^|/)internal/api/",
      "message": "Internal API files changed. Review backward compatibility.",
      "severity": "high",
      "confidence": "medium"
    }
  ]
}
```

Each rule requires `name`, `pattern` (regex), `message`, `severity`, and
`confidence`. Add `"enabled": false` to disable a rule. Custom rules are merged
with built-in rules; same-name custom rules override the built-in version.

If `rules.json` is missing or invalid, ForgeDesk silently falls back to built-in
rules only. `forgedesk doctor` reports whether `rules.json` was found.

Risk rules do not call AI, edit product code, commit, push, open PRs, tag,
release, publish, upload, or run in the background.

## Session Lifecycle

| Command | Purpose | Writes local data |
|---|---|---|
| `forgedesk done` | Mark the active session as done. | yes |
| `forgedesk archive --session <id>` | Archive a session. | yes |
| `forgedesk reopen --session <id>` | Reopen a done or archived session and make it active. | yes |

`done` means the local evidence workflow is complete. It is not a correctness,
merge, release, or publication verdict.
