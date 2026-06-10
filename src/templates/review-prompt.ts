import type { EvidenceBundle } from '../types.js'
import { changedFileCount, listOrNone, notVerified, renderChangedFiles, reviewReadiness } from './format.js'

export function renderReviewPrompt(bundle: EvidenceBundle): string {
  const { session, gitSnapshot } = bundle

  return `# Review Prompt

You are reviewing one AI-assisted code change.

## Goal

${session.intent || session.title}

## Review Scope

Only review the files and behavior related to this change.

## Evidence

- Branch: ${gitSnapshot.branch}
- HEAD: ${gitSnapshot.head}
- Changed files: ${changedFileCount(gitSnapshot)}

## Review Readiness

${listOrNone(reviewReadiness(session))}

## Files

${renderChangedFiles(gitSnapshot)}

## Please Check

- Does the diff match the stated intent?
- Are there unexpected file changes?
- Are the tests relevant?
- Are unverified risks clearly listed?
- Do not expand into unrelated refactors.

## Not Verified

${listOrNone(notVerified(session), 'No known gaps recorded.')}
`
}
