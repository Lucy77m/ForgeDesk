# Local Workflow

ForgeDesk v0.1 is meant to be tried from a local checkout.

## Try ForgeDesk On A Demo Repository

Build ForgeDesk first:

```bash
pnpm install
pnpm build
```

Create or open another git repository, then initialize ForgeDesk:

```bash
node D:/ForgeDesk/dist/cli/index.js init --repo .
node D:/ForgeDesk/dist/cli/index.js start --title "Describe the change"
```

Record the change evidence:

```bash
node D:/ForgeDesk/dist/cli/index.js intent "Explain what this change should accomplish."
node D:/ForgeDesk/dist/cli/index.js decision "Record a relevant implementation decision."
node D:/ForgeDesk/dist/cli/index.js risk "Record a review focus or remaining risk." --severity low
node D:/ForgeDesk/dist/cli/index.js check "Record a manual verification step."
node D:/ForgeDesk/dist/cli/index.js test --command "pnpm test"
node D:/ForgeDesk/dist/cli/index.js test -- pnpm test
```

Generate, check, and export the evidence:

```bash
node D:/ForgeDesk/dist/cli/index.js evidence
node D:/ForgeDesk/dist/cli/index.js ready
node D:/ForgeDesk/dist/cli/index.js handoff
node D:/ForgeDesk/dist/cli/index.js export
node D:/ForgeDesk/dist/cli/index.js inspect
node D:/ForgeDesk/dist/cli/index.js inspect --export
```

Use lifecycle commands when the local evidence workflow is complete:

```bash
node D:/ForgeDesk/dist/cli/index.js done
```

ForgeDesk writes local output under:

```text
.forgedesk/evidence/<session-id>/
```

Generating evidence marks that session as `needs-review`, so `forgedesk ready`
and `forgedesk handoff` can treat it as prepared evidence rather than an active
draft.

## Try ForgeDesk On Itself

From this repository:

```bash
pnpm build
node dist/cli/index.js sessions
node dist/cli/index.js show
node dist/cli/index.js status
node dist/cli/index.js doctor
node dist/cli/index.js ready
node dist/cli/index.js handoff
node dist/cli/index.js export
node dist/cli/index.js inspect
node dist/cli/index.js evidence --list
```

The `.forgedesk/` directory is intentionally ignored by git. It keeps local
dogfood sessions and evidence packs without publishing them by default.

## Review The Output

Start with:

- `PR_EVIDENCE.md`
- `TEST_RESULTS.md`
- `REVIEW_PROMPT.md`
- `HANDOFF.md` if you ran `forgedesk export`

Use the evidence to review scope, tests, manual checks, risks, and known gaps.
Do not treat it as proof that the change is correct.

## Session Lifecycle

ForgeDesk sessions can move through a small local lifecycle:

```text
active -> needs-review -> done -> archived
```

Common commands:

```bash
node dist/cli/index.js sessions
node dist/cli/index.js show
node dist/cli/index.js show --session <id>
node dist/cli/index.js done
node dist/cli/index.js archive --session <id>
node dist/cli/index.js reopen --session <id>
```

`done` means the local evidence workflow is complete. It does not mean the code
is correct, reviewed, merged, released, or published.

## Local Health Check

Use `forgedesk doctor` to check whether ForgeDesk metadata, sessions, and
recorded evidence files are readable and internally linked. Use
`forgedesk doctor --json` when another local tool needs structured output.

Use `forgedesk ready` to check whether the active session has enough recorded
evidence for handoff. It reports blockers and warnings, but it is not a code
correctness, security, merge, or release verdict.

Use `forgedesk handoff` to print a compact local summary for a reviewer, PR
description, release note draft, or next AI window. It reads existing local
evidence and does not call an AI provider.

Use `forgedesk export` to copy the existing evidence pack and a generated
`HANDOFF.md` into `.forgedesk/exports/<session-id>` or a chosen local directory.
It does not upload, publish, compress, or regenerate evidence.

Use `forgedesk inspect` to check which expected evidence files exist and how
large they are. Use `forgedesk inspect --export` to inspect the default local
export directory for the active session.

## Local Smoke Check

After building ForgeDesk, run:

```bash
pnpm smoke
```

The smoke script creates a temporary git repository and runs the compiled CLI
through the evidence, readiness, handoff, export, and inspect flow. It removes
the temporary repository when it finishes and does not push, publish, tag, or
upload anything.

See `docs/troubleshooting.md` when a local workflow command fails.
