# Local Workflow

ForgeDesk v0.1 is meant to be tried from a local checkout.

## Try ForgeDesk On A Demo Repository

Build ForgeDesk first:

```bash
pnpm install
pnpm build
```

Create or open another git repository, then run the compiled CLI:

```bash
node D:/ForgeDesk/dist/cli/index.js init --repo .
node D:/ForgeDesk/dist/cli/index.js start --title "Describe the change"
node D:/ForgeDesk/dist/cli/index.js intent "Explain what this change should accomplish."
node D:/ForgeDesk/dist/cli/index.js decision "Record a relevant implementation decision."
node D:/ForgeDesk/dist/cli/index.js risk "Record a review focus or remaining risk." --severity low
node D:/ForgeDesk/dist/cli/index.js check "Record a manual verification step."
node D:/ForgeDesk/dist/cli/index.js test --command "pnpm test"
node D:/ForgeDesk/dist/cli/index.js test -- pnpm test
node D:/ForgeDesk/dist/cli/index.js evidence
```

ForgeDesk writes local output under:

```text
.forgedesk/evidence/<session-id>/
```

## Try ForgeDesk On Itself

From this repository:

```bash
pnpm build
node dist/cli/index.js sessions
node dist/cli/index.js status
```

The `.forgedesk/` directory is intentionally ignored by git. It keeps local
dogfood sessions and evidence packs without publishing them by default.

## Review The Output

Start with:

- `PR_EVIDENCE.md`
- `TEST_RESULTS.md`
- `REVIEW_PROMPT.md`

Use the evidence to review scope, tests, manual checks, risks, and known gaps.
Do not treat it as proof that the change is correct.
