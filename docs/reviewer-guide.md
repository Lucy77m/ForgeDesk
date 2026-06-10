# Reviewer Guide

ForgeDesk evidence is meant to make an AI-assisted change easier to inspect.
It is not a substitute for code review.

## How To Read PR_EVIDENCE.md

Start with these sections:

1. `Intent`: what the change claims to do.
2. `Git Summary`: branch, HEAD, dirty state, and changed file count.
3. `Review Readiness`: a quick scan of intent, tests, decisions, risks, and known gaps.
4. `Files Changed`: the review scope.
5. `Tests`: what was run, what was only recorded, manual checks, and where logs are stored.
6. `Not Verified`: the explicit review gaps.

## What To Check

- Does the diff match the stated intent?
- Are changed files limited to the claimed scope?
- Are tests relevant to the change?
- Are manual checks concrete enough to be useful?
- Are failed or missing tests acknowledged?
- Are risks specific enough to guide review?
- Is anything important hidden outside the evidence pack?

## How To Use REVIEW_PROMPT.md

Use `REVIEW_PROMPT.md` when handing a change to another AI window or reviewer.
It narrows the task to one local change and asks the reviewer not to expand into
unrelated refactors.

## What Evidence Cannot Prove

Evidence can show what was recorded and executed. It cannot prove that the code
is correct, secure, complete, or ready to merge. The maintainer still owns the
final judgment.
