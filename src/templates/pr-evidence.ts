import type { EvidenceBundle } from '../types.js'
import {
  changedFileCount,
  executedTests,
  listOrNone,
  notVerified,
  recordedOnlyTests,
  renderChangedFiles,
  renderTestGroup,
  reviewReadiness
} from './format.js'

export function renderPrEvidence(bundle: EvidenceBundle): string {
  const { session, gitSnapshot } = bundle

  return `# PR Evidence

## Change

${session.title}

## Intent

${session.intent || 'Not recorded.'}

## Git Summary

- Branch: ${gitSnapshot.branch}
- HEAD: ${gitSnapshot.head}
- Dirty: ${gitSnapshot.isDirty ? 'yes' : 'no'}
- Changed files: ${changedFileCount(gitSnapshot)}

## Review Readiness

${listOrNone(reviewReadiness(session))}

## Files Changed

${renderChangedFiles(gitSnapshot)}

## Decisions

${listOrNone(session.decisions.map((decision) => decision.text))}

## Risks / Review Focus

${listOrNone(session.risks.map((risk) => `${risk.severity ? `[${risk.severity}] ` : ''}${risk.text}`))}

## Tests

### Executed Tests

${renderTestGroup(executedTests(session.tests))}

### Recorded Only

${renderTestGroup(recordedOnlyTests(session.tests))}

### Manual Checks

${listOrNone((session.manualChecks ?? []).map((check) => check.text))}

## Not Verified

${listOrNone(notVerified(session), 'No known gaps recorded.')}

## Suggested PR Description

${session.intent || session.title}
`
}
