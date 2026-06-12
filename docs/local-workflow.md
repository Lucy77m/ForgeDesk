# Local Workflow

ForgeDesk v0.2 can be installed from npm or tried from a local checkout.

## Try ForgeDesk On A Demo Repository

Install ForgeDesk, or build it from a local checkout:

```bash
npm install -g forgedesk
```

For local source development:

```bash
pnpm install
pnpm build
```

Use `forgedesk` after npm install. From a local checkout, replace `forgedesk`
with `node dist/cli/index.js`.

Create or open another git repository, make a local change, then preview and run
the next local ForgeDesk step:

```bash
forgedesk next --dry-run
forgedesk next
```

Record the change evidence:

```bash
forgedesk intent "Explain what this change should accomplish."
forgedesk decision "Record a relevant implementation decision."
forgedesk risk "Record a review focus or remaining risk." --severity low
forgedesk check "Record a manual verification step."
forgedesk test --command "pnpm test"
forgedesk test -- pnpm test
```

Generate, check, and export the evidence with the run button:

```bash
forgedesk next
forgedesk next
forgedesk inspect --export
```

Use lifecycle commands when the local evidence workflow is complete:

```bash
forgedesk done
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
node dist/cli/index.js next --dry-run
node dist/cli/index.js next
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
- `SUMMARY.md`
- `REVIEW_CONTEXT.md`
- `PR_BODY.md`
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

Use `forgedesk fix-context` after failed tests to print bounded local context
for a repair pass. It packages failure evidence but does not fix code.

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
