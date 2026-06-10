# Troubleshooting

This page covers common local ForgeDesk errors and the shortest useful fix.

ForgeDesk v0.1 is local-only. These commands do not require an AI provider,
cloud sync, GitHub write access, or npm publishing.

## Cannot Find A ForgeDesk Project

Error:

```text
Could not find a ForgeDesk project
```

Run ForgeDesk from a repository that has already been initialized:

```bash
forgedesk init --repo .
```

If you are inside a subdirectory, either run the command from the repository
root or pass the intended repository path to `init`.

## Not A Git Repository

Error:

```text
not a git repository
```

ForgeDesk needs a local git repository so it can capture branch, HEAD, status,
changed files, and recent commits. Initialize git first:

```bash
git init
forgedesk init --repo .
```

## No Active Change Session

Error:

```text
No active change session
```

Start or reopen a session:

```bash
forgedesk start --title "Describe the change"
```

For an existing done or archived session:

```bash
forgedesk reopen --session <id>
```

Use `forgedesk sessions --all` when you do not know the session id.

## Evidence Has Not Been Generated

Error:

```text
Evidence has not been generated
```

Generate an evidence pack before running `ready`, `handoff`, `export`, or
`inspect` workflows that expect output files:

```bash
forgedesk evidence
```

Then check it:

```bash
forgedesk inspect
```

## Export Directory Was Not Found

Error:

```text
Cannot inspect because export directory was not found
```

`forgedesk inspect --export` checks the default local export directory. Create
it first:

```bash
forgedesk export
forgedesk inspect --export
```

## Missing Evidence Files

If `forgedesk inspect` reports missing files, regenerate the evidence pack:

```bash
forgedesk evidence
forgedesk inspect
```

If `forgedesk inspect --export` reports missing files, recreate the export:

```bash
forgedesk export
forgedesk inspect --export
```

## Metadata Is Invalid Or Corrupted

Errors like these mean a local `.forgedesk/*.json` file is malformed or does
not match the current v0.1 schema:

```text
Could not read ForgeDesk project metadata
Invalid ForgeDesk session metadata
schemaVersion must be forgedesk-session-v1
```

First run:

```bash
forgedesk doctor
```

If the error names `project.json` or `config.json`, the safest recovery is often
to move the broken `.forgedesk/` directory aside and reinitialize the repository:

```bash
forgedesk init --repo .
```

If the error names one file under `.forgedesk/sessions/`, inspect that session
file locally. Do not paste private project details, secrets, or token-like
values into external tools while debugging metadata.

## Ready Says No

`forgedesk ready` is an evidence completeness check, not a correctness verdict.
It can fail when intent, test evidence, manual checks, generated evidence, or
the git snapshot are missing.

Check the blockers:

```bash
forgedesk ready
```

Then add the missing local evidence, for example:

```bash
forgedesk intent "Explain the change."
forgedesk check "Reviewed the generated evidence files."
forgedesk test -- npm test
forgedesk evidence
```

Warnings do not necessarily block local handoff, but they should be read before
treating a session as ready.

## Test Command Did Not Run As Expected

Use `--command` only to record a command without running it:

```bash
forgedesk test --command "npm test"
```

Use `--` to run a command and capture its exit code and log:

```bash
forgedesk test -- npm test
```

Full command output is written under `.forgedesk/logs/`.

## Local Smoke Check

After building ForgeDesk, run the local smoke workflow:

```bash
pnpm build
pnpm smoke
```

The smoke script creates a temporary git repository, runs the compiled CLI
through the evidence, readiness, handoff, export, and inspect flow, then removes
the temporary repository. It does not push, publish, tag, or upload anything.
