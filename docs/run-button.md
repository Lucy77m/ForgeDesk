# Run Button Workflow

ForgeDesk v0.3 centers the local workflow on one repeated action:

```bash
forgedesk next
```

`next` is a local run button. It advances one safe ForgeDesk step at a time and
then tells you what to do next.

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

## Supporting Buttons

These commands support the run-button path:

```bash
forgedesk doctor
forgedesk fix-context
forgedesk review-context
forgedesk pr
forgedesk handoff
forgedesk inspect --export
```

- `doctor` explains local project, session, evidence, and verification state.
- `fix-context` packages failed-test context without modifying code.
- `review-context` prints the generated reviewer context.
- `pr` prints the generated PR body.
- `handoff` prints a compact local handoff summary.
- `inspect --export` verifies the exported evidence files.

## Typical Loop

```bash
forgedesk next --dry-run
forgedesk next
forgedesk test -- npm test
forgedesk next
forgedesk next
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
