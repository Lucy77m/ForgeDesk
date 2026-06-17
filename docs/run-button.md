# Run Button Workflow

ForgeDesk v0.3 centers the local workflow on one repeated action:

```bash
forgedesk setup
forgedesk next
```

`next` is a local run button. It advances one safe ForgeDesk step at a time and
then tells you what to do next.

`setup` is the first-run button. It initializes the local ForgeDesk workspace,
sets safe advisory `assist` mode, refreshes `NOW.md`, and repairs editor
shortcuts.

Opt into stronger local entry points explicitly:

```bash
forgedesk setup --test-tasks
forgedesk setup --ignition
forgedesk setup --hooks
```

## What The Button Does

Depending on the current repository and session state, `forgedesk next` may:

- auto-capture a dirty git diff into a ForgeDesk session;
- generate or refresh evidence for the active session;
- stop on readiness blockers and point to the next useful local command;
- export a ready evidence pack.

Use `forgedesk next --dry-run` when you want to preview the next action without
writing `.forgedesk/` files.

## Auto Profile

`forgedesk auto-config` shows the repository's local automation profile.

```bash
forgedesk auto-config
forgedesk auto-config set assist
```

The default profile is `manual`, which preserves direct command-driven
behavior. Local automation surfaces such as git hooks, foreground watch mode,
and CI evidence gates use this profile as their safety boundary.

Profiles remain local and explicit. They do not enable AI calls, product-code
edits, automatic commits, pushes, PRs, tags, releases, publishes, uploads, or
hidden background services.

## Git Hooks

`forgedesk hooks install` adds ForgeDesk-managed `pre-commit` and `pre-push`
hooks to the current repository.

```bash
forgedesk auto-config set assist
forgedesk hooks install
forgedesk hooks status
```

The recommended first hook mode is `assist`: it warns without blocking. Use
`local-auto` only when you want hooks to run one safe local `next` step, and use
`guarded` only when you want evidence problems to block commit or push.

ForgeDesk refuses to overwrite hooks it does not manage. Remove hooks with:

```bash
forgedesk hooks uninstall
```

## Foreground Watch

`forgedesk watch` keeps the run button open in the foreground.

```bash
forgedesk auto-config set assist
forgedesk watch
forgedesk watch --quiet
```

Use `assist` when you want watch to explain the next step without writing files.
Use `local-auto` when you want it to run one safe local `next` step as state
changes. Use `guarded` when you want the watch output to make blockers obvious
without modifying `.forgedesk/`.

Use `watch --quiet` for editor tasks or side terminals where a compact status
line is enough.

`watch` is not a daemon. It runs in the terminal you started, and `Ctrl+C` stops
it. For a one-shot check:

```bash
forgedesk watch --once
```

## Ignition

`forgedesk ignition install` creates a folder-open task that starts
`forgedesk watch --quiet` when the project opens in VS Code or Cursor.

```bash
forgedesk ignition install
forgedesk ignition status
```

The editor may ask you to allow automatic tasks for the folder. ForgeDesk does
not bypass that prompt.

Remove ignition with:

```bash
forgedesk ignition uninstall
```

## NOW.md

`forgedesk now` refreshes `.forgedesk/NOW.md`, the fixed local status entry for
humans and future AI windows.

```bash
forgedesk now
```

`NOW.md` records the active session, auto mode, readiness state, evidence and
export paths, blockers, warnings, and the next suggested action. It is refreshed
by `next`, `doctor`, `watch --once`, and `ci check` when possible.

## Episodes

`forgedesk episodes status` names the current local work segment phase.

```bash
forgedesk episodes status
```

Episodes sit on top of existing sessions and evidence. They are meant to answer
"where am I in this change?" with phases like `needs-evidence`,
`needs-verification`, `ready`, or `exported`.

## Repair

`forgedesk repair` is the local setup repair button.

```bash
forgedesk repair
```

It refreshes `NOW.md`, repairs safe ForgeDesk editor shortcuts, and reports
whether hooks or ignition need explicit setup. It does not install hooks or
folder-open ignition by default.

## Editor Shortcuts

`forgedesk shortcuts install` creates VS Code tasks so the most common
ForgeDesk buttons can be clicked from the editor.

```bash
forgedesk shortcuts install
```

The generated tasks are:

- `ForgeDesk: Next`
- `ForgeDesk: Next Preview`
- `ForgeDesk: Doctor`
- `ForgeDesk: Watch`
- `ForgeDesk: Inspect Export`

Package scripts are opt-in:

```bash
forgedesk shortcuts install --package-scripts
```

Test buttons are also opt-in:

```bash
forgedesk tests discover
forgedesk shortcuts install --test-tasks
```

ForgeDesk discovers common package scripts such as `test`, `typecheck`,
`build`, `lint`, and `check`. Generated test tasks run through
`forgedesk test -- <runner> run <script>` so the result is recorded in the
active session when you click the button.

ForgeDesk only removes shortcuts that it generated:

```bash
forgedesk shortcuts uninstall
forgedesk shortcuts uninstall --package-scripts
forgedesk shortcuts uninstall --test-tasks
```

## CI Evidence Gate

`forgedesk ci check` turns the same local evidence rules into a CI-friendly
gate.

```bash
forgedesk ci check
forgedesk ci print
forgedesk ci init
```

The generated workflow is optional. It is meant for repositories that want CI
to fail when ForgeDesk evidence is missing or not ready. Review the workflow
before committing it.

In a dirty local worktree, `ci check` also checks evidence freshness for the
current diff. In a clean CI checkout, freshness is reported as
`skipped-clean-worktree` because ForgeDesk is not claiming to reconstruct the PR
diff fingerprint.

## Supporting Buttons

These commands support the run-button path:

```bash
forgedesk doctor
forgedesk episodes status
forgedesk repair
forgedesk fix-context
forgedesk open
forgedesk open export
forgedesk review-context
forgedesk pr
forgedesk handoff
forgedesk inspect --export
```

- `doctor` explains local project, session, evidence, and verification state.
- `fix-context` packages failed-test context without modifying code.
- `open` opens existing local ForgeDesk files or directories such as `NOW.md`,
  evidence, export, review context, and PR body.
- `review-context` prints the generated reviewer context.
- `pr` prints the generated PR body.
- `handoff` prints a compact local handoff summary.
- `inspect --export` verifies the exported evidence files.

## Typical Loop

```bash
forgedesk setup --test-tasks
forgedesk next --dry-run
forgedesk next
forgedesk test -- npm test
forgedesk next
forgedesk next
forgedesk open export
forgedesk inspect --export
```

If tests fail:

```bash
forgedesk fix-context
```

Then fix the code yourself, rerun the relevant test command, and press the
button again:

```bash
forgedesk test -- npm test
forgedesk next
```

## Boundary

The run button does not call AI, edit product code, run tests unless you
explicitly use `forgedesk test --`, commit, push, open PRs, tag, release,
publish, upload, or run as a hidden background service.

ForgeDesk organizes local evidence. It does not decide whether the code is
correct.
